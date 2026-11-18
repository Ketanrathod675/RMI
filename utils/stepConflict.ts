import Toast from "react-native-toast-message";
import { getApiErrorInfo } from "@/utils/api/errors";
import { getWorkflowProgress } from "@/utils/api/services/user.service";
import { StepHref, StepNameTypes } from "@/utils/api/types/user.types";
import { handleApplicationRejected, isRejectedStatus } from "@/utils/applicationRejection";
import { getSyncTranslation } from "@/utils/toast_translations";

export type StepRoute = string | { pathname: string; params?: Record<string, any> };

/**
 * Returns the navigation destination for a given workflow step.
 * Special cases:
 * - "selfie_match" -> { pathname: "/ckyc-instructions", params: { startSelfie: "true" } }
 * - "address_submission" -> { pathname: "/aadhaar-kyc", params: { startFromAddress: "true" } }
 * - unknown / falsy -> "/(tabs)"
 */
export function routeForStep(step?: string | null): StepRoute {
	if (!step) return "/(tabs)";
	if (step === "selfie_match") {
		return { pathname: "/ckyc-instructions", params: { startSelfie: "true" } };
	}
	if (step === "address_submission") {
		return { pathname: "/aadhaar-kyc", params: { startFromAddress: "true" } };
	}
	return StepHref[step as StepNameTypes] ?? "/(tabs)";
}

let isHandlingStepConflict = false;

export interface HandleStepConflictParams {
	router: { replace: (route: any) => void };
	queryClient?: any;
	error: any;
	source?: string;
	getWorkflowProgressFn?: () => Promise<any>;
}

/**
 * Recovers from HTTP 409 step conflict errors by checking server workflow progress
 * and redirecting the user to their actual step.
 *
 * Returns true if the conflict was handled (navigated or rejected), false otherwise.
 */
export async function handleStepConflict({
	router,
	queryClient,
	error,
	source = "step_conflict",
	getWorkflowProgressFn = getWorkflowProgress,
}: HandleStepConflictParams): Promise<boolean> {
	const info = getApiErrorInfo(error);
	if (info.status !== 409) {
		return false;
	}

	if (isHandlingStepConflict) {
		return true;
	}

	isHandlingStepConflict = true;
	try {
		const res = await getWorkflowProgressFn();
		const progressData = res?.data;

		if (isRejectedStatus(progressData)) {
			await handleApplicationRejected({ router, queryClient, source });
			return true;
		}

		const currentStep = progressData?.current_step;
		if (currentStep) {
			Toast.show({
				type: "info",
				text1: getSyncTranslation("alert", "Alert"),
				text2: getSyncTranslation(
					"movingToCorrectStep",
					"Your application is on a different step. Taking you there...",
				),
			});
			router.replace(routeForStep(currentStep) as any);
			return true;
		}

		return false;
	} catch {
		return false;
	} finally {
		// Release guard after navigation completes
		setTimeout(() => {
			isHandlingStepConflict = false;
		}, 1000);
	}
}

export function resetStepConflictGuard(): void {
	isHandlingStepConflict = false;
}
