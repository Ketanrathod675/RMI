/**
 * Unit test suite for post-assessment-fee check classification, timeout recovery,
 * and Try Again retry orchestration.
 */

import {
	ASSESSMENT_LOADER_TIMEOUT_MS,
	classifyAssessmentChecksOutcome,
	executeAssessmentRetry,
	isEmailFixable,
	isPanFixable,
	resolveErrorFallbackStatus,
	shouldCallBackendRetry,
} from "../utils/assessmentChecksFlow";
import { normalizeAssessmentChecks } from "../utils/api/services/payment.service";
import { pollAssessmentChecks } from "../hooks/useAssessmentChecks";
import type { AssessmentChecks } from "../utils/api/types/payment.types";

function assert(condition: boolean, message: string): void {
	if (!condition) {
		throw new Error(`Assertion failed: ${message}`);
	}
}

const makeChecks = (overrides: Partial<AssessmentChecks> = {}): AssessmentChecks => ({
	status: "pending",
	failed_rule: null,
	can_update_email: false,
	can_update_pan: false,
	remaining_email_updates: 2,
	remaining_pan_updates: 2,
	...overrides,
});

export async function runAssessmentChecksTests(): Promise<void> {
	// 1. Loader timeout exceeds 51s backoff + 9 network attempts
	{
		assert(
			ASSESSMENT_LOADER_TIMEOUT_MS >= 90000,
			`Expected ASSESSMENT_LOADER_TIMEOUT_MS >= 90000, got ${ASSESSMENT_LOADER_TIMEOUT_MS}`,
		);
	}

	// 2. normalizeAssessmentChecks maps "in_progress" safely to "pending"
	{
		const normalized = normalizeAssessmentChecks({ status: "in_progress" });
		assert(
			normalized.status === "pending",
			`Expected 'in_progress' to normalize to 'pending', got '${normalized.status}'`,
		);
	}

	// 3. shouldCallBackendRetry handles timeout & pending (previously skipped!), error, service_unavailable
	{
		const now = 1_700_000_000_000;
		for (const st of ["timeout", "pending", "error", "service_unavailable"]) {
			assert(
				shouldCallBackendRetry({
					lastStatus: st,
					lastRetryAtMs: 0,
					cooldownSeconds: 60,
					nowMs: now,
				}),
				`First retry for status '${st}' must be allowed`,
			);
			assert(
				!shouldCallBackendRetry({
					lastStatus: st,
					lastRetryAtMs: now - 30_000,
					cooldownSeconds: 60,
					nowMs: now,
				}),
				`Retry for status '${st}' inside 60s cooldown must be blocked`,
			);
			assert(
				shouldCallBackendRetry({
					lastStatus: st,
					lastRetryAtMs: now - 61_000,
					cooldownSeconds: 60,
					nowMs: now,
				}),
				`Retry for status '${st}' after 60s cooldown must be allowed`,
			);
		}
		assert(
			!shouldCallBackendRetry({
				lastStatus: "approved",
				lastRetryAtMs: 0,
				cooldownSeconds: 60,
				nowMs: now,
			}),
			"Retry must NOT run when lastStatus is 'approved'",
		);
	}

	// 4. classifyAssessmentChecksOutcome covers all statuses accurately
	{
		assert(
			classifyAssessmentChecksOutcome(makeChecks({ status: "approved" })).action === "approved",
			"approved must classify as 'approved'",
		);
		const emailFix = makeChecks({
			status: "needs_update",
			failed_rule: "email",
			can_update_email: true,
			remaining_email_updates: 1,
		});
		assert(isEmailFixable(emailFix), "Email update should be fixable");
		assert(
			classifyAssessmentChecksOutcome(emailFix).action === "needs_email",
			"Fixable email must classify as 'needs_email'",
		);

		const panFix = makeChecks({
			status: "rejected",
			failed_rule: "pan_card",
			can_update_pan: true,
			remaining_pan_updates: 2,
		});
		assert(isPanFixable(panFix), "PAN update should be fixable");
		assert(
			classifyAssessmentChecksOutcome(panFix).action === "needs_pan",
			"Fixable PAN must classify as 'needs_pan'",
		);

		const exhaustedPan = makeChecks({
			status: "rejected",
			failed_rule: "pan_card",
			can_update_pan: true,
			remaining_pan_updates: 0,
		});
		assert(
			classifyAssessmentChecksOutcome(exhaustedPan).action === "rejected",
			"Exhausted PAN retries must classify as final 'rejected'",
		);

		const svcUnavail = makeChecks({ status: "service_unavailable", retry_after_seconds: 45 });
		const svcOutcome = classifyAssessmentChecksOutcome(svcUnavail);
		assert(
			svcOutcome.action === "still_checking" &&
				svcOutcome.status === "service_unavailable" &&
				svcOutcome.retryAfterSeconds === 45,
			"service_unavailable must preserve status and retry_after_seconds",
		);

		assert(
			classifyAssessmentChecksOutcome(makeChecks({ status: "pending" })).action === "poll",
			"pending must classify as 'poll'",
		);
	}

	// 5. resolveErrorFallbackStatus: fail-closed recovery on poll timeout / error
	{
		// Recovers to approved when fresh booking check returns approved
		const recoveredFromHs = resolveErrorFallbackStatus({
			error: { isTimeout: true },
			freshChecks: makeChecks({ status: "approved" }),
			dashboardData: null,
		});
		assert(recoveredFromHs.action === "approved", "Should recover to approved when freshChecks=approved");

		// Recovers to approved when fresh check still pending/null ONLY if dashboard workflow_progress.bre_status === "approved"
		const recoveredFromDash = resolveErrorFallbackStatus({
			error: { isTimeout: true },
			freshChecks: makeChecks({ status: "pending" }),
			dashboardData: {
				is_rejected: false,
				workflow_progress: {
					overall_status: "in_progress",
					current_step: "professional_details",
					bre_status: "approved",
					is_rejected: false,
				},
			},
		});
		assert(
			recoveredFromDash.action === "approved",
			"Should recover to approved when dashboard bre_status === 'approved'",
		);

		// FAIL-CLOSED: current_step === 'professional_details' WITHOUT bre_status === 'approved' MUST NOT approve (avoids 409 loop)
		const notYetApproved = resolveErrorFallbackStatus({
			error: { isTimeout: true },
			freshChecks: makeChecks({ status: "service_unavailable", retry_after_seconds: 60 }),
			dashboardData: {
				is_rejected: false,
				workflow_progress: {
					overall_status: "in_progress",
					current_step: "professional_details",
					bre_status: "service_unavailable",
					is_rejected: false,
				},
			},
		});
		assert(
			notYetApproved.action === "still_checking" &&
				notYetApproved.status === "service_unavailable" &&
				notYetApproved.retryAfterSeconds === 60,
			"Must remain fail-closed when bre_status !== 'approved' even if current_step advanced",
		);

		// FAIL-CLOSED: Rejected dashboard overrides bre_status
		const rejectedWins = resolveErrorFallbackStatus({
			error: { isTimeout: true },
			freshChecks: makeChecks({ status: "pending" }),
			dashboardData: {
				is_rejected: true,
				workflow_progress: {
					overall_status: "rejected",
					bre_status: "approved",
					is_rejected: true,
				},
			},
		});
		assert(rejectedWins.action === "rejected", "Rejected dashboard must override bre_status");
	}

	// 6. executeAssessmentRetry: timeout calls backend retry and acts on immediate approved without re-polling
	{
		let retryCalls = 0;
		let bookingCalls = 0;
		const res = await executeAssessmentRetry({
			lastStatus: "timeout",
			lastRetryAtMs: 0,
			cooldownSeconds: 60,
			nowMs: 1_700_000_000_000,
			callRetry: async () => {
				retryCalls += 1;
				return makeChecks({ status: "approved" });
			},
			callBookingStatus: async () => {
				bookingCalls += 1;
				return makeChecks({ status: "approved" });
			},
			callDashboard: async () => null,
		});
		assert(retryCalls === 1, "Timeout retry MUST call backend retryAssessmentChecks");
		assert(bookingCalls === 0, "Immediate approved result should skip redundant booking status fetch");
		assert(res.calledBackendRetry === true, "calledBackendRetry must be true");
		assert(res.outcome.action === "approved", "Immediate approved retry must resolve to 'approved'");
	}

	// 7. executeAssessmentRetry: handles HTTP 409 from retryAssessmentChecks gracefully
	{
		// Case 7a: 409 because backend already moved to approved
		const resApproved = await executeAssessmentRetry({
			lastStatus: "service_unavailable",
			lastRetryAtMs: 0,
			cooldownSeconds: 60,
			nowMs: 1_700_000_000_000,
			callRetry: async () => {
				const err: any = new Error("Eligibility checks cannot be retried");
				err.status = 409;
				throw err;
			},
			callBookingStatus: async () => makeChecks({ status: "approved" }),
			callDashboard: async () => null,
		});
		assert(resApproved.outcome.action === "approved", "409 fallback should advance when booking_status is approved");

		// Case 7b: 409 because backend still blocks 'service_unavailable'
		const resStillBlocked = await executeAssessmentRetry({
			lastStatus: "service_unavailable",
			lastRetryAtMs: 0,
			cooldownSeconds: 60,
			nowMs: 1_700_000_000_000,
			callRetry: async () => {
				const err: any = new Error("Eligibility checks cannot be retried");
				err.status = 409;
				throw err;
			},
			callBookingStatus: async () =>
				makeChecks({ status: "service_unavailable", retry_after_seconds: 30 }),
			callDashboard: async () => null,
		});
		assert(
			resStillBlocked.outcome.action === "still_checking" &&
				resStillBlocked.outcome.status === "service_unavailable" &&
				resStillBlocked.cooldownSecondsToStart === 30,
			"409 with service_unavailable should return still_checking and respect retry_after_seconds",
		);
	}

	// 8. executeAssessmentRetry: 'pending' response triggers polling and applies default cooldown
	{
		const resPending = await executeAssessmentRetry({
			lastStatus: "timeout",
			lastRetryAtMs: 0,
			cooldownSeconds: 60,
			nowMs: 1_700_000_000_000,
			callRetry: async () => makeChecks({ status: "pending" }),
			callBookingStatus: async () => makeChecks({ status: "pending" }),
			callDashboard: async () => null,
		});
		assert(
			resPending.outcome.action === "poll" && resPending.cooldownSecondsToStart === 60,
			"Pending retry response should trigger polling and set cooldown",
		);
	}

	// 9. status === "approved" with booking_status: "service_unavailable" resolves as approved
	{
		const approvedBookingUnavail = makeChecks({
			status: "approved",
			booking_status: "service_unavailable",
			booking_success: false,
		});

		// 9a: classifyAssessmentChecksOutcome
		const classified = classifyAssessmentChecksOutcome(approvedBookingUnavail);
		assert(
			classified.action === "approved",
			"status === 'approved' with booking_status === 'service_unavailable' must classify as 'approved'",
		);

		// 9b: normalizeAssessmentChecks
		const normalized = normalizeAssessmentChecks({
			status: "approved",
			booking_status: "service_unavailable",
			booking_success: false,
		});
		assert(
			normalized.status === "approved" &&
				normalized.booking_status === "service_unavailable" &&
				normalized.booking_success === false,
			"normalizeAssessmentChecks must retain approved status even when booking is service_unavailable",
		);

		// 9c: pollAssessmentChecks returns approved on attempt 1 without error
		let pollCalls = 0;
		const polled = await pollAssessmentChecks({
			txnid: `approved_unavail_${Date.now()}`,
			leadId: "lead_approved_unavail",
			fetcher: async () => {
				pollCalls += 1;
				return approvedBookingUnavail;
			},
		});
		assert(polled.status === "approved", "pollAssessmentChecks must resolve as approved");
		assert(pollCalls === 1, `Must terminate immediately on attempt 1, got ${pollCalls}`);
	}

	// 10. A 404 from booking-status halts polling after 1 request
	{
		let poll404Calls = 0;
		let caughtErr: any = null;
		try {
			await pollAssessmentChecks({
				txnid: `txn_404_${Date.now()}`,
				leadId: "lead_404",
				fetcher: async () => {
					poll404Calls += 1;
					const notFoundErr: any = new Error("Lead not found for payment.");
					notFoundErr.isNotFound = true;
					notFoundErr.status = 404;
					throw notFoundErr;
				},
			});
		} catch (err: any) {
			caughtErr = err;
		}

		assert(poll404Calls === 1, `404 must halt polling immediately after 1 request, got ${poll404Calls}`);
		assert(
			caughtErr?.isNotFound === true && caughtErr?.status === 404,
			"Expected 404 notFound error to be thrown to caller",
		);
	}
}

