import { isRejectedStatus } from "@/utils/applicationRejection";
import type { AssessmentChecks } from "@/utils/api/types/payment.types";

/**
 * Total polling window across 8 backoff intervals is 51,000 ms (9 HTTP calls total).
 * Keep JourneyLoader's task timeout comfortably above 51s + request latency so
 * pollAssessmentChecks reaches terminal completion rather than getting aborted mid-schedule.
 */
export const ASSESSMENT_LOADER_TIMEOUT_MS = 95000;

export type AssessmentOutcomeAction =
	| { action: "approved" }
	| { action: "needs_email"; checks: AssessmentChecks }
	| { action: "needs_pan"; checks: AssessmentChecks }
	| {
			action: "rejected";
			checks?: AssessmentChecks | null;
			isDashboardRejected?: boolean;
	  }
	| {
			action: "still_checking";
			status: "service_unavailable" | "error" | "timeout";
			checks?: AssessmentChecks | null;
			retryAfterSeconds?: number;
	  }
	| { action: "poll" };

export const isEmailFixable = (
	checks: AssessmentChecks | null | undefined,
): boolean => {
	if (!checks) return false;
	return (
		(checks.status === "rejected" || checks.status === "needs_update") &&
		checks.failed_rule === "email" &&
		Boolean(checks.can_update_email) &&
		checks.remaining_email_updates > 0
	);
};

export const isPanFixable = (
	checks: AssessmentChecks | null | undefined,
): boolean => {
	if (!checks) return false;
	return (
		(checks.status === "rejected" || checks.status === "needs_update") &&
		checks.failed_rule === "pan_card" &&
		Boolean(checks.can_update_pan) &&
		checks.remaining_pan_updates > 0
	);
};

/**
 * Normalizes any AssessmentChecks payload into a concrete navigation or UI action.
 */
export function classifyAssessmentChecksOutcome(
	checks: AssessmentChecks | null | undefined,
): AssessmentOutcomeAction {
	if (!checks) {
		return { action: "poll" };
	}

	if (checks.status === "approved") {
		return { action: "approved" };
	}

	if (checks.status === "rejected" || checks.status === "needs_update") {
		if (isEmailFixable(checks)) {
			return { action: "needs_email", checks };
		}
		if (isPanFixable(checks)) {
			return { action: "needs_pan", checks };
		}
		return { action: "rejected", checks };
	}

	if (checks.status === "service_unavailable") {
		return {
			action: "still_checking",
			status: "service_unavailable",
			checks,
			retryAfterSeconds:
				typeof checks.retry_after_seconds === "number"
					? checks.retry_after_seconds
					: undefined,
		};
	}

	if (checks.status === "error") {
		return {
			action: "still_checking",
			status: "error",
			checks,
			retryAfterSeconds:
				typeof checks.retry_after_seconds === "number"
					? checks.retry_after_seconds
					: undefined,
		};
	}

	return { action: "poll" };
}

/**
 * Determines whether clicking "Try Again" should invoke POST /payment/retry-assessment-checks
 * before re-polling status. Covers timeout & pending in addition to error & service_unavailable.
 */
export function shouldCallBackendRetry(params: {
	lastStatus: string | null | undefined;
	lastRetryAtMs: number;
	cooldownSeconds: number;
	nowMs?: number;
}): boolean {
	const status = String(params.lastStatus || "").toLowerCase().trim();
	const retryableStatus =
		status === "error" ||
		status === "service_unavailable" ||
		status === "timeout" ||
		status === "pending";

	if (!retryableStatus) {
		return false;
	}

	if (!params.lastRetryAtMs || params.lastRetryAtMs <= 0) {
		return true;
	}

	const nowMs = params.nowMs ?? Date.now();
	const elapsedSeconds = (nowMs - params.lastRetryAtMs) / 1000;
	return elapsedSeconds >= Math.max(0, params.cooldownSeconds);
}

/**
 * Resolves a failed/timed-out polling run using fresh status/dashboard reads.
 * Strictly fail-closed: only returns "approved" when bre_status is explicitly "approved"
 * and dashboard is not rejected (never based on current_step alone).
 */
export function resolveErrorFallbackStatus(params: {
	error: any;
	freshChecks?: AssessmentChecks | null;
	dashboardData?: any;
}): Exclude<AssessmentOutcomeAction, { action: "poll" }> {
	const { error, freshChecks, dashboardData } = params;

	if (
		dashboardData &&
		(Boolean(dashboardData.is_rejected) ||
			isRejectedStatus(dashboardData.workflow_progress))
	) {
		return { action: "rejected", isDashboardRejected: true };
	}

	if (freshChecks) {
		const classified = classifyAssessmentChecksOutcome(freshChecks);
		if (classified.action !== "poll") {
			return classified;
		}
	}

	const dashBreStatus = String(dashboardData?.workflow_progress?.bre_status ?? "")
		.toLowerCase()
		.trim();
	if (dashBreStatus === "approved") {
		return { action: "approved" };
	}

	const errChecks: AssessmentChecks | undefined = error?.checks;
	if (errChecks) {
		const classifiedErrChecks = classifyAssessmentChecksOutcome(errChecks);
		if (classifiedErrChecks.action !== "poll") {
			return classifiedErrChecks;
		}
	}

	if (error?.isServiceUnavailable) {
		return {
			action: "still_checking",
			status: "service_unavailable",
			checks: errChecks ?? null,
			retryAfterSeconds:
				typeof errChecks?.retry_after_seconds === "number"
					? errChecks.retry_after_seconds
					: undefined,
		};
	}

	return {
		action: "still_checking",
		status: error?.isError ? "error" : "timeout",
		checks: errChecks ?? null,
	};
}

