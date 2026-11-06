import Toast from "react-native-toast-message";
import Logger from "@/utils/logger";
import { getFriendlyError } from "@/utils/api/core/friendlyError";
import { checkCanReapply, reapplyForLoan, StepHref } from "@/utils/api";
import {
	clearApplicationRejectionFlags,
	resetApplicationRejectionGuard,
} from "@/utils/applicationRejection";

/**
 * Shared loan reapplication execution.
 * Checks eligibility -> triggers reapply -> clears rejection flags -> routes to next step with fromReapply=true.
 */
export async function executeLoanReapply(
	router: any,
	queryClient: any,
	t?: (key: any, fallback?: string) => string,
): Promise<boolean> {
	try {
		const reapplyData = await checkCanReapply();

		if (reapplyData.can_apply) {
			try {
				const reapplyRes = await reapplyForLoan();
				resetApplicationRejectionGuard();
				await clearApplicationRejectionFlags();
				await queryClient.invalidateQueries({ queryKey: ["user", "dashboard"] });

				const currentStep = reapplyRes?.current_step;
				const href = currentStep
					? StepHref[currentStep as keyof typeof StepHref]
					: "/new-assessment-fee";

				router.replace({
					pathname: (href || "/new-assessment-fee") as any,
					params: { fromReapply: "true" },
				});
				return true;
			} catch (reapplyErr: any) {
				const detailText = getFriendlyError(reapplyErr).message;
				Toast.show({
					type: "error",
					text1: t ? t("cannotReapply", "Cannot reapply") : "Cannot reapply",
					text2: detailText,
				});
				return false;
			}
		} else {
			const rawMsg = (reapplyData.message || "").toLowerCase();
			const mentionsCoolingOrInternal =
				rawMsg.includes("cool") ||
				rawMsg.includes("30") ||
				rawMsg.includes("period") ||
				rawMsg.includes("wait") ||
				rawMsg.includes("days") ||
				rawMsg.includes("policy") ||
				rawMsg.includes("rule") ||
				rawMsg.includes("bre") ||
				rawMsg.includes("lender");

			const message = rawMsg.includes("overdue")
				? t
					? t("overdueLoanMessage", "You have an overdue loan payment")
					: "You have an overdue loan payment"
				: mentionsCoolingOrInternal
					? t
						? t("notEligibleToReapply", "You are not eligible to re-apply at this time")
						: "You are not eligible to re-apply at this time"
					: reapplyData.message || (t ? t("notEligibleToReapply", "You are not eligible to re-apply at this time") : "You are not eligible to re-apply at this time");

			Toast.show({
				type: "error",
				text1: t ? t("cannotReapply", "Cannot reapply") : "Cannot reapply",
				text2: message,
			});
			return false;
		}
	} catch (error: any) {
		Logger.warn("executeLoanReapply failed", { error });
		const detailText = getFriendlyError(error).message;
		Toast.show({
			type: "error",
			text1: t ? t("cannotReapply", "Cannot reapply") : "Cannot reapply",
			text2: detailText,
		});
		return false;
	}
}

