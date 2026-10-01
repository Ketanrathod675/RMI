/**
 * Note from original author of this file:
 * whoever is working on this file, I am sorry.
 * i designed this file in a rush and it is not clean.
 *
 * The flow is messed up, the logic is gone dumps, and result is unpredictable.
 *
 * This was my first time working on deep linking and url hooks,
 * I fked up.
 *
 * So sorry for the pain you will be going through to debug.
 *
 * You will suffer with the side effects.
 *
 * ***** DO NOT CHANGE THIS FILE UNLESS ABSOLUTELY NECESSARY *****
 */

import RejectionModal from '@/components/RejectionModal';
import ExitIntentModal from "@/components/assessment-fee/ExitIntentModal";
import { TranslatedText } from "@/components/TranslatedText";
import { dark, primary, white } from "@/constants/Colors";
import { IconSymbol } from "@/components/ui/IconSymbol";
import { Images } from "@/constants/images";
import { type TranslationKey } from "@/constants/translations";
import { useJourneyTracker } from "@/hooks/useJourneyTracker";
import { useNetworkAwareMutation } from "@/hooks/useNetworkAwareMutation";
import { useNetworkAwareQuery } from "@/hooks/useNetworkAwareQuery";
import { useTranslation } from "@/hooks/useTranslation";
import { clearTransactionId, setTransactionId, useDispatch } from "@/store";
import { trackAssessmentFeePaid } from "@/utils/analytics";
import { axios, errorHandler, fetchProcessingFee, getUserProfile, URLS } from "@/utils/api";
import { confirmPayment, initialApproval, verifyEmail, verifyLeadCreation, verifyPan } from "@/utils/api/kyc";
import { font, height, width } from "@/utils/dimensions";
import { getStorageItem, removeStorageItem, setStorageItem, STORAGE_KEYS } from "@/utils/storage";
import { MaterialIcons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import Constants from "expo-constants";
import { Image } from "expo-image";
import * as Linking from "expo-linking";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
	ActivityIndicator,
	Alert,
	Animated,
	BackHandler,
	DeviceEventEmitter,
	Modal,
	ScrollView,
	StyleSheet,
	Text,
	ToastAndroid,
	TouchableOpacity,
	Linking as UrlLinking,
	View
} from "react-native";
import Toast from "react-native-toast-message";

// API function to check initial approval is now imported from @/utils/api/kyc


export type InitiatePaymentResponse = {
	status: string;
	message: string;
	payment_data: PaymentData;
	payment_methods: PaymentMethods;
	next_step: string;
};

