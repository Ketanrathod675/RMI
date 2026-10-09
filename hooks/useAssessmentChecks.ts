import { getHandshakeStatus, type AssessmentChecks } from "@/utils/api";
import { useCallback, useEffect, useRef } from "react";

export interface PollAssessmentChecksOptions {
	txnid?: string;
	signal?: AbortSignal;
	timeoutMs?: number;
	intervalMs?: number;
}

/**
 * Polls GET /payment/handshake-status until status is approved, rejected, or error.
 * Network errors are swallowed until timeout.
 * Rejects with { aborted: true } if aborted.
 * Rejects with { isTimeout: true, checks: lastResult } on timeout.
 */
export async function pollAssessmentChecks({
	txnid,
	signal,
	timeoutMs = 60000,
	intervalMs = 2000,
}: PollAssessmentChecksOptions): Promise<AssessmentChecks> {
	const startTime = Date.now();
	let lastResult: AssessmentChecks | null = null;

	while (Date.now() - startTime < timeoutMs) {
		if (signal?.aborted) {
			const err: any = new Error("Assessment checks polling aborted");
			err.aborted = true;
			throw err;
		}

		try {
			const res = await getHandshakeStatus(txnid);
			lastResult = res;

			if (res.status === "approved" || res.status === "rejected" || res.status === "error") {
				return res;
			}
		} catch {
			// Swallow network errors until timeout
		}

		if (signal?.aborted) {
			const err: any = new Error("Assessment checks polling aborted");
			err.aborted = true;
			throw err;
		}

		const elapsed = Date.now() - startTime;
		if (elapsed >= timeoutMs) break;

		const waitTime = Math.min(intervalMs, timeoutMs - elapsed);
		await new Promise<void>((resolve) => {
			const timer = setTimeout(resolve, waitTime);
			if (signal) {
				const onAbort = () => {
					clearTimeout(timer);
					signal.removeEventListener("abort", onAbort);
					resolve();
				};
				signal.addEventListener("abort", onAbort, { once: true });
			}
		});
	}

	if (signal?.aborted) {
		const err: any = new Error("Assessment checks polling aborted");
		err.aborted = true;
		throw err;
	}

	const timeoutErr: any = new Error("Assessment checks polling timed out");
	timeoutErr.isTimeout = true;
	timeoutErr.checks = lastResult;
	throw timeoutErr;
}

export const isEmailFixable = (checks: AssessmentChecks | null | undefined): boolean => {
	if (!checks) return false;
	return (
		checks.status === "rejected" &&
		checks.failed_rule === "email" &&
		Boolean(checks.can_update_email) &&
		checks.remaining_email_updates > 0
	);
};

export const isPanFixable = (checks: AssessmentChecks | null | undefined): boolean => {
	if (!checks) return false;
	return (
		checks.status === "rejected" &&
		checks.failed_rule === "pan_card" &&
		Boolean(checks.can_update_pan) &&
		checks.remaining_pan_updates > 0
	);
};

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
