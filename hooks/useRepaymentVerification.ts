import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import Logger from "@/utils/logger";
import { getUserDashboardData } from "@/utils/api/services/user.service";
import { verifyRepaymentStatus } from "@/utils/api/services/repayment.service";
import type { VerifyRepaymentData } from "@/utils/api/types/repayment.types";
import {
	classify,
	withTimeout,
	type Classified,
	type VerifySource,
	REPAYMENT_WINDOW_MS,
	REPAYMENT_POLL_INTERVAL_MS,
} from "@/utils/paymentVerification";
import {
	getStorageItem,
	removeStorageItem,
	STORAGE_KEYS,
} from "@/utils/storage";

export type RepaymentOutcomeType =
	| "success"
	| "failed"
	| "cancelled"
	| "expired"
	| "not_completed"
	| "unconfirmed";

export interface RepaymentOutcome {
	type: RepaymentOutcomeType;
	txnid: string;
	data?: VerifyRepaymentData;
}

interface UseRepaymentVerificationOptions {
	txnid: string;
	initialSource?: VerifySource;
	onSuccess?: (data?: VerifyRepaymentData) => void;
}

export function useRepaymentVerification({
	txnid,
	initialSource = "browser_closed",
	onSuccess,
}: UseRepaymentVerificationOptions) {
	const queryClient = useQueryClient();

	const [isVerifying, setIsVerifying] = useState(false);
	const [countdown, setCountdown] = useState(0);
	const [outcome, setOutcome] = useState<RepaymentOutcome | null>(null);

	const runIdRef = useRef(0);
	const mountedRef = useRef(true);
	const activeRef = useRef<{ txnid: string; source: VerifySource } | null>(null);
	const requestControllerRef = useRef<AbortController | null>(null);
	const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const successHandledRef = useRef<Set<string>>(new Set());
	const onSuccessRef = useRef(onSuccess);
	onSuccessRef.current = onSuccess;

	const clearStoredRepayment = useCallback(async () => {
		await removeStorageItem(STORAGE_KEYS["@repayment-txnid"]);
		await removeStorageItem(STORAGE_KEYS["@repayment-timestamp"]);
		await removeStorageItem(STORAGE_KEYS["@repayment-amount-before"]);
		await removeStorageItem(STORAGE_KEYS["@repayment-idempotency-key"]);
	}, []);

	useEffect(() => {
		mountedRef.current = true;
		return () => {
			mountedRef.current = false;
			runIdRef.current += 1;
			if (pollTimerRef.current) {
				clearTimeout(pollTimerRef.current);
				pollTimerRef.current = null;
			}
			requestControllerRef.current?.abort();
		};
	}, []);

	const waitForPoll = (ms: number) =>
		new Promise<void>((resolve) => {
			if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
			pollTimerRef.current = setTimeout(() => {
				pollTimerRef.current = null;
				resolve();
			}, ms);
		});

	/**
	 * Single API check. Never throws.
	 */
	const checkOnce = async (
		id: string,
		timeoutMs = 8000,
		signal?: AbortSignal,
	): Promise<{ kind: Classified; notStarted: boolean; res?: any }> => {
		try {
			const res = await verifyRepaymentStatus(id, { timeoutMs, signal });
			return { ...classify(res), res };
		} catch (err) {
			Logger.warn("Repayment verify checkOnce failed (will retry if window permits)", { error: err });
			return { kind: "ERROR", notStarted: false };
		}
	};

	/**
	 * Safety Net: calls getUserDashboardData to check if active_loan was cleared
	 * or amount_to_repay was reduced compared to amountBefore.
	 */
	const safetyNetCheck = async (timeoutMs = 8000): Promise<boolean> => {
		try {
			const storedBeforeStr = await getStorageItem(STORAGE_KEYS["@repayment-amount-before"]);
			const amountBefore = storedBeforeStr ? Number(storedBeforeStr) : null;

			const dash: any = await withTimeout(getUserDashboardData(), timeoutMs, null);
			if (!dash) return false;

			const activeLoan = dash?.active_loan;

			// Loan is now closed or non-existent
			if (!activeLoan) {
				return true;
			}

			// Partial or full payment reduced the outstanding balance
			if (
				amountBefore !== null &&
				typeof activeLoan.amount_to_repay === "number" &&
				activeLoan.amount_to_repay < amountBefore
			) {
				return true;
			}

			return false;
		} catch {
			return false;
		}
	};

	const finishSuccess = async (targetTxnid: string, resData?: any) => {
		activeRef.current = null;
		setIsVerifying(false);
		setCountdown(0);

		if (successHandledRef.current.has(targetTxnid)) {
			return;
		}
		successHandledRef.current.add(targetTxnid);

		await clearStoredRepayment();
		await queryClient.invalidateQueries({ queryKey: ["user", "dashboard"] });

		const verifiedData = resData?.data ?? resData;
		setOutcome({
			type: "success",
			txnid: targetTxnid,
			data: verifiedData,
		});

		onSuccessRef.current?.(verifiedData);
	};

	const finishWithOutcome = async (
		type: RepaymentOutcomeType,
		targetTxnid: string,
		resData?: any,
	) => {
		activeRef.current = null;
		setIsVerifying(false);
		setCountdown(0);

		// Clear storage for terminal outcomes, preserve for unconfirmed and not_completed
		if (type !== "unconfirmed" && type !== "not_completed") {
			await clearStoredRepayment();
		}

		const verifiedData = resData?.data ?? resData;
		setOutcome({
			type,
			txnid: targetTxnid,
			data: verifiedData,
		});
	};

	/**
	 * Core Polling Loop
	 */
	const startVerification = useCallback(
		async (targetTxnid: string, source: VerifySource) => {
			if (!targetTxnid) return;

			const runId = ++runIdRef.current;
			activeRef.current = { txnid: targetTxnid, source };

			const windowMs = REPAYMENT_WINDOW_MS[source] ?? 30_000;
			const startedAt = Date.now();
			const windowSec = Math.ceil(windowMs / 1000);

			setOutcome(null);
			setIsVerifying(true);
			setCountdown(windowSec);

			const isStale = () => runIdRef.current !== runId || !mountedRef.current;
			let notStartedHits = 0;
			let consecutiveErrors = 0;
			let checks = 0;

			// Countdown interval
			const countdownInterval = setInterval(() => {
				if (isStale()) {
					clearInterval(countdownInterval);
					return;
				}
				const elapsed = Math.floor((Date.now() - startedAt) / 1000);
				const remaining = Math.max(0, windowSec - elapsed);
				setCountdown(remaining);
				if (remaining <= 0) {
					clearInterval(countdownInterval);
				}
			}, 1000);

			try {
				while (!isStale()) {
					// browser_closed polls at most 2 checks (every 3s)
					if (source === "browser_closed" && checks >= 2) break;
					checks += 1;

					const remainingMs = Math.max(0, windowMs - (Date.now() - startedAt));
					if (remainingMs <= 0) break;

					const controller = new AbortController();
					requestControllerRef.current = controller;

					const r = await withTimeout(
						checkOnce(targetTxnid, Math.min(8000, remainingMs), controller.signal),
						remainingMs,
						{ kind: "ERROR" as const, notStarted: false },
					);

					controller.abort();
					requestControllerRef.current = null;

					if (isStale()) return;

					if (r.kind === "SUCCESS") {
						return finishSuccess(targetTxnid, r.res);
					}
					if (r.kind === "FAILED") {
						return finishWithOutcome("failed", targetTxnid, r.res);
					}
					if (r.kind === "CANCELLED") {
						return finishWithOutcome("cancelled", targetTxnid, r.res);
					}
					if (r.kind === "EXPIRED") {
						return finishWithOutcome("expired", targetTxnid, r.res);
					}

					if (r.kind === "ERROR") {
						consecutiveErrors += 1;
						// Safety net trigger after 2 consecutive errors
						if (consecutiveErrors >= 2 && Date.now() - startedAt < windowMs) {
							const safetyOk = await withTimeout(
								safetyNetCheck(Math.min(6000, windowMs - (Date.now() - startedAt))),
								Math.max(1, windowMs - (Date.now() - startedAt)),
								false,
							);
							if (safetyOk) {
								return finishSuccess(targetTxnid);
							}
						}
					} else {
						consecutiveErrors = 0;
					}

					// User backed out before payment started on server
					if (source === "browser_closed" && r.kind === "PENDING" && r.notStarted) {
						notStartedHits += 1;
						if (notStartedHits >= 2) {
							return finishWithOutcome("not_completed", targetTxnid, r.res);
						}
					}

					if (Date.now() - startedAt >= windowMs) break;

					await waitForPoll(source === "browser_closed" ? 3000 : REPAYMENT_POLL_INTERVAL_MS);
				}

				if (isStale()) return;

				// Window expired: run safety net once more
				const finalSafetyOk = await safetyNetCheck(Math.min(6000, 8000));
				if (finalSafetyOk) {
					return finishSuccess(targetTxnid);
				}

				if (source === "deeplink_failure") {
					return finishWithOutcome("failed", targetTxnid);
				}
				if (source === "browser_closed") {
					return finishWithOutcome("not_completed", targetTxnid);
				}

				return finishWithOutcome("unconfirmed", targetTxnid);
			} finally {
				clearInterval(countdownInterval);
			}
		},
		[clearStoredRepayment, queryClient],
	);

	// Start initial verification on mount or txnid change
	useEffect(() => {
		if (txnid) {
			startVerification(txnid, initialSource);
		}
	}, [txnid, initialSource, startVerification]);

	// AppState listener: if returns to foreground while unconfirmed and not currently running
	useEffect(() => {
		const sub = AppState.addEventListener("change", (state) => {
			if (state === "active" && txnid && !activeRef.current && !outcome) {
				startVerification(txnid, "browser_closed");
			}
		});
		return () => sub.remove();
	}, [txnid, outcome, startVerification]);

	const recheck = useCallback(() => {
		if (txnid) {
			startVerification(txnid, "manual");
		}
	}, [txnid, startVerification]);

	const cancelVerification = useCallback(() => {
		runIdRef.current += 1;
		requestControllerRef.current?.abort();
		requestControllerRef.current = null;
		activeRef.current = null;
		setIsVerifying(false);
		setCountdown(0);
		if (txnid) {
			finishWithOutcome("not_completed", txnid);
		}
	}, [txnid]);

	return {
		isVerifying,
		countdown,
		outcome,
		recheck,
		cancelVerification,
	};
}

