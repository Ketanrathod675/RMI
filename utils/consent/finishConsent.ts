import Toast from "react-native-toast-message";
import type { QueryClient } from "@tanstack/react-query";
import type { useRouter } from "expo-router";
import { getUserDashboardData } from "@/utils/api/services/user.service";
import { resolveWorkflowRoute } from "@/utils/api/types/user.types";
import { getApiErrorInfo } from "@/utils/api/errors";
import Logger from "@/utils/logger";

type AppRouter = ReturnType<typeof useRouter>;

interface FinishConsentOptions {
	queryClient: QueryClient;
	router: AppRouter;
	responseMessage?: string;
}

/**
 * Executes the post-consent completion workflow:
 * 1. Shows a success toast
 * 2. Invalidates the user dashboard query
 * 3. Fetches fresh dashboard data
 * 4. Resolves the next workflow route and navigates accordingly
 */
export async function finishConsent({
	queryClient,
	router,
	responseMessage = "Consent document signed successfully",
}: FinishConsentOptions): Promise<void> {
	Toast.show({
		type: "success",
		text1: responseMessage,
		visibilityTime: 3000,
	});

	await queryClient.invalidateQueries({ queryKey: ["user", "dashboard"] });
	const freshDash = await getUserDashboardData();

	const currentStep = freshDash?.workflow_progress?.current_step;
	const overallStatus = freshDash?.workflow_progress?.overall_status;
	const breStatus =
		freshDash?.workflow_progress?.bre_status ??
		(freshDash as any)?.lead?.lead_metadata?.bre_status;
	const breFailedRule =
		freshDash?.workflow_progress?.bre_failed_rule ??
		(freshDash as any)?.lead?.lead_metadata?.bre_failed_rule;

	const nextRoute = resolveWorkflowRoute(
		currentStep,
		overallStatus,
		breStatus,
		breFailedRule,
	);

	Logger.debug("Consent finished, resolved next route", { currentStep, nextRoute });

	if (nextRoute === "/customer-data-consent") {
		Toast.show({
			type: "error",
			text1: "Your application has not advanced yet. Please try again shortly.",
			visibilityTime: 4000,
		});
		return;
	}

	if (nextRoute === "/professional-details") {
		router.replace({
			pathname: "/professional-details" as any,
			params: { disableBack: "true" },
		});
	} else {
		router.replace(nextRoute as any);
	}
}

/**
 * Checks if a signing/initiate error is a 409 status that can be handled gracefully:
 * - 409 "already signed" -> treated as success
 * - 409 "not required" or "not in progress" -> invalidates dashboard and redirects to (tabs)
 */
export async function handleConsent409Error(
	err: any,
	queryClient: QueryClient,
	router: AppRouter,
): Promise<{ isHandled: boolean; isSuccess?: boolean; message?: string }> {
	const info = getApiErrorInfo(err);
	const detailLower = (info.detail || "").toLowerCase();

	if (info.status === 409 && detailLower.includes("already signed")) {
		return {
			isHandled: true,
			isSuccess: true,
			message: info.detail || "Consent already signed",
		};
	}

	if (
		info.status === 409 &&
		(detailLower.includes("not required") ||
			detailLower.includes("not in progress"))
	) {
		await queryClient.invalidateQueries({ queryKey: ["user", "dashboard"] });
		router.replace("/(tabs)");
		return {
			isHandled: true,
			isSuccess: false,
		};
	}

	return { isHandled: false };
}
