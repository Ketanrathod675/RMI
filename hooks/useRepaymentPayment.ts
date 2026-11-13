import { useCallback, useRef, useState } from "react";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import Toast from "react-native-toast-message";
import Logger from "@/utils/logger";
import { getFriendlyError } from "@/utils/api/core/friendlyError";
import { initiateRepayment } from "@/utils/api/services/repayment.service";
import type { ActiveLoan } from "@/utils/api/types/repayment.types";
import { invalidatePostRepaymentQueries, type VerifySource } from "@/utils/paymentVerification";
import {
	classifyRepaymentInitiate409,
	clearStoredRepaymentKeys,
	initiateRepaymentWithConflictRetry,
	interpretRepaymentInitiateResponse,
	saveRepaymentKeyExpiry,
} from "@/utils/repaymentIdempotency";
import { openExternalUrl } from "@/utils/openExternalUrl";
import { getStorageItem, setStorageItem, STORAGE_KEYS } from "@/utils/storage";
import { useTranslation } from "./useTranslation";

const REPAYMENT_RETURN_SCHEME = "rapid-money://";

interface UseRepaymentPaymentOptions {
	activeLoan?: ActiveLoan | null;
}

export function useRepaymentPayment({ activeLoan }: UseRepaymentPaymentOptions = {}) {
	const router = useRouter();
	const queryClient = useQueryClient();
	const { t } = useTranslation();
	const [isInitiating, setIsInitiating] = useState(false);
	const submitGuardRef = useRef(false);
	const activeLoanRef = useRef<ActiveLoan | null | undefined>(activeLoan);
	activeLoanRef.current = activeLoan;

	const handlePayNow = useCallback(async () => {
		if (submitGuardRef.current) {
			Logger.debug("handlePayNow ignored: submit guard active");
			return;
		}

		submitGuardRef.current = true;
		setIsInitiating(true);

		const currentActiveLoan = activeLoanRef.current;

		try {
			// 1 & 2. Initiate payment using scoped idempotency key (auto-retries once on stale 409)
			const rawRes = await initiateRepaymentWithConflictRetry({
				amount: currentActiveLoan?.amount_to_repay ?? null,
				initiateFn: initiateRepayment,
			});

			const interpreted = interpretRepaymentInitiateResponse(rawRes);

			if (interpreted.kind === "already_paid") {
				await clearStoredRepaymentKeys();
				await invalidatePostRepaymentQueries(queryClient);

				if (interpreted.txnid) {
					router.push({
						pathname: "/repayment-status" as any,
						params: { txnid: interpreted.txnid, source: "manual" },
					});
				} else {
					Toast.show({
						type: "success",
						text1: t("paymentAlreadyReceived", "Your previous payment was received"),
					});
				}
				return;
			}

			if (interpreted.kind !== "open_url") {
				Logger.warn("Repayment initiation failed: missing or invalid payment_url/txnid");
				Toast.show({
					type: "error",
					text1: t("unableToInitiatePayment", "Unable to initiate payment"),
					text2: t("pleaseRetryPayment", "Please try again shortly"),
				});
				return;
			}

			if (interpreted.resumed) {
				Logger.info("Resuming existing repayment payment link", { txnid: interpreted.txnid });
			}

			const numericResAmount =
				typeof interpreted.amount === "number"
					? interpreted.amount
					: Number(interpreted.amount) || undefined;
			const amountForMeta = currentActiveLoan?.amount_to_repay ?? numericResAmount;
			await saveRepaymentKeyExpiry(interpreted.expiresAt, amountForMeta);

			// 3. Persist attempt details in storage
			const startedAt = Date.now();
			const amountBefore = amountForMeta ?? 0;
			await setStorageItem(STORAGE_KEYS["@repayment-txnid"], interpreted.txnid);
			await setStorageItem(STORAGE_KEYS["@repayment-timestamp"], String(startedAt));
			await setStorageItem(STORAGE_KEYS["@repayment-amount-before"], String(amountBefore));

			// 4. Open payment gateway with WebBrowser (no polling while gateway is open)
			let navSource: VerifySource = "browser_closed";
			try {
				const result: any = await WebBrowser.openAuthSessionAsync(
					interpreted.paymentUrl,
					REPAYMENT_RETURN_SCHEME,
				);
				Logger.debug("Repayment WebBrowser session finished", { type: result?.type });

				if (result?.type === "success" && result?.url) {
					const { queryParams } = Linking.parse(result.url);
					const statusLower = String(queryParams?.status || "").toLowerCase();
					if (statusLower === "success") {
						navSource = "deeplink_success";
					} else if (statusLower === "failure" || statusLower === "failed") {
						navSource = "deeplink_failure";
					}
				}
			} catch (browserErr) {
				Logger.warn("Repayment openAuthSessionAsync failed, falling back to openExternalUrl");
				await openExternalUrl(interpreted.paymentUrl);
			}

			// 5. Navigate to verification screen
			router.push({
				pathname: "/repayment-status" as any,
				params: { txnid: interpreted.txnid, source: navSource },
			});
		} catch (err: any) {
			const detail = err?.response?.data?.detail;
			const detailStr = typeof detail === "string" ? detail.toLowerCase() : JSON.stringify(detail || "").toLowerCase();

			// 409 / Active payment link conflict -> ONLY route to status when genuinely in flight at gateway
			if (classifyRepaymentInitiate409(err) === "in_progress") {
				await invalidatePostRepaymentQueries(queryClient);
				const storedTxn =
					err?.response?.data?.txnid ||
					(await getStorageItem(STORAGE_KEYS["@repayment-txnid"])) ||
					currentActiveLoan?.active_payment?.txnid;

				if (storedTxn) {
					router.push({
						pathname: "/repayment-status" as any,
						params: { txnid: storedTxn, source: "manual" },
					});
					return;
				}

				const friendly = getFriendlyError(err);
				Toast.show({
					type: "error",
					text1: t("paymentFailedTitle", "Payment initiation failed"),
					text2: friendly.message || t("pleaseRetryPayment", "Please try again shortly"),
				});
				return;
			}

			// No outstanding amount
			if (detailStr.includes("no outstanding") || detailStr.includes("already repaid") || detailStr.includes("no active loan")) {
				await invalidatePostRepaymentQueries(queryClient);
				Toast.show({
					type: "info",
					text1: t("noOutstandingPayment", "No outstanding payment found"),
				});
				return;
			}

			// Network / Server errors
			const friendly = getFriendlyError(err);
			Toast.show({
				type: "error",
				text1: t("paymentFailedTitle", "Payment initiation failed"),
				text2: friendly.message || t("pleaseRetryPayment", "Please try again shortly"),
			});
		} finally {
			submitGuardRef.current = false;
			setIsInitiating(false);
		}
	}, [queryClient, router, t]);

	return {
		handlePayNow,
		isInitiating,
	};
}

