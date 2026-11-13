import AsyncStorage from "@react-native-async-storage/async-storage";
import { Alert } from "react-native";
import Toast from "react-native-toast-message";
import { clearTransactionId, store } from "@/store";
import { getFriendlyError } from "@/utils/api/core/friendlyError";
import {
	checkCanReapply,
	getUserDashboardData,
	getWorkflowProgress,
	reapplyForLoan,
	type ReapplyLoanResponse,
	type WorkflowProgressData,
} from "@/utils/api/services/user.service";
import { StepHref, type CanReapplyResponseType } from "@/utils/api/types/user.types";
import {
	clearApplicationRejectionFlags,
	handleApplicationRejected,
	isRejectedStatus,
	resetApplicationRejectionGuard,
} from "@/utils/applicationRejection";
import { clearIdempotencyKey } from "@/utils/idempotency";
import Logger from "@/utils/logger";
import { getStorageItem, removeStorageItem, setStorageItem, STORAGE_KEYS } from "@/utils/storage";

export type TranslatorFn = (key: any, fallback?: string) => string;

export interface ReapplyDependencies {
	checkCanReapply?: () => Promise<CanReapplyResponseType>;
	reapplyForLoan?: () => Promise<ReapplyLoanResponse>;
	getWorkflowProgress?: () => Promise<{ data?: WorkflowProgressData } | null>;
	getUserDashboardData?: () => Promise<any>;
	resetApplicationRejectionGuard?: () => void;
	clearApplicationRejectionFlags?: () => Promise<void>;
	handleApplicationRejected?: (options?: {
		router?: any;
		queryClient?: any;
		source?: string;
	}) => Promise<void>;
	clearTransactionId?: () => Promise<void> | void;
	showToast?: (options: any) => void;
	showAlert?: (title: string, message: string, buttons?: any[]) => void;
	language?: string;
}

const STALE_APPLICATION_KEYS: string[] = [
	STORAGE_KEYS["@assessment-fee"],
	STORAGE_KEYS["@assessment-fee-amount"],
	STORAGE_KEYS["@af-flag"],
	STORAGE_KEYS["@transaction-id"],
	STORAGE_KEYS["@latest-assessment-fee-txnid"],
	STORAGE_KEYS["@payment-timer-start"],
	STORAGE_KEYS["@assessment-timer-id"],
	STORAGE_KEYS["@completed-journey-steps"],
	STORAGE_KEYS["@allocated-lender-id"],
	STORAGE_KEYS["@allocated-lender-name"],
	STORAGE_KEYS["@kyc-response"],
	STORAGE_KEYS["@mandate-pending"],
];

let inFlightReapplyPromise: Promise<boolean> | null = null;

/**
 * Formats an ISO timestamp for user-facing reapply availability copy in IST.
 * Example output (English): "12 Dec 2026".
 */
export function formatReapplyAvailableDate(
	isoDate?: string | null,
	language?: string,
): string {
	if (!isoDate || typeof isoDate !== "string") return "";
	const parsed = new Date(isoDate);
	if (!Number.isFinite(parsed.getTime())) return "";

	const locale = language === "hindi" ? "hi-IN" : "en-IN";
	try {
		return new Intl.DateTimeFormat(locale, {
			day: "numeric",
			month: "short",
			year: "numeric",
			timeZone: "Asia/Kolkata",
		}).format(parsed);
	} catch {
		return parsed.toLocaleDateString(locale, {
			day: "numeric",
			month: "short",
			year: "numeric",
		});
	}
}

/**
 * Returns true when an ISO timestamp represents a valid date strictly in the future.
 */
export function isFutureCooldownDate(isoDate?: string | null): boolean {
	if (!isoDate || typeof isoDate !== "string") return false;
	const parsed = new Date(isoDate);
	if (!Number.isFinite(parsed.getTime())) return false;
	return parsed.getTime() > Date.now();
}

function buildNotEligibleToastMessage(
	rawMessage: string,
	t?: TranslatorFn,
): string {
	const rawLower = (rawMessage || "").toLowerCase();
	const mentionsCoolingOrInternal =
		rawLower.includes("cool") ||
		rawLower.includes("30") ||
		rawLower.includes("period") ||
		rawLower.includes("wait") ||
		rawLower.includes("days") ||
		rawLower.includes("policy") ||
		rawLower.includes("rule") ||
		rawLower.includes("bre") ||
		rawLower.includes("lender");

	if (rawLower.includes("overdue")) {
		return t ? t("overdueLoanMessage", "You have an overdue loan payment") : "You have an overdue loan payment";
	}
	if (mentionsCoolingOrInternal || !rawMessage.trim()) {
		return t
			? t("notEligibleToReapply", "You are not eligible to re-apply at this time")
			: "You are not eligible to re-apply at this time";
	}
	return rawMessage;
}

