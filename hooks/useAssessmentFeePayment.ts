import { useNetworkAwareMutation } from "@/hooks/useNetworkAwareMutation";
import { useTranslation } from "@/hooks/useTranslation";
import { clearTransactionId, setTransactionId, useDispatch } from "@/store";
import { trackAssessmentFeePaid } from "@/utils/analytics";
import { errorHandler, URLS } from "@/utils/api";
// TODO: migrate off legacy API
import { checkEasebuzzPaymentStatus } from "@/utils/api/kyc";
import { axios } from "@/utils/api";
import Logger from "@/utils/logger";
import { getStorageItem, removeStorageItem, setStorageItem, STORAGE_KEYS } from "@/utils/storage";
import { useQueryClient } from "@tanstack/react-query";
import Constants from "expo-constants";
import * as Linking from "expo-linking";
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
	onPaymentSuccess: (txnId: string) => void;
}

export const useAssessmentFeePayment = ({
	processingFeeAmount,
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
				const res = await checkEasebuzzPaymentStatus(txnId);
				Logger.debug("Payment status polling response", res);

				if (res.status === "success") {
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
					trackAssessmentFeePaid(processingFeeAmount, txnId).catch(() => {});
					queryClient.invalidateQueries({ queryKey: ["user", "dashboard"] });

					onPaymentSuccess(txnId);
					return true;
				}

				if (res.status === "failure") {
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
				Logger.error("Payment status polling failed", err);
			}
			return false;
		};

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
			const payload = {
				amount: processingFeeAmount,
				purpose: "assessment fee",
				payment_type: "assessment_fee",
				platform: "mobile",
				version: Constants.expoConfig?.version,
			};

			Logger.debug("Initiating payment checkout", payload);
			const response = await axios.post<Partial<InitiatePaymentResponse>>(
				URLS.payments.initiate_payment,
				payload,
			);
			return response.data;
		},
		onSuccess: async (data) => {
			Logger.debug("Payment checkout initiated", data);

			if (!data?.payment_data?.payment_link) {
				Toast.show({
					type: "error",
					text1: t("unableToInitiatePayment"),
					text2: t("pleaseRetryPayment"),
				});
				return;
			}

			await clearTimer();
			const url = data.payment_data.payment_link;

			if (Platform.OS === "android") {
				ToastAndroid.show(t("redirectingToYourBrowser"), ToastAndroid.SHORT);
			}

			dispatch(setTransactionId(data.payment_data.transaction_id));
			// Store order_id as @transaction-id matching Easebuzz txnid
			await setStorageItem(STORAGE_KEYS["@transaction-id"], data.payment_data.order_id);

			setIsPaymentInitiated(true);
			const startTime = Date.now();
			await setStorageItem(STORAGE_KEYS["@payment-timer-start"], startTime.toString());

			setPaymentStatus({
				paymentPending: true,
				paymentTimer: 120,
				timerStartTime: startTime,
			});

			DeviceEventEmitter.emit("SHOW_GLOBAL_LOADER");

			setTimeout(async () => {
				try {
					await Linking.openURL(url);
				} catch (err) {
					console.error("Failed to open payment URL", err);
				}
			}, 800);
		},
		onError: (err, variables, ctx) => {
			const { error } = errorHandler(err, variables, ctx);
			Logger.error("Payment initiation failed", error);

			Toast.show({
				type: "error",
				text1: t("errorInitiatingPayment"),
				text2: error?.message ?? t("pleaseRetryPayment"),
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
