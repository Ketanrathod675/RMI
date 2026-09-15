import DevPaymentSimulator from "@/components/assessment-fee/DevPaymentSimulator";
import ExitIntentModal from "@/components/assessment-fee/ExitIntentModal";
import OfferLendersSection, {
	type LenderOffer,
} from "@/components/assessment-fee/OfferLendersSection";
import PaymentSuccessModal from "@/components/assessment-fee/PaymentSuccessModal";
import FiveSecDelay from "@/components/FiveSecDelay";
import RejectionModal from "@/components/RejectionModal";
import { IconSymbol } from "@/components/ui/IconSymbol";
import { dark, white } from "@/constants/Colors";
import { Images } from "@/constants/images";
import { useAssessmentFeePayment } from "@/hooks/useAssessmentFeePayment";
import { useJourneyTracker } from "@/hooks/useJourneyTracker";
import { useNetworkAwareQuery } from "@/hooks/useNetworkAwareQuery";
import { useTranslation } from "@/hooks/useTranslation";
import {
	axios,
	getMyDetails,
	getUserProfile,
	initialApproval,
	verifyEmail,
	verifyLeadCreation,
	verifyPan,
} from "@/utils/api";
import { font, height, width } from "@/utils/dimensions";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
	ActivityIndicator,
	Animated,
	BackHandler,
	ScrollView,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

export type LenderOffersResponseType = {
	success: boolean;
	primary_lender: LenderOffer;
	eligible_lenders: LenderOffer[];
	assessment_fee: {
		amount: number;
		original_amount?: number;
		gst: number;
		currency: string;
	};
};

