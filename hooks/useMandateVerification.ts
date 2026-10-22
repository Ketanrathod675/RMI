import { getMandateStatus, getUserDashboardData } from "@/utils/api";
import Logger from "@/utils/logger";
import { getStorageItem, removeStorageItem, STORAGE_KEYS } from "@/utils/storage";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";

export type MandateVerifySource =
	| "deeplink_success" // return link said status=true
	| "deeplink_pending" // return link said status=pending (UPI awaiting bank)
	| "deeplink_failure" // return link said status=false (a hint only)
	| "browser_closed" // user closed the tab / dismissed / unknown return
	| "manual"; // user tapped "Check again"

const POLL_INTERVAL_MS = 3000;
const WINDOW_MS: Record<MandateVerifySource, number> = {
	deeplink_success: 90_000,
	deeplink_pending: 10_000,
	deeplink_failure: 8_000,
	browser_closed: 15_000,
	manual: 20_000,
};

const FAILED_STATUSES = ["failure", "failed", "cancelled", "canceled", "usercancelled", "dropped", "bounced"];
const PENDING_STATUSES = new Set([
	"pending",
	"initiated",
	"preinitiated",
	"inprogress",
	"inprocess",
	"processing",
	"awaiting",
]);
const SUCCESS_STATUSES = new Set([
	"success",
	"successful",
	"authorized",
	"authorised",
	"completed",
	"complete",
	"active",
	"activated",
	"mandateactive",
	"mandateactivated",
	"mandatecompleted",
]);
const normalizeMandateStatus = (status: unknown) =>
	String(status ?? "").toLowerCase().trim().replace(/[^a-z]/g, "");

export type MandateState =
	| "idle"
	| "verifying"
	| "waiting_bank"
	| "in_progress"
	| "success"
	| "failed"
	| "cancelled"
	| "unconfirmed";

export type MandateOutcome = "success" | "failed" | "cancelled" | "unconfirmed" | "in_progress" | null;

type ClassifiedKind = "SUCCESS" | "FAILED" | "WAITING_BANK" | "PENDING" | "ERROR";

