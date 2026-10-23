import { checkPaymentStatus, getUserDashboardData } from "@/utils/api";
import Logger from "@/utils/logger";
import { getStorageItem, STORAGE_KEYS } from "@/utils/storage";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";

// Module-level guard: never redirect more than once per app session
let hasRedirectedThisSession = false;

const FEE_STEPS = ["assessment_fee", "assessment_fee_payment", "fee_payment"];

/**
 * Recovery hook for pending assessment fee transactions (Phase B1).
 * Only redirects if BOTH:
 * 1) Server says payment for that txn is COMPLETED
 * 2) Dashboard step is still fee step (or BRE is pending)
 *
 * For PENDING/unconfirmed, does NOT redirect; exposes hasPendingPayment state.
 * For FAILED/CANCELLED/EXPIRED, does nothing (cleanup is owned by payment hook).
 * Never redirects more than once per app session.
 * Never redirects if user is already past the fee step.
 */
export const usePendingPaymentRecovery = () => {
	const router = useRouter();
	const [hasPendingPayment, setHasPendingPayment] = useState(false);
	const [pendingTxnId, setPendingTxnId] = useState<string | null>(null);

	useEffect(() => {
		let isMounted = true;

		(async () => {
			const txnId = await getStorageItem(STORAGE_KEYS["@transaction-id"]);
			if (!txnId || !isMounted) return;

			try {
				// Check dashboard step first: never redirect if already past fee step
				const dash: any = await getUserDashboardData().catch(() => null);
				if (!isMounted) return;

				const currentStep = String(
					dash?.workflow_progress?.current_step || dash?.current_step || ""
				).toLowerCase().trim();

				// If user is already past fee step, do not redirect
				const isAtFeeStep = !currentStep || FEE_STEPS.includes(currentStep);
				const breStatus = String(dash?.workflow_progress?.bre_status ?? (dash as any)?.lead?.lead_metadata?.bre_status ?? "").toLowerCase();
				const isBrePending = breStatus === "pending" || breStatus === "error";

				if (!isAtFeeStep && !isBrePending) {
					Logger.debug("User already past fee step, skipping payment recovery redirect", { currentStep });
					return;
				}

				const res = await checkPaymentStatus(txnId);
				if (!isMounted) return;

				const rawStatus = String(res?.data?.status ?? "").toUpperCase();

				if (["COMPLETED", "SUCCESS", "WAIVED"].includes(rawStatus)) {
					if (hasRedirectedThisSession) {
						Logger.debug("Already redirected this session, skipping duplicate redirect", { txnId });
						return;
					}
					hasRedirectedThisSession = true;
					router.replace({
						pathname: "/new-assessment-fee",
						params: { resumeChecks: "true", txnid: txnId },
					});
					return;
				}

				if (!["FAILED", "FAILURE", "REJECTED", "DROPPED", "BOUNCED", "CANCELLED", "CANCELED", "EXPIRED"].includes(rawStatus)) {
					// PENDING / unconfirmed: do NOT redirect; leave key alone, expose state for optional non-blocking banner
					setHasPendingPayment(true);
					setPendingTxnId(txnId);
				}
			} catch (err) {
				Logger.warn("Pending payment recovery check failed", err);
			}
		})();

		return () => {
			isMounted = false;
		};
	}, [router]);

	return { hasPendingPayment, pendingTxnId };
};

export default usePendingPaymentRecovery;