export type PaymentData = {
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

export type PaymentMethods = {
	payment_methods: PaymentMethod[];
	currency: string;
	supported_countries: string[];
	min_amount: number;
	max_amount: number;
};

export type PaymentMethod = {
	id: string;
	name: string;
	description: string;
	icon: string;
	enabled: boolean;
	processing_fee: number;
};

const ASSESSMENT_BANNER = Images.ASSESSMENT_BANNER2;
const RUPEE_COIN = Images.RUPEE_COIN;
const SUCCESS_ICON = Images.SUCCESS_ICON;

type LoanOption = {
	name: string;
	isSelected: boolean;
	tenureKey: TranslationKey;
	assessmentFee: string;
	qualifiedAmount: string;
};

const formatAmount = (amount: number): string => {
	return new Intl.NumberFormat("en-IN", {
		style: "currency",
		currency: "INR",
		minimumFractionDigits: 0,
		maximumFractionDigits: 0,
	}).format(amount);
};

export default function AssessmentFee() {
	console.log("🔄 [AssessmentFee] Rendering AssessmentFee screen");
	const { t, isHindi } = useTranslation();
	const router = useRouter();
	const params = useLocalSearchParams();
	// const [transactionId, setTransactionId] = useState("");

	// Track this screen in the journey
	useJourneyTracker("/assessment-fee");

	const [isPaymentInitiated, setIsPaymentInitiated] = useState(false);
	const [isExitModalVisible, setIsExitModalVisible] = useState(false);

	const dispatch = useDispatch();

	// const transactionId = useSelector((state: RootState) => state.user.transactionId);

	const [, setTransaction] = useState<string | null>(null);

	const urlHook = Linking.useLinkingURL();

	const queryClient = useQueryClient();

	const clearTimer = async () => {
		const timerId = await getStorageItem(STORAGE_KEYS["@assessment-timer-id"]);

		if (timerId) {
			clearInterval(parseInt(timerId));
		}

		await removeStorageItem(STORAGE_KEYS["@assessment-timer-id"]);
	};

	// clear any timer running
	useEffect(() => {
		return () => {
			clearTimer();
			if (pollIntervalRef.current) {
				clearInterval(pollIntervalRef.current);
			}
		};
	}, []);

	const navigation = useNavigation();

	useEffect(() => {
		// Prevent swipe or navigation.goBack inside router
		const unsubscribe = navigation.addListener("beforeRemove", (e) => {
			if (["GO_BACK", "POP"].includes(e.data.action.type)) {
				e.preventDefault();
				setIsExitModalVisible(true);
			}
		});

		// Intercept Android hardware back button
		const backHandler = BackHandler.addEventListener("hardwareBackPress", () => {
			setIsExitModalVisible(true);
			return true; // prevent default app exit
		});

		return () => {
			unsubscribe();
			backHandler.remove();
		};
	}, [navigation]);

	useEffect(() => {
		const handleDeepLink = async () => {
			console.log("🔗 Deep link handler called, urlHook:", urlHook);
			const transactionId = await getStorageItem(STORAGE_KEYS["@transaction-id"]);
			console.log("handle deep link, transactionId:", transactionId);

			if (!urlHook || !transactionId) {
				console.log("❌ No urlHook or transactionId, skipping");
				return;
			}

	const { hostname, path, queryParams } = Linking.parse(urlHook);
	console.log("🔍 Parsed - hostname:", hostname, "queryParams:", queryParams);

	if (!hostname?.includes("assessment-fee")) {
		console.log("❌ Hostname doesn't include 'assessment-fee', skipping");
		return;
	}
	
	console.log("✅ Hostname matches! Processing payment result...");

		// Check if this transaction has already been processed
		if (queryParams?.txnid && processedTransactionRef.current === queryParams.txnid) {
			console.log("⚠️ Transaction already processed, ignoring duplicate deep link");
			return;
		}

		dispatch(clearTransactionId());
		removeStorageItem(STORAGE_KEYS["@transaction-id"]);

		if (!queryParams?.txnid) {
			return;
		}

		if (queryParams?.status && queryParams?.txnid === transactionId) {
			// Mark this transaction as processed
			processedTransactionRef.current = queryParams.txnid;
				dispatch(clearTransactionId());
				// setTransactionId("");

				setIsPaymentInitiated(false);

				// Clear timer storage
				// DELAY REMOVAL to ensure _layout.tsx sees it if checked concurrently
				// await removeStorageItem(STORAGE_KEYS["@payment-timer-start"]);

				setPaymentStatus({
					paymentPending: false,
					paymentTimer: 0,
					timerStartTime: 0,
				});

			if (queryParams.status === "success") {
				console.log("✅ Payment SUCCESS detected!");
				clearTimer();

				// ── Analytics: Assessment Fee Paid ───────────────────────
				trackAssessmentFeePaid(processingFeeAmount, String(queryParams.txnid)).catch(() => {});
				// ───────────────────────────────────────────────

				// Set modal visible FIRST so it is already rendered when the global
				// loader disappears — prevents a 1-frame flash of the raw screen.
				console.log("🎉 Setting modal visible to TRUE");
				setModalVisible(true);

				setPaymentStatus({
					paymentPending: false,
					paymentTimer: 0,
					timerStartTime: 0,
				});

				queryClient.invalidateQueries({ queryKey: ["user", "dashboard"] });

				// Hide loader after modal is queued — no raw screen ever visible.
				DeviceEventEmitter.emit("HIDE_GLOBAL_LOADER");
				return;
			}

			if (queryParams.status === "failure") {
				console.log("❌ Payment FAILURE detected!");
				
				// Clear timer and flags so _layout doesn't re-trigger loader
				clearTimer();
				await removeStorageItem(STORAGE_KEYS["@payment-timer-start"]);
				
				setPaymentStatus({
					paymentPending: false,
					paymentTimer: 0,
					timerStartTime: 0,
				});

				// Hide global loader immediately
				DeviceEventEmitter.emit("HIDE_GLOBAL_LOADER");

				// Small delay to ensure overlay is removed before showing Toast
				setTimeout(() => {
					Toast.show({
						type: "error",
						text1: t("transactionFailed"),
						text2: t("pleaseRetryPayment"),
						visibilityTime: 7000, // Add this line

					});
				}, 500);
			}
			}
		};

	handleDeepLink();
}, [urlHook]);

	const [paymentStatus, setPaymentStatus] = useState({
		paymentPending: false,
		paymentTimer: 0,
		timerStartTime: 0, // Timestamp when timer started
	});

	// Restore timer state from storage on mount
	useEffect(() => {
		const restoreTimerState = async () => {
			const storedStartTime = await getStorageItem(STORAGE_KEYS["@payment-timer-start"]);
			
			if (storedStartTime) {
			const startTime = parseInt(storedStartTime);
			const currentTime = Date.now();
		const elapsedSeconds = Math.floor((currentTime - startTime) / 1000);
		const totalDuration = 10; // 10 seconds for testing
		// const totalDuration = 5 * 60; // 5 minutes in seconds
		const remainingTime = totalDuration - elapsedSeconds;

				if (remainingTime > 0) {
					// Timer still valid, restore it
					setPaymentStatus({
						paymentPending: true,
						paymentTimer: remainingTime,
						timerStartTime: startTime,
					});
				} else {
					// Timer expired, clean up
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

	// Timer countdown effect - updates every second
	useEffect(() => {
		let interval: ReturnType<typeof setInterval> | null = null;

		if (paymentStatus.paymentPending && paymentStatus.timerStartTime > 0) {
		interval = setInterval(() => {
			const currentTime = Date.now();
		const elapsedSeconds = Math.floor((currentTime - paymentStatus.timerStartTime) / 1000);
		// const totalDuration = 10; // 10 seconds for testing
		const totalDuration = 5 * 60; // 5 minutes in seconds
		const remainingTime = totalDuration - elapsedSeconds;

				if (remainingTime <= 0) {
					// Timer expired
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
	}, [paymentStatus.paymentPending, paymentStatus.timerStartTime]);

	// Fetch processing fee details from API
	const {
		data: processingFeeData,
		isLoading: isLoadingProcessingFee,
		error: processingFeeError,
	} = useNetworkAwareQuery({
		queryKey: ["processing-fee"],
		queryFn: fetchProcessingFee,
		retry: 2,
		staleTime: 5 * 1000, // 5 minutes
	});

	// Handle API error and redirect
	useEffect(() => {
		if (processingFeeError) {
			console.error("Processing fee fetch error:", processingFeeError);

			Toast.show({
				type: "error",
				text1: t("failedToFetchProcessingFee"),
				text2: t("pleaseTryAgain"),
				visibilityTime: 4000,
			});

			// Redirect to tabs after showing error
			setTimeout(() => {
				router.replace("/(tabs)");
			}, 2000);
		}
	}, [processingFeeError]);

	console.log("processing fee", processingFeeData);

	// Map API response to processing fee amounts
	// amount = base amount, gst = percentage (e.g., amount=1, gst=1 means ₹1 + 1% GST)
	const baseAmount = processingFeeData?.processing_fee?.amount || 200;
	const gstPercentage = processingFeeData?.processing_fee?.gst || 0;
	
	// Calculate total: amount + (amount × gst%)
	const processingFeeAmount = Math.round(baseAmount + (baseAmount * gstPercentage / 100));
	
	console.log("💰 Base Amount:", baseAmount);
	console.log("💰 GST Percentage:", gstPercentage + "%");
	console.log("💰 Total Processing Fee (with GST):", processingFeeAmount);

	// const currency = processingFeeData?.processing_fee?.currency || "INR";

	const handleRapidCareInfo = () => {
		// Handle RapidCare info button press
		console.log("RapidCare info clicked");
		// You can add a modal or navigation to info page here
	};

	const [modalVisible, setModalVisible] = useState(false);
	const scaleAnim = useRef(new Animated.Value(0)).current;
	const processedTransactionRef = useRef<string | null>(null); // Track processed transactions
	const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
	
	// Rejection modal state
	const [rejectionModalVisible, setRejectionModalVisible] = useState(false);
	const [delayVisible, setDelayVisible] = useState(false);
	const [isVerifyLeadFlow, setIsVerifyLeadFlow] = useState(false);
	const [rejectionMessage, setRejectionMessage] = useState<string>("");
	const [rejectionCountdown, setRejectionCountdown] = useState(15);

	// Email Verification States - REMOVED (Screens used instead)
	const [consentChecked, setConsentChecked] = useState(false);
	
	const handleEmailVerificationFlow = async (email?: string) => {
		// Fetch profile to get email (if missing) and PAN details for auto-verification
		let profileData = null;
		try {
			profileData = await getUserProfile();
		} catch (e) {
			console.error("Failed to fetch user profile", e);
		}

		let targetEmail = email;
		if (!targetEmail) {
			targetEmail = profileData?.email || "";
		}

		if (!targetEmail) {
			// Navigate directly — assessment-fee unmounts naturally, no raw screen flash.
			router.replace("/verify-email");
			return;
		}

		try {
			console.log("🔍 Verifying email:", targetEmail);
			const verifyRes = await verifyEmail(targetEmail);
			console.log("📧 Verify Email Result:", verifyRes);

			if (verifyRes.result === "deliverable") {
				// Email is valid. Try to verify PAN automatically
				console.log("✅ Email deliverable. checking for PAN details...");
				const personalDetails = profileData?.personal_details;

				if (personalDetails?.pan_number && personalDetails?.full_name) {
					console.log("🔄 Found PAN/Name. Attempting Auto-PAN Verify...");
					try {
						const verifyPanRes = await verifyPan({
							name: personalDetails.full_name,
							pan_number: personalDetails.pan_number,
						});

						// If success (no error thrown)
						console.log("✅ Auto-PAN Verify Success");
						const isPanValid = verifyPanRes.is_pan_valid || false;

						// Call Initial Approval
						const approvalResponse = await initialApproval({
							email: targetEmail,
							is_deliverable: true,
							is_pan_verified: true,
							is_pan_valid: isPanValid,
							pan_number: personalDetails.pan_number,
							name: personalDetails.full_name,
						});

						if (approvalResponse.status === "approved") {
							// Navigate directly — component unmounts, modal gone naturally.
							router.replace("/application-approved");
						} else if (approvalResponse.status === "reject") {
							// Not navigating away — must close modal to show rejection overlay.
							setModalVisible(false);
							setRejectionMessage(approvalResponse.msg || "Application Rejected");
							setRejectionModalVisible(true);
						} else {
							// Navigate directly — component unmounts, modal gone naturally.
							router.replace({
								pathname: "/professional-details",
								params: { disableBack: "true" },
							});
						}
						// Done!
						return;

					} catch (panError) {
						console.error("❌ Auto-PAN Failed:", panError);
						// If fails, fall through to manual verify-pan screen
					}
				} else {
					console.log("⚠️ No PAN/Name found in profile for auto-verify");
				}

				// Success: Navigate to Verify PAN — component unmounts, modal gone naturally.
				router.replace({
					pathname: "/verify-pan",
					params: {
						email: targetEmail,
						is_deliverable: "true"
					}
				});
			} else {
				// Undeliverable: Navigate to verify-email — component unmounts, modal gone naturally.
				console.log("❌ Email Undeliverable, navigating to verification screen");
				router.replace({
					pathname: "/verify-email",
					params: { email: targetEmail }
				});
			}
		} catch (e: any) {
			console.error("Email verification failed", e);
			// Navigate directly on error — component unmounts, modal gone naturally.
			router.replace({
				pathname: "/verify-email",
				params: { email: targetEmail }
			});
		}
	};

	const startVerifyLeadFlow = () => {
		setModalVisible(false);
		setIsVerifyLeadFlow(true);
		setDelayVisible(true);

		const startTime = Date.now();
		
		const checkLead = async () => {
			try {
				console.log("🚀 Calling verifyLeadCreation()...");
				const res = await verifyLeadCreation();
				console.log("📥 Verify Lead Response:", JSON.stringify(res));
				
				if (res?.lead_created) {
					console.log("✅ Lead created is true! Proceeding to email verification flow.");
					if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
					setDelayVisible(false);
					setIsVerifyLeadFlow(false);
					handleEmailVerificationFlow();
					return true;
				}
			} catch (err) {
				console.error("❌ Error verify-lead-creation:", err);
			}
			return false;
		};

		// Run immediately
		checkLead();

		// Poll every 2 seconds
		pollIntervalRef.current = setInterval(async () => {
			const elapsed = Date.now() - startTime;
			if (elapsed >= 60000) {
				if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
				const isCreated = await checkLead();
				if (!isCreated) {
					console.log("❌ Lead verification still false after 60s. Redirecting to dashboard...");
					setDelayVisible(false);
					setIsVerifyLeadFlow(false);
					router.replace("/(tabs)");
				}
			} else {
				await checkLead();
			}
		}, 2000);
	};

	const { mutate: initiatePayment, isPending } = useNetworkAwareMutation({
		mutationFn: async () => {
		const payload = {
			amount: processingFeeAmount, // Already includes GST
			purpose: "assessment fee",
			payment_type: "assessment_fee",
			platform: "mobile",
			version: Constants.expoConfig?.version,
		};

			console.log("💳 Payment Payload:", payload);

			const response = await axios.post<Partial<InitiatePaymentResponse>>(
				URLS.payments.initiate_payment,
				payload,
			);

			return response.data;
		},
		onSuccess: async (data) => {
			console.log("initiate payment data", JSON.stringify(data));

			if (!data?.payment_data?.payment_link) {
				Toast.show({
					type: "error",
					text1: t("unableToInitiatePayment"),
					text2: t("pleaseRetryPayment"),
				});
				return;
			}

			clearTimer();

			const url = data?.payment_data?.payment_link;

			const supported = await UrlLinking.canOpenURL(url);

			if (supported) {
				ToastAndroid.show(t("redirectingToYourBrowser"), 1000);

				console.log("transaction id", data?.payment_data.transaction_id);
				dispatch(setTransactionId(data?.payment_data.transaction_id));

				console.log("generated url", url);

				setTransaction(data?.payment_data.transaction_id);

				await setStorageItem(STORAGE_KEYS["@transaction-id"], data?.payment_data.order_id);

				console.log(
					"stored transaction id",
					getStorageItem(STORAGE_KEYS["@transaction-id"]),
				);

				setIsPaymentInitiated(true);

				// Store the start time (timestamp) in storage for persistence IMMEDIATELY
				const startTime = Date.now();
				await setStorageItem(STORAGE_KEYS["@payment-timer-start"], startTime.toString());
				console.log("✅ Payment timer flag SET (proactive):", startTime);

				// Set initial timer state with 10 seconds
				setPaymentStatus({
					paymentPending: true,
					paymentTimer: 10, // 10 seconds for testing
					timerStartTime: startTime,
				});

				// Emit global loader event before opening URL to ensure app is in "Loader" state
				// when returning from payment gateway
				DeviceEventEmitter.emit("SHOW_GLOBAL_LOADER");

				setTimeout(async () => {
					await Linking.openURL(url);
				}, 1000);
			} else {
				Toast.show({
					type: "error",
					text1: t("errorInitiatingPayment"),
					text2: t("pleaseRetryPayment"),
				});
			}
		},
		onError: (err, variables, ctx) => {
			const { error } = errorHandler(err, variables, ctx);

			console.log("error", error);

			Toast.show({
				type: "error",
				text1: t("errorInitiatingPayment"),
				text2: error?.message ?? t("pleaseRetryPayment"),
			});
		},
	});

	const { mutate: _handleConfirmPayment } = useNetworkAwareMutation({
		mutationFn: confirmPayment,
		onSuccess: (data) => {
			console.log("💰 Confirm Payment - Data:", data);

			setTimeout(() => {
				router.replace("/professional-details");
			}, 1300);
		},
		onError: (error, variables, ctx) => {
			const { error: _apiError } = errorHandler(error, variables, ctx);

			Toast.show({
				type: "error",
				text1: t("somethingWentWrong"),
			});

			setTimeout(() => {
				router.replace("/professional-details");
			}, 1300);
		},
	});

	useEffect(() => {
		console.log("📱 Modal visibility changed:", modalVisible);
		if (modalVisible) {
			console.log("⏰ Setting 3-second timer for navigation...");
			const timeout = setTimeout(() => {
				Animated.timing(scaleAnim, {
					toValue: 1,
					duration: 50,
					useNativeDriver: true,
				}).start();
			}, 1500);

		const timeout2 = setTimeout(async () => {
			console.log("🚀 3 seconds passed! Starting Email Verification Flow...");
			
			// NOW remove the timer flag as we are navigating away (or transitioning state)
			await removeStorageItem(STORAGE_KEYS["@payment-timer-start"]);

			// Clear the processed transaction ref for next payment
			processedTransactionRef.current = null;

			// Start lead creation check flow
			startVerifyLeadFlow();

		}, 3000);

		return () => {
			console.log("🧹 Cleaning up modal timeouts");
			clearTimeout(timeout);
			clearTimeout(timeout2);
			clearTimer();
		};
		}
	}, [modalVisible, router, scaleAnim]);


	const handleCheckout = async () => {
		initiatePayment();
	};

	const timerFormat = {
		value: `${Math.round(paymentStatus?.paymentTimer / 60)
			.toString()
			.padStart(2, "0")}:${(paymentStatus?.paymentTimer % 60).toString().padStart(2, "0")}`,
		unit: "min",
	};

	return (
		<>
			<View style={{ flex: 1, backgroundColor: white }}>
				<ScrollView
					style={styles.scrollView}
					contentContainerStyle={styles.scrollContentContainer}
					showsVerticalScrollIndicator={false}>
					<View style={styles.bannerContainer}>
						<Image
							source={ASSESSMENT_BANNER}
							style={styles.banner}
							contentFit="cover"
						/>
						<Image
							source={RUPEE_COIN}
							style={[styles.coin, styles.rupeeCoin1]}
							contentFit="contain"
						/>
						{/* <Image
							source={RUPEE_COIN}
							style={[styles.coin, styles.rupeeCoin2]}
							contentFit="contain"
						/> */}
						<Image
							source={RUPEE_COIN}
							style={[styles.coin, styles.rupeeCoin3]}
							contentFit="contain"
						/>
						<Image
							source={RUPEE_COIN}
							style={[styles.coin, styles.rupeeCoin4]}
							contentFit="contain"
						/>
						{/* <Image
							source={RUPEE_COIN}
							style={[styles.coin, styles.rupeeCoin5]}
							contentFit="contain"
						/> */}
						<Image
							source={RUPEE_COIN}
							style={[styles.coin, styles.rupeeCoin6]}
							contentFit="contain"
						/>

						{/* Back button */}
						<TouchableOpacity style={styles.backButton} onPress={() => setIsExitModalVisible(true)}>
							<MaterialIcons name="arrow-back" size={24} color="white" />
						</TouchableOpacity>

						{/* Congratulations text */}
						<View style={styles.textContainer}>
							<Text style={styles.congratsText}>
								<TranslatedText translationKey="congratulations" /> 🎉
							</Text>
							
							{/* Styled SubText with Bold Pre-Qualified */}
							<Text style={styles.subText}>
								<TranslatedText translationKey="youArePreQualifiedForLoanUpTo" />{" "}
								<Text style={styles.boldGreenText}>
									<TranslatedText translationKey="preQualified" />
								</Text>{" "}
								<TranslatedText translationKey="forLoanFromOurLendingPartner" />
							</Text>

							<View style={styles.amountBlockCentered}>
								{!isHindi && (
									<TranslatedText
										style={styles.upToText}
										translationKey="upTo"
									/>
								)}
								<View style={styles.loanAmountContainer}>
									<Text style={styles.loanAmountText}>₹15,000</Text>
									{isHindi && (
										<TranslatedText
											style={styles.upToTextHindi}
											translationKey="upTo"
										/>
									)}
								</View>
								<TranslatedText style={styles.tcTextRight} translationKey="tcApply" />
							</View>
						</View>
					</View>

					{/* Middle Section - Light Green Card */}
					<View style={styles.contentContainer}>
						<View style={styles.membershipCard}>

							{/* Solid thin line */}
							<View style={styles.separatorLine} />

							<View style={styles.feeRow}>
								<TranslatedText style={styles.feeRowLabel} translationKey="assessmentFee" />
								<View style={styles.feeAmountContainer}>
									<Text style={styles.feeRowAmount}>₹{processingFeeAmount}*</Text>
									<TranslatedText style={styles.feeRowSubtext} translationKey="nonRefundableFee" />
								</View>
							</View>

							{/* Solid/Dashed line */}
							<View style={styles.separatorLine} />

							<View style={styles.featuresListContainer}>
								<View style={styles.featureLine}>
									<View style={styles.featureIconContainer}>
										<MaterialIcons name="verified-user" size={18} color="#00BFA5" />
									</View>
									<TranslatedText style={styles.featureItemText} translationKey="accessToInstantLoan" />
								</View>
								<View style={styles.featureLine}>
									<View style={styles.featureIconContainer}>
										<MaterialIcons name="schedule" size={18} color="#00BFA5" />
									</View>
									<TranslatedText style={styles.featureItemText} translationKey="fasterLoanProcessing" />
								</View>
								<View style={styles.featureLine}>
									<View style={styles.featureIconContainer}>
										<MaterialIcons name="trending-up" size={18} color="#00BFA5" />
									</View>
									<TranslatedText style={styles.featureItemText} translationKey="accessToNewOffers" />
								</View>
							</View>
						</View>

						{/* Consent Checkbox + Proceed to Pay Button outside the card */}
						{!modalVisible && (
							<View style={styles.buttonContainer}>
								{/* Consent Checkbox */}
								<TouchableOpacity
									style={styles.consentRow}
									onPress={() => setConsentChecked((v) => !v)}
									activeOpacity={0.7}>
									<View style={[styles.checkbox, consentChecked && styles.checkboxChecked]}>
										{consentChecked && (
											<Text style={styles.checkmark}>✓</Text>
										)}
									</View>
									<TranslatedText style={styles.consentText} translationKey="consentAssessmentFee" />
								</TouchableOpacity>
								<TouchableOpacity
									style={[styles.proceedButton, (!consentChecked || isPending || paymentStatus.paymentPending || isLoadingProcessingFee) && styles.proceedButtonDisabled]}
									disabled={
										!consentChecked || isPending || paymentStatus.paymentPending || isLoadingProcessingFee
									}
									onPress={handleCheckout}>
									{isLoadingProcessingFee ? (
										<ActivityIndicator size="small" color="#333" />
									) : isPending ? (
										<ActivityIndicator size="small" color="#333" />
									) : paymentStatus?.paymentPending ? (
										<Text style={styles.proceedButtonText}>
											Waiting for {Math.floor(paymentStatus.paymentTimer / 60).toString().padStart(2, "0")}:
											{(paymentStatus.paymentTimer % 60).toString().padStart(2, "0")} min
										</Text>
									) : (
										<View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
											<Text style={styles.proceedButtonText}>{t("proceedToPay")}</Text>
											<IconSymbol name="arrow.right" size={20} color={dark} />
										</View>
									)}
								</TouchableOpacity>
							</View>
						)}
					</View>

						{/* <View style={styles.feeContainer}>
							<TranslatedText
								style={styles.feeLabel}
								translationKey="assessmentFee"
							/>
							{isLoadingProcessingFee ? (
								<View style={styles.priceContainer}>
									<Text style={styles.discountedPrice}>-</Text>
								</View>
							) : (
								<>
									<View style={styles.priceContainer}>
										<Text style={styles.actualPrice}>
											₹ {actualProcessingFeeAmount}/-
										</Text>
									</View>
									<View style={styles.priceContainer}>
										<Text style={styles.discountedPrice}>
											₹ {processingFeeAmount}{" "}
											<Text style={{ fontSize: font(1.4) }}>
												+ ({gst}% GST)
											</Text>
										</Text>
									</View>
								</>
							)}
						</View>
						<View
							style={{
								width: "100%",
								flexDirection: "row-reverse",
								marginTop: -height(2),
								marginBottom: height(2),
							}}>
							<Text
								style={{
									fontSize: font(1.4),
									// marginTop: -height(3),
									textAlign: "right",
									color: "#777",
								}}>
								<TranslatedText translationKey="taxesAsApplicable" />{" "}
								<Text style={{ color: "red" }}>*</Text>
							</Text>
						</View> */}

						{/* RapidCare Component */}
						{/* <View style={styles.rapidCareContainer}>
							<View style={styles.rapidCareHeader}>
								<TranslatedText
									style={styles.rapidCareTitle}
									translationKey="alsoGetComplimentary"
								/>
								<View style={{ flexDirection: "row", gap: width(3) }}>
									<TranslatedText
										style={[
											{
												fontWeight: "bold",
												fontSize: font(2.3),
												color: "#777",
											},
										]}
										translationKey="rapidCare"
									/>
									<TouchableOpacity onPress={() => router.push("/rapidcare")}>
										<Text
											style={[
												{
													color: white,
													backgroundColor: "#4FCEB3",
													fontSize: font(1.9),
													paddingHorizontal: width(2),
													borderRadius: width(30),
													fontWeight: "bold",
													marginTop: height(0.5),
												},
											]}>
											i
										</Text>
									</TouchableOpacity>
								</View>
							</View>
							<View style={styles.rapidCareMainTitle}>
								<TranslatedText
									style={styles.rapidCareText}
									translationKey="rapidCare"
								/>
								<TouchableOpacity
									style={styles.infoButton}
									onPress={handleRapidCareInfo}>
									<MaterialIcons name="info" size={16} color="#4CAF50" />
								</TouchableOpacity>
							</View>
							<LinearGradient
								colors={["#F9F4CC", "#E6D4FE"]}
								start={{ x: 0, y: 0 }}
								end={{ x: 1, y: 0 }}
								style={styles.amountCard}>
								<TranslatedText
									style={styles.packageTitle}
									translationKey="packageIncludes"
								/>
								<View style={styles.featuresContainer}>
									<View style={styles.featureItem}>
										<TouchableOpacity
											onPress={() => router.push("/rapidcare")}
											style={[
												styles.featureIcon,
												{ backgroundColor: "#FFF1F4" },
											]}>
											<Image
												source={Images.DOC_ON_CALL_ICON}
												style={[styles.featureImage]}
												contentFit="contain"
											/>
										</TouchableOpacity>
										<TranslatedText
											style={styles.featureText}
											translationKey="docOnCallWithCertifiedDoctors"
										/>
									</View>
									<View style={styles.featureItem}>
										<TouchableOpacity
											onPress={() => router.push("/rapidcare")}
											style={[
												styles.featureIcon,
												{ backgroundColor: "#EAFFF7" },
											]}>
											<Image
												source={Images.CHAT_WITH_DOCTOR_ICON}
												style={styles.featureImage}
												contentFit="contain"
											/>
										</TouchableOpacity>
										<TranslatedText
											style={styles.featureText}
											translationKey="chatWithDoctor"
										/>
									</View>
									<View style={styles.featureItem}>
										<TouchableOpacity
											onPress={() => router.push("/rapidcare")}
											style={[
												styles.featureIcon,
												{ backgroundColor: "#FEF9ED" },
											]}>
											<Image
												source={Images.DEATH_COVERAGE_ICON}
												style={styles.featureImage}
												contentFit="contain"
											/>
										</TouchableOpacity>
										<TranslatedText
											style={styles.featureText}
											translationKey="accidentalDeathCover"
										/>
									</View>
								</View>
							</LinearGradient>
						</View> */}
				</ScrollView>
			</View>

			{/* <Modal visible={paymentStatus.paymentPending} transparent={false} animationType="fade">
				<View className="flex-1 justify-center align-middle flex-col gap-y-[3em]">
					<Text>Do not close this app.</Text>
					<Text>{`Waiting ${timerFormat.value} ${timerFormat.unit}`} ...</Text>
				</View>
			</Modal> */}

			{/* Payment Success Modal */}
			<Modal visible={modalVisible} transparent={true} animationType="none" statusBarTranslucent={true}>
				<View style={styles.modalOverlay}>
					<View style={styles.modalContent}>
						<Animated.Image
							source={SUCCESS_ICON}
							style={[styles.successImage, { transform: [{ scale: scaleAnim }] }]}
							resizeMode="contain"
						/>
						<TranslatedText
							style={styles.successTitle}
							translationKey="paymentSuccessful"
						/>
						<TranslatedText
							style={styles.successSubtitle}
							translationKey="congratulationsAssessmentFeePaid"
						/>
					</View>
				</View>
			</Modal>

			{/* Rejection Modal */}
				<RejectionModal
					visible={rejectionModalVisible}
					countdown={rejectionCountdown}
					setCountdown={setRejectionCountdown}
					onClose={() => setRejectionModalVisible(false)}
				/>

				<ExitIntentModal
					visible={isExitModalVisible}
					onClose={() => setIsExitModalVisible(false)}
					onConfirmExit={async () => {
						setIsExitModalVisible(false);
						await clearTimer();
						router.replace("/(tabs)");
					}}
				/>
		</>
	);
}

const styles = StyleSheet.create({
	modalOverlay: {
		position: "absolute",
		top: -height(20),
		left: 0,
		right: 0,
		bottom: -height(20),
		width: "100%",
		height: height(140),
		backgroundColor: "rgba(0,0,0,0.08)",
		justifyContent: "center",
		alignItems: "center",
	},
	modalContent: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		width: "100%",
		height: "100%",
		backgroundColor: "white",
		borderRadius: 0,
		alignItems: "center",
		justifyContent: "center",
	},
	successImage: {
		width: width(40),
		height: width(40),
		marginBottom: height(4),
	},
	successTitle: {
		fontSize: 22,
		fontWeight: "700",
		color: "#333",
		textAlign: "center",
		marginBottom: height(2),
		lineHeight: 30,
	},
	successSubtitle: {
		fontSize: 14,
		color: "#333",
		textAlign: "center",
		marginTop: 0,
	},
	container: {
		flex: 1,
		backgroundColor: white,
		alignItems: "center",
	},
	scrollView: {
		flex: 1,
		width: "100%",
		backgroundColor: "#EAF2D7",
	},
	scrollContentContainer: {
		flexGrow: 1,
		paddingBottom: height(10),
	},
	bannerContainer: {
		width: "100%",
		alignItems: "center",
		position: "relative",
		backgroundColor: "#EAF2D7",
		zIndex: 10,
		
	},
	banner: {
		width: "100%",
		height: height(37),
		overflow: "hidden",
		borderBottomLeftRadius: width(10),
		borderBottomRightRadius: width(10),
		backgroundColor: "#033120",
		
	},
	coin: {
		position: "absolute",
		width: width(6),
		height: width(6),
	},
	rupeeCoin1: {
		top: height(8),
		left: width(15),
	},
	rupeeCoin2: {
		top: height(15),
		right: width(12),
	},
	rupeeCoin3: {
		bottom: height(10),
		left: width(8),
	},
	rupeeCoin4: {
		bottom: height(15),
		right: width(20),
	},
	rupeeCoin5: {
		top: height(25),
		left: width(25),
	},
	rupeeCoin6: {
		bottom: height(25),
		right: width(8),
	},
	backButton: {
		position: "absolute",
		top: height(4),
		left: width(4),
		zIndex: 50,
		padding: width(2),
		
	},
	textContainer: {
		position: "absolute",
		top: height(4.5),
		alignItems: "center",
		zIndex: 20,
		width: "100%",
		
	},
	congratsText: {
		fontSize: font(3.2),
		fontWeight: "bold",
		color: "white",
		textAlign: "center",
		marginBottom: height(1),
	},
	subText: {
		fontSize: font(1.8),
		color: "white",
		textAlign: "center",
		marginBottom: height(2),
		lineHeight: 22,
	},
	boldGreenText: {
		fontWeight: "bold",
		color: "#A4E65E", // Light green matching the screenshot
	},
	amountBlockCentered: {
		alignItems: "flex-start",
		marginBottom: height(1.5),
	},
	loanAmountContainer: {
		flexDirection: "row",
		alignItems: "flex-start",
	},
	loanAmountText: {
		fontSize: font(5),
		fontWeight: "bold",
		color: "white",
		textAlign: "center",
	},
	asterisk: {
		fontSize: font(3),
		color: "white",
		marginTop: height(0.5),
		lineHeight: font(5),
	},
	upToText: {
		fontSize: font(1.6),
		color: "white",
		textAlign: "left",
		marginBottom: -height(0.9),
		zIndex: 2,
	},
	upToTextHindi: {
		fontSize: font(1.6),
		color: "white",
		marginLeft: width(1),
		alignSelf: "flex-end",
		marginBottom: height(0.8),
	},
	disclaimerText: {
		fontSize: font(1.6),
		color: dark,
		textAlign: "center",
		marginBottom: height(2.5),
		lineHeight: 22,
		fontWeight: "500",
	},
	tcText: {
		fontSize: font(1.6),
		color: 'white',
		textAlign: "center",
		opacity: 0.9,
	},
	tcTextRight: {
		fontSize: font(1.7),
		color: 'white',
		textAlign: "right",
		alignSelf: "center",
		marginTop: -height(0.1),
		opacity: 0.9,
	},
	contentContainer: {
		paddingHorizontal: width(4),
		marginTop: -height(5),
		paddingBottom: height(2),
		zIndex: 30,
	},
	membershipCard: {
		backgroundColor: "#EAF2D7", // Matching light green bg
		borderRadius: width(4),
		paddingHorizontal: width(6),
		paddingTop: height(4),
		paddingBottom: height(3),
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.1,
		shadowRadius: 8,
		elevation: 3,
	},
	separatorLine: {
		height: 1,
		backgroundColor: "#000", // Darker greenish line
		width: "100%",
		marginVertical: height(2.5),
	},
	feeRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "flex-start",
	},
	feeRowLabel: {
		fontSize: font(1.8),
		fontWeight: "600",
		color: "#000",
		marginTop: height(0.5),
	},
	feeAmountContainer: {
		alignItems: "flex-end",
	},
	feeRowAmount: {
		fontSize: font(3),
		fontWeight: "bold",
		color: dark,
	},
	feeRowSubtext: {
		fontSize: font(1.2),
		color: "#666",
		marginTop: height(0.5),
	},
	featuresListContainer: {
		marginBottom: height(3),
		gap: height(2),
	},
	featureLine: {
		flexDirection: "row",
		alignItems: "center",
	},
	featureIconContainer: {
		width: width(8),
		height: width(8),
		borderRadius: width(2),
		backgroundColor: "white",
		justifyContent: "center",
		alignItems: "center",
		marginRight: width(3),
	},
	featureItemText: {
		fontSize: font(1.7),
		color: "#000",
		fontWeight: "500",
	},
	buttonContainer: {
		width: "100%",
		marginTop: height(5),
	},
	amountText: {
		fontSize: 24,
		fontWeight: "900",
		color: "white",
		textAlign: "center",
	},
	logo: {
		position: "absolute",
		top: height(6),
		alignSelf: "center",
		width: width(55),
		height: height(7),
		zIndex: 2,
	},
	content: {
		paddingHorizontal: 0,
		paddingTop: height(3),
		paddingBottom: height(12),
		alignItems: "center",
	},
	mainHeading: {
		fontSize: 20,
		fontWeight: "600",
		color: "#333",
		textAlign: "center",
		marginBottom: height(4),
		paddingHorizontal: width(4),
		lineHeight: 28,
	},
	feeContainer: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		width: "100%",
		borderWidth: 2,
		borderColor: "#18CA53",
		borderStyle: "dashed",
		borderRadius: 8,
		padding: width(4),
		marginBottom: height(3),
		backgroundColor: "#F0FFF5",
	},
	priceContainer: {
		flexDirection: "row",
		alignItems: "center",
		gap: width(2),
	},
	actualPrice: {
		fontSize: font(1.4),
		fontWeight: "600",
		color: "gray",
		textDecorationLine: "line-through",
	},
	discountedPrice: {
		fontSize: font(2.7),
		fontWeight: "600",
		color: "#4CAF50",
	},
	rapidCareContainer: {
		borderRadius: 16,
		// paddingVertical: width(),
		marginBottom: height(2),
		width: "100%",
	},
	rapidCareMainTitle: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		marginBottom: height(2),
	},
	rapidCareText: {
		fontSize: 28,
		fontWeight: "bold",
		color: "#333",
		marginRight: width(2),
	},
	infoButton: {
		backgroundColor: "rgba(76, 175, 80, 0.1)",
		borderRadius: 12,
		padding: width(1),
	},
	packageTitle: {
		fontSize: font(1.6),
		fontWeight: "500",
		color: "#333",
		textAlign: "center",
		marginBottom: height(1),
	},
	featuresContainer: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		marginTop: height(1),
		width: "100%",
		paddingHorizontal: width(2),
	},
	featureDisplayImage: {
		width: width(24),
		height: width(24), 
		// resizeMode: "contain", // handled by contentFit
	},
	featureItem: {
		// alignItems: "center",
		flex: 1,
		justifyContent: "center",
		// paddingHorizontal: width(1),
	},
	featureIcon: {
		borderRadius: width(3),
		paddingHorizontal: width(2),
		paddingVertical: width(2),
		marginBottom: height(1),
		justifyContent: "center",
		alignItems: "center",
	},
	featureImage: {
		width: width(4),
		height: height(4),
	},
	featureText: {
		fontSize: font(1),
		fontWeight: "500",
		color: "#333",
		textAlign: "center",
		lineHeight: font(1),
	},
	proceedButton: {
		backgroundColor: "#B8FF55",
		borderRadius: width(2.5),
		paddingVertical: height(2.2),
		paddingHorizontal: width(8),
		width: "100%",
		alignItems: "center",
	},
	feeDisclaimer: {
		display: "none",
	},
	proceedButtonText: {
		fontSize: font(2.2),
		fontWeight: "bold",
		color: dark,
	},
		checkboxContainer: {
		marginRight: width(3),
		marginTop: height(0.2),
	},
	checkbox: {
		width: width(5),
		height: width(5),
		borderWidth: 2,
		borderColor: "#000",
		borderRadius: width(1),
		backgroundColor: white,
		alignItems: "center",
		justifyContent: "center",
	},
	checkboxChecked: {
		backgroundColor: primary,
		borderColor: primary,
	},
	checkmark: {
		color: "#000",
		fontSize: font(1.5),
		fontWeight: "bold",
	},
	// Header BG image
	rejectionHeaderBg: {
		width: "150%",
		paddingTop: height(5),
		paddingBottom: height(6),
		paddingHorizontal: width(7),
		alignItems: "center",
		justifyContent: "center",
		transform: [{ translateY: -height(2) }],
	},

	consentRow: {
		flexDirection: "row",
		alignItems: "flex-start",
		marginBottom: 14,
		gap: 10,
	},
	consentText: {
		flex: 1,
		fontSize: font(1.45),
		color: "#000",
		lineHeight: 20,
		fontWeight: "500",
	},
	proceedButtonDisabled: {
		opacity: 0.45,
	},
});
