import { QueryClient } from "@tanstack/react-query";
import { router as globalRouter } from "expo-router";
import { getStorageItem, removeStorageItem, setStorageItem, STORAGE_KEYS } from "./storage";
import { getWorkflowProgress, getUserDashboardData, type WorkflowProgressData } from "./api/services/user.service";
import { StepHref, type StepNameTypes } from "./api/types/user.types";

/**
 * Module-level lock so rejection handling triggers only once per session until reset.
 */
let isRejectionHandlingInProgress = false;

/**
 * Registered callback for global 403 rejection handling from client interceptor.
 */
let registeredApplicationRejectedHandler: (() => void) | null = null;

export function setApplicationRejectedHandler(fn: (() => void) | null) {
	registeredApplicationRejectedHandler = fn;
}

export function triggerGlobalApplicationRejected(): void {
	if (registeredApplicationRejectedHandler) {
		registeredApplicationRejectedHandler();
	}
}

/**
 * Resets the application rejection guard.
 * Call on fresh login, on starting reapplication, and when the dashboard shows a new in_progress workflow.
 */
export function resetApplicationRejectionGuard(): void {
	isRejectionHandlingInProgress = false;
}

/**
 * Clear stored rejection flags.
 */
export async function clearApplicationRejectionFlags(): Promise<void> {
	await Promise.all([
		removeStorageItem(STORAGE_KEYS["@loan-rejected-flag"]).catch(() => {}),
		removeStorageItem(STORAGE_KEYS["@no-approved-amount-flag"]).catch(() => {}),
	]);
}

/**
 * Evaluates whether an Axios or API error represents an application rejection HTTP 403.
 * Checks detail, code, message for "not approved" or "application_rejected".
 */
export function isApplicationRejectedError(error: unknown): boolean {
	if (!error || typeof error !== "object") return false;

	const anyErr = error as any;
	const status = anyErr?.response?.status ?? anyErr?.status;
	if (status !== 403) return false;

	const data = anyErr?.response?.data;
	const detail = data?.detail;
	const code = data?.code ?? (typeof detail === "object" ? detail?.code : undefined) ?? anyErr?.code;
	if (code === "application_rejected") return true;

	const extractText = (val: unknown): string => {
		if (typeof val === "string") return val;
		if (Array.isArray(val)) {
			return val.map((item) => extractText(item?.msg ?? item)).join(" ");
		}
		if (val && typeof val === "object") {
			return `${(val as any)?.message ?? ""} ${(val as any)?.msg ?? ""} ${(val as any)?.detail ?? ""}`;
		}
		return "";
	};

	const combinedText = `${extractText(detail)} ${data?.message ?? ""} ${anyErr?.message ?? ""}`.toLowerCase();
	return combinedText.includes("not approved") || combinedText.includes("application_rejected");
}

/**
 * Evaluates whether workflow progress indicates a rejected status.
 */
export function isRejectedStatus(progress: unknown): boolean {
	if (!progress || typeof progress !== "object") return false;
	const p = progress as any;

	if (p.is_rejected === true) return true;

	const status = String(p.overall_status ?? "").toLowerCase().trim();
	if (status === "rejected" || status === "application_rejected" || status === "no_approved_amount") {
		return true;
	}

	return false;
}

/**
 * Central handler when an application is rejected.
 * Idempotent: sets flags, invalidates/cancels queries, suppresses error toasts, routes to /no-approved-amount.
 */
export async function handleApplicationRejected(options?: {
	router?: any;
	queryClient?: QueryClient;
	source?: string;
}): Promise<void> {
	if (isRejectionHandlingInProgress) {
		return;
	}
	isRejectionHandlingInProgress = true;

	try {
		await Promise.all([
			setStorageItem(STORAGE_KEYS["@loan-rejected-flag"], "true").catch(() => {}),
			setStorageItem(STORAGE_KEYS["@no-approved-amount-flag"], "true").catch(() => {}),
		]);
	} catch {
		// Ignore storage write failures
	}

	const qc = options?.queryClient;
	if (qc) {
		try {
			qc.cancelQueries({ queryKey: ["loan"] });
			qc.cancelQueries({ queryKey: ["bankAccounts"] });
			qc.cancelQueries({ queryKey: ["credit-queue"] });

			qc.invalidateQueries({ queryKey: ["user", "dashboard"] });
			qc.invalidateQueries({ queryKey: ["credit-queue", "status"] });
			qc.invalidateQueries({ queryKey: ["loan", "offer"] });
		} catch {
			// Ignore query client failures
		}
	}

	const r = options?.router || globalRouter;
	try {
		r.replace("/no-approved-amount");
	} catch {
		try {
			globalRouter.replace("/no-approved-amount");
		} catch {
			// Fail-safe
		}
	}
}

/**
 * Shared helper that fetches fresh workflow progress (falls back to dashboard),
 * checks rejection status FIRST, and only routes by current_step if not rejected.
 * If status check fails, throws or leaves user on current screen (never advances blindly).
 */
export async function routeAfterStep(
	router: any,
	queryClient?: QueryClient,
	options?: { fallbackStep?: string }
): Promise<void> {
	if (queryClient) {
		await queryClient.invalidateQueries({ queryKey: ["user", "dashboard"] });
	}

	let progressData: WorkflowProgressData | null = null;
	try {
		const wfRes = await getWorkflowProgress();
		if (wfRes?.data) {
			progressData = wfRes.data;
		}
	} catch {
		// Fall back to dashboard
	}

	if (!progressData) {
		const dash = await getUserDashboardData();
		progressData = dash?.workflow_progress || null;
	}

	if (!progressData) {
		throw new Error("Unable to retrieve workflow progress");
	}

	if (isRejectedStatus(progressData)) {
		await handleApplicationRejected({ router, queryClient, source: "routeAfterStep" });
		return;
	}

	const nextStep = progressData.current_step || options?.fallbackStep;
	if (!nextStep) {
		router.replace("/(tabs)");
		return;
	}

	const targetRoute = StepHref[nextStep as StepNameTypes] || "/(tabs)";
	router.replace(targetRoute as any);
}