export default function AssessmentFeeScreen() {
	const { t } = useTranslation();
	const router = useRouter();
	const params = useLocalSearchParams();
	const insets = useSafeAreaInsets();
	const navigation = useNavigation();

	// Track this screen in journey
	useJourneyTracker("/new-assessment-fee");

	const [offerTimer, setOfferTimer] = useState(299); // 4:59 = 299 seconds
	const [isExitModalVisible, setIsExitModalVisible] = useState(false);
	const [isSuccessModalVisible, setIsSuccessModalVisible] = useState(false);
	const [isVerifyLeadFlow, setIsVerifyLeadFlow] = useState(false);
	const [delayStageKey, setDelayStageKey] = useState<string>("verifyingPaymentWait");
	const [rejectionModalVisible, setRejectionModalVisible] = useState(false);
	const [rejectionCountdown, setRejectionCountdown] = useState(15);
	const [rejectionMessage, setRejectionMessage] = useState("");

	const leadPollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const shimmerAnim = useRef(new Animated.Value(0)).current;

	// Offer countdown timer effect
	useEffect(() => {
		const interval = setInterval(() => {
			setOfferTimer((prev) => {
				if (prev <= 1) {
					clearInterval(interval);
					return 0;
				}
				return prev - 1;
			});
		}, 1000);

		return () => clearInterval(interval);
	}, []);

	// Intercept back gesture / hardware back press
	useFocusEffect(
		useCallback(() => {
			const unsubscribe = navigation.addListener("beforeRemove", (e) => {
				if (["GO_BACK", "POP"].includes(e.data.action.type)) {
					e.preventDefault();
					setIsExitModalVisible(true);
				}
			});

			const backHandler = BackHandler.addEventListener("hardwareBackPress", () => {
				setIsExitModalVisible(true);
				return true;
			});

			return () => {
				unsubscribe();
				backHandler.remove();
			};
		}, [navigation]),
	);

	// Fetch eligible lenders and assessment fee
	const {
		data: lenderOffersData,
		isLoading: isLoadingLenderOffers,
		error: lenderOffersError,
	} = useNetworkAwareQuery<LenderOffersResponseType>({
		queryKey: ["lender-offers"],
		queryFn: async () => {
			const response = await axios.get<LenderOffersResponseType>("kyc/lender-offers");
			return response.data;
		},
		retry: 2,
		staleTime: 5 * 1000,
	});

	// Handle lender offer errors / status failures
	useEffect(() => {
		if (lenderOffersData) {
			const hasFailedStatus =
				lenderOffersData.success === false ||
				(lenderOffersData as any).status === false ||
				(lenderOffersData as any).status === "failed" ||
				(lenderOffersData as any).status === "reject";

			if (hasFailedStatus) {
				if (params.fromReapply === "true") {
					router.replace("/no-lenders-available");
					return;
				}

				const apiMessage =
					(lenderOffersData as any).message || (lenderOffersData as any).msg || "";
				let displayMessage = apiMessage;

				if (!apiMessage || apiMessage.toLowerCase().includes("no eligible lender")) {
					displayMessage =
						t("noEligibleLendersFound") !== "noEligibleLendersFound"
							? t("noEligibleLendersFound")
							: "No eligible lenders found";
				}

				Toast.show({
					type: "error",
					text1: displayMessage,
					visibilityTime: 4000,
				});

				setTimeout(() => {
					router.replace("/(tabs)");
				}, 2000);
			}
		}
	}, [lenderOffersData, params.fromReapply, router, t]);

	useEffect(() => {
		if (lenderOffersError) {
			console.error("Lender offers fetch error:", lenderOffersError);

			if (params.fromReapply === "true") {
				router.replace("/no-lenders-available");
				return;
			}

			let displayMessage =
				t("failedToFetchLenderOffers") !== "failedToFetchLenderOffers"
					? t("failedToFetchLenderOffers")
					: "Failed to fetch lender offers";

			const apiErrorData = (lenderOffersError as any)?.response?.data;
			if (apiErrorData) {
				const apiMessage =
					apiErrorData.message || apiErrorData.msg || apiErrorData.detail || "";
				if (apiMessage && typeof apiMessage === "string") {
					displayMessage = apiMessage;
				}
			}

			Toast.show({
				type: "error",
				text1: displayMessage,
				visibilityTime: 4000,
			});

			setTimeout(() => {
				router.replace("/(tabs)");
			}, 2000);
		}
	}, [lenderOffersError, params.fromReapply, router, t]);

	// Fee calculations
	const baseAmount = lenderOffersData?.assessment_fee?.amount ?? 99;
	const gst = lenderOffersData?.assessment_fee?.gst ?? 0;
	const processingFeeAmount = Math.round(baseAmount + (gst * baseAmount) / 100);
	const originalPrice =
		lenderOffersData?.assessment_fee?.original_amount ||
		(processingFeeAmount === 99 ? 249 : Math.round(processingFeeAmount / 0.75));
	const discountPercent = Math.max(
		1,
		Math.round(((originalPrice - processingFeeAmount) / originalPrice) * 100)
	);

	const primaryLender = lenderOffersData?.primary_lender;
	const eligibleLenders = lenderOffersData?.eligible_lenders || [];

	// Post-Payment Email & PAN Verification Flow
	const handleEmailVerificationFlow = async (email?: string) => {
		let detailsResponse = null;
		try {
			detailsResponse = await getMyDetails();
		} catch (e) {
			console.error("Failed to fetch user details", e);
		}

		const isReapp = detailsResponse?.reapplication;
		const isPanVer =
			detailsResponse?.pan_verified || detailsResponse?.kyc_record?.is_pan_verified;
		const isEmailVer =
			detailsResponse?.email_verified || detailsResponse?.kyc_record?.is_email_verified;

		// If reapplication is in progress and PAN + Email are already verified:
		if (isReapp && isPanVer && isEmailVer) {
			console.log("🔄 Reapplication check: calling Initial Approval directly...");
			const targetEmail = email || detailsResponse?.kyc_record?.email || "";
			const personalDetails = detailsResponse?.kyc_record;

			try {
				const approvalResponse = await initialApproval({
					email: targetEmail,
					is_deliverable: true,
					is_pan_verified: true,
					is_pan_valid: true,
					pan_number: personalDetails?.pan_number || "",
					name: personalDetails?.full_name || personalDetails?.name || "",
				});

				setDelayVisible(false);
				if (approvalResponse.status === "approved") {
					router.replace("/application-approved" as any);
				} else if (approvalResponse.status === "reject") {
					setIsSuccessModalVisible(false);
					setRejectionMessage(approvalResponse.msg || "Application Rejected");
					setRejectionModalVisible(true);
				} else {
					router.replace({
						pathname: "/professional-details" as any,
						params: { disableBack: "true" },
					});
				}
			} catch (approvalError) {
				console.error("❌ Failed during initial approval transition:", approvalError);
				setDelayVisible(false);
				router.replace({
					pathname: "/professional-details" as any,
					params: { disableBack: "true" },
				});
			}
			return;
		}

		// Standard first-time flow: User moved from Assessment Fee queue to Professional Details queue
		console.log("➡️ [Payment Flow] Moving user to Professional Details queue (/professional-details)");
		setDelayVisible(false);
		router.replace({
			pathname: "/professional-details" as any,
			params: { disableBack: "true" },
		});
	};

	// Start lead creation polling after success modal
	const startVerifyLeadFlow = () => {
		setIsSuccessModalVisible(false);
		setDelayStageKey("paymentConfirmedVerifyingDetails");
		setDelayVisible(true);
		setIsVerifyLeadFlow(true);

		const startTime = Date.now();

		const checkLead = async () => {
			try {
				const res = await verifyLeadCreation();
				if (res?.lead_created) {
					if (leadPollIntervalRef.current) clearInterval(leadPollIntervalRef.current);
					setIsVerifyLeadFlow(false);
					setDelayStageKey("evaluatingCreditPolicyCriteria");
					handleEmailVerificationFlow();
					return true;
				}
			} catch (err) {
				console.error("Error in verifyLeadCreation:", err);
			}
			return false;
		};

		checkLead();

		leadPollIntervalRef.current = setInterval(async () => {
			const elapsed = Date.now() - startTime;
			if (elapsed >= 60000) {
				if (leadPollIntervalRef.current) clearInterval(leadPollIntervalRef.current);
				const isCreated = await checkLead();
				if (!isCreated) {
					setIsVerifyLeadFlow(false);
					setDelayVisible(false);
					router.replace({
						pathname: "/professional-details" as any,
						params: { disableBack: "true" },
					});
				}
			} else {
				await checkLead();
			}
		}, 2000);
	};

	// Payment Subsystem hook
	const {
		initiatePayment,
		isPending,
		isPaymentCompleted,
		isPaymentPolling,
		delayVisible,
		setDelayVisible,
		paymentStatus,
		simulateDeepLinkReturn,
		clearTimer,
	} = useAssessmentFeePayment({
		processingFeeAmount,
		onPaymentSuccess: () => {
			setIsSuccessModalVisible(true);
			setTimeout(() => {
				startVerifyLeadFlow();
			}, 3000);
		},
	});

	// Sync payment polling stage
	useEffect(() => {
		if (isPaymentPolling) {
			setDelayStageKey("verifyingPaymentWait");
		}
	}, [isPaymentPolling]);
	useEffect(() => {
		let loop: Animated.CompositeAnimation;
		if (!isPending && !paymentStatus.paymentPending && !isLoadingLenderOffers) {
			loop = Animated.loop(
				Animated.sequence([
					Animated.timing(shimmerAnim, {
						toValue: 1,
						duration: 1600,
						useNativeDriver: true,
					}),
					Animated.delay(2000),
				]),
			);
			loop.start();
		} else {
			shimmerAnim.setValue(0);
		}

		return () => {
			if (loop) loop.stop();
		};
	}, [isPending, paymentStatus.paymentPending, isLoadingLenderOffers, shimmerAnim]);

	// Cleanup lead poll on unmount
	useEffect(() => {
		return () => {
			if (leadPollIntervalRef.current) {
				clearInterval(leadPollIntervalRef.current);
			}
		};
	}, []);

	const offerMinutes = Math.floor(offerTimer / 60)
		.toString()
		.padStart(2, "0");
	const offerSeconds = (offerTimer % 60).toString().padStart(2, "0");

	return (
		<View style={styles.screenContainer}>
			{isPaymentCompleted && !isSuccessModalVisible ? (
				<View style={styles.loadingContainer}>
					<ActivityIndicator size="large" color="#000000" />
					<Text style={styles.loadingText}>{t("loading")}</Text>
				</View>
			) : (
				<>
					<ScrollView
						style={styles.scrollView}
						contentContainerStyle={styles.scrollContent}
						showsVerticalScrollIndicator={false}>
						{/* Subsystem 1: Offer & Lender Section */}
						<OfferLendersSection
							primaryLender={primaryLender}
							eligibleLenders={eligibleLenders}
							isLoadingFee={isLoadingLenderOffers}
							processingFeeAmount={processingFeeAmount}
							originalPrice={originalPrice}
							discountPercent={discountPercent}
							offerMinutes={offerMinutes}
							offerSeconds={offerSeconds}
							onBackPress={() => setIsExitModalVisible(true)}
						/>

						{/* Dev Test Simulator (active in __DEV__ only) */}
						<DevPaymentSimulator onSimulateDeepLink={simulateDeepLinkReturn} />
					</ScrollView>

					{/* Sticky Bottom CTA Section */}
					<View
						style={[
							styles.bottomContainer,
							{ paddingBottom: Math.max(insets.bottom + height(1.5), height(3.5)) },
						]}>
						<Image
							source={Images.RBI_LOGO}
							style={styles.rbiLogo}
							contentFit="cover"
						/>

						<TouchableOpacity
							style={[
								styles.proceedBtn,
								(isPending ||
									paymentStatus.paymentPending ||
									isLoadingLenderOffers) &&
									styles.proceedBtnDisabled,
							]}
							disabled={
								isPending || paymentStatus.paymentPending || isLoadingLenderOffers
							}
							onPress={() => initiatePayment()}
							activeOpacity={0.85}>
							{/* Subtle Sheen Gradient */}
							{!(
								isPending ||
								paymentStatus.paymentPending ||
								isLoadingLenderOffers
							) && (
								<Animated.View
									style={[
										StyleSheet.absoluteFill,
										{
											width: "60%",
											transform: [
												{
													translateX: shimmerAnim.interpolate({
														inputRange: [0, 1],
														outputRange: [-width(60), width(100)],
													}),
												},
											],
										},
									]}>
									<LinearGradient
										colors={[
											"transparent",
											"rgba(255,255,255,0.05)",
											"rgba(255,255,255,0.22)",
											"rgba(255,255,255,0.05)",
											"transparent",
										]}
										locations={[0, 0.25, 0.5, 0.75, 1]}
										start={{ x: 0, y: 0 }}
										end={{ x: 1, y: 0 }}
										style={StyleSheet.absoluteFill}
									/>
								</Animated.View>
							)}

							{isLoadingLenderOffers || isPending ? (
								<ActivityIndicator size="small" color="#333" />
							) : paymentStatus.paymentPending ? (
								<Text style={styles.waitingText}>
									Waiting for{" "}
									{Math.floor(paymentStatus.paymentTimer / 60)
										.toString()
										.padStart(2, "0")}
									:{(paymentStatus.paymentTimer % 60).toString().padStart(2, "0")}{" "}
									min
								</Text>
							) : (
								<View style={styles.proceedRow}>
									<Text style={styles.proceedText}>{t("proceed")}</Text>
									<IconSymbol name="arrow.right" size={20} color="#000" />
								</View>
							)}
						</TouchableOpacity>
					</View>
				</>
			)}

			{/* Subsystem 3 & 4 Modals */}
			<PaymentSuccessModal visible={isSuccessModalVisible} />

			<FiveSecDelay
				visible={delayVisible}
				isPolling={isVerifyLeadFlow || isPaymentPolling}
				pollingTextKey={delayStageKey}
				onComplete={() => {
					setDelayVisible(false);
				}}
			/>

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
		</View>
	);
}

