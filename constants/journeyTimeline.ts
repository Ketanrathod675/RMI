import Logger from "../utils/logger";
import { type TranslationKey } from "./translations";

export type TimelineGroupId = "profile" | "kyc" | "bank" | "payout";

export interface TimelineGroup {
	id: TimelineGroupId;
	labelKey: TranslationKey;
	titleKey: TranslationKey;
	subtitleKey: TranslationKey;
	stepNames: readonly string[];
}

export const TIMELINE_GROUPS: readonly TimelineGroup[] = [
	{
		id: "profile",
		labelKey: "journeyProfile",
		titleKey: "journeyGroupProfileTitle",
		subtitleKey: "journeyGroupProfileSubtitle",
		stepNames: [
			"signup_login",
			"login_signup",
			"basic_details",
			"personal_details",
			"assessment_fee",
			"assessment_fee_payment",
			"email_verification",
			"pan_verification",
			"customer_consent_step",
			"consent_permission",
			"mpin_set",
			"professional_details",
		],
	},
	{
		id: "kyc",
		labelKey: "journeyKyc",
		titleKey: "journeyGroupKycTitle",
		subtitleKey: "journeyGroupKycSubtitle",
		stepNames: [
			"ekyc_ckyc",
			"ckyc",
			"digilocker",
			"selfie_match",
			"address_submission",
		],
	},
	{
		id: "bank",
		labelKey: "journeyBank",
		titleKey: "journeyGroupBankTitle",
		subtitleKey: "journeyGroupBankSubtitle",
		stepNames: [
			"credit_queue",
			"loan_application",
			"bank_details",
			"enach_mandate",
			"pdq_check",
		],
	},
	{
		id: "payout",
		labelKey: "journeyPayout",
		titleKey: "journeyGroupPayoutTitle",
		subtitleKey: "journeyGroupPayoutSubtitle",
		stepNames: [
			"agreement_signing",
			"kfs_signing",
			"disbursement",
		],
	},
] as const;

export const STEP_SUBTITLE_KEYS: Partial<Record<string, TranslationKey>> = {
	pan_verification: "journeyStepPanSubtitle",
	professional_details: "journeyStepProfessionalSubtitle",
	ekyc_ckyc: "journeyStepAadhaarSubtitle",
	digilocker: "journeyStepAadhaarSubtitle",
	ckyc: "journeyStepAadhaarSubtitle",
	selfie_match: "journeyStepSelfieSubtitle",
	address_submission: "journeyStepAddressSubtitle",
	credit_queue: "journeyStepCreditQueueSubtitle",
	loan_application: "journeyStepLoanAppSubtitle",
	bank_details: "journeyStepBankDetailsSubtitle",
	enach_mandate: "journeyStepEnachSubtitle",
	pdq_check: "journeyStepPdqSubtitle",
	agreement_signing: "journeyStepAgreementSubtitle",
	kfs_signing: "journeyStepAgreementSubtitle",
	disbursement: "journeyStepDisbursementSubtitle",
};

export interface TimelineState {
	activeIndex: number; // 0..3
	completedCount: number; // 0..4
	allComplete: boolean;
	isDisbursing: boolean;
	groupProgress: number; // 10..90 (or 100 when allComplete)
	stepName: string;
	groupId: TimelineGroupId;
	currentGroup: TimelineGroup;
	subtitleKey: TranslationKey;
}

export type MinimalWorkflowProgress = {
	current_step?: string | null;
	overall_status?: string | null;
	completion_percentage?: number | null;
	bre_status?: string | null;
};

const loggedUnknownSteps = new Set<string>();

/**
 * Resolves the 4-step horizontal timeline state from backend workflow_progress.
 *
 * Rules:
 * - Read current_step and overall_status.
 * - If overall_status === "completed": allComplete = true, activeIndex = 3, completedCount = 4.
 * - Find the group whose stepNames includes current_step.
 * - If current_step is unknown/empty: log once with Logger, fallback to activeIndex = 0.
 * - groupProgress is clamped between 10% and 90% (or 100% when allComplete).
 * - isDisbursing = current_step === "disbursement" && overall_status !== "completed".
 * - Never uses completion_percentage (90-99%) thresholds to decide state.
 */
export function resolveTimelineState(
	workflowProgress: MinimalWorkflowProgress | null | undefined,
): TimelineState {
	const currentStep = workflowProgress?.current_step ? String(workflowProgress.current_step).trim() : "";
	const overallStatus = workflowProgress?.overall_status ? String(workflowProgress.overall_status).trim().toLowerCase() : "";

	// Overall completed state
	if (overallStatus === "completed") {
		const lastGroup = TIMELINE_GROUPS[3];
		return {
			activeIndex: 3,
			completedCount: 4,
			allComplete: true,
			isDisbursing: false,
			groupProgress: 100,
			stepName: currentStep || "completed",
			groupId: lastGroup.id,
			currentGroup: lastGroup,
			subtitleKey: lastGroup.subtitleKey,
		};
	}

	// Match group
	const groupIndex = TIMELINE_GROUPS.findIndex((group) =>
		group.stepNames.includes(currentStep),
	);

	if (groupIndex === -1) {
		if (currentStep && !loggedUnknownSteps.has(currentStep)) {
			loggedUnknownSteps.add(currentStep);
			Logger.warn("Unknown workflow current_step in timeline", { step: currentStep });
		}
		const defaultGroup = TIMELINE_GROUPS[0];
		return {
			activeIndex: 0,
			completedCount: 0,
			allComplete: false,
			isDisbursing: false,
			groupProgress: 10,
			stepName: currentStep,
			groupId: defaultGroup.id,
			currentGroup: defaultGroup,
			subtitleKey: defaultGroup.subtitleKey,
		};
	}

	const group = TIMELINE_GROUPS[groupIndex];
	const stepIdxInGroup = group.stepNames.indexOf(currentStep);
	const position = stepIdxInGroup >= 0 ? stepIdxInGroup + 1 : 1;
	const rawProgress = Math.round((position / group.stepNames.length) * 100);
	const groupProgress = Math.min(90, Math.max(10, rawProgress));

	const isDisbursing = currentStep === "disbursement" && overallStatus !== "completed";
	const subtitleKey = STEP_SUBTITLE_KEYS[currentStep] || group.subtitleKey;

	return {
		activeIndex: groupIndex,
		completedCount: groupIndex,
		allComplete: false,
		isDisbursing,
		groupProgress,
		stepName: currentStep,
		groupId: group.id,
		currentGroup: group,
		subtitleKey,
	};
}
