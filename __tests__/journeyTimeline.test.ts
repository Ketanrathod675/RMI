/**
 * Unit test suite for constants/journeyTimeline.ts: resolveTimelineState
 *
 * Verifies all required backend steps:
 * 1. Profile group: basic_details, pan_verification, professional_details
 * 2. KYC group: ekyc_ckyc, digilocker, selfie_match, address_submission
 * 3. Bank group: credit_queue, loan_application, bank_details, enach_mandate, pdq_check
 * 4. Payout group: agreement_signing, disbursement (isDisbursing)
 * 5. Robustness: unknown value, null/empty string
 * 6. Overall status: "completed"
 */

import {
	resolveTimelineState,
	type TimelineState,
} from "../constants/journeyTimeline";

function assert(condition: boolean, message: string): void {
	if (!condition) {
		throw new Error(`Assertion failed: ${message}`);
	}
}

export function runJourneyTimelineTests(): void {
	// 1. Profile group steps
	{
		const state = resolveTimelineState({
			current_step: "basic_details",
			overall_status: "in_progress",
		});
		assert(state.activeIndex === 0, "basic_details should have activeIndex = 0 (Profile)");
		assert(state.groupId === "profile", "basic_details should belong to profile group");
		assert(state.completedCount === 0, "basic_details should have completedCount = 0");
		assert(!state.allComplete, "basic_details should not be allComplete");
		assert(!state.isDisbursing, "basic_details should not be isDisbursing");
		assert(state.groupProgress >= 10 && state.groupProgress <= 90, "groupProgress should be clamped between 10 and 90");
	}

	{
		const state = resolveTimelineState({
			current_step: "pan_verification",
			overall_status: "in_progress",
		});
		assert(state.activeIndex === 0, "pan_verification should have activeIndex = 0 (Profile)");
		assert(state.subtitleKey === "journeyStepPanSubtitle", "pan_verification should map to journeyStepPanSubtitle");
	}

	{
		const state = resolveTimelineState({
			current_step: "professional_details",
			overall_status: "in_progress",
		});
		assert(state.activeIndex === 0, "professional_details should have activeIndex = 0 (Profile)");
		assert(state.subtitleKey === "journeyStepProfessionalSubtitle", "professional_details should map to journeyStepProfessionalSubtitle");
	}

	// 2. KYC group steps
	{
		const state = resolveTimelineState({
			current_step: "ekyc_ckyc",
			overall_status: "in_progress",
		});
		assert(state.activeIndex === 1, "ekyc_ckyc should have activeIndex = 1 (KYC)");
		assert(state.groupId === "kyc", "ekyc_ckyc should belong to kyc group");
		assert(state.completedCount === 1, "ekyc_ckyc should have completedCount = 1 (Profile completed)");
		assert(state.subtitleKey === "journeyStepAadhaarSubtitle", "ekyc_ckyc should map to journeyStepAadhaarSubtitle");
	}

	{
		const state = resolveTimelineState({
			current_step: "digilocker",
			overall_status: "in_progress",
		});
		assert(state.activeIndex === 1, "digilocker should have activeIndex = 1 (KYC)");
		assert(state.subtitleKey === "journeyStepAadhaarSubtitle", "digilocker should map to journeyStepAadhaarSubtitle");
	}

	{
		const state = resolveTimelineState({
			current_step: "selfie_match",
			overall_status: "in_progress",
		});
		assert(state.activeIndex === 1, "selfie_match should have activeIndex = 1 (KYC)");
		assert(state.subtitleKey === "journeyStepSelfieSubtitle", "selfie_match should map to journeyStepSelfieSubtitle");
	}

	{
		const state = resolveTimelineState({
			current_step: "address_submission",
			overall_status: "in_progress",
		});
		assert(state.activeIndex === 1, "address_submission should have activeIndex = 1 (KYC)");
		assert(state.subtitleKey === "journeyStepAddressSubtitle", "address_submission should map to journeyStepAddressSubtitle");
	}

	// 3. Bank group steps
	{
		const state = resolveTimelineState({
			current_step: "credit_queue",
			overall_status: "in_progress",
		});
		assert(state.activeIndex === 2, "credit_queue should have activeIndex = 2 (Bank)");
		assert(state.groupId === "bank", "credit_queue should belong to bank group");
		assert(state.completedCount === 2, "credit_queue should have completedCount = 2 (Profile + KYC completed)");
		assert(state.subtitleKey === "journeyStepCreditQueueSubtitle", "credit_queue should map to journeyStepCreditQueueSubtitle");
	}

	{
		const state = resolveTimelineState({
			current_step: "loan_application",
			overall_status: "in_progress",
		});
		assert(state.activeIndex === 2, "loan_application should have activeIndex = 2 (Bank)");
		assert(state.subtitleKey === "journeyStepLoanAppSubtitle", "loan_application should map to journeyStepLoanAppSubtitle");
	}

	{
		const state = resolveTimelineState({
			current_step: "bank_details",
			overall_status: "in_progress",
		});
		assert(state.activeIndex === 2, "bank_details should have activeIndex = 2 (Bank)");
		assert(state.subtitleKey === "journeyStepBankDetailsSubtitle", "bank_details should map to journeyStepBankDetailsSubtitle");
	}

	{
		const state = resolveTimelineState({
			current_step: "enach_mandate",
			overall_status: "in_progress",
		});
		assert(state.activeIndex === 2, "enach_mandate should have activeIndex = 2 (Bank)");
		assert(state.subtitleKey === "journeyStepEnachSubtitle", "enach_mandate should map to journeyStepEnachSubtitle");
	}

	{
		const state = resolveTimelineState({
			current_step: "pdq_check",
			overall_status: "in_progress",
		});
		assert(state.activeIndex === 2, "pdq_check should have activeIndex = 2 (Bank)");
		assert(state.subtitleKey === "journeyStepPdqSubtitle", "pdq_check should map to journeyStepPdqSubtitle");
	}

	// 4. Payout group steps
	{
		const state = resolveTimelineState({
			current_step: "agreement_signing",
			overall_status: "in_progress",
		});
		assert(state.activeIndex === 3, "agreement_signing should have activeIndex = 3 (Payout)");
		assert(state.groupId === "payout", "agreement_signing should belong to payout group");
		assert(state.completedCount === 3, "agreement_signing should have completedCount = 3");
		assert(!state.isDisbursing, "agreement_signing is not yet disbursement");
		assert(state.subtitleKey === "journeyStepAgreementSubtitle", "agreement_signing should map to journeyStepAgreementSubtitle");
	}

	{
		const state = resolveTimelineState({
			current_step: "disbursement",
			overall_status: "in_progress",
		});
		assert(state.activeIndex === 3, "disbursement should have activeIndex = 3 (Payout)");
		assert(state.isDisbursing === true, "disbursement with overall_status != completed must set isDisbursing = true");
		assert(!state.allComplete, "disbursement is not yet allComplete");
		assert(state.subtitleKey === "journeyStepDisbursementSubtitle", "disbursement should map to journeyStepDisbursementSubtitle");
	}

	// 5. Unknown value / empty / null
	{
		const state = resolveTimelineState({
			current_step: "completely_unknown_step_123",
			overall_status: "in_progress",
		});
		assert(state.activeIndex === 0, "unknown step should fallback to activeIndex = 0 without crashing");
		assert(!state.allComplete, "unknown step should not be allComplete");
		assert(!state.isDisbursing, "unknown step should not be isDisbursing");
	}

	{
		const state = resolveTimelineState(null);
		assert(state.activeIndex === 0, "null workflowProgress should fallback safely");
		assert(state.completedCount === 0, "null workflowProgress should have completedCount = 0");
	}

	// 6. Overall status: "completed"
	{
		const state = resolveTimelineState({
			current_step: "disbursement",
			overall_status: "completed",
		});
		assert(state.allComplete === true, "overall_status = completed must set allComplete = true");
		assert(state.activeIndex === 3, "overall_status = completed must set activeIndex = 3");
		assert(state.completedCount === 4, "overall_status = completed must set completedCount = 4");
		assert(state.isDisbursing === false, "overall_status = completed must set isDisbursing = false");
		assert(state.groupProgress === 100, "overall_status = completed must have groupProgress = 100");
	}
}

// Execute tests if running directly
try {
	runJourneyTimelineTests();
	// Test passed silently without console.log
} catch (error) {
	throw error;
}