const styles = StyleSheet.create({
	screenContainer: {
		flex: 1,
		backgroundColor: white,
	},
	scrollView: {
		flex: 1,
		backgroundColor: "#F5F5F5",
	},
	scrollContent: {
		flexGrow: 1,
		paddingBottom: height(14),
	},
	loadingContainer: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
	},
	loadingText: {
		marginTop: 20,
		fontSize: font(1.8),
		color: "#000",
		fontWeight: "bold",
	},
	bottomContainer: {
		paddingHorizontal: width(4),
		paddingTop: height(1.2),
		backgroundColor: white,
		borderTopWidth: 1,
		borderTopColor: "#E5E5E5",
		width: "100%",
	},
	rbiLogo: {
		marginVertical: height(0.8),
		width: width(85),
		height: width(10),
		alignSelf: "center",
	},
	proceedBtn: {
		backgroundColor: "#B7FB52",
		borderRadius: width(5),
		paddingVertical: height(1.8),
		paddingHorizontal: width(8),
		width: "100%",
		alignItems: "center",
		justifyContent: "center",
		overflow: "hidden",
		position: "relative",
		elevation: 3,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.22,
		shadowRadius: 2.22,
	},
	proceedBtnDisabled: {
		opacity: 0.5,
	},
	proceedRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: width(2),
		zIndex: 10,
	},
	proceedText: {
		color: dark,
		fontWeight: "bold",
		letterSpacing: 1,
		fontSize: font(2),
	},
	waitingText: {
		color: dark,
		fontWeight: "bold",
		zIndex: 10,
		fontSize: font(1.6),
	},
});
