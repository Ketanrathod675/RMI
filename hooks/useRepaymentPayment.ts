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
import { generateUUID, type VerifySource } from "@/utils/paymentVerification";
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

	const handlePayNow = useCallback(async () => {
		if (submitGuardRef.current) {
			Logger.debug("handlePayNow ignored: submit guard active");
			return;
		}

		submitGuardRef.current = true;
		setIsInitiating(true);

		try {
			// 1. Get or generate persistent Idempotency-Key for this attempt
			let idempotencyKey = await getStorageItem(STORAGE_KEYS["@repayment-idempotency-key"]);
			if (!idempotencyKey) {
				idempotencyKey = generateUUID();
				await setStorageItem(STORAGE_KEYS["@repayment-idempotency-key"], idempotencyKey);
			}

			// 2. Initiate payment with the backend
			const res = await initiateRepayment(idempotencyKey);
			const url = res?.payment_url;
			const txnid = res?.txnid;

			// Validate payment_url: strictly HTTPS and present
			if (!url || typeof url !== "string" || !url.startsWith("https://") || !txnid) {
				Logger.warn("Repayment initiation failed: missing or invalid payment_url/txnid");
				Toast.show({
					type: "error",
					text1: t("unableToInitiatePayment", "Unable to initiate payment"),
					text2: t("pleaseRetryPayment", "Please try again shortly"),
				});
				return;
			}

			// 3. Persist attempt details in storage
			const startedAt = Date.now();
			const amountBefore = activeLoan?.amount_to_repay ?? res?.amount ?? 0;
			await setStorageItem(STORAGE_KEYS["@repayment-txnid"], txnid);
			await setStorageItem(STORAGE_KEYS["@repayment-timestamp"], String(startedAt));
			await setStorageItem(STORAGE_KEYS["@repayment-amount-before"], String(amountBefore));

			// 4. Open payment gateway with WebBrowser (no polling while gateway is open)
			let navSource: VerifySource = "browser_closed";
			try {
				const result: any = await WebBrowser.openAuthSessionAsync(url, REPAYMENT_RETURN_SCHEME);
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
				await openExternalUrl(url);
			}

			// 5. Navigate to verification screen
			router.push({
				pathname: "/repayment-status" as any,
				params: { txnid, source: navSource },
			});
		} catch (err: any) {
			const status = err?.response?.status;
			const detail = err?.response?.data?.detail;
			const detailStr = typeof detail === "string" ? detail.toLowerCase() : JSON.stringify(detail || "").toLowerCase();

			// 409 / Active payment link conflict -> refresh dashboard and route to status
			if (status === 409 || detailStr.includes("active") || detailStr.includes("in progress") || detailStr.includes("existing")) {
				await queryClient.invalidateQueries({ queryKey: ["user", "dashboard"] });
				const storedTxn =
					(await getStorageItem(STORAGE_KEYS["@repayment-txnid"])) ||
					err?.response?.data?.txnid ||
					activeLoan?.active_payment?.txnid;

				if (storedTxn) {
					router.push({
						pathname: "/repayment-status" as any,
						params: { txnid: storedTxn, source: "manual" },
					});
					return;
				}
			}

			// No outstanding amount
			if (detailStr.includes("no outstanding") || detailStr.includes("already repaid") || detailStr.includes("no active loan")) {
				await queryClient.invalidateQueries({ queryKey: ["user", "dashboard"] });
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
	}, [activeLoan, queryClient, router, t]);

	return {
		handlePayNow,
		isInitiating,
	};
}

