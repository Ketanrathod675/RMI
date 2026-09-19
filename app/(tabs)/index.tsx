import FAQ from "@/components/FAQ";
import FiveSecDelay from "@/components/FiveSecDelay";
import { PushNotificationDebugger } from "@/components/PushNotificationDebugger";
import TestimonialCarousel from "@/components/TestimonialCarousel";
import { TranslatedText } from "@/components/TranslatedText";
import { IconSymbol } from "@/components/ui/IconSymbol";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { dark, dark_primary, primary, white } from "@/constants/Colors";
import { Images } from "@/constants/images";
import { VIDEO_TUTORIALS } from "@/constants/videoTutorials";
import { useAuth } from "@/hooks/useAuth";
import { useDefault } from "@/hooks/useDefault";
import { useNetworkAwareQuery } from "@/hooks/useNetworkAwareQuery";
import { usePermissions } from "@/hooks/usePermissions";
import { useTranslation } from "@/hooks/useTranslation";
import { clearNotifications, setNotifications, useDispatch, type RootState, clearTransactionId } from "@/store";
import { setUserType } from "@/utils/analytics";
import { checkCanReapply, getUserDashboardData, Status, StepHref } from "@/utils/api";
// TODO: migrate off legacy API
import { verifyLeadCreation, checkEasebuzzPaymentStatus } from "@/utils/api/kyc";
import { font, height, width } from "@/utils/dimensions";
import { decode } from "@/utils/encode_decode";
import Logger from "@/utils/logger";
import { getStorageItem, removeStorageItem, STORAGE_KEYS } from "@/utils/storage";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect, useNavigation } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
	Alert,
	Animated,
	BackHandler,
	Dimensions,
	Image,
	ImageBackground,
	Modal,
	Platform,
	Pressable,
	ScrollView,
	StatusBar as RNStatusBar,
	StyleSheet,
	Text,
	TouchableOpacity,
	View
} from "react-native";
import Toast from "react-native-toast-message";
import { useSelector } from "react-redux";

// Format amount to Indian Rupees with proper formatting
const formatIndianRupees = (amount: number): string => {
	return new Intl.NumberFormat("en-IN", {
		style: "currency",
		currency: "INR",
		minimumFractionDigits: 0,
		maximumFractionDigits: 2,
	}).format(amount);
};

// Simple Circular Progress Component
const CircularProgress = ({ percentage }: { percentage: number }) => {
	const size = width(15);

	const roundPercentage = Math.round(percentage);



	return (
		<View
			style={{
				width: size,
				height: size,
				alignItems: "center",
				justifyContent: "center",
				position: "relative",
			}}>
			{/* Background Circle */}
			<View
				style={{
					width: size,
					height: size,
					borderRadius: size / 2,
					borderWidth: 4,
					borderColor: "#E6D4FE",
					position: "absolute",
					top: 0,
					left: 0,
				}}
			/>

			{/* Progress Circle - Simple approach using borderColor based on percentage */}
			<View
				style={{
					width: size,
					height: size,
					borderRadius: size / 2,
					borderWidth: 4,
					borderLeftColor: percentage > 12 ? primary : "#E6D4FE",
					borderTopColor: percentage > 37 ? primary : "#E6D4FE",
					borderRightColor: percentage > 62 ? primary : "#E6D4FE",
					borderBottomColor: percentage > 87 ? primary : "#E6D4FE",
					position: "absolute",
					top: 0,
					left: 0,
					transform: [{ rotate: "45deg" }],
				}}
			/>

			{/* Inner white circle */}
			<View
				style={{
					width: size - 16,
					height: size - 16,
					backgroundColor: white,
					borderRadius: (size - 16) / 2,
					alignItems: "center",
					justifyContent: "center",
					elevation: 1,
					shadowColor: "#000",
					shadowOffset: { width: 0, height: 1 },
					shadowOpacity: 0.05,
					shadowRadius: 1,
					zIndex: 10,
				}}>
				<Text
					style={{
						fontSize: font(roundPercentage > 99 ? 1.7 : 2.0),
						fontWeight: "bold",
						color: dark,
						textAlign: "center",
						textAlignVertical: "center",
						includeFontPadding: false,
						lineHeight: font(1.7) * 1.2,
					}}>
					{roundPercentage}%
				</Text>
			</View>
		</View>
	);
};

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

