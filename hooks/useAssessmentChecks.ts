import { getBookingStatus, type AssessmentChecks } from "@/utils/api";
import { isEmailFixable, isPanFixable } from "@/utils/assessmentChecksFlow";
import Logger from "@/utils/logger";
import { useCallback, useEffect, useRef } from "react";
import { AppState } from "react-native";

export { isEmailFixable, isPanFixable };

export const ASSESSMENT_CHECKS_BACKOFF_DELAYS = [
	2000, 3000, 5000, 5000, 8000, 8000, 10000, 10000,
] as const;

export interface PollAssessmentChecksOptions {
	txnid?: string;
	leadId?: string;
	signal?: AbortSignal;
	timeoutMs?: number;
	intervalMs?: number;
	fetcher?: (params: { txnid?: string; leadId?: string }) => Promise<AssessmentChecks>;
}

interface InFlightEntry {
	promise: Promise<AssessmentChecks>;
	signals: Set<AbortSignal>;
	fetcher?: (params: { txnid?: string; leadId?: string }) => Promise<AssessmentChecks>;
}

const inFlightPolls = new Map<string, InFlightEntry>();

function waitForActive(): Promise<void> {
	if (AppState.currentState === "active") {
		return Promise.resolve();
	}

	return new Promise<void>((resolve) => {
		let subscription: { remove: () => void } | null = null;
		subscription = AppState.addEventListener("change", (nextState) => {
			if (nextState === "active") {
				if (subscription) {
					subscription.remove();
					subscription = null;
				}
				resolve();
			}
		});
	});
}

function sleepWithAbort(ms: number, isAborted: () => boolean): Promise<void> {
	return new Promise((resolve) => {
		const start = Date.now();
		const interval = setInterval(() => {
			if (isAborted() || Date.now() - start >= ms) {
				clearInterval(interval);
				resolve();
			}
		}, 100);
	});
}

const isTerminalStatus = (status: string): boolean => {
	return (
		status === "approved" ||
		status === "rejected" ||
		status === "error" ||
		status === "service_unavailable" ||
		status === "needs_update"
	);
};

function raceWithAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
	if (!signal) return promise;
	if (signal.aborted) {
		const err: any = new Error("Assessment checks polling aborted");
		err.aborted = true;
		return Promise.reject(err);
	}

	return new Promise<T>((resolve, reject) => {
		const onAbort = () => {
			signal.removeEventListener("abort", onAbort);
			const err: any = new Error("Assessment checks polling aborted");
			err.aborted = true;
			reject(err);
		};

		signal.addEventListener("abort", onAbort, { once: true });
		promise.then(
			(val) => {
				signal.removeEventListener("abort", onAbort);
				resolve(val);
			},
			(err) => {
				signal.removeEventListener("abort", onAbort);
				reject(err);
			},
		);
	});
}

