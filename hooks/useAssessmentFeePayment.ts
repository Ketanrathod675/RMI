import { useNetworkAwareMutation } from "@/hooks/useNetworkAwareMutation";
import { useTranslation } from "@/hooks/useTranslation";
import { clearTransactionId, setTransactionId, useDispatch } from "@/store";
import { trackAssessmentFeePaid } from "@/utils/analytics";
import {
	checkPaymentStatus,
	errorHandler,
	getUserDashboardData,
	getUserProfile,
	initiateAssessmentFee,
	URLS,
	type InitiateAssessmentFeeResponse,
	type PaymentStatusResponse,
} from "@/utils/api";
import { decode } from "@/utils/encode_decode";
import Logger from "@/utils/logger";
import { getStorageItem, removeStorageItem, setStorageItem, STORAGE_KEYS } from "@/utils/storage";
import { useQueryClient } from "@tanstack/react-query";
import Constants from "expo-constants";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { DeviceEventEmitter, Platform, ToastAndroid } from "react-native";
import Toast from "react-native-toast-message";

export type InitiatePaymentResponse = {
	status: string;
	message: string;
	payment_data: {
		order_id: string;
		cf_order_id: string;
		payment_session_id: string;
		order_status: string;
		order_token: string;
		payment_link: string;
		amount: number;
		currency: string;
		expires_at: string;
		created_at: string;
		transaction_id: string;
	};
	payment_methods: {
		payment_methods: any[];
		currency: string;
		supported_countries: string[];
		min_amount: number;
		max_amount: number;
	};
	next_step: string;
};

interface UseAssessmentFeePaymentOptions {
	processingFeeAmount: number;
	leadId?: string;
	couponCode?: string;
	onPaymentSuccess: (txnId: string) => void;
}