function extractReapplyErrorMeta(error: any) {
	const status: number | undefined = error?.response?.status ?? error?.status;
	const data = error?.response?.data ?? error?.data;
	const detail = data?.detail;
	const code: string | undefined =
		data?.code ??
		(detail && typeof detail === "object" ? detail.code : undefined) ??
		error?.code;
	const canReapplyAt: string | null =
		data?.can_reapply_at ??
		(detail && typeof detail === "object" ? detail.can_reapply_at : undefined) ??
		null;

	const rawDetailText =
		typeof detail === "string"
			? detail
			: detail && typeof detail === "object"
				? String(detail.message ?? detail.msg ?? "")
				: "";
	const combinedText = `${rawDetailText} ${data?.message ?? ""} ${error?.message ?? ""}`.trim();

	return {
		status,
		detail,
		code,
		canReapplyAt,
		rawDetailText,
		combinedText,
		isCooldownActive: status === 403 && code === "REAPPLY_COOLDOWN_ACTIVE",
		isAlreadyInProgress:
			status === 400 &&
			combinedText.toLowerCase().includes("already have an application in progress"),
		isPlainEligibilityError:
			(status === 403 || status === 400) && typeof detail === "string",
	};
}

function showCooldownPopup(
	canReapplyAt: string | null | undefined,
	t: TranslatorFn | undefined,
	showAlertFn: (title: string, message: string, buttons?: any[]) => void,
	language?: string,
): void {
	const title = t
		? t("reapplyCooldownTitle", "You can apply again soon")
		: "You can apply again soon";
	const formattedDate = formatReapplyAvailableDate(canReapplyAt, language);
	const message = formattedDate
		? (t
			? t("reapplyCooldownMessage", "You can apply again from {date}.")
			: "You can apply again from {date}."
		).replace("{date}", formattedDate)
		: t
			? t("notEligibleToReapply", "You are not eligible to re-apply at this time")
			: "You are not eligible to re-apply at this time";

	const okLabel = t ? t("ok", "OK") : "OK";
	showAlertFn(title, message, [{ text: okLabel }]);
}

async function clearPerApplicationLeftovers(
	clearReduxTx?: () => Promise<void> | void,
): Promise<void> {
	await Promise.all([
		AsyncStorage.multiRemove(STALE_APPLICATION_KEYS).catch(() => {}),
		clearIdempotencyKey("assessment-fee").catch(() => {}),
	]);

	if (clearReduxTx) {
		await clearReduxTx();
	} else {
		try {
			store.dispatch(clearTransactionId());
		} catch {
			// Store unavailable in non-UI contexts
		}
	}
}

async function invalidateReapplyQueries(queryClient: any): Promise<void> {
	if (!queryClient?.invalidateQueries) return;
	await Promise.all([
		queryClient.invalidateQueries({ queryKey: ["user", "dashboard"] }).catch(() => {}),
		queryClient.invalidateQueries({ queryKey: ["workflow", "progress"] }).catch(() => {}),
		queryClient.invalidateQueries({ queryKey: ["workflow-progress"] }).catch(() => {}),
	]);
}