async function executePoll(
	txnid: string | undefined,
	leadId: string | undefined,
	entry: InFlightEntry,
): Promise<AssessmentChecks> {
	let lastResult: AssessmentChecks | null = null;
	const areAllSignalsAborted = () =>
		entry.signals.size > 0 && Array.from(entry.signals).every((s) => s.aborted);

	const totalAttempts = ASSESSMENT_CHECKS_BACKOFF_DELAYS.length + 1; // 1 initial + 8 delays = max 9 requests
	const statusFetcher = entry.fetcher || getBookingStatus;

	for (let attempt = 0; attempt < totalAttempts; attempt++) {
		if (areAllSignalsAborted()) {
			const err: any = new Error("Assessment checks polling aborted");
			err.aborted = true;
			throw err;
		}

		// Pause while AppState is not "active" before next request; paused time does not count against schedule
		await waitForActive();

		if (areAllSignalsAborted()) {
			const err: any = new Error("Assessment checks polling aborted");
			err.aborted = true;
			throw err;
		}

		Logger.debug("pollAssessmentChecks attempt", {
			attempt: attempt + 1,
			totalAttempts,
			txnid,
			leadId,
		});

		try {
			const res = await statusFetcher({ txnid, leadId });
			lastResult = res;

			if (isTerminalStatus(res.status)) {
				Logger.info("pollAssessmentChecks terminal status reached", {
					status: res.status,
					attempt: attempt + 1,
				});
				return res;
			}
		} catch (error: any) {
			if (error?.isNotFound || error?.status === 404) {
				Logger.warn("pollAssessmentChecks 404 not found, stopping polling immediately", {
					attempt: attempt + 1,
					error: error?.message || error,
				});
				const notFoundErr: any = new Error(error?.message || "Booking status not found");
				notFoundErr.isNotFound = true;
				notFoundErr.status = 404;
				notFoundErr.isError = true;
				throw notFoundErr;
			}
			if (error?.isPaymentPending || error?.status === 409) {
				Logger.debug("pollAssessmentChecks 409 payment pending, continuing schedule", {
					attempt: attempt + 1,
				});
			} else {
				// Network errors: do not retry faster than the schedule; count them as an attempt.
				Logger.warn("pollAssessmentChecks network error, continuing schedule", {
					attempt: attempt + 1,
					error: error?.message || error,
				});
			}
		}

		// If this was the last attempt, break and throw timeout
		if (attempt === totalAttempts - 1) {
			break;
		}

		// Wait for active state before backoff delay
		await waitForActive();
		if (areAllSignalsAborted()) {
			const err: any = new Error("Assessment checks polling aborted");
			err.aborted = true;
			throw err;
		}

		const delay = ASSESSMENT_CHECKS_BACKOFF_DELAYS[attempt];
		await sleepWithAbort(delay, areAllSignalsAborted);
	}

	if (areAllSignalsAborted()) {
		const err: any = new Error("Assessment checks polling aborted");
		err.aborted = true;
		throw err;
	}

	Logger.info("pollAssessmentChecks exhausted schedule, returning timeout", {
		lastStatus: lastResult?.status,
	});
	const timeoutErr: any = new Error("Assessment checks polling timed out");
	timeoutErr.isTimeout = true;
	timeoutErr.checks = lastResult;
	throw timeoutErr;
}

/**
 * Shared single-flight, backoff-based BRE status poller.
 * Returns shared promise for the same `${txnid ?? "none"}:${leadId ?? "none"}` key.
 * Terminal statuses: "approved", "rejected", "error", "service_unavailable", "needs_update".
 * Rejects with { aborted: true } if signal is aborted.
 * Rejects with { isTimeout: true, checks: lastResult } on schedule exhaustion.
 */
export function pollAssessmentChecks(
	options: PollAssessmentChecksOptions = {},
): Promise<AssessmentChecks> {
	const { txnid, leadId, signal } = options;

	if (signal?.aborted) {
		const err: any = new Error("Assessment checks polling aborted");
		err.aborted = true;
		return Promise.reject(err);
	}

	const flightKey = `${txnid ?? "none"}:${leadId ?? "none"}`;
	let entry = inFlightPolls.get(flightKey);

	if (!entry) {
		const signals = new Set<AbortSignal>();
		if (signal) signals.add(signal);

		const inFlightObj: InFlightEntry = {
			promise: Promise.resolve() as any,
			signals,
			fetcher: options.fetcher,
		};

		inFlightObj.promise = executePoll(txnid, leadId, inFlightObj).finally(() => {
			inFlightPolls.delete(flightKey);
		});

		inFlightPolls.set(flightKey, inFlightObj);
		entry = inFlightObj;
	} else if (signal) {
		entry.signals.add(signal);
	}

	return raceWithAbort(entry.promise, signal);
}

export function useAssessmentChecksController() {
	const controllerRef = useRef<AbortController>(new AbortController());

	const cancel = useCallback(() => {
		controllerRef.current.abort();
		controllerRef.current = new AbortController();
	}, []);

	useEffect(() => {
		return () => {
			controllerRef.current.abort();
		};
	}, []);

	return {
		signal: controllerRef.current.signal,
		cancel,
	};
}