export const useAssessmentFeePayment = ({
	processingFeeAmount,
	leadId,
	couponCode,
	onPaymentSuccess,
}: UseAssessmentFeePaymentOptions) => {
	const { t } = useTranslation();
	const router = useRouter();
	const dispatch = useDispatch();
	const queryClient = useQueryClient();

	const [isPaymentInitiated, setIsPaymentInitiated] = useState(false);
	const [isPaymentPolling, setIsPaymentPolling] = useState(false);
	const [isPaymentCompleted, setIsPaymentCompleted] = useState(false);
	const [delayVisible, setDelayVisible] = useState(false);

	const [paymentStatus, setPaymentStatus] = useState({
		paymentPending: false,
		paymentTimer: 0,
		timerStartTime: 0,
	});

	const processedTransactionRef = useRef<string | null>(null);
	const paymentPollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const checkStatusRef = useRef<((id: string) => Promise<boolean>) | null>(null);
	const urlHook = Linking.useLinkingURL();

	const clearTimer = async () => {
		const timerId = await getStorageItem(STORAGE_KEYS["@assessment-timer-id"]);
		if (timerId) {
			clearInterval(parseInt(timerId, 10));
		}
		await removeStorageItem(STORAGE_KEYS["@assessment-timer-id"]);
	};

	// Clean up intervals on unmount
	useEffect(() => {
		return () => {
			clearTimer();
			if (paymentPollIntervalRef.current) {
				clearInterval(paymentPollIntervalRef.current);
			}
		};
	}, []);

	// Restore payment timer on mount
	useEffect(() => {
		const restoreTimerState = async () => {
			const storedStartTime = await getStorageItem(STORAGE_KEYS["@payment-timer-start"]);
			if (storedStartTime) {
				const startTime = parseInt(storedStartTime, 10);
				const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
				const totalDuration = 120; // 2 minutes matching polling timeout
				const remainingTime = totalDuration - elapsedSeconds;

				if (remainingTime > 0) {
					setPaymentStatus({
						paymentPending: true,
						paymentTimer: remainingTime,
						timerStartTime: startTime,
					});

					const transactionId = await getStorageItem(STORAGE_KEYS["@transaction-id"]);
					if (transactionId) {
						startPaymentPolling(transactionId);
					}
				} else {
					await removeStorageItem(STORAGE_KEYS["@payment-timer-start"]);
					setPaymentStatus({
						paymentPending: false,
						paymentTimer: 0,
						timerStartTime: 0,
					});
				}
			}
		};

		restoreTimerState();
	}, []);

	// Timer countdown effect
	useEffect(() => {
		let interval: ReturnType<typeof setInterval> | null = null;
		if (paymentStatus.paymentPending && paymentStatus.timerStartTime > 0) {
			interval = setInterval(() => {
				const elapsedSeconds = Math.floor(
					(Date.now() - paymentStatus.timerStartTime) / 1000,
				);
				const totalDuration = 120;
				const remainingTime = totalDuration - elapsedSeconds;

				if (remainingTime <= 0) {
					removeStorageItem(STORAGE_KEYS["@payment-timer-start"]);
					dispatch(clearTransactionId());
					removeStorageItem(STORAGE_KEYS["@transaction-id"]);

					setPaymentStatus({
						paymentPending: false,
						paymentTimer: 0,
						timerStartTime: 0,
					});

					if (interval) clearInterval(interval);
				} else {
					setPaymentStatus((prev) => ({
						...prev,
						paymentTimer: remainingTime,
					}));
				}
			}, 1000);
		}

		return () => {
			if (interval) clearInterval(interval);
		};
	}, [paymentStatus.paymentPending, paymentStatus.timerStartTime, dispatch]);

	// Easebuzz Status Polling logic
	const startPaymentPolling = (txnId: string) => {
		if (paymentPollIntervalRef.current) {
			clearInterval(paymentPollIntervalRef.current);
		}

		console.log(`🚀 [Payment] Starting Easebuzz status polling for: ${txnId}`);
		setIsPaymentPolling(true);
		setDelayVisible(true);

		const pollStartTime = Date.now();

		const checkStatus = async (): Promise<boolean> => {
			try {
				const res = await checkPaymentStatus(txnId);
				Logger.debug("Payment status polling response", res);

				const statusVal =
					res?.data?.status?.toUpperCase() ||
					(res?.success && (res?.data as any)?.status !== "PENDING" ? "COMPLETED" : "PENDING");

				if (statusVal === "COMPLETED" || statusVal === "SUCCESS") {
					if (paymentPollIntervalRef.current) {
						clearInterval(paymentPollIntervalRef.current);
					}
					setIsPaymentPolling(false);
					setDelayVisible(false);

					// Clear stored session state
					dispatch(clearTransactionId());
					await removeStorageItem(STORAGE_KEYS["@transaction-id"]);
					await removeStorageItem(STORAGE_KEYS["@payment-timer-start"]);
					setIsPaymentInitiated(false);
					setPaymentStatus({
						paymentPending: false,
						paymentTimer: 0,
						timerStartTime: 0,
					});

					setIsPaymentCompleted(true);
					const paymentRef = res?.data?.payment_id || res?.data?.easepayid || txnId;
					trackAssessmentFeePaid(processingFeeAmount, paymentRef).catch(() => {});
					queryClient.invalidateQueries({ queryKey: ["user", "dashboard"] });

					onPaymentSuccess(paymentRef);
					return true;
				}

				if (
					statusVal === "FAILED" ||
					statusVal === "FAILURE" ||
					statusVal === "REJECTED" ||
					statusVal === "USERCANCELLED"
				) {
					if (paymentPollIntervalRef.current) {
						clearInterval(paymentPollIntervalRef.current);
					}
					setIsPaymentPolling(false);
					setDelayVisible(false);

					dispatch(clearTransactionId());
					await removeStorageItem(STORAGE_KEYS["@transaction-id"]);
					await removeStorageItem(STORAGE_KEYS["@payment-timer-start"]);
					setIsPaymentInitiated(false);
					setPaymentStatus({
						paymentPending: false,
						paymentTimer: 0,
						timerStartTime: 0,
					});

					setTimeout(() => {
						Toast.show({
							type: "error",
							text1: t("transactionFailed"),
							text2: t("pleaseRetryPayment"),
							visibilityTime: 6000,
						});
					}, 500);
					return true;
				}
			} catch (err) {
				Logger.warn("Primary payment status check error, verifying dashboard workflow fallback", err);
				try {
					const dash = await getUserDashboardData();
					const step = String(
						(dash as any)?.current_step ||
						dash?.workflow_progress?.current_step ||
						dash?.current_step_info?.step ||
						""
					).toLowerCase();
					if (step && step !== "assessment_fee" && step !== "assessment_fee_payment") {
						console.log("✅ [Payment] User dashboard confirms workflow advanced to:", step);
						if (paymentPollIntervalRef.current) {
							clearInterval(paymentPollIntervalRef.current);
						}
						setIsPaymentPolling(false);
						setDelayVisible(false);

						dispatch(clearTransactionId());
						await removeStorageItem(STORAGE_KEYS["@transaction-id"]);
						await removeStorageItem(STORAGE_KEYS["@payment-timer-start"]);
						setIsPaymentInitiated(false);
						setPaymentStatus({
							paymentPending: false,
							paymentTimer: 0,
							timerStartTime: 0,
						});

						setIsPaymentCompleted(true);
						trackAssessmentFeePaid(processingFeeAmount, txnId).catch(() => {});
						queryClient.invalidateQueries({ queryKey: ["user", "dashboard"] });
						onPaymentSuccess(txnId);
						return true;
					}
				} catch (dashErr) {
					Logger.error("Dashboard fallback check also failed", dashErr);
				}
			}
			return false;
		};

		checkStatusRef.current = checkStatus;

		// Run immediately
		checkStatus();

		// Poll every 5 seconds
		paymentPollIntervalRef.current = setInterval(async () => {
			const elapsed = Date.now() - pollStartTime;
			if (elapsed >= 120000) {
				// 2 minutes timeout
				if (paymentPollIntervalRef.current) {
					clearInterval(paymentPollIntervalRef.current);
				}
				const isResolved = await checkStatus();
				if (!isResolved) {
					console.log("⏱️ [Payment] Polling timed out after 2 min. Navigating to dashboard...");
					setIsPaymentPolling(false);
					setDelayVisible(false);

					// Deliberately keep @transaction-id in storage for dashboard resumption
					setIsPaymentInitiated(false);
					setPaymentStatus({
						paymentPending: false,
						paymentTimer: 0,
						timerStartTime: 0,
					});

					router.replace("/(tabs)");
				}
			} else {
				await checkStatus();
			}
		}, 5000);
	};

	// Handle deep-link returns
	useEffect(() => {
		const handleDeepLink = async () => {
			if (!urlHook) return;

			const transactionId = await getStorageItem(STORAGE_KEYS["@transaction-id"]);
			if (!transactionId) return;

			const { hostname, queryParams } = Linking.parse(urlHook);

			if (
				!hostname?.includes("assessment-fee") &&
				!hostname?.includes("assessment-fee-success")
			) {
				return;
			}

			if (
				queryParams?.txnid &&
				processedTransactionRef.current === queryParams.txnid
			) {
				return;
			}

			if (!queryParams?.txnid) return;

			if (queryParams?.status && queryParams?.txnid === transactionId) {
				processedTransactionRef.current = queryParams.txnid as string;
				DeviceEventEmitter.emit("HIDE_GLOBAL_LOADER");
				startPaymentPolling(transactionId);
			}
		};

		handleDeepLink();
	}, [urlHook]);

	// Payment Initiation Mutation
	const { mutate: initiatePayment, isPending } = useNetworkAwareMutation({
		mutationFn: async () => {
			let targetLeadId = leadId;
			if (!targetLeadId) {
				targetLeadId = (await getStorageItem(STORAGE_KEYS["@lead-id"])) || undefined;
			}

			if (!targetLeadId) {
				throw new Error("Lead ID is missing. Please submit your basic details again.");
			}

			// Resolve user contact info required by backend Easebuzz schema
			let resolvedPhone = "";
			let resolvedName = "Applicant";
			let resolvedEmail = "applicant@rapidmoney.in";

			try {
				const rawPhone = await getStorageItem(STORAGE_KEYS["@phone-number"]);
				if (rawPhone) {
					try {
						const decoded = decode(rawPhone);
						resolvedPhone = decoded.replace(/\D/g, "").slice(-10);
					} catch {
						resolvedPhone = rawPhone.replace(/\D/g, "").slice(-10);
					}
				}
			} catch {}

			try {
				const profile = await getUserProfile();
				const pDetails = profile?.personal_details;
				if (pDetails?.full_name) {
					resolvedName = pDetails.full_name.split(" ")[0].trim() || "Applicant";
				}
				if (profile?.email) {
					resolvedEmail = profile.email.trim();
				}
				if (!resolvedPhone && (profile as any)?.phone_number) {
					resolvedPhone = String((profile as any).phone_number).replace(/\D/g, "").slice(-10);
				}
			} catch {}

			if (!resolvedPhone || resolvedPhone.length < 10) {
				resolvedPhone = "9999999999";
			}

			Logger.debug("Initiating assessment fee payment", {
				lead_id: targetLeadId,
				phone_no: resolvedPhone,
				firstname: resolvedName,
				email: resolvedEmail,
				coupon_code: couponCode,
			});

			return await initiateAssessmentFee({
				lead_id: targetLeadId,
				phone_no: resolvedPhone.slice(-10),
				firstname: resolvedName.slice(0, 50),
				email: resolvedEmail.slice(0, 100),
				coupon_code: couponCode || null,
			});
		},
		onSuccess: async (res) => {
			Logger.debug("Assessment fee payment initiated", res);

			const data = (res as any)?.data ?? res;
			if (!data) {
				Toast.show({
					type: "error",
					text1: t("unableToInitiatePayment"),
					text2: t("pleaseRetryPayment"),
				});
				return;
			}

			// If fee is waived (100% coupon or 0 fee)
			if (data.status === "WAIVED" || data.amount === 0) {
				await clearTimer();
				setIsPaymentInitiated(false);
				setIsPaymentCompleted(true);
				onPaymentSuccess(data.txnid || "WAIVED");
				return;
			}

			const paymentUrl = data.payment_url || data.payment_link;
			if (!paymentUrl) {
				Toast.show({
					type: "error",
					text1: t("unableToInitiatePayment"),
					text2: t("pleaseRetryPayment"),
				});
				return;
			}

			await clearTimer();
			const url = paymentUrl;
			const txnid = data.txnid || data.transaction_id || data.order_id;

			if (Platform.OS === "android") {
				ToastAndroid.show(t("redirectingToYourBrowser") || "Opening Easebuzz Payment Gateway...", ToastAndroid.SHORT);
			}

			dispatch(setTransactionId(txnid));
			await setStorageItem(STORAGE_KEYS["@transaction-id"], txnid);

			setIsPaymentInitiated(true);
			const startTime = Date.now();
			await setStorageItem(STORAGE_KEYS["@payment-timer-start"], startTime.toString());

			setPaymentStatus({
				paymentPending: true,
				paymentTimer: 120,
				timerStartTime: startTime,
			});

			DeviceEventEmitter.emit("SHOW_GLOBAL_LOADER");

			// Start polling immediately in the background so whenever Easebuzz finishes, status is caught
			startPaymentPolling(txnid);

			setTimeout(async () => {
				try {
					const redirectScheme = "rapid-money://";
					const result = await WebBrowser.openAuthSessionAsync(url, redirectScheme);
					console.log("💳 [WebBrowser] Auth session completed:", result);
					// Immediately verify status when returning from gateway without waiting for next poll tick
					if (checkStatusRef.current) {
						await checkStatusRef.current(txnid);
					}
				} catch (err) {
					console.warn("Failed to open via WebBrowser, using Linking.openURL", err);
					await Linking.openURL(url).catch((openErr) => {
						console.error("Failed to open payment URL", openErr);
					});
				}
			}, 300);
		},
		onError: (err, variables, ctx) => {
			const { error } = errorHandler(err, variables, ctx);
			Logger.error("Payment initiation failed", error);

			const rawDetail = (err as any)?.response?.data?.detail;
			const displayMessage =
				typeof rawDetail === "string"
					? rawDetail
					: error?.message ?? t("pleaseRetryPayment");

			Toast.show({
				type: "error",
				text1: t("errorInitiatingPayment"),
				text2: displayMessage,
			});
		},
	});

	// Dev simulation helper
	const simulateDeepLinkReturn = (status: "success" | "failure", txnId?: string) => {
		if (__DEV__ && txnId) {
			console.log(`🛠️ [DEV MOCK] Simulating deep link return: ${status} for txnid: ${txnId}`);
			DeviceEventEmitter.emit("HIDE_GLOBAL_LOADER");

			if (status === "success") {
				startPaymentPolling(txnId);
			} else {
				Toast.show({
					type: "error",
					text1: t("transactionFailed"),
					text2: t("pleaseRetryPayment"),
				});
			}
		}
	};

	return {
		initiatePayment,
		isPending,
		isPaymentInitiated,
		isPaymentPolling,
		isPaymentCompleted,
		delayVisible,
		setDelayVisible,
		paymentStatus,
		startPaymentPolling,
		simulateDeepLinkReturn,
		clearTimer,
	};
};

export default useAssessmentFeePayment;