async function runExecuteLoanReapply(
	router: any,
	queryClient: any,
	t?: TranslatorFn,
	deps?: ReapplyDependencies,
): Promise<boolean> {
	const doCheckCanReapply = deps?.checkCanReapply ?? checkCanReapply;
	const doReapplyForLoan = deps?.reapplyForLoan ?? reapplyForLoan;
	const doGetWorkflowProgress = deps?.getWorkflowProgress ?? getWorkflowProgress;
	const doGetDashboardData = deps?.getUserDashboardData ?? getUserDashboardData;
	const doResetGuard = deps?.resetApplicationRejectionGuard ?? resetApplicationRejectionGuard;
	const doClearRejectionFlags = deps?.clearApplicationRejectionFlags ?? clearApplicationRejectionFlags;
	const doHandleRejected = deps?.handleApplicationRejected ?? handleApplicationRejected;
	const showToastFn = deps?.showToast ?? ((opts: any) => Toast.show(opts));
	const showAlertFn = deps?.showAlert ?? ((title: string, msg: string, buttons?: any[]) => Alert.alert(title, msg, buttons));
	const language =
		deps?.language ??
		(await getStorageItem(STORAGE_KEYS["@set-language"]).catch(() => null)) ??
		"english";

	try {
		const reapplyData = await doCheckCanReapply();

		if (!reapplyData.can_apply) {
			if (reapplyData.can_reapply_at) {
				showCooldownPopup(reapplyData.can_reapply_at, t, showAlertFn, language);
				return false;
			}
			const message = buildNotEligibleToastMessage(reapplyData.message || "", t);
			showToastFn({
				type: "error",
				text1: t ? t("cannotReapply", "Cannot reapply") : "Cannot reapply",
				text2: message,
			});
			return false;
		}

		let reapplyRes: ReapplyLoanResponse | null = null;
		let alreadyInProgress = false;

		try {
			reapplyRes = await doReapplyForLoan();
		} catch (reapplyErr: any) {
			const meta = extractReapplyErrorMeta(reapplyErr);

			if (meta.isCooldownActive) {
				showCooldownPopup(meta.canReapplyAt, t, showAlertFn, language);
				return false;
			}

			if (meta.isAlreadyInProgress) {
				alreadyInProgress = true;
			} else if (meta.isPlainEligibilityError) {
				const message = buildNotEligibleToastMessage(meta.rawDetailText, t);
				showToastFn({
					type: "error",
					text1: t ? t("cannotReapply", "Cannot reapply") : "Cannot reapply",
					text2: message,
				});
				return false;
			} else {
				const detailText = getFriendlyError(reapplyErr).message;
				showToastFn({
					type: "error",
					text1: t ? t("cannotReapply", "Cannot reapply") : "Cannot reapply",
					text2: detailText,
				});
				return false;
			}
		}

		if (alreadyInProgress) {
			doResetGuard();
			await doClearRejectionFlags();
			await invalidateReapplyQueries(queryClient);

			const [dashData, wfRes] = await Promise.all([
				doGetDashboardData().catch(() => null),
				doGetWorkflowProgress().catch(() => null),
			]);
			const wfData = wfRes?.data ?? dashData?.workflow_progress ?? null;
			const resolvedLeadId = wfData?.lead_id ?? dashData?.lead_id;
			if (resolvedLeadId) {
				await setStorageItem(STORAGE_KEYS["@lead-id"], String(resolvedLeadId));
			}

			if (isRejectedStatus(wfData)) {
				await doHandleRejected({ router, queryClient, source: "executeLoanReapply" });
				return false;
			}

			const currentStep = wfData?.current_step;
			const href = currentStep
				? StepHref[currentStep as keyof typeof StepHref]
				: "/new-assessment-fee";
			router.replace({
				pathname: (href || "/new-assessment-fee") as any,
				params: {
					fromReapply: "true",
					...(resolvedLeadId ? { lead_id: String(resolvedLeadId) } : {}),
				},
			});
			return true;
		}

		// Persist new lead_id or clear old one so resolveLeadId() recovers from /auth/me
		if (reapplyRes?.lead_id) {
			await setStorageItem(STORAGE_KEYS["@lead-id"], String(reapplyRes.lead_id));
		} else {
			await removeStorageItem(STORAGE_KEYS["@lead-id"]).catch(() => {});
		}

		await clearPerApplicationLeftovers(deps?.clearTransactionId);
		doResetGuard();
		await doClearRejectionFlags();
		await invalidateReapplyQueries(queryClient);

		// Re-check workflow progress immediately because backend runs BRE inside reapply
		const wfRes = await doGetWorkflowProgress().catch(() => null);
		const wfData = wfRes?.data ?? null;
		const isInstantRejection =
			wfData?.is_rejected === true ||
			String(wfData?.overall_status ?? "").toLowerCase() === "rejected" ||
			isRejectedStatus(wfData);

		if (isInstantRejection) {
			await doHandleRejected({ router, queryClient, source: "executeLoanReapply" });
			return false;
		}

		const currentStep = wfData?.current_step || reapplyRes?.current_step;
		const href = currentStep
			? StepHref[currentStep as keyof typeof StepHref]
			: "/new-assessment-fee";
		const resolvedLeadId = reapplyRes?.lead_id || wfData?.lead_id;

		router.replace({
			pathname: (href || "/new-assessment-fee") as any,
			params: {
				fromReapply: "true",
				...(resolvedLeadId ? { lead_id: String(resolvedLeadId) } : {}),
			},
		});
		return true;
	} catch (error: any) {
		Logger.warn("executeLoanReapply failed", { error });
		const meta = extractReapplyErrorMeta(error);
		if (meta.isCooldownActive) {
			showCooldownPopup(meta.canReapplyAt, t, showAlertFn, language);
			return false;
		}
		const detailText = getFriendlyError(error).message;
		showToastFn({
			type: "error",
			text1: t ? t("cannotReapply", "Cannot reapply") : "Cannot reapply",
			text2: detailText,
		});
		return false;
	}
}

/**
 * Shared loan reapplication execution.
 * Coalesces concurrent taps with an in-flight promise guard, resets per-application storage,
 * verifies instant BRE decision, and replaces route onto the new workflow step.
 */
export function executeLoanReapply(
	router: any,
	queryClient: any,
	t?: TranslatorFn,
	deps?: ReapplyDependencies,
): Promise<boolean> {
	if (inFlightReapplyPromise) {
		return inFlightReapplyPromise;
	}

	const run = runExecuteLoanReapply(router, queryClient, t, deps).finally(() => {
		inFlightReapplyPromise = null;
	});
	inFlightReapplyPromise = run;
	return run;
}