interface MandateCheckResult {
	kind: ClassifiedKind;
	notStarted: boolean;
	status?: string;
	txnid?: string;
	nextStep?: string;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const POST_MANDATE_STEPS = new Set([
	"disbursement",
	"loan_congratulations",
	"loan-congratulations",
	"loan_details",
	"agreement_signing",
	"completed",
]);

export const useMandateVerification = () => {
	const queryClient = useQueryClient();

	const [state, setState] = useState<MandateState>("verifying");
	const [outcome, setOutcome] = useState<MandateOutcome>(null);
	const [lastStatus, setLastStatus] = useState<string>("");
	const [currentTxnid, setCurrentTxnid] = useState<string>("");
	const [nextStep, setNextStep] = useState<string | null>(null);

	const lastStatusRef = useRef<string>("");
	const currentTxnidRef = useRef<string>("");
	const consecutiveErrorsRef = useRef<number>(0);
	const runIdRef = useRef(0);
	const activeRef = useRef<{ txnid: string; source: MandateVerifySource } | null>(null);
	const mountedRef = useRef(true);

	useEffect(() => {
		mountedRef.current = true;
		return () => {
			mountedRef.current = false;
			runIdRef.current += 1;
		};
	}, []);

	const clearPendingMandate = async () => {
		await removeStorageItem(STORAGE_KEYS["@mandate-pending"]).catch(() => {});
	};

	/** Safety net: check if workflow moved past enach_mandate on the server (allow-list only) */
	const workflowAdvanced = useCallback(async (): Promise<{ advanced: boolean; nextStep?: string }> => {
		try {
			const dash: any = await getUserDashboardData();
			consecutiveErrorsRef.current = 0;
			const step = String(
				dash?.workflow_progress?.current_step || dash?.current_step || dash?.current_step_info?.step || "",
			).trim();
			const lower = step.toLowerCase();
			if (lower && POST_MANDATE_STEPS.has(lower)) {
				return { advanced: true, nextStep: step };
			}
			return { advanced: false };
		} catch {
			consecutiveErrorsRef.current += 1;
			return { advanced: false };
		}
	}, []);

	/** Single check of mandate status */
	const checkOnce = useCallback(
		async (txnid?: string): Promise<MandateCheckResult> => {
			try {
				const res = await getMandateStatus(txnid || undefined);
				const data = res?.data;
				const rawStatus = String(data?.status ?? "").toLowerCase().trim();
				const normalizedStatus = normalizeMandateStatus(rawStatus);
				const notStarted = data?.callback_received === false;
				const resolvedTxnid = data?.txnid ? String(data.txnid) : txnid;

				if (FAILED_STATUSES.includes(normalizedStatus)) {
					return {
						kind: "FAILED",
						notStarted,
						status: data?.status ?? rawStatus,
						txnid: resolvedTxnid,
					};
				}

				// The backend's is_complete flag is authoritative for its workflow semantics.
				// It may be true for UPI pending/initiated while the workflow proceeds to pdq_check.
				if (data?.is_complete === true) {
					return {
						kind: "SUCCESS",
						notStarted,
						status: data?.status ?? rawStatus,
						txnid: resolvedTxnid,
						nextStep: data?.next_step || undefined,
					};
				}

				if (SUCCESS_STATUSES.has(normalizedStatus)) {
					return {
						kind: "SUCCESS",
						notStarted,
						status: data?.status ?? rawStatus,
						txnid: resolvedTxnid,
						nextStep: data?.next_step || undefined,
					};
				}

				// The backend reports UPI pending/initiated mandates as is_active=true and moves
				// workflow to pdq_check while the bank is still authorizing them. Do not treat
				// either that flag or the intermediate workflow step as final authorization.
				if (PENDING_STATUSES.has(normalizedStatus) || data?.is_active === true) {
					return {
						kind: "WAITING_BANK",
						notStarted,
						status: data?.status ?? rawStatus,
						txnid: resolvedTxnid,
					};
				}

				if (data?.current_step && POST_MANDATE_STEPS.has(String(data.current_step).toLowerCase())) {
					const adv = await workflowAdvanced();
					if (adv.advanced) {
						return {
							kind: "SUCCESS",
							notStarted,
							status: data?.status ?? rawStatus,
							txnid: resolvedTxnid,
							nextStep: adv.nextStep || (data?.current_step && POST_MANDATE_STEPS.has(String(data.current_step).toLowerCase()) ? data.current_step : undefined),
						};
					}
				}

				return {
					kind: "PENDING",
					notStarted,
					status: data?.status ?? rawStatus,
					txnid: resolvedTxnid,
				};
			} catch (err) {
				Logger.warn("Mandate status check failed (will retry)", err);
				return {
					kind: "ERROR",
					notStarted: false,
				};
			}
		},
		[workflowAdvanced],
	);

	const finishSuccess = useCallback(
		async (txnId: string, step?: string) => {
			await clearPendingMandate();
			activeRef.current = null;
			queryClient.invalidateQueries({ queryKey: ["user", "dashboard"] });
			if (mountedRef.current) {
				setNextStep(step || null);
				setState("success");
				setOutcome("success");
			}
		},
		[queryClient],
	);

	const finishWithOutcome = useCallback(
		async (type: "failed" | "cancelled" | "unconfirmed" | "in_progress", txnId: string) => {
			if (type === "failed" || type === "cancelled") {
				await clearPendingMandate();
			}
			activeRef.current = null;
			if (mountedRef.current) {
				setState(type);
				setOutcome(type);
			}
		},
		[],
	);

	/**
	 * Main verification loop:
	 * One loop at a time, cancellable, de-duplicated per txn id.
	 */
	const verify = useCallback(
		async (targetTxnid?: string, source: MandateVerifySource = "browser_closed") => {
			let txnId = targetTxnid || currentTxnidRef.current || currentTxnid;
			if (!txnId) {
				try {
					const stored = await getStorageItem(STORAGE_KEYS["@mandate-pending"]);
					if (stored) {
						txnId = String(JSON.parse(stored)?.txnid ?? "");
					}
				} catch {
					// ignore
				}
			}
			if (txnId) {
				currentTxnidRef.current = txnId;
				setCurrentTxnid(txnId);
			}

			const current = activeRef.current;
			if (current && current.txnid === txnId) {
				const isStronger =
					(source === "deeplink_success" || source === "deeplink_pending") &&
					(current.source === "browser_closed" || current.source === "deeplink_failure");
				if (!isStronger && source !== "manual") {
					return;
				}
			}

			const runId = ++runIdRef.current;
			activeRef.current = { txnid: txnId || "", source };
			const windowMs = WINDOW_MS[source];
			const startedAt = Date.now();

			setOutcome(null);
			setState(source === "deeplink_pending" ? "waiting_bank" : "verifying");

			const isStale = () => runIdRef.current !== runId || !mountedRef.current;


			while (!isStale()) {
				const r = await checkOnce(txnId);
				if (isStale()) return;

				if (r.status) {
					lastStatusRef.current = r.status;
					setLastStatus(r.status);
				}
				if (r.txnid) {
					currentTxnidRef.current = r.txnid;
					setCurrentTxnid(r.txnid);
					txnId = r.txnid;
				}

				if (r.kind === "SUCCESS") {
					return finishSuccess(txnId, r.nextStep);
				}
				if (r.kind === "FAILED") {
					return finishWithOutcome("failed", txnId);
				}

				if (r.kind === "ERROR") {
					const adv = await workflowAdvanced();
					if (isStale()) return;
					if (adv.advanced) {
						return finishSuccess(txnId, adv.nextStep);
					}
				}

				if (r.kind === "WAITING_BANK") {
					setState("waiting_bank");
				}
				if (Date.now() - startedAt >= windowMs) break;
				await sleep(POLL_INTERVAL_MS);
			}

			if (isStale()) return;

			// Window ended: check workflow safety net
			const adv = await workflowAdvanced();
			if (isStale()) return;
			if (adv.advanced) {
				return finishSuccess(txnId, adv.nextStep);
			}

			const currentStatusNorm = (lastStatusRef.current || "").toLowerCase().trim();
			if (
				source === "deeplink_pending" ||
				currentStatusNorm === "pending" ||
				currentStatusNorm === "preinitiated" ||
				currentStatusNorm === "initiated"
			) {
				return finishWithOutcome("in_progress", txnId);
			}

			if (source === "deeplink_failure") {
				// A callback query parameter is only a hint. The status endpoint may still
				// report pending or an unknown provider status; only its explicit failure
				// response above should mark the mandate as failed.
				return finishWithOutcome("unconfirmed", txnId);
			}

			return finishWithOutcome("unconfirmed", txnId);
		},
		[checkOnce, finishSuccess, finishWithOutcome, workflowAdvanced],
	);

	/**
	 * Re-check triggered by user tapping "Check again" or AppState active when unconfirmed.
	 * Uses "manual" source (30s window). Never starts a second loop if one is already running.
	 */
	const recheck = useCallback(async () => {
		if (activeRef.current) return;
		let txn = currentTxnidRef.current || currentTxnid;
		if (!txn) {
			try {
				const stored = await getStorageItem(STORAGE_KEYS["@mandate-pending"]);
				if (stored) {
					txn = String(JSON.parse(stored)?.txnid ?? "");
				}
			} catch {
				// ignore
			}
		}
		await verify(txn, "manual");
	}, [currentTxnid, verify]);

	/**
	 * Single-check recovery of an in-flight attempt (not a loop).
	 */
	const recover = useCallback(
		async (txnid?: string): Promise<{
			outcome: MandateOutcome | "failed_or_not_started";
			nextStep?: string;
		}> => {
			runIdRef.current += 1;
			activeRef.current = null;

			let targetTxn = txnid || currentTxnidRef.current || currentTxnid;
			if (!targetTxn) {
				try {
					const stored = await getStorageItem(STORAGE_KEYS["@mandate-pending"]);
					if (stored) {
						targetTxn = String(JSON.parse(stored)?.txnid ?? "");
					}
				} catch {
					// ignore
				}
			}
			if (targetTxn) {
				currentTxnidRef.current = targetTxn;
				setCurrentTxnid(targetTxn);
			}

			setState("verifying");
			setOutcome(null);

			// 1. Safety net first
			const adv = await workflowAdvanced();
			if (adv.advanced) {
				await finishSuccess(targetTxn || "", adv.nextStep);
				return { outcome: "success", nextStep: adv.nextStep };
			}

			// 2. Single status check
			const r = await checkOnce(targetTxn);
			if (r.status) {
				lastStatusRef.current = r.status;
				setLastStatus(r.status);
			}
			if (r.txnid) {
				currentTxnidRef.current = r.txnid;
				setCurrentTxnid(r.txnid);
			}

			if (r.kind === "SUCCESS") {
				await finishSuccess(r.txnid || targetTxn || "", r.nextStep);
				return { outcome: "success", nextStep: r.nextStep };
			}

			if (r.kind === "FAILED") {
				await clearPendingMandate();
				setState("failed");
				setOutcome("failed");
				return { outcome: "failed_or_not_started" };
			}

			const normalizedStatus = String(r.status || "").toLowerCase().trim();
			if (
				normalizedStatus === "pending" ||
				normalizedStatus === "preinitiated" ||
				normalizedStatus === "initiated" ||
				(!r.notStarted && r.kind === "PENDING")
			) {
				// Keep @mandate-pending so user cannot start a duplicate mandate while this one is in progress
				setState("in_progress");
				setOutcome("in_progress");
				return { outcome: "in_progress" };
			}

			if (r.notStarted) {
				// No callback yet is inconclusive: keep the pending attempt and allow another status check.
				setState("unconfirmed");
				setOutcome("unconfirmed");
				return { outcome: "unconfirmed" };
			}

			// Otherwise show unconfirmed view (keeps @mandate-pending)
			setState("unconfirmed");
			setOutcome("unconfirmed");
			return { outcome: "unconfirmed" };
		},
		[checkOnce, currentTxnid, finishSuccess, workflowAdvanced],
	);

	return {
		state,
		outcome,
		lastStatus,
		txnid: currentTxnid,
		nextStep,
		verify,
		recheck,
		recover,
	};
};
