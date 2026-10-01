/**
 * Loan Journey Steps Configuration (Single Source of Truth)
 * Aligned with backend WORKFLOW_STEPS_ORDER:
 * (basic_details, assessment_fee, pan_verification, professional_details, ekyc_ckyc, bank_details, loan_application/sanction, agreement_signing, disbursement)
 */

export type JourneyStepId =
	| "basic_details"
	| "assessment_fee"
	| "pan_verification"
	| "professional_details"
	| "ekyc_ckyc"
	| "bank_details"
	| "sanction"
	| "agreement_signing"
	| "disbursement";

export interface JourneyStepSubStep {
	id: string;
	titleKey: string;
	title: string;
}

export interface JourneyStep {
	id: JourneyStepId;
	titleKey: string;
	title: string;
	activeSubtitleKey?: string;
	activeSubtitle?: string;
	nextRoute: string;
	subSteps?: JourneyStepSubStep[];
}

export const JOURNEY_STEPS: JourneyStep[] = [
	{
		id: "basic_details",
		titleKey: "basicDetailsStepTitle",
		title: "Basic details",
		activeSubtitle: "Validating your personal information",
		nextRoute: "/new-assessment-fee",
	},
	{
		id: "assessment_fee",
		titleKey: "assessmentFeeStepTitle",
		title: "Assessment fee",
		activeSubtitleKey: "verifyingPaymentWait",
		activeSubtitle: "Confirming fee payment and policy",
		nextRoute: "/professional-details",
		subSteps: [
			{
				id: "verifying_payment",
				titleKey: "verifyingPaymentWait",
				title: "Verifying your payment...",
			},
			{
				id: "confirming_details",
				titleKey: "paymentConfirmedVerifyingDetails",
				title: "Confirming your details...",
			},
			{
				id: "evaluating_policy",
				titleKey: "evaluatingCreditPolicyCriteria",
				title: "Evaluating credit policy...",
			},
		],
	},
	{
		id: "pan_verification",
		titleKey: "verifyingPan",
		title: "PAN verification",
		activeSubtitle: "NSDL validation in progress",
		nextRoute: "/professional-details",
	},
	{
		id: "professional_details",
		titleKey: "professionalDetailsStepTitle",
		title: "Professional details",
		activeSubtitle: "Verifying employment & income",
		nextRoute: "/professional-details-success",
	},
	{
		id: "ekyc_ckyc",
		titleKey: "kycVerificationStepTitle",
		title: "KYC & identity verification",
		activeSubtitle: "Authenticating CKYC & Aadhaar",
		nextRoute: "/ckyc-instructions",
	},
	{
		id: "bank_details",
		titleKey: "bankVerificationStepTitle",
		title: "Bank account verification",
		activeSubtitle: "Penny drop in progress",
		nextRoute: "/sanction-letter",
	},
	{
		id: "sanction",
		titleKey: "sanctionApprovalStepTitle",
		title: "Sanction letter & approval",
		activeSubtitle: "Generating sanction offer",
		nextRoute: "/loan-agreement",
	},
	{
		id: "agreement_signing",
		titleKey: "agreementSigningStepTitle",
		title: "Agreement signing",
		activeSubtitle: "Signing digital loan agreement",
		nextRoute: "/auto-debit-setup",
	},
	{
		id: "disbursement",
		titleKey: "disbursementSetupStepTitle",
		title: "Disbursement & mandate",
		activeSubtitle: "Setting up auto-debit & payout",
		nextRoute: "/(tabs)",
	},
];

export const JOURNEY_STEP_IDS: JourneyStepId[] = JOURNEY_STEPS.map((s) => s.id);

export function getStepIndex(stepId: JourneyStepId): number {
	const idx = JOURNEY_STEP_IDS.indexOf(stepId);
	return idx >= 0 ? idx : 0;
}

export function getJourneyStep(stepId: JourneyStepId): JourneyStep | undefined {
	return JOURNEY_STEPS.find((s) => s.id === stepId);
}

/**
 * Returns all step IDs that precede `stepId` in the journey.
 */
export function getCompletedBefore(stepId: JourneyStepId): JourneyStepId[] {
	const idx = JOURNEY_STEP_IDS.indexOf(stepId);
	if (idx <= 0) return [];
	return JOURNEY_STEP_IDS.slice(0, idx);
}

/**
 * Calculates progress percentage (0 - 100) based on real completed/total steps.
 */
export function getProgressPercent(
	completedIds: (JourneyStepId | string)[],
	activeStepId?: JourneyStepId | string | null
): number {
	const total = JOURNEY_STEPS.length;
	if (total === 0) return 0;

	// Completed step count
	const completedCount = completedIds.length;
	// If an active step is running, count it as half-progress toward completion
	const activeWeight = activeStepId && !completedIds.includes(activeStepId as any) ? 0.5 : 0;

	const percent = Math.round(((completedCount + activeWeight) / total) * 100);
	return Math.min(100, Math.max(5, percent));
}