export default function Home() {
	const insets = useSafeAreaInsets();
	// [FOWS-DIAGNOSTIC] Log MOUNTED message with timestamp
	if (__DEV__) {
		console.log(`🚀 [FOWS-DIAG][(tabs)/index.tsx] MOUNTED at timestamp: ${new Date().toISOString()} (${Date.now()})`);
	}

	const [isDrawerOpen, setIsDrawerOpen] = useState(false);
	const [showSettings, setShowSettings] = useState(false);
	const slideAnimation = useRef(new Animated.Value(-screenWidth * 0.8)).current;

	const [termDate, setTermDate] = useState("");
	const [hasNoApprovedAmountFlag, setHasNoApprovedAmountFlag] = useState(false);
	const [hasLoanRejectedFlag, setHasLoanRejectedFlag] = useState(false);

	// State for exit alert functionality
	const [showExitAlert, setShowExitAlert] = useState(false);

	// State for loan terms modal
	const [showLoanTermsModal, setShowLoanTermsModal] = useState(false);
	const [loanType, setLoanType] = useState<"term" | "short">("term");
	const loanTermsSlideAnim = useRef(new Animated.Value(screenHeight)).current;
	const loanTermsBackgroundOpacity = useRef(new Animated.Value(0)).current;

	const [delayVisible, setDelayVisible] = useState(false);
	const [delayStageKey, setDelayStageKey] = useState<string>("verifyingPaymentWait");
	const [isVerifyLeadFlow, setIsVerifyLeadFlow] = useState(false);
	const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

	const [isPaymentPolling, setIsPaymentPolling] = useState(false);
	const [modalVisible, setModalVisible] = useState(false);
	const scaleAnim = useRef(new Animated.Value(0)).current;
	const paymentPollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);



	useEffect(() => {
		if (modalVisible) {
			const timeout = setTimeout(() => {
				Animated.timing(scaleAnim, {
					toValue: 1,
					duration: 50,
					useNativeDriver: true,
				}).start();
			}, 1500);

			const timeout2 = setTimeout(async () => {
				setModalVisible(false);
				
				// Reset animation scale
				scaleAnim.setValue(0);

				// Start lead creation check flow
				startVerifyLeadFlow(true);
			}, 3000);

			return () => {
				clearTimeout(timeout);
				clearTimeout(timeout2);
			};
		}
	}, [modalVisible]);

	const startPaymentPolling = (txnId: string) => {
		if (paymentPollIntervalRef.current) {
			clearInterval(paymentPollIntervalRef.current);
		}

		setDelayStageKey("verifyingPaymentWait");
		setIsPaymentPolling(true);
		setDelayVisible(true);

		const pollStartTime = Date.now();

		const checkStatus = async () => {
			try {
				console.log(`[Dashboard] Checking Easebuzz status for transaction ${txnId}...`);
				const res = await checkEasebuzzPaymentStatus(txnId);
				Logger.debug("Dashboard payment status response", res);

				if (res.status === "success") {
					if (paymentPollIntervalRef.current) clearInterval(paymentPollIntervalRef.current);
					setIsPaymentPolling(false);
					setDelayVisible(false);

					// Clear transaction ID from state and storage since it succeeded
					dispatch(clearTransactionId());
					await removeStorageItem(STORAGE_KEYS["@transaction-id"]);
					await removeStorageItem(STORAGE_KEYS["@payment-timer-start"]);

					// Refresh dashboard data
					refetch();

					// Show success modal
					setModalVisible(true);
					return true;
				}

				if (res.status === "failure") {
					if (paymentPollIntervalRef.current) clearInterval(paymentPollIntervalRef.current);
					setIsPaymentPolling(false);
					setDelayVisible(false);

					// Clear transaction ID from state and storage since it failed
					dispatch(clearTransactionId());
					await removeStorageItem(STORAGE_KEYS["@transaction-id"]);
					await removeStorageItem(STORAGE_KEYS["@payment-timer-start"]);

					// Show failure toast
					setTimeout(() => {
						Toast.show({
							type: "error",
							text1: t("transactionFailed"),
							text2: t("pleaseRetryPayment"),
							visibilityTime: 7000,
						});
					}, 500);
					return true;
				}
			} catch (err) {
				Logger.error("Dashboard payment status check failed", err);
			}
			return false;
		};

		// Run immediately
		checkStatus();

		// Poll every 5 seconds
		paymentPollIntervalRef.current = setInterval(async () => {
			const elapsed = Date.now() - pollStartTime;
			if (elapsed >= 120000) { // 2 minutes
				if (paymentPollIntervalRef.current) clearInterval(paymentPollIntervalRef.current);
				const isResolved = await checkStatus();
				if (!isResolved) {
					console.log("[Dashboard] Easebuzz status polling timed out (2 min). Stopping polling...");
					setIsPaymentPolling(false);
					setDelayVisible(false);

					// We do NOT clear the transaction ID from storage, so they can retry later.
					// Just show a Toast informing them.
					setTimeout(() => {
						Toast.show({
							type: "info",
							text1: t("verifyingPaymentWait"),
							text2: t("pleaseRetryPayment"),
							visibilityTime: 5000,
						});
					}, 500);
				}
			} else {
				await checkStatus();
			}
		}, 5000);
	};

	const startVerifyLeadFlow = (isPostPayment = true) => {
		setDelayStageKey(
			isPostPayment
				? "paymentConfirmedVerifyingDetails"
				: "verifyingDetails"
		);
		setIsVerifyLeadFlow(true);
		setDelayVisible(true);

		const startTime = Date.now();

		const checkLead = async () => {
			try {
				console.log("🚀 Calling verifyLeadCreation() from dashboard...");
				const res = await verifyLeadCreation();
				Logger.debug("Dashboard lead verification response", res);

				if (res?.lead_created) {
					console.log("✅ Lead created is true! Continuing to verify-email...");
					if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
					setDelayVisible(false);
					setIsVerifyLeadFlow(false);
					router.push("/verify-email" as any);
					return true;
				}
			} catch (err) {
				Logger.error("Dashboard lead verification failed", err);
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
					console.log("❌ Lead verification still false after 60s on dashboard. Closing loader...");
					setDelayVisible(false);
					setIsVerifyLeadFlow(false);
				}
			} else {
				await checkLead();
			}
		}, 2000);
	};

	const { logout } = useAuth();
	const { t, tWithValues } = useTranslation();
	const { language } = useDefault();
	const navigation = useNavigation();

	const { allPermissionsGranted } = usePermissions();

	const dispatch = useDispatch();
	const notifications = useSelector((state: RootState) => state.user.notifications);

	const { data, isPending, refetch } = useNetworkAwareQuery({
		queryKey: ["user", "dashboard"],
		queryFn: getUserDashboardData,
		staleTime: 3000,
		retry: 2,
	});

	const progressPercentage = data?.workflow_progress?.completion_percentage ?? 0;
	const isReapplyScenario = !isPending && data && (data as any)?.dashboard_type === "workflow_dashboard" && progressPercentage === 100;

	const faqData = [
		{
			id: '1',
			question: t('faqQ1'),
			answer: t('faqA1'),
		},
		{
			id: '2',
			question: t('faqQ2'),
			answer: t('faqA2'),
		},
		{
			id: '3',
			question: t('faqQ3'),
			answer: t('faqA3'),
		},
		{
			id: '4',
			question: t('faqQ4'),
			answer: t('faqA4'),
		},
	];

	// Refetch dashboard data when screen comes into focus to update progress
	useFocusEffect(
		useCallback(() => {
			RNStatusBar.setBarStyle("light-content");
			if (Platform.OS === "android") {
				RNStatusBar.setBackgroundColor("transparent");
				RNStatusBar.setTranslucent(true);
			}
			refetch();
			  try {
                console.log("FB _ dashboard_viewed");
            } catch (error) {
                console.error("🔥 [Analytics] FB Dashboard event error:", error);
            }
		}, [refetch])
	);

	Logger.debug("Dashboard response", data);

	

	useEffect(() => {
		const fetchTermDate = async () => {
			const termDate = await getStorageItem(STORAGE_KEYS["@completion-date"]);

			if (termDate) {
				setTermDate(decode(termDate));
			}
		};

		const checkNoApprovedAmountFlag = async () => {
			const flag = await getStorageItem(STORAGE_KEYS["@no-approved-amount-flag"]);
			if (flag === "true") {
				setHasNoApprovedAmountFlag(true);
				// Clear the flag after reading
				await removeStorageItem(STORAGE_KEYS["@no-approved-amount-flag"]);
			}
		};

		const checkLoanRejectedFlag = async () => {
			const flag = await getStorageItem(STORAGE_KEYS["@loan-rejected-flag"]);
			if (flag === "true") {
				setHasLoanRejectedFlag(true);
				// Clear the flag after reading
				await removeStorageItem(STORAGE_KEYS["@loan-rejected-flag"]);
			}
		};

		fetchTermDate();
		checkNoApprovedAmountFlag();
		checkLoanRejectedFlag();
		return () => {
			if (pollIntervalRef.current) {
				clearInterval(pollIntervalRef.current);
			}
			if (paymentPollIntervalRef.current) {
				clearInterval(paymentPollIntervalRef.current);
			}
		};
	}, []);

	useEffect(() => {
		if (isPending) {
			dispatch(clearNotifications());
			return;
		}

		if (data?.notifications) {
			dispatch(setNotifications(data.notifications));
		}
	}, [isPending, data?.notifications, dispatch]);

	// Loan Terms Modal Functions
	const showLoanTermsModalHandler = (type: "term" | "short") => {
		setLoanType(type);
		setShowLoanTermsModal(true);

		// First animate background opacity
		Animated.timing(loanTermsBackgroundOpacity, {
			toValue: 1,
			duration: 200,
			useNativeDriver: true,
		}).start(() => {
			// Then slide up the modal after 50ms
			setTimeout(() => {
				Animated.timing(loanTermsSlideAnim, {
					toValue: 0,
					duration: 300,
					useNativeDriver: true,
				}).start();
			}, 50);
		});
	};

	const hideLoanTermsModal = () => {
		Animated.timing(loanTermsSlideAnim, {
			toValue: screenHeight,
			duration: 250,
			useNativeDriver: true,
		}).start(() => {
			Animated.timing(loanTermsBackgroundOpacity, {
				toValue: 0,
				duration: 200,
				useNativeDriver: true,
			}).start(() => {
				setShowLoanTermsModal(false);
			});
		});
	};

	// Handle back press with exit confirmation - only when focused on this tab
	const handleBackPress = useCallback(() => {
		// Only handle back press if this screen is focused
		if (!navigation.isFocused()) {
			return false;
		}

		if (showExitAlert) {
			// If alert is already showing and user presses back, close alert and exit app
			setShowExitAlert(false);
			setTimeout(() => {
				BackHandler.exitApp();
			}, 50);
			return true;
		}

		// Show exit confirmation alert
		setShowExitAlert(true);
		Alert.alert(
			t("exitApp"),
			t("areYouSureExitApp"),
			[
				{
					text: t("stay"),
					onPress: () => setShowExitAlert(false),
					style: "cancel",
				},
				{
					text: t("exit"),
					onPress: () => {
						setShowExitAlert(false);
						setTimeout(() => {
							BackHandler.exitApp();
						}, 50);
					},
					style: "destructive",
				},
			],
			{
				cancelable: false,
				onDismiss: () => setShowExitAlert(false),
			},
		);

		return true; // Prevent default behavior
	}, [showExitAlert, t]);

	// Store back handler reference for cleanup
	const backHandlerRef = useRef<any>(null);

	// Set up back handler only when this screen is focused
	useFocusEffect(
		useCallback(() => {
			backHandlerRef.current = BackHandler.addEventListener(
				"hardwareBackPress",
				handleBackPress,
			);

			return () => {
				if (backHandlerRef.current) {
					backHandlerRef.current.remove();
					backHandlerRef.current = null;
				}
				setShowExitAlert(false);
			};
		}, [handleBackPress])
	);

	const userLoanAndJourneyStatus = isPending
		? "fetching"
		: data?.workflow_steps?.every((item) => item?.status === Status.Completed)
			? "completed"
			: "unfinished";

	// Check if application is completed based on backend overall_status
	const applicationCompleted = data?.workflow_progress?.overall_status === "completed";

	// Check if loan application is rejected
	const overallStatus = data?.workflow_progress?.overall_status;
	const isRejected =
		overallStatus === "rejected" ||
		overallStatus === "application_rejected" ||
		overallStatus === "no_approved_amount" ||
		hasNoApprovedAmountFlag ||
		hasLoanRejectedFlag;

	// Reapply handler - extracted from JourneyBackground rejection logic
	const handleReapply = async () => {
		try {
			// Call the can-reapply API
			const reapplyData = await checkCanReapply();

			if (reapplyData.can_apply) {
				const startingStep = reapplyData.starting_step;
				const href = StepHref[startingStep as keyof typeof StepHref];

				if (href) {
					console.log("Re-applying from step:", startingStep, "->", href);
					router.push({
						pathname: href as any,
						params: { fromReapply: "true" },
					});
				} else {
					Toast.show({
						type: "error",
						text1: t("error"),
						text2: "Unable to determine the starting step",
					});
				}
			} else {
				const message = reapplyData.message?.toLowerCase().includes("overdue")
					? t("overdueLoanMessage")
					: reapplyData.message || t("notEligibleToReapply");

				Toast.show({
					type: "error",
					text1: t("cannotReapply"),
					text2: message,
				});
			}
		} catch (error) {
			console.error("Re-apply error:", error);
			Toast.show({
				type: "error",
				text1: t("error"),
				text2: t("reApplicationCheckFailed"),
			});
		}
	};

	const handleContinueJourney = async () => {

				// Check if there is an active payment transaction first
		const transactionId = await getStorageItem(STORAGE_KEYS["@transaction-id"]);
		if (transactionId) {
			startPaymentPolling(transactionId);
			return;
		}
		const progress = data?.workflow_progress?.current_step;

		if (progress === "consent_permission") {
			router.push("/request-permissions");
			return;
		}

		if (progress === "pan_verification") {
			startVerifyLeadFlow(false);
			return;
		}

		// If auto-debit setup is the current step, go there immediately
		if (progress === "enach_mandate") {
			router.push("/auto-debit-setup" as any);
			return;
		}

		const href = progress
			? StepHref[progress as keyof typeof StepHref]
			: undefined;

		console.log("progress", progress, allPermissionsGranted);

		if (href) {
			if (
				progress === "personal_details" &&
				!allPermissionsGranted
			) {
				router.push("/request-permissions");
				return;
			}

			// If current step is selfie_match, navigate to liveness check with startSelfie param
			if (progress === "selfie_match") {
				router.push({
					pathname: "/ckyc-instructions" as any,
					params: { startSelfie: "true" }
				});
				return;
			}

			// If current step is digilocker, navigate to Aadhaar KYC with nextStep parameter
			if (progress === "digilocker") {
				router.push({
					pathname: "/aadhaar-kyc" as any,
					params: { nextStep: "digilocker" }
				});
				return;
			}

			// If current step is address_submission, navigate with startFromAddress param
			// This will trigger /kyc/address API call and show address step directly
			if (progress === "address_submission") {
				router.push({
					pathname: href as any,
					params: { startFromAddress: "true" }
				});
				return;
			}

			router.push(href as any);
		}
	};

	const toggleDrawer = () => {
		const toValue = isDrawerOpen ? -screenWidth * 0.8 : 0;

		Animated.timing(slideAnimation, {
			toValue,
			duration: 300,
			useNativeDriver: true,
		}).start();

		setIsDrawerOpen(!isDrawerOpen);
	};

	const closeDrawer = () => {
		if (isDrawerOpen) {
			Animated.timing(slideAnimation, {
				toValue: -screenWidth * 0.8,
				duration: 300,
				useNativeDriver: true,
			}).start();
			setIsDrawerOpen(false);
		}
	};

	const handleLogout = () => {
		logout();

		router.replace("/login");
	};


	const loanTypes = [
		{ titleKey: "medicalLoan" as const, image: Images.MEDICAL_LOAN_ICON_1 },
		{ titleKey: "personalLoan" as const, image: Images.PERSONAL_LOAN_ICON_1 },
		{ titleKey: "educationLoan" as const, image: Images.EDUCATIONAL_LOAN_ICON_1 },
		{ titleKey: "businessLoan" as const, image: Images.BUSINESS_LOAN_ICON_1 },
	];

	const testimonials = [
		{
			id: '1',
			text: 'Loan process was smooth and easy, and my amount got disbursed quickly. The processing fee is transparent and totally worth it.',
			name: 'Michael B',
			title: 'Product Manager',
			rating: 5,
			image: Images.TESTIMONIAL_MICHAEL,
		},
		{
			id: '2',
			text: 'Outstanding experience! Completed all verification checks in seconds and the loan amount showed up in my account shortly after.',
			name: 'Saurabh K',
			title: 'Software Engineer',
			rating: 5,
			image: Images.TESTIMONIAL_SAURABH,
		},
		{
			id: '3',
			text: 'The entire loan process was smooth and completely online. I completed my KYC in just a few minutes and the application process was simple to understand.',
			name: 'Sneha Gupta',
			title: 'Senior Designer',
			rating: 5,
			image: require('@/assets/images/testimonial3.png'),
		},
		{
			id: '4',
			text: 'What impressed me the most was the transparency. All charges and repayment details were clearly shown before I proceeded. Highly recommended!',
			name: 'Priya Verma',
			title: 'Marketing Lead',
			rating: 5,
			image: require('@/assets/images/testimonial4.png'),
		},
		{
			id: '5',
			text: 'Unlike many platforms, RapidMoney made the loan journey easy to understand. The updates at every step kept me informed throughout the application.',
			name: 'Rahul Sharma',
			title: 'Business Analyst',
			rating: 5,
			image: require('@/assets/images/testimonial1.png'),
		},
	];

	const placeholderVideos = VIDEO_TUTORIALS;

	// const handleDeleteAccount = () => {
	// 	const deleteAccountUrl = "https://rapidmoney.in/delete-my-account";
	// 	Linking.openURL(deleteAccountUrl).catch((err) => {
	// 		console.error("Failed to open delete account URL:", err);
	// 		Alert.alert("Error", "Failed to open delete account page");
	// 	});
	// };

	const handleDeleteAccount = () => {
		router.push("/delete-account" as any);
	};


	const handleSettingsClick = () => {
		setShowSettings(!showSettings);
	};

	// Function to check if user has active loans
	const hasActiveLoans = () => {
		if (!data) return false;

		const dashboardData = data as any;

		// Debug: Log loan status information
		console.log("🔍 Delete Account Check:", {
			hasData: !!data,
			loanNumber: dashboardData?.primary_loan?.loan_number,
			dashboardType: dashboardData?.dashboard_type,
			outstandingBalance: dashboardData?.loan_summary?.current_outstanding,
		});

		// Check if user has no loan number (no loans taken)
		if (!dashboardData?.primary_loan?.loan_number) {
			console.log("✅ Can delete: No loan number");
			return false; // No loans = can delete account
		}

		// Check if dashboard type is not loan_dashboard (means no active loans)
		if (dashboardData?.dashboard_type !== "loan_dashboard") {
			console.log("✅ Can delete: Not loan dashboard");
			return false; // No active loans = can delete account
		}

		// Check if there's outstanding balance
		const outstandingBalance = dashboardData?.loan_summary?.current_outstanding || 0;
		if (outstandingBalance <= 0) {
			console.log("✅ Can delete: No outstanding balance");
			return false; // No outstanding balance = can delete account
		}

		// If we reach here, user has active loans with outstanding balance
		console.log("❌ Cannot delete: Has active loans with outstanding balance");
		return true; // Has active loans = cannot delete account
	};


	const benefitsOfPayNow = [
		{
			id: 1,
			icon: Images.THUNDER_ICON,
			titleKey: "getNextLoanFaster" as const,
		},
		{
			id: 2,
			icon: Images.CARD_LOGO,
			titleKey: "avoidLatePaymentCharges" as const,
		},
		{
			id: 3,
			icon: Images.MONEY_ICON,
			titleKey: "unlockHigherLoanLimits" as const,
		},
	];

	// Local Carousel Component
	const HomeCarousel = () => {
		const [currentIndex, setCurrentIndex] = useState(0);
		const scrollRef = useRef<ScrollView>(null);
		const carouselImages = [
			Images.BLUE_CAROUSEL,
			Images.YELLOW_CAROUSEL,
			Images.GREEN_CAROUSEL,
		];

		const carouselWidth = width(100) - width(8);

		useEffect(() => {
			const interval = setInterval(() => {
				const nextIndex = (currentIndex + 1) % carouselImages.length;
				scrollRef.current?.scrollTo({ x: nextIndex * carouselWidth, animated: true });
				setCurrentIndex(nextIndex);
			}, 5000);
			return () => clearInterval(interval);
		}, [currentIndex]);

		const handleScroll = (event: any) => {
			const contentOffsetX = event.nativeEvent.contentOffset.x;
			const index = Math.round(contentOffsetX / carouselWidth);
			if (index !== currentIndex && index >= 0 && index < carouselImages.length) {
				setCurrentIndex(index);
			}
		};

		return (
			<View style={{ marginBottom: height(2) }}>
				<View style={styles.carouselContainer}>
					<ScrollView
						ref={scrollRef}
						horizontal
						pagingEnabled
						showsHorizontalScrollIndicator={false}
						onMomentumScrollEnd={handleScroll}
						scrollEventThrottle={16}
					>
						{carouselImages.map((img, index) => (
							<Image
								key={index}
								source={img}
								style={{ width: carouselWidth, height: "100%" }}
								resizeMode="cover"
							/>
						))}
					</ScrollView>
				</View>

				<View style={[styles.carouselDots, { marginTop: height(1) }]}>
					{carouselImages.map((_, index) => (
						<View
							key={index}
							style={[
								styles.carouselDot,
								currentIndex === index && { backgroundColor: "#8B5CF6", width: width(3) },
							]}
						/>
					))}
				</View>
			</View>
		);
	};

	console.log("application completed", applicationCompleted);

	// [FOWS-DIAGNOSTIC] First/ongoing pass render state inspection
	if (__DEV__) {
		console.log("🎨 [FOWS-DIAG][(tabs)/index.tsx] RENDER PASS:", {
			timestamp: new Date().toISOString(),
			isPending,
			hasData: !!data,
			dataUserSummary: (data as any)?.user_summary?.name ?? null,
			dashboardType: (data as any)?.dashboard_type ?? null,
			overallStatus: data?.workflow_progress?.overall_status ?? null,
			currentStep: data?.workflow_progress?.current_step ?? null,
			progressPercentage,
			isRenderingStaticShell: isPending || !data,
		});
	}

	return (
		<View style={{ flex: 1, backgroundColor: "#F5F7F2" }}>
			<StatusBar style="light" />
			<ScrollView
				style={{ flex: 1, backgroundColor: "#F5F7F2" }}

				showsVerticalScrollIndicator={false}>
				{/* Unified Hero Brand Section from Figma */}
				<LinearGradient
					colors={["#436B19", "#2A5200", "#0C1A02"]}
					locations={[0.0337, 0.45, 1.0]}
					start={{ x: 0.5, y: 0 }}
					end={{ x: 0.5, y: 1 }}
					style={[styles.heroBrand, { paddingTop: Math.max(insets.top, 12) }]}>

					{/* Navigation Header */}
					<View style={styles.navHeader}>
						<TouchableOpacity
							onPress={toggleDrawer}
							hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
							style={styles.menuButton}>
							<MaterialCommunityIcons name="menu" size={24} color="#FFFFFF" />
						</TouchableOpacity>

						<Image
							source={Images.LOGO_RAPID_MONEY}
							style={styles.navLogo}
							resizeMode="contain"
						/>

						<TouchableOpacity
							onPress={() => router.push("/user-notifications" as any)}
							style={styles.notificationBtn}>
							<MaterialCommunityIcons name="bell-outline" size={18} color="#FFFFFF" />
							{(notifications?.unread_count ?? 0) > 0 && (
								<View style={styles.notificationDot} />
							)}
						</TouchableOpacity>
					</View>

					{/* Greeting Block */}
					<View style={styles.greetingBlock}>
						<Text style={styles.userName}>
							Hi {data?.user_summary?.name ? (data.user_summary.name.length > 20 ? data.user_summary.name.slice(0, 20) + "..." : data.user_summary.name) : "Dev"}
						</Text>
						<Text style={styles.subAction}>
							{data?.dashboard_type === "loan_dashboard"
								? t("loanSummaryDetails")
								: isReapplyScenario
								? t("welcomeReapplyLoan")
								: "Apply for a Loan Now"}
						</Text>
					</View>

					{/* Card inside Hero Brand */}
					{!isPending && data && (data as any)?.dashboard_type === "loan_dashboard" ? (
						<View style={styles.loanDashboardCardWrapper}>
							<LinearGradient
								colors={['#000000', "#69ad02"]}
								style={styles.newAmountCard}>

								<View style={styles.newCardContent}>
									<Text style={styles.newCardLabel}>
										{t("amountDueCardLabel")}
									</Text>
									<Text style={styles.newAmount}>
										{formatIndianRupees((data as any)?.loan_summary?.current_outstanding || 0)}
									</Text>

									<View style={styles.dueDateBadgeContainer}>
										<View style={styles.dueDateBadgeNew}>
											<IconSymbol name="calendar" size={14} color="#E84D4D" />
											<Text style={styles.dueDateTextNew}>
												{t("dueDatePrefix")}
												{(data as any)?.loan_summary?.next_due_date
													? new Date((data as any).loan_summary.next_due_date).toLocaleDateString(language === "hindi" ? "hi-IN" : "en-IN", {
														day: "numeric",
														month: "long",
														year: "numeric"
													})
													: "-"}
											</Text>
										</View>
									</View>

									<TouchableOpacity
										style={styles.newPayNowButton}
										onPress={() => {
											const loanNumber = (data as any)?.primary_loan?.loan_number;
											if (loanNumber) {
												router.push({
													pathname: "/repayment-options" as any,
													params: { loanNumber }
												});
											}
										}}>
										<Text style={styles.newPayNowButtonText}>
											{t("payNowButton")}
										</Text>
										<IconSymbol name="arrow.right" size={20} color={white} />
									</TouchableOpacity>

									<View style={styles.newBenefitsSection}>
										<Text style={styles.newBenefitsTitle}>
											{t("earlyPayPromoTitle")}
										</Text>

										{[
											"benefit1_loanAmount",
											"benefit2_creditScore",
											"benefit3_eligibility"
										].map((key: any, index) => (
											<View key={index} style={styles.newBenefitItem}>
												<IconSymbol name="checkmark.circle.fill" size={18} color="#fff" />
												<Text style={styles.newBenefitText}>
													{t(key)}
												</Text>
											</View>
										))}
									</View>
								</View>
							</LinearGradient>

							<View style={styles.loanSummaryContainer}>
								<TranslatedText
									style={{ color: "#000", fontWeight: "700", fontSize: 18 }}
									translationKey="onTimePaymentBenefits"
								/>
								<View style={styles.benefitsListWrapper}>
									{benefitsOfPayNow.map((item) => (
										<View
											key={item.id}
											style={styles.benefitItem}
										>
											<Image
												source={item.icon}
												style={styles.benefitIcon}
											/>
											<Text style={styles.benefitText}>
												{t(item.titleKey)}
											</Text>
										</View>
									))}
								</View>

								<TouchableOpacity
									style={styles.payNowButtonBenefits}
									onPress={() => {
										const loanNumber = (data as any)?.primary_loan?.loan_number;
										if (loanNumber) {
											router.push({
												pathname: "/repayment-options" as any,
												params: { loanNumber }
											});
										}
									}}>
									<View style={{ flexDirection: "row", alignItems: "center", gap: width(2) }}>
										<Text style={{ color: '#fff', fontWeight: '700' }}>
											{t("payNow")}
										</Text>
										<IconSymbol name="arrow.right" size={20} color={white} />
									</View>
								</TouchableOpacity>
							</View>
						</View>
					) : (
						/* Pre-Qualified Card from Figma */
						<View style={styles.preQualContainer}>
							<LinearGradient
								colors={["rgba(26, 51, 0, 0.8)", "rgba(13, 30, 0, 0.8)"]}
								start={{ x: 0.9, y: 0.1 }}
								end={{ x: 0.1, y: 0.9 }}
								style={styles.cardShell}>

								{/* Subtle Glow at top right */}
								<View style={styles.cardGlow} />

								{/* Card Top: Title & Amount */}
								<View style={styles.cardTop}>
									<Text style={styles.preQualTitle}>PRE-QUALIFIED LOAN LIMIT</Text>
									<Text style={styles.preQualAmountText}>₹ 15,000/-</Text>
								</View>

								{/* CTA Button */}
								<TouchableOpacity
									activeOpacity={0.85}
									onPress={isReapplyScenario ? handleReapply : (isRejected ? handleReapply : handleContinueJourney)}
									style={styles.ctaBtnWrapper}>
									<LinearGradient
										colors={["#8AD600", "#5FA800"]}
										start={{ x: 0.5, y: 0 }}
										end={{ x: 0.5, y: 1 }}
										style={styles.ctaBtn}>
										<Text style={styles.ctaText}>
											{isReapplyScenario ? t("reapplyLoan") : (isRejected ? t("reapplyLoan") : "Complete Application")}
										</Text>
										<MaterialCommunityIcons name="arrow-right" size={18} color="#F9FDF5" />
									</LinearGradient>
								</TouchableOpacity>

								{/* Metric Badges */}
								<View style={styles.metricBadges}>
									<View style={styles.badgeItem}>
										<View style={styles.badgeIconContainer}>
											<MaterialCommunityIcons name="shield-outline" size={20} color="#EEF8E0" />
										</View>
										<Text style={styles.badgeText}>Trusted RBI-Registered</Text>
									</View>

									<View style={styles.badgeItem}>
										<View style={styles.badgeIconContainer}>
											<MaterialCommunityIcons name="clock-outline" size={20} color="#F9FFF2" />
										</View>
										<Text style={styles.badgeText}>Approved in 2 Mins</Text>
									</View>

									<View style={styles.badgeItem}>
										<View style={styles.badgeIconContainer}>
											<MaterialCommunityIcons name="database-outline" size={20} color="#FAFFF4" />
										</View>
										<Text style={styles.badgeText}>Bureau-based Paperless</Text>
									</View>
								</View>
							</LinearGradient>
						</View>
					)}
				</LinearGradient>

				{/* Loan Rejected Screen - Show only for workflow_dashboard when rejected */}
				{!isPending &&
					data &&
					(data as any)?.dashboard_type === "workflow_dashboard" &&
					isRejected && (
						<View style={styles.rejectedScreenContainer}>
							<Image
								source={language === "hindi" ? Images.LOAN_REJECTED_SCREEN_HINDI : Images.LOAN_REJECTED_SCREEN}
								style={styles.rejectedScreenImage}
								resizeMode="contain"
							/>
						</View>
					)}

				{/* Continue Journey Card - Show only for workflow_dashboard and NOT rejected */}
				{!isPending &&
					data &&
					(data as any)?.dashboard_type === "workflow_dashboard" &&
					!isRejected && (
						isReapplyScenario ? (
							<View style={styles.reapplyBenefitsCard}>
								<TranslatedText
									style={styles.reapplyBenefitsTitle}
									translationKey="benefitsOfReapplying"
								/>
								
								<View style={styles.reapplyBenefitsList}>
									<View style={styles.reapplyBenefitItem}>
										<Image source={Images.MONEY_ICON} style={styles.reapplyBenefitIcon} />
										<TranslatedText style={styles.reapplyBenefitText} translationKey="unlockHigherLoanLimits" />
									</View>
									<View style={styles.reapplyBenefitItem}>
										<Image source={Images.CARD_LOGO} style={styles.reapplyBenefitIcon} />
										<TranslatedText style={styles.reapplyBenefitText} translationKey="boostYourCreditScore" />
									</View>
									<View style={styles.reapplyBenefitItem}>
										<Image source={Images.THUNDER_ICON} style={styles.reapplyBenefitIcon} />
										<TranslatedText style={styles.reapplyBenefitText} translationKey="getNextLoanFaster" />
									</View>
								</View>

								<TouchableOpacity style={styles.reapplyNowButton} onPress={handleReapply}>
									<View style={{ flexDirection: "row", alignItems: "center", gap: width(2) }}>
										<Text style={styles.reapplyNowButtonText}>
											{t("reapplyNow")}
										</Text>
										<IconSymbol name="arrow.right" size={16} color="#FFF" />
									</View>
								</TouchableOpacity>
							</View>
						) : (
							<ImageBackground
								source={Images.JOURNEY_BG}
								style={styles.journeyBackground}
								imageStyle={styles.journeyBackgroundImage}
							>
								<View style={styles.journeyTracker}>
									{/* Circular Progress Meter */}
									<View style={styles.circularMeterContainer}>
										<CircularProgress
											percentage={
												data?.workflow_progress?.completion_percentage ?? 0
											}
										/>
									</View>

									{/* Progress-based content display */}
									{(() => {
										const progressPercentage = data?.workflow_progress?.completion_percentage ?? 0;
										const overallStatus = data?.workflow_progress?.overall_status;

										// 90-95% range: Show "Ready for disburse" (not clickable)
										if (progressPercentage >= 90 && progressPercentage < 100) {
											return (
												<View style={styles.journeyTextContainer}>
													<TranslatedText
														style={styles.completedLoanText}
														translationKey="readyForDisburse"
													/>
												</View>
											);
										}

										// 100%: Show "Your loan is closed" with Re-apply button
										if (progressPercentage === 100) {
											return (
												<View style={styles.journeyTextContainer}>
													<TranslatedText
														style={styles.completedLoanText}
														translationKey="yourLoanIsClosed"
													/>
													<View style={{ alignItems: "center" }}>
														<TranslatedText
															style={styles.clickHereText}
															translationKey="clickHere"
														/>
														<TouchableOpacity
															onPress={async () => {
																try {
																	// Call the can-reapply API
																	const reapplyData = await checkCanReapply();

																	if (reapplyData.can_apply) {
																		// ── Analytics: User Segmentation ──
																		setUserType("repeat_user").catch(() => { });
																		// ───────────────────────────────────

																		const startingStep = reapplyData.starting_step;
																		const href = StepHref[startingStep as keyof typeof StepHref];

																		if (href) {
																			console.log("Re-applying from step:", startingStep, "->", href);
																			router.push({
																				pathname: href as any,
																				params: { fromReapply: "true" },
																			});
																		} else {
																			Toast.show({
																				type: "error",
																				text1: t("error"),
																				text2: "Unable to determine the starting step",
																			});
																		}
																	} else {
																		const message = reapplyData.message?.toLowerCase().includes("overdue")
																			? t("overdueLoanMessage")
																			: reapplyData.message || t("notEligibleToReapply");

																		Toast.show({
																			type: "error",
																			text1: t("cannotReapply"),
																			text2: message,
																		});
																	}
																} catch (error) {
																	console.error("Re-apply error:", error);
																	Toast.show({
																		type: "error",
																		text1: t("error"),
																		text2: t("reApplicationCheckFailed"),
																	});
																}
															}}
															style={styles.reapplyButton}>
															<IconSymbol name="arrow.clockwise" size={18} color={white} />
															<TranslatedText
																translationKey="reApply"
																style={styles.reapplyButtonText}
																numberOfLines={1}
																adjustsFontSizeToFit
																minimumFontScale={0.85}
															/>

														</TouchableOpacity>
													</View>
												</View>
											);
										}

										// Default: Show clickable "Continue Journey" with arrow
										return (
											<TouchableOpacity
												onPress={handleContinueJourney}
												style={styles.journeyTextContainer}>
												<TranslatedText
													style={styles.completedLoanText}
													translationKey="completedYourLoanJourney"
												/>
												<View style={styles.continueButton}>
													<IconSymbol name="chevron.right" size={35} color={white} />
												</View>
											</TouchableOpacity>
										);
									})()}
								</View>
							</ImageBackground>
						)
					)}


				{/* Phase 2 Dashboard Content Sections */}
				<View style={styles.contentSectionsWrapper}>
					{/* A1: Categories Grid */}
					<View style={styles.sectionContainer}>
						<TranslatedText
							style={styles.sectionTitle}
							translationKey="loansForEveryNeeds"
						/>

						<View style={styles.categoriesRow}>
							{loanTypes.map((item, index) => (
								<TouchableOpacity 
									key={index}   
									activeOpacity={0.8}
									style={styles.categoryCard}>
									<View style={styles.categoryIconCircle}>
										<Image
											source={item.image}
											style={styles.categoryIcon}
											resizeMode="contain"
										/>
									</View>
									<Text 
										style={styles.categoryTitle} 
										numberOfLines={1} 
										adjustsFontSizeToFit 
										minimumFontScale={0.8}
										ellipsizeMode="tail">
										{t(item.titleKey)}
									</Text>
								</TouchableOpacity>
							))}
						</View>
					</View>

					{/* A2: Testimonials */}
					<View style={styles.sectionContainer}>
						<View style={styles.sectionHeaderRow}>
							<TranslatedText
								style={styles.sectionTitle}
								translationKey="whatOurUsersSay"
							/>
							<TouchableOpacity activeOpacity={0.7} onPress={() => {}}>
								<Text style={styles.seeAllText}>See All</Text>
							</TouchableOpacity>
						</View>
					</View>
					<TestimonialCarousel testimonials={testimonials} />

					{/* Video Tutorials */}
					<View style={styles.videoSectionContainer}>
						<View style={styles.videoSectionHeaderRow}>
							<Text style={styles.sectionTitle}>How to Apply for a Loan</Text>
							<TouchableOpacity
								activeOpacity={0.7}
								onPress={() => {
									router.push({
										pathname: "/reel-player" as any,
										params: { initialIndex: "0" },
									});
								}}>
								<Text style={styles.seeAllText}>See All</Text>
							</TouchableOpacity>
						</View>

						<ScrollView
							horizontal
							showsHorizontalScrollIndicator={false}
							contentContainerStyle={styles.videoScrollContainer}
							decelerationRate="fast"
							snapToInterval={152}>
							{placeholderVideos.map((video, index) => (
								<TouchableOpacity
									key={video.id}
									activeOpacity={0.85}
									style={styles.videoCard}
									onPress={() => {
										router.push({
											pathname: "/reel-player" as any,
											params: { initialIndex: index.toString() },
										});
									}}>
									<ImageBackground
										source={video.thumbnail}
										style={styles.videoThumbnail}
										imageStyle={styles.videoThumbnailImage}
										resizeMode="cover">
										<LinearGradient
											colors={["transparent", "rgba(0, 0, 0, 0.15)", "rgba(0, 0, 0, 0.85)"]}
											locations={[0.45, 0.7, 1]}
											style={StyleSheet.absoluteFill}
										/>
										<View style={styles.videoDurationBadge}>
											<Text style={styles.videoDurationText}>{video.duration}</Text>
										</View>
										<View style={styles.videoPlayButton}>
											<MaterialCommunityIcons
												name="play-outline"
												size={22}
												color="#000000"
												style={styles.videoPlayIcon}
											/>
										</View>
										<Text style={styles.videoTitle} numberOfLines={2}>
											{video.title}
										</Text>
									</ImageBackground>
								</TouchableOpacity>
							))}
						</ScrollView>
					</View>

					{/* A3: Questions & Answers */}
					<View style={styles.sectionContainer}>
						<View style={styles.sectionHeaderRow}>
							<TranslatedText
								style={styles.sectionTitle}
								translationKey="questionsAndAnswers"
							/>
							<TouchableOpacity
								activeOpacity={0.7}
								onPress={() => router.push("/help-support" as any)}>
								<Text style={styles.seeAllText}>See All</Text>
							</TouchableOpacity>
						</View>
						<FAQ data={faqData} onViewAll={() => router.push("/help-support" as any)} />
					</View>

					{/* B2: Brand Banner */}
					<LinearGradient
						colors={["#F5F7F2", "#E8F8D5", "#D0F1AB", "#B8E986"]}
						locations={[0, 0.22, 0.58, 1]}
						start={{ x: 0.5, y: 0 }}
						end={{ x: 0.5, y: 1 }}
						style={styles.brandBanner}>
						<Text style={styles.brandTagline}>
							Loan Chahiye, <Text style={styles.brandTaglineGreen}>Rapid</Text>Money{"\n"}Hai Na!
						</Text>
						<Text style={styles.brandSubtext}>
							Get instant personal loans with minimum effort and maximum trust.
						</Text>
						<View style={styles.trustBadgePill}>
							<Text style={styles.trustBadgeText}>
								Made with <Text style={styles.trustBadgeHeart}>♥</Text> in India
							</Text>
						</View>
					</LinearGradient>
				</View>
			</ScrollView>

			{/* Drawer Overlay */}
			{isDrawerOpen && (
				<TouchableOpacity
					style={styles.drawerOverlay}
					onPress={closeDrawer}
					activeOpacity={1}
				/>
			)}

			{/* Side Drawer */}
			<Animated.View
				style={[
					styles.drawer,
					{
						transform: [{ translateX: slideAnimation }],
					},
				]}>
				<View style={styles.drawerContent}>
					<View style={styles.drawerHeader}>
						<TranslatedText style={styles.drawerTitle} translationKey="menu" />
						<TouchableOpacity onPress={closeDrawer}>
							<Text style={styles.closeButton}>✕</Text>
						</TouchableOpacity>
					</View>

					<ScrollView style={styles.drawerBody} showsVerticalScrollIndicator={false}>
						<TouchableOpacity style={styles.drawerItem} onPress={handleSettingsClick}>
							<View style={styles.drawerItemContent}>
								<IconSymbol name="settings" size={20} color={dark} />
								<TranslatedText
									style={[styles.drawerItemText, { marginLeft: width(3) }]}
									translationKey="settings"
								/>
								<IconSymbol
									name="chevron.right"
									size={16}
									color={dark}
									style={{ marginLeft: "auto", transform: [{ rotate: showSettings ? "90deg" : "0deg" }] }}
								/>
							</View>
						</TouchableOpacity>

						{showSettings && !hasActiveLoans() && (
							<TouchableOpacity style={[styles.drawerItem, styles.settingsSubItem]} onPress={handleDeleteAccount}>
								<View style={styles.drawerItemContent}>
									<IconSymbol name="trash" size={20} color="#FF0000" />
									<TranslatedText
										style={[styles.drawerItemText, { color: "#FF0000", marginLeft: width(3) }]}
										translationKey="deleteAccount"
									/>
								</View>
							</TouchableOpacity>
						)}

						{/* Push Notification Debugger - Shows in all builds for debugging */}
						{__DEV__ && (
							<View style={{ marginTop: 10 }}>
								<PushNotificationDebugger />
							</View>
						)}
					</ScrollView>

					<View style={styles.drawerFooter}>
						<TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
							<IconSymbol name="logout" size={20} color="#FF0000" />
							<TranslatedText
								style={styles.logoutButtonText}
								translationKey="logout"
							/>
						</TouchableOpacity>
					</View>
				</View>
			</Animated.View>

			{/* Loan Terms Modal */}
			<Modal
				visible={showLoanTermsModal}
				transparent={true}
				animationType="none"
				onRequestClose={hideLoanTermsModal}>
				<Animated.View
					style={[
						styles.modalOverlay,
						{
							opacity: loanTermsBackgroundOpacity,
						},
					]}>
					<Pressable style={styles.modalOverlayPressable} onPress={hideLoanTermsModal}>
						<Animated.View
							style={[
								styles.modalContainer,
								{
									transform: [{ translateY: loanTermsSlideAnim }],
								},
							]}>
							<View style={styles.loanTermsModalContent}>
								{/* Modal Handle */}
								<View style={styles.modalHandle} />

								{/* Title */}
								<TranslatedText
									style={styles.loanTermsModalTitle}
									translationKey="loanTermsModal"
								/>

								{/* Content */}
								<View style={styles.loanTermsContentContainer}>
									{loanType === "term" ? (
										<TranslatedText
											style={styles.loanTermsText}
											translationKey="loanTermsContent"
										/>
									) : (
										<TranslatedText
											style={styles.loanTermsText}
											translationKey="shortTermLoanTermsContent"
										/>
									)}
								</View>

								{/* Close Button */}
								<TouchableOpacity
									style={styles.closeButtonModal}
									onPress={hideLoanTermsModal}>
									<TranslatedText
										style={styles.closeButtonText}
										translationKey="close"
									/>
								</TouchableOpacity>
							</View>
						</Animated.View>
					</Pressable>
				</Animated.View>
			</Modal>
			{/* Payment Success Modal */}
			<Modal visible={modalVisible} transparent={true} animationType="none" statusBarTranslucent={true}>
				<View style={styles.paymentSuccessModalOverlay}>
					<View style={styles.paymentSuccessModalContent}>
						<Animated.Image
							source={Images.SUCCESS_ICON}
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

			{/* Lead status / Payment status check loader */}
			<FiveSecDelay 
				visible={delayVisible} 
				isPolling={isVerifyLeadFlow || isPaymentPolling} 
				pollingTextKey={delayStageKey}
				onComplete={() => setDelayVisible(false)} 
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	heroBrand: {
		paddingBottom: 28,
		width: "100%",
	},
	navHeader: {
		height: 60,
		paddingHorizontal: 16,
		paddingVertical: 12,
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
	},
	menuButton: {
		width: 24,
		height: 24,
		justifyContent: "center",
		alignItems: "center",
	},
	navLogo: {
		width: 177,
		height: 30,
	},
	notificationBtn: {
		width: 36,
		height: 36,
		borderRadius: 18,
		backgroundColor: "rgba(255, 255, 255, 0.102)",
		justifyContent: "center",
		alignItems: "center",
	},
	notificationDot: {
		position: "absolute",
		top: 4,
		right: 4,
		width: 8,
		height: 8,
		borderRadius: 4,
		backgroundColor: "#FF4D4F",
	},
	greetingBlock: {
		paddingHorizontal: 16,
		paddingVertical: 12,
		gap: 4,
	},
	userName: {
		fontSize: 22,
		fontWeight: "700",
		lineHeight: 27,
		color: "#FFFFFF",
		fontFamily: Platform.select({ ios: "System", android: "sans-serif" }),
	},
	subAction: {
		fontSize: 13,
		fontWeight: "500",
		lineHeight: 16,
		letterSpacing: 0.2,
		color: "#8FD62A",
		fontFamily: Platform.select({ ios: "System", android: "sans-serif" }),
	},
	preQualContainer: {
		paddingHorizontal: 16,
		marginTop: 4,
	},
	cardShell: {
		padding: 20,
		gap: 16,
		borderWidth: 1,
		borderColor: "#5FA800",
		borderRadius: 20,
		position: "relative",
		overflow: "hidden",
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 12 },
		shadowOpacity: 0.314,
		shadowRadius: 28,
		elevation: 8,
	},
	cardGlow: {
		position: "absolute",
		width: 160,
		height: 160,
		right: -20,
		top: -20,
		borderRadius: 80,
		backgroundColor: "rgba(118, 200, 0, 0.149)",
	},
	cardTop: {
		alignItems: "center",
		gap: 6,
	},
	preQualTitle: {
		fontSize: 10,
		fontWeight: "700",
		lineHeight: 12,
		textTransform: "uppercase",
		letterSpacing: 0.5,
		color: "#8FD62A",
		fontFamily: Platform.select({ ios: "System", android: "sans-serif" }),
	},
	preQualAmountText: {
		fontSize: 34,
		fontWeight: "800",
		lineHeight: 41,
		color: "#FFFFFF",
		fontFamily: Platform.select({ ios: "System", android: "sans-serif" }),
	},
	ctaBtnWrapper: {
		borderRadius: 14,
		shadowColor: "rgba(118, 200, 0, 0.5)",
		shadowOffset: { width: 0, height: 6 },
		shadowOpacity: 0.333,
		shadowRadius: 16,
		elevation: 4,
	},
	ctaBtn: {
		height: 50,
		borderRadius: 14,
		flexDirection: "row",
		justifyContent: "center",
		alignItems: "center",
		gap: 8,
	},
	ctaText: {
		fontSize: 15,
		fontWeight: "800",
		lineHeight: 18,
		color: "#F4FAEE",
		fontFamily: Platform.select({ ios: "System", android: "sans-serif" }),
	},
	metricBadges: {
		flexDirection: "row",
		alignItems: "flex-start",
		gap: 12,
	},
	badgeItem: {
		flex: 1,
		alignItems: "center",
		gap: 8,
	},
	badgeIconContainer: {
		width: 40,
		height: 40,
		borderRadius: 20,
		backgroundColor: "rgba(255, 255, 255, 0.082)",
		borderWidth: 1,
		borderColor: "rgba(118, 200, 0, 0.188)",
		justifyContent: "center",
		alignItems: "center",
	},
	badgeText: {
		fontSize: 10,
		fontWeight: "500",
		lineHeight: 12,
		textAlign: "center",
		color: "#C8E8A0",
		fontFamily: Platform.select({ ios: "System", android: "sans-serif" }),
	},
	loanDashboardCardWrapper: {
		paddingHorizontal: 16,
		marginTop: 8,
	},
	amountCard: {
		marginHorizontal: width(4),
		marginTop: -height(6),
		borderRadius: width(5),
		padding: width(5),
		paddingBottom: height(3),
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.1,
		shadowRadius: 8,
		elevation: 4,
		position: "relative",
		overflow: "hidden",
	},
	lightWaves: {
		position: "absolute",
		width: width(40),
		height: height(20),
		right: width(2),
		top: height(2),
		opacity: 0.6,
		zIndex: 10,
	},
	blueBgWaves: {
		position: "absolute",
		width: width(100),
		height: height(30),
		right: -width(20),
		top: -height(10),
		opacity: 0.6,
		zIndex: 10,
	},
	referFriendImage: {
		position: "absolute",
		right: -width(23),
		bottom: 0,
		zIndex: 20,
		width: width(100),
		height: height(27),
	},
	loanChaheyeFooter: {
		width: width(100),
		height: height(30),
		backgroundColor: "transparent",
		marginBottom: -height(4),
	},
	cardLabel: {
		fontSize: font(1.7),
		fontWeight: "600",
		color: dark,
		opacity: 0.7,
		// marginBottom: height(0.5),
	},
	amount: {
		fontSize: font(4),
		color: dark,
		fontWeight: "bold",
		marginBottom: height(1),
	},
	cardRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		marginBottom: height(1.5),
	},
	cardSubLabel: {
		fontSize: font(1.7),
		color: dark,
		opacity: 0.7,
	},
	cardSubValue: {
		fontSize: font(2),
		color: dark,
		fontWeight: "bold",
	},
	payButton: {
		backgroundColor: white,
		borderRadius: width(3),
		paddingVertical: height(1.5),
		alignItems: "center",
		marginTop: height(2),
		zIndex: 20,
	},
	payButtonText: {
		color: dark,
		fontSize: font(2),
		fontWeight: "600",
	},
	sectionContainer: {
		marginTop: 24,
		paddingHorizontal: 16,
	},
	sectionTitle: {
		fontSize: 20,
		fontWeight: "800",
		color: "#14201A",
		fontFamily: Platform.select({ ios: "System", android: "sans-serif" }),
	},
	sectionHeaderRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		marginBottom: 16,
	},
	seeAllText: {
		fontSize: 14,
		fontWeight: "700",
		color: "#5FA800",
		fontFamily: Platform.select({ ios: "System", android: "sans-serif" }),
	},
	featuresText: {
		fontSize: font(1.7),
		color: dark_primary,
		fontWeight: "500",
		textDecorationLine: "underline",
		paddingVertical: height(0.6),
	},
	loanCard: {
		backgroundColor: "#F6F7FF",
		borderRadius: width(4),
		padding: 0,
		paddingTop: width(4),
		paddingHorizontal: width(4),
		position: "relative",
		overflow: "hidden",
	},
	loanTitle: {
		fontSize: font(2.1),
		color: dark,
		fontWeight: "bold",
	},
	dashedLine: {
		borderBottomWidth: 1,
		borderBottomColor: "#E0E0E0",
		borderStyle: "dashed",
		marginBottom: height(1.5),
	},
	loanContentContainer: {
		position: "relative",
		minHeight: height(20),
	},
	loanDetailsContainer: {
		position: "absolute",
		top: 0,
		left: 0,
		zIndex: 2,
		backgroundColor: "rgba(246, 247, 255, 0.9)",
		paddingRight: width(2),
		paddingBottom: height(1),
	},
	loanAmount: {
		fontSize: font(3.0),
		color: dark,
		fontWeight: "bold",
	},
	loanLabel: {
		fontSize: font(1.5),
		color: dark,
		opacity: 0.7,
	},
	loanTenure: {
		fontSize: font(2),
		color: dark,
		fontWeight: "bold",
		marginTop: height(1),
	},
	loanTagsRow: {
		flexDirection: "row",
		marginTop: height(1),
	},
	speedTag: {
		backgroundColor: "#E6F0FF",
		borderRadius: width(4),
		paddingHorizontal: width(2.5),
		paddingVertical: height(0.5),
		marginRight: width(1.5),
	},
	speedTagText: {
		fontSize: font(1.2),
		color: "#4A90E2",
		fontWeight: "bold",
	},
	cheapTag: {
		backgroundColor: "#D6F5D6",
		borderRadius: width(4),
		paddingHorizontal: width(2.5),
		paddingVertical: height(0.5),
	},
	cheapTagText: {
		fontSize: font(1.2),
		color: "#4CAF50",
		fontWeight: "bold",
	},
	loanMascot: {
		position: "absolute",
		bottom: 0,
		right: -width(10),
		width: width(100),
		height: height(25),
		zIndex: 1,
	},
	coinStack: {
		position: "absolute",
		bottom: 0,
		left: width(23),
		width: width(100),
		height: height(15),
		zIndex: 1,
	},
	floatingCoin: {
		position: "absolute",
		top: height(2),
		right: width(40),
		width: width(12),
		height: height(12),
		zIndex: 3,
	},
	referFriendSection: {
		minHeight: height(30),
		flexDirection: "column-reverse",
		justifyContent: "flex-start",
		position: "relative",
		// marginTop: height(5),
	},
	referFriendContent: {
		minHeight: height(22),
		maxHeight: height(22),
		backgroundColor: "#4D43FE",
		position: "relative",
	},
	referTextContainer: {
		zIndex: 15,
		paddingHorizontal: width(4),
		paddingTop: height(1),
	},
	referEarnText: {
		fontSize: font(2.2),
		color: white,
		fontWeight: "bold",
	},
	referSecondText: {
		fontSize: font(2.2),
		color: white,
		fontWeight: "bold",
		marginBottom: height(1),
	},
	referSubText: {
		fontSize: font(2),
		color: white,
		opacity: 0.9,
	},
	referButton: {
		backgroundColor: primary,
		borderRadius: width(6),
		paddingHorizontal: width(4),
		paddingVertical: height(1),
		marginTop: height(1.5),
		alignSelf: "flex-start",
	},
	referButtonText: {
		color: dark,
		fontSize: font(2),
		fontWeight: "bold",
	},
	drawerOverlay: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		backgroundColor: "rgba(0,0,0,0.5)",
		zIndex: 10,
	},
	drawer: {
		position: "absolute",
		top: 0,
		left: 0,
		width: screenWidth * 0.8, // Adjust as needed
		height: "100%",
		backgroundColor: white,
		zIndex: 15,
		borderTopRightRadius: width(8),
		borderBottomRightRadius: width(8),
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.2,
		shadowRadius: 4,
		elevation: 5,
	},
	drawerHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingHorizontal: width(4),
		paddingTop: height(4),
		paddingBottom: height(2),
		borderBottomWidth: 1,
		borderBottomColor: "#E0E0E0",
	},
	drawerTitle: {
		fontSize: font(2.5),
		color: dark,
		fontWeight: "bold",
	},
	closeButton: {
		fontSize: font(3),
		color: dark,
	},
	drawerBody: {
		flex: 1,
		paddingHorizontal: width(4),
		paddingTop: height(2),
	},
	drawerItem: {
		paddingVertical: height(1.5),
		// borderBottomWidth: 1,
		// borderBottomColor: "#E0E0E0",
	},
	drawerItemContent: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: width(4),
	},
	drawerItemText: {
		fontSize: font(2),
		color: dark,
		fontWeight: "bold",
	},
	settingsSubItem: {
		backgroundColor: "#F5F5F5",
		marginLeft: width(4),
		borderRadius: width(1),
	},
	drawerContent: {
		flex: 1,
	},
	drawerFooter: {
		paddingHorizontal: width(4),
		paddingBottom: Platform.OS === "ios" ? height(10) : height(2),
		borderTopWidth: 1,
		borderTopColor: "#E0E0E0",
	},
	logoutButton: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		paddingVertical: height(1.2),
		gap: width(2),
	},
	logoutButtonText: {
		color: "#FF0000",
		fontSize: font(2),
		fontWeight: "bold",
	},
	// Journey Tracker Styles
	journeyTracker: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: width(4),
		gap: width(4),
	},
	circularMeterContainer: {
		alignItems: "center",
		justifyContent: "center",
		minWidth: width(15),
		minHeight: width(15),
	},
	journeyTextContainer: {
		flex: 1,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		height: height(10),
	},
	rejectionContainer: {
		flex: 1,
		flexDirection: "column",
		alignItems: "flex-start",
		justifyContent: "center",
		width: "100%",
	},
	continueJourneyText: {
		fontSize: font(2.1),
		color: dark,
		fontWeight: "600",
		flex: 1,
		textAlign: "left",
	},
	completedLoanText: {
		fontSize: font(2.1),
		color: "#fff",
		fontWeight: "600",
		flex: 1,
		textAlign: "left",
	},
	rejectionSubtext: {
		fontSize: font(1.8),
		color: "#666",
		fontWeight: "400",
		marginTop: height(1),
		textAlign: "left",
		width: "100%",
	},
	continueButton: {
		width: width(8),
		height: width(8),
		borderRadius: width(4),
		// backgroundColor: primary,
		alignItems: "center",
		justifyContent: "center",
	},
	reapplyButton: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: "darkgreen",
		paddingHorizontal: width(2),
		paddingVertical: height(1.2),
		borderRadius: 50,
		gap: width(3),
		marginTop: height(1),
	},

	reapplyButtonText: {
		color: white,
		fontSize: font(1.5),
		fontWeight: "600",
		flexShrink: 1,          // ✅ KEY FIX
		textAlign: "center",
	},

	// Loan Terms Modal Styles
	modalOverlay: {
		flex: 1,
		backgroundColor: "rgba(0, 0, 0, 0.5)",
		justifyContent: "flex-end",
	},
	modalOverlayPressable: {
		flex: 1,
		justifyContent: "flex-end",
	},
	modalContainer: {
		width: "100%",
		justifyContent: "flex-end",
	},
	loanTermsModalContent: {
		backgroundColor: white,
		borderTopLeftRadius: width(5),
		borderTopRightRadius: width(5),
		paddingHorizontal: width(6),
		paddingBottom: height(3),
		shadowColor: "#000",
		shadowOffset: {
			width: 0,
			height: -2,
		},
		shadowOpacity: 0.25,
		shadowRadius: 4,
		elevation: 5,
	},
	modalHandle: {
		width: width(10),
		height: height(0.4),
		backgroundColor: "#E0E0E0",
		borderRadius: width(1),
		alignSelf: "center",
		marginTop: height(1),
		marginBottom: height(2),
	},
	loanTermsModalTitle: {
		fontSize: font(2.4),
		fontWeight: "bold",
		color: dark,
		textAlign: "center",
		marginBottom: height(1.5),
	},
	loanTermsContentContainer: {
		paddingVertical: height(1.5),
		marginBottom: height(1.5),
	},
	loanTermsText: {
		fontSize: font(1.7),
		color: dark,
		lineHeight: font(2.6),
		textAlign: "left",
	},
	closeButtonModal: {
		backgroundColor: primary,
		borderRadius: width(6),
		paddingVertical: height(1.5),
		alignItems: "center",
		marginTop: height(1),
	},
	closeButtonText: {
		fontSize: font(1.8),
		fontWeight: "600",
		color: dark,
	},
	clickHereText: {
		fontSize: font(1.8),
		color: dark,
	},
	// New Amount Card Styles
	// newAmountCard: {
	// 	marginHorizontal: width(4),
	// 	marginTop: -height(6),
	// 	borderRadius: width(6),
	// 	shadowColor: "#000",
	// 	shadowOffset: { width: 0, height: 4 },
	// 	shadowOpacity: 0.1,
	// 	shadowRadius: 10,
	// 	elevation: 6,
	// 	overflow: "hidden",
	// },

	newAmountCard: {
		marginHorizontal: width(4),
		marginTop: -height(6),
		borderRadius: width(6),
		overflow: "hidden",
		position: "relative", // Important
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.1,
		shadowRadius: 10,
		elevation: 6,
	},

	greenGlow: {
		position: "absolute",
		width: width(90),
		height: width(90),
		borderRadius: width(45),

		backgroundColor: "#7ED321",
		opacity: 0.22,

		bottom: -width(45),
		alignSelf: "center",
	},


	newCardContent: {
		padding: width(6),
		alignItems: "center",
	},
	newCardLabel: {
		fontSize: font(1.8),
		color: "#fff",
		opacity: 0.8,
		marginBottom: height(0.5),
	},
	newAmount: {
		fontSize: font(4.2),
		fontWeight: "bold",
		color: "#fff",
		marginBottom: height(1.5),
	},
	dueDateBadgeContainer: {
		marginBottom: height(2.5),
	},
	dueDateBadgeNew: {
		backgroundColor: "#FFEBEE",
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: width(3),
		paddingVertical: height(0.6),
		borderRadius: width(2),
		gap: width(2),
	},
	dueDateTextNew: {
		color: "#E84D4D",
		fontSize: font(1.6),
		fontWeight: "600",
	},
	newPayNowButton: {
		backgroundColor: "#79CA00",
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		width: "100%",
		paddingVertical: height(1.8),
		borderRadius: width(5),
		gap: width(2),
		marginBottom: height(3.5),
	},
	newPayNowButtonText: {
		color: white,
		fontSize: font(2.1),
		fontWeight: "bold",
	},
	newBenefitsSection: {
		width: "100%",
	},
	newBenefitsTitle: {
		fontSize: font(1.9),
		fontWeight: "bold",
		color: "#fff",
		textAlign: "center",
		marginBottom: height(1.5),
	},
	newBenefitItem: {
		flexDirection: "row",
		alignItems: "center",
		marginBottom: height(1),
		gap: width(2.5),
	},
	newBenefitText: {
		fontSize: font(1.7),
		color: "#fff",
		fontWeight: "500",
	},
	// Carousel Styles
	carouselContainer: {
		marginTop: height(2),
		height: height(32),
		marginHorizontal: width(4),
		backgroundColor: "#1A1A1A",
		borderRadius: width(4),
		overflow: "hidden",
		position: "relative",
	},
	carouselSlide: {
		flex: 1,
		alignItems: "center",
		paddingTop: height(3),
		paddingHorizontal: width(5),
	},
	carouselBg: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		opacity: 0.1,
	},

	carouselTitle: {
		fontSize: font(2.1),
		fontWeight: "bold",
		textAlign: "center",
		marginBottom: height(3),
	},
	carouselIconWrapper: {
		width: width(24),
		height: width(24),
		borderRadius: width(12),
		backgroundColor: "rgba(255,255,255,0.05)",
		alignItems: "center",
		justifyContent: "center",
		marginBottom: height(3),
	},
	carouselSubtitle: {
		fontSize: font(1.9),
		color: white,
		fontWeight: "500",
		textAlign: "center",
	},
	carouselDots: {
		flexDirection: "row",
		justifyContent: "center",
		alignItems: "center",
		gap: width(2),
		paddingBottom: height(2),
	},
	carouselDot: {
		width: width(1.5),
		height: width(1.5),
		borderRadius: width(0.75),
		backgroundColor: "rgba(255,255,255,0.3)",
	},
	paymentSuccessModalOverlay: {
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
	paymentSuccessModalContent: {
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
	journeyBackground: {
		marginHorizontal: width(4),
		marginTop: height(2),
		height: height(12), // adjust as per your design
		justifyContent: "center",
		overflow: "hidden",
	},
	completeApplicationContainer: {
		marginHorizontal: width(4),
		marginTop: -height(6),
	},
	completeApplicationFrame: {
		width: "100%",
		aspectRatio: 1.24,
		overflow: "hidden",
		borderRadius: width(6),
	},
	completeApplicationFrameImage: {
		resizeMode: "cover",
	},
	completeApplicationContent: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		transform: [{ translateY: -height(4) }],
	},
	preQualifiedAmount: {
		color: white,
		fontSize: font(5.5),
		fontWeight: "700",
		marginBottom: height(1.5),
	},
	completeApplicationButton: {
		alignItems: "center",
		backgroundColor: "#79CA00",
		borderRadius: width(6),
		justifyContent: "center",
		minWidth: width(48),
		paddingHorizontal: width(15),
		paddingVertical: height(2),
	},
	completeApplicationButtonText: {
		color: "#fff",
		fontSize: font(2.2),
		fontWeight: "700",
	},
	completeApplicationTitle: {
		color: dark,
		fontSize: font(2.1),
		fontWeight: "600",
		marginTop: height(1.5),
		textAlign: "center",
	},
	contentSectionsWrapper: {
		backgroundColor: "#F5F7F2",
		paddingTop: 8,
		paddingBottom: 0,
	},
	categoriesRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "flex-start",
		marginTop: 16,
	},
	categoryCard: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		paddingVertical: 6,
		paddingHorizontal: 2,
	},
	categoryIconCircle: {
		width: 58,
		height: 58,
		backgroundColor: "#FFFFFF",
		borderWidth: 1,
		borderColor: "#C5D0C2",
		borderRadius: 29,
		alignItems: "center",
		justifyContent: "center",
		marginBottom: 8,
	},
	categoryIcon: {
		width: 28,
		height: 28,
	},
	categoryTitle: {
		fontSize: 12,
		fontWeight: "600",
		color: "#14201A",
		textAlign: "center",
		fontFamily: Platform.select({ ios: "System", android: "sans-serif" }),
	},
	videoSectionContainer: {
		marginTop: 24,
		marginBottom: 8,
	},
	videoSectionHeaderRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingHorizontal: 16,
		marginBottom: 14,
	},
	videoScrollContainer: {
		paddingHorizontal: 16,
		paddingVertical: 4,
		gap: 12,
	},
	videoCard: {
		width: 140,
		height: 220,
		borderRadius: 20,
		overflow: "hidden",
		backgroundColor: "#0D2753",
	},
	videoThumbnail: {
		width: "100%",
		height: "100%",
		justifyContent: "center",
		alignItems: "center",
		position: "relative",
	},
	videoThumbnailImage: {
		borderRadius: 20,
	},
	videoDurationBadge: {
		position: "absolute",
		top: 10,
		right: 10,
		backgroundColor: "rgba(20, 25, 20, 0.72)",
		borderRadius: 12,
		paddingHorizontal: 8,
		paddingVertical: 3,
		justifyContent: "center",
		alignItems: "center",
	},
	videoDurationText: {
		color: "#FFFFFF",
		fontSize: 11,
		fontWeight: "600",
		fontFamily: Platform.select({ ios: "System", android: "sans-serif" }),
	},
	videoPlayButton: {
		width: 38,
		height: 38,
		borderRadius: 19,
		backgroundColor: "rgba(240, 240, 240, 0.78)",
		justifyContent: "center",
		alignItems: "center",
	},
	videoPlayIcon: {
		marginLeft: 2,
	},
	videoTitle: {
		position: "absolute",
		bottom: 12,
		left: 12,
		right: 12,
		fontSize: 13,
		fontWeight: "700",
		color: "#FFFFFF",
		lineHeight: 17,
		fontFamily: Platform.select({ ios: "System", android: "sans-serif" }),
	},
	brandBanner: {
		width: "100%",
		paddingTop: 40,
		paddingBottom: 64,
		paddingHorizontal: 20,
		alignItems: "center",
		justifyContent: "center",
		marginTop: 28,
	},
	brandTagline: {
		fontSize: 28,
		fontWeight: "800",
		color: "#14201A",
		textAlign: "center",
		lineHeight: 36,
		letterSpacing: -0.5,
		fontFamily: Platform.select({ ios: "System", android: "sans-serif" }),
	},
	brandTaglineGreen: {
		color: "#5FA800",
		fontWeight: "800",
	},
	brandSubtext: {
		fontSize: 14,
		color: "#3D5A45",
		textAlign: "center",
		marginTop: 10,
		marginBottom: 18,
		lineHeight: 21,
		maxWidth: 320,
		fontFamily: Platform.select({ ios: "System", android: "sans-serif" }),
	},
	trustBadgePill: {
		backgroundColor: "#FFFFFF",
		borderWidth: 1,
		borderColor: "#C5E4A8",
		borderRadius: 24,
		paddingHorizontal: 20,
		paddingVertical: 8,
		alignItems: "center",
		justifyContent: "center",
		shadowColor: "#1B3B18",
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.08,
		shadowRadius: 5,
		elevation: 2,
	},
	trustBadgeText: {
		fontSize: 13.5,
		fontWeight: "700",
		color: "#1B3B18",
		fontFamily: Platform.select({ ios: "System", android: "sans-serif" }),
	},
	trustBadgeHeart: {
		color: "#1B3B18",
		fontSize: 13.5,
	},
	journeyBackgroundImage: {
		borderRadius: width(5),
		resizeMode: "cover",
	},
	rejectedScreenContainer: {
		marginHorizontal: width(4),
	},
	rejectedScreenImage: {
		width: "100%",
		height: height(30),
		borderRadius: width(5),
	},
	loanSummaryContainer: {
		paddingHorizontal: width(5),
		paddingVertical: height(2),
		backgroundColor: "#79CA001A",
		borderRadius: width(5),
		marginVertical: height(2),
		marginHorizontal: width(4),
		alignItems: "center",

	},
	benefitIcon: { width: width(5), height: height(3) },
	benefitItem: { flexDirection: "row", alignItems: "center", marginTop: height(1) },
	benefitText: { color: "#000", fontWeight: "500", fontSize: 14, marginLeft: width(2) },
	payNowButtonBenefits: {
		flexDirection: "row",
		// justifyContent: 'space-between',
		paddingVertical: 10,
		paddingHorizontal: 40,
		backgroundColor: "#79CA00",
		borderRadius: width(5),
		alignItems: 'center',
		marginTop: 10,
		elevation: 3,
	},
	reapplyPromoRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		width: "100%",
		marginTop: height(1.5),
		paddingHorizontal: width(2),
	},
	reapplyPromoCol: {
		flex: 1,
		alignItems: "center",
		gap: height(0.5),
	},
	reapplyPromoText: {
		color: "#FFF",
		fontSize: font(1.0),
		textAlign: "center",
		opacity: 0.9,
	},
	reapplyBenefitsCard: {
		backgroundColor: "#F1F8E9",
		borderRadius: width(6),
		padding: width(5),
		marginHorizontal: width(4),
		marginTop: height(2),
		alignItems: "center",
		elevation: 2,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.1,
		shadowRadius: 4,
	},
	reapplyBenefitsTitle: {
		fontSize: font(2.2),
		fontWeight: "700",
		color: "#1B5E20",
		marginBottom: height(2),
	},
	reapplyBenefitsList: {
		alignSelf: "center",
		alignItems: "flex-start",
		width: "80%",
		gap: height(1.5),
		marginBottom: height(2.5),
	},
	reapplyBenefitItem: {
		flexDirection: "row",
		alignItems: "center",
		gap: width(3),
	},
	reapplyBenefitIcon: {
		width: width(6),
		height: width(6),
		resizeMode: "contain",
	},
	reapplyBenefitText: {
		fontSize: font(1.6),
		fontWeight: "600",
		color: "#37474F",
	},
	reapplyNowButton: {
		backgroundColor: "#79CA00",
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		paddingVertical: height(1.5),
		paddingHorizontal: width(12),
		borderRadius: width(6),
		gap: width(2),
		elevation: 2,
	},
	reapplyNowButtonText: {
		color: "#FFF",
		fontSize: font(1.8),
		fontWeight: "700",
	},
	benefitsListWrapper: {
		alignSelf: "center",
		alignItems: "flex-start",
		width: "80%",
		marginVertical: height(1),
	}

});

export { RouteErrorBoundary as ErrorBoundary } from "@/components/ErrorBoundary";