export interface ExecuteAssessmentRetryResult {
	outcome: AssessmentOutcomeAction;
	calledBackendRetry: boolean;
	nextRetryAtMs?: number;
	cooldownSecondsToStart?: number;
}

/**
 * Orchestrates "Try Again": calls POST /payment/retry-assessment-checks when eligible,
 * acts immediately on terminal results, and recovers gracefully from HTTP 409 / transient errors.
 */
export async function executeAssessmentRetry(params: {
	lastStatus: string | null | undefined;
	lastRetryAtMs: number;
	cooldownSeconds: number;
	nowMs?: number;
	callRetry?: () => Promise<AssessmentChecks>;
	callHandshakeStatus: () => Promise<AssessmentChecks | null>;
	callDashboard: () => Promise<any>;
}): Promise<ExecuteAssessmentRetryResult> {
	const nowMs = params.nowMs ?? Date.now();
	const canCallBackend =
		Boolean(params.callRetry) &&
		shouldCallBackendRetry({
			lastStatus: params.lastStatus,
			lastRetryAtMs: params.lastRetryAtMs,
			cooldownSeconds: params.cooldownSeconds,
			nowMs,
		});

	if (canCallBackend && params.callRetry) {
		try {
			const retChecks = await params.callRetry();
			const classified = classifyAssessmentChecksOutcome(retChecks);

			if (
				classified.action === "approved" ||
				classified.action === "needs_email" ||
				classified.action === "needs_pan" ||
				classified.action === "rejected"
			) {
				return {
					outcome: classified,
					calledBackendRetry: true,
					nextRetryAtMs: nowMs,
				};
			}

			if (classified.action === "still_checking") {
				return {
					outcome: classified,
					calledBackendRetry: true,
					nextRetryAtMs: nowMs,
					cooldownSecondsToStart:
						classified.retryAfterSeconds ?? params.cooldownSeconds,
				};
			}

			return {
				outcome: { action: "poll" },
				calledBackendRetry: true,
				nextRetryAtMs: nowMs,
				cooldownSecondsToStart:
					typeof retChecks?.retry_after_seconds === "number"
						? retChecks.retry_after_seconds
						: params.cooldownSeconds,
			};
		} catch (retryErr: any) {
			const freshChecks = await params.callHandshakeStatus().catch(() => null);
			const dashboardData =
				!freshChecks || freshChecks.status === "pending"
					? await params.callDashboard().catch(() => null)
					: null;

			const fallback = resolveErrorFallbackStatus({
				error: retryErr,
				freshChecks,
				dashboardData,
			});

			if (
				fallback.action === "still_checking" &&
				freshChecks?.status === "pending"
			) {
				return {
					outcome: { action: "poll" },
					calledBackendRetry: true,
				};
			}

			const retryAfter =
				fallback.action === "still_checking"
					? fallback.retryAfterSeconds
					: undefined;

			return {
				outcome: fallback,
				calledBackendRetry: true,
				nextRetryAtMs:
					typeof retryAfter === "number" ? nowMs : undefined,
				cooldownSecondsToStart: retryAfter,
			};
		}
	}

	const freshChecks = await params.callHandshakeStatus().catch(() => null);
	const dashboardData =
		!freshChecks || freshChecks.status === "pending"
			? await params.callDashboard().catch(() => null)
			: null;

	if (
		dashboardData &&
		(Boolean(dashboardData.is_rejected) ||
			isRejectedStatus(dashboardData.workflow_progress))
	) {
		return {
			outcome: { action: "rejected", isDashboardRejected: true },
			calledBackendRetry: false,
		};
	}

	if (freshChecks) {
		const classified = classifyAssessmentChecksOutcome(freshChecks);
		if (classified.action !== "poll") {
			return {
				outcome: classified,
				calledBackendRetry: false,
				cooldownSecondsToStart:
					classified.action === "still_checking"
						? classified.retryAfterSeconds
						: undefined,
			};
		}
	}

	const dashBreStatus = String(dashboardData?.workflow_progress?.bre_status ?? "")
		.toLowerCase()
		.trim();
	if (dashBreStatus === "approved") {
		return {
			outcome: { action: "approved" },
			calledBackendRetry: false,
		};
	}

	return {
		outcome: { action: "poll" },
		calledBackendRetry: false,
	};
}
