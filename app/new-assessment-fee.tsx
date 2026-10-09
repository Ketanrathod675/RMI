import DevPaymentSimulator from "@/components/assessment-fee/DevPaymentSimulator";
import ExitIntentModal from "@/components/assessment-fee/ExitIntentModal";
import OfferLendersSection, {
	type LenderOffer,
} from "@/components/assessment-fee/OfferLendersSection";
import PaymentStatusModal from "@/components/assessment-fee/PaymentStatusModal";
import PaymentSuccessModal from "@/components/assessment-fee/PaymentSuccessModal";
import RejectionModal from "@/components/RejectionModal";
import { useJourneyLoader } from "@/context/JourneyLoaderProvider";
import { IconSymbol } from "@/components/ui/IconSymbol";
import { dark, white } from "@/constants/Colors";
import { Images } from "@/constants/images";
import { useAssessmentFeePayment } from "@/hooks/useAssessmentFeePayment";
import { useAuth } from "@/hooks/useAuth";
import { useJourneyTracker } from "@/hooks/useJourneyTracker";
import { useNetworkAwareQuery } from "@/hooks/useNetworkAwareQuery";
import { useTranslation } from "@/hooks/useTranslation";
import {
	isEmailFixable,
	isPanFixable,
	pollAssessmentChecks,
	useAssessmentChecksController,
} from "@/hooks/useAssessmentChecks";
import {
	allocateLenderForUser,
	axios,
	getHandshakeStatus,
	getUserProfile,
	retryAssessmentChecks,
	triggerPostKycAllocationAdapter,
	verifyCoupon,
	type AssessmentChecks,
	type RetryAssessmentChecksPayload,
} from "@/utils/api";
import { getStorageItem, setStorageItem, STORAGE_KEYS } from "@/utils/storage";
import { getUserIdFromToken } from "@/utils/encode_decode";
import SecureStorage from "@/utils/secure-storage";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getMyDetails } from "@/utils/api/kyc";
import { resolveLeadId } from "@/utils/leadId";
import { font, height, width } from "@/utils/dimensions";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
	ActivityIndicator,
	Animated,
	BackHandler,
	Modal,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
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

const DEFAULT_LENDER_OFFERS: LenderOffersResponseType = {
	success: true,
	primary_lender: {
		lender_id: "lender_ruloans_01",
		lender_name: "Ruloans Financial Services P Ltd",
		is_rbi_nbfc: true,
		loan_upto: 15000,
		tenure_upto: 60,
		interest_rate_starts_at: "Starts @ 1.5% p.m.",
	},
	eligible_lenders: [
		{
			lender_id: "lender_fintree_02",
			lender_name: "Fintree (Term - Personal Loan)",
			is_rbi_nbfc: true,
			loan_upto: 20000,
			tenure_upto: 45,
			interest_rate_starts_at: "Starts @ 1.75% p.m.",
		},
		{
			lender_id: "lender_emkay_03",
			lender_name: "Emkay Global Finance",
			is_rbi_nbfc: true,
			loan_upto: 15000,
			tenure_upto: 30,
			interest_rate_starts_at: "Starts @ 2.0% p.m.",
		},
	],
	assessment_fee: {
		amount: 99,
		original_amount: 249,
		gst: 0,
		currency: "INR",
	},
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

	const [stillCheckingModalVisible, setStillCheckingModalVisible] = useState(false);

	const activeTxnidRef = useRef<string>("");
	const lastStatusRef = useRef<string>("");
	const hasAllocatedRef = useRef(false);

	const leadPollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const shimmerAnim = useRef(new Animated.Value(0)).current;

	const { userId } = useAuth();
	const { runStep, show, hide } = useJourneyLoader();
	const { signal: checksSignal } = useAssessmentChecksController();

	// Allocated lender state
	const [allocatedLender, setAllocatedLender] = useState<{ id: string; name: string } | null>(null);

	// Coupon states
	const [afFlag, setAfFlag] = useState<string>((params.af as string) || "yes");
	const [couponCode, setCouponCode] = useState("");
	const [couponError, setCouponError] = useState("");
	const [isCouponVerifying, setIsCouponVerifying] = useState(false);
	const [appliedDiscount, setAppliedDiscount] = useState<number>(0);
	const [appliedCouponCode, setAppliedCouponCode] = useState<string>("");
	const [appliedFinalAmount, setAppliedFinalAmount] = useState<number | null>(null);

	// Assessment fee amount state (loaded from router params or storage, defaults to 826 from backend)
	const [rawFeeAmount, setRawFeeAmount] = useState<number>(() => {
		const paramFee = Number(params.fee_amount);
		if (!isNaN(paramFee) && paramFee > 0) return paramFee;
		return 826;
	});

	useEffect(() => {
		const loadFeeAndLead = async () => {
			try {
				let existingLeadId = await AsyncStorage.getItem(STORAGE_KEYS["@lead-id"]);
				const savedFee = await AsyncStorage.getItem(STORAGE_KEYS["@assessment-fee-amount"]);
				if (savedFee) {
					const parsed = Number(savedFee);
					if (!isNaN(parsed) && parsed > 0) {
						setRawFeeAmount(parsed);
					}
				}

				if (!existingLeadId || !savedFee) {
					try {
						const profile = await getUserProfile();
						const meData = (profile as any)?.data || profile;
						const wf = meData?.current_workflow;
						const kycResp = wf?.profile_response;
						const recoveredLeadId = wf?.lead_id || kycResp?.lead_id;
						if (recoveredLeadId && !existingLeadId) {
							await AsyncStorage.setItem(STORAGE_KEYS["@lead-id"], String(recoveredLeadId));
						}
						const fee = kycResp?.af_amount || kycResp?.assessment_fee;
						if (fee && Number(fee) > 0 && !savedFee) {
							setRawFeeAmount(Number(fee));
							await AsyncStorage.setItem(STORAGE_KEYS["@assessment-fee-amount"], String(fee));
						}
						if (kycResp?.af) {
							setAfFlag(String(kycResp.af));
							await AsyncStorage.setItem(STORAGE_KEYS["@af-flag"], String(kycResp.af));
						}
					} catch (profileErr) {
						console.warn("⚠️ [new-assessment-fee] Failed to recover lead/fee from /auth/me:", profileErr);
					}
				}
			} catch { }
		};
		loadFeeAndLead();
	}, []);

	useEffect(() => {
		const loadAllocationAndAf = async () => {
			try {
				const savedAf = await AsyncStorage.getItem(STORAGE_KEYS["@af-flag"]);
				if (savedAf) {
					setAfFlag(savedAf);
				}

				const savedLenderId = await AsyncStorage.getItem(STORAGE_KEYS["@allocated-lender-id"]);
				const savedLenderName = await AsyncStorage.getItem(STORAGE_KEYS["@allocated-lender-name"]);

				let effectiveUserId: string | null | undefined = userId;
				if (!effectiveUserId) {
					const token: string | null | undefined =
						await SecureStorage.getSensitiveWithLegacyMigration(STORAGE_KEYS["@access-token"]);
					effectiveUserId = getUserIdFromToken(token);
				}

				if (savedLenderId && savedLenderId !== "null") {
					setAllocatedLender({ id: savedLenderId, name: savedLenderName || "Assigned Partner Lender" });
				} else if (!hasAllocatedRef.current) {
					hasAllocatedRef.current = true;
					try {
						const allocation = await triggerPostKycAllocationAdapter();
						if (allocation && allocation.allocated_lender_id) {
							const lId = allocation.allocated_lender_id;
							const lName = allocation.lender_name || "Assigned Partner Lender";
							await AsyncStorage.setItem(STORAGE_KEYS["@allocated-lender-id"], lId);
							await AsyncStorage.setItem(STORAGE_KEYS["@allocated-lender-name"], lName);
							setAllocatedLender({ id: lId, name: lName });
						}
					} catch (allocErr) {
						console.warn("⚠️ [AssessmentFee] Allocation adapter fallback failed:", allocErr);
					}
				}
			} catch (err) {
				console.warn("⚠️ [AssessmentFee] Error loading allocation or af flag:", err);
			}
		};
		loadAllocationAndAf();
	}, [userId]);

	const handleApplyCoupon = async () => {
		const trimmedCode = couponCode.trim();
		if (!trimmedCode) return;
		setCouponError("");
		setIsCouponVerifying(true);
		try {
			const leadId = (params.lead_id as string) || (await getStorageItem(STORAGE_KEYS["@lead-id"])) || undefined;
			const res = await verifyCoupon(trimmedCode, leadId);
			if (res.success && res.data) {
				setAppliedDiscount(Math.min(res.data.discount || 0, res.data.original_amount ?? Infinity));
				setAppliedCouponCode(res.data.coupon_code);
				if (typeof res.data.original_amount === "number") setRawFeeAmount(res.data.original_amount);
				setAppliedFinalAmount(typeof res.data.final_amount === "number" ? res.data.final_amount : null);
				Toast.show({
					type: "success",
					text1: t("couponApplied" as any, "Coupon Applied"),
					text2: `₹${res.data.discount} discount applied successfully`,
				});
			}
		} catch (err: any) {
			const rawDetail = err?.response?.data?.detail;
			const errorMsg =
				typeof rawDetail === "string"
					? rawDetail
					: err?.response?.data?.message || err?.message || "Invalid coupon.";
			setCouponError(errorMsg);
		} finally {
			setIsCouponVerifying(false);
		}
	};

	const handleRemoveCoupon = () => {
		setAppliedCouponCode("");
		setAppliedDiscount(0);
		setAppliedFinalAmount(null);
		setCouponCode("");
		setCouponError("");
	};

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
		}, [navigation])
	);

	// Fetch eligible lenders and assessment fee
	const {
		data: lenderOffersData,
		isLoading: isLoadingLenderOffers,
		error: lenderOffersError,
	} = useNetworkAwareQuery<LenderOffersResponseType>({
		queryKey: ["lender-offers"],
		queryFn: async () => {
			try {
				const response = await axios.get<LenderOffersResponseType>("kyc/lender-offers");
				return response.data;
			} catch (err: any) {
				// If backend route is not yet implemented (e.g. 404 on in-house FastAPI) or network fails, use default offers
				if (err?.response?.status === 404 || !err?.response) {
					console.warn(
						"⚠️ [LenderOffers] kyc/lender-offers returned 404 or network unavailable; using default lender offers."
					);
					return DEFAULT_LENDER_OFFERS;
				}
				throw err;
			}
		},
		retry: 1,
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
			console.warn("Lender offers fetch error:", lenderOffersError);

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
	const initialFeeAmount =
		rawFeeAmount ||
		(lenderOffersData?.assessment_fee?.amount
			? Math.round(
				lenderOffersData.assessment_fee.amount +
				((lenderOffersData.assessment_fee.gst ?? 0) * lenderOffersData.assessment_fee.amount) / 100
			)
			: 826);
	const processingFeeAmount =
		appliedFinalAmount ?? Math.max(0, initialFeeAmount - appliedDiscount);
	const originalPrice =
		lenderOffersData?.assessment_fee?.original_amount ||
		Math.round(initialFeeAmount * 1.5) ||
		1249;
	const discountPercent = Math.max(
		1,
		Math.round(((originalPrice - processingFeeAmount) / originalPrice) * 100)
	);

	const primaryLender: LenderOffer | undefined = allocatedLender
		? {
			lender_id: allocatedLender.id,
			lender_name: allocatedLender.name,
			is_rbi_nbfc: true,
			loan_upto: lenderOffersData?.primary_lender?.loan_upto ?? 15000,
			tenure_upto: lenderOffersData?.primary_lender?.tenure_upto ?? 60,
			interest_rate_starts_at:
				lenderOffersData?.primary_lender?.interest_rate_starts_at ?? "Starts @ 1.5% p.m.",
		}
		: lenderOffersData?.primary_lender;

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
			const txnid =
				(await getStorageItem(STORAGE_KEYS["@latest-assessment-fee-txnid"])) ||
				(await getStorageItem(STORAGE_KEYS["@transaction-id"]));
			if (!txnid) {
				router.replace("/(tabs)");
				return;
			}
			activeTxnidRef.current = txnid;
			const leadId = await resolveLeadId();
			try {
				await retryAssessmentChecks({
					lead_id: leadId,
					txnid: activeTxnidRef.current || undefined,
				});
			} catch (e) {
				console.warn("retryAssessmentChecks in reapplication failed, continuing to check flow", e);
			}
			await startVerifyLeadFlow(txnid);
			return;
		}

		// Standard first-time flow: User moved from Assessment Fee queue to Professional Details queue
		console.log("➡️ [Payment Flow] Moving user to Professional Details queue (/professional-details)");
		await proceedToProfessionalDetails();
	};

	const proceedToProfessionalDetails = async () => {
		setDelayVisible(false);
		router.replace({
			pathname: "/professional-details" as any,
			params: { disableBack: "true" },
		});
	};

	// Start post-payment verification flow via JourneyLoader
	const startVerifyLeadFlow = async (txnId?: string) => {
		setIsSuccessModalVisible(false);
		setStillCheckingModalVisible(false);

		const activeTxnid =
			txnId ||
			(await getStorageItem(STORAGE_KEYS["@latest-assessment-fee-txnid"])) ||
			(await getStorageItem(STORAGE_KEYS["@transaction-id"]));

		if (!activeTxnid) {
			console.warn("⚠️ [startVerifyLeadFlow] No transaction ID found, redirecting to dashboard");
			router.replace("/(tabs)");
			return;
		}
		activeTxnidRef.current = activeTxnid;

		try {
			await runStep(
				"assessment_fee",
				async ({ advanceSubStep }) => {
					// Sub-step 1: Payment verified, confirming details
					advanceSubStep("confirming_details", t("paymentConfirmedVerifyingDetails"));

					// Sub-step 2: Credit Evaluation (BRE) / Handshake check
					advanceSubStep("evaluating_policy", t("evaluatingCreditPolicyCriteria"));

					const res = await pollAssessmentChecks({
						txnid: activeTxnid,
						signal: checksSignal,
						timeoutMs: 60000,
						intervalMs: 2000,
					});

					if (res.status === "approved") {
						return res;
					}

					if (res.status === "rejected") {
						throw { isRejection: true, checks: res };
					}

					if (res.status === "error") {
						throw { isError: true, checks: res };
					}

					return res;
				},
				{ timeoutMs: 65000 }
			);

			// Successfully approved
			router.replace({
				pathname: "/professional-details" as any,
				params: { disableBack: "true" },
			});
		} catch (error: any) {
			if (error?.isRejection) {
				const checks: AssessmentChecks = error.checks;
				const canFixEmail = isEmailFixable(checks);
				const canFixPan = isPanFixable(checks);

				if (canFixEmail) {
					hide();
					router.replace("/verify-email" as any);
					return;
				}

				if (canFixPan) {
					hide();
					router.replace("/verify-pan" as any);
					return;
				}

				// Final rejection: hide loader and show existing RejectionModal (fixed copy, 15s countdown)
				hide();
				setRejectionCountdown(15);
				setRejectionModalVisible(true);
				return;
			}

			// Error or timeout: Fail-closed (NEVER navigate to /professional-details)
			lastStatusRef.current = error?.isError ? "error" : "timeout";
			hide();
			setStillCheckingModalVisible(true);
		}
	};

	const handleRetryChecking = async () => {
		setStillCheckingModalVisible(false);
		const txnid = activeTxnidRef.current;
		if (!txnid) {
			router.replace("/(tabs)");
			return;
		}
		if (lastStatusRef.current === "error") {
			try {
				const leadId = await resolveLeadId();
				await retryAssessmentChecks({
					lead_id: leadId,
					txnid: activeTxnidRef.current || undefined,
				});
			} catch (e) {
				console.warn("retryAssessmentChecks on retry failed", e);
			}
		}
		startVerifyLeadFlow(txnid);
	};

	// Auto-resume checking if resumeChecks param is set
	useEffect(() => {
		if (params.resumeChecks === "true") {
			(async () => {
				const txnid =
					(params.txnid as string) ||
					(await getStorageItem(STORAGE_KEYS["@latest-assessment-fee-txnid"])) ||
					(await getStorageItem(STORAGE_KEYS["@transaction-id"]));
				if (txnid) {
					startVerifyLeadFlow(txnid);
				} else {
					router.replace("/(tabs)");
				}
			})();
		}
	}, [params.resumeChecks]);

	// Payment Subsystem hook
	const {
		initiatePayment,
		isPending,
		isPaymentCompleted,
		isPaymentPolling,
		delayVisible,
		setDelayVisible,
		paymentStatus,
		paymentOutcome,
		recheckPayment,
		dismissPaymentOutcome,
		simulateDeepLinkReturn,
		clearTimer,
	} = useAssessmentFeePayment({
		processingFeeAmount,
		leadId: (params.lead_id as string) || undefined,
		couponCode: appliedCouponCode || undefined,
		onPaymentSuccess: (txnId: string) => {
			setIsSuccessModalVisible(true);
			setTimeout(() => {
				startVerifyLeadFlow(txnId);
			}, 3000);
		},
		onCouponRejected: handleRemoveCoupon,
	});

	// Sync payment polling stage with loader
	const hasShownPollingLoaderRef = useRef(false);
	useEffect(() => {
		if (isPaymentPolling && !hasShownPollingLoaderRef.current) {
			hasShownPollingLoaderRef.current = true;
			show("assessment_fee", t("verifyingPaymentWait"));
		} else if (!isPaymentPolling && hasShownPollingLoaderRef.current) {
			// Polling ended (success, failure, cancel or timeout): always release the full-screen loader.
			hasShownPollingLoaderRef.current = false;
			hide();
		}
	}, [isPaymentPolling]);
	useEffect(() => {
		return () => {
			if (hasShownPollingLoaderRef.current) {
				hasShownPollingLoaderRef.current = false;
				hide();
			}
		};
	}, []);
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
			<ScrollView
				style={styles.scrollView}
				contentContainerStyle={styles.scrollContent}
				showsVerticalScrollIndicator={false}>
				{/* Subsystem 1: Offer & Lender Section */}
				<OfferLendersSection
					primaryLender={primaryLender}
					eligibleLenders={eligibleLenders}
					isLoadingFee={isLoadingLenderOffers && !rawFeeAmount}
					processingFeeAmount={processingFeeAmount}
					originalPrice={originalPrice}
					discountPercent={discountPercent}
					offerMinutes={offerMinutes}
					offerSeconds={offerSeconds}
					onBackPress={() => setIsExitModalVisible(true)}
				/>

				{/* Coupon input section (active when af === "coupon") */}
				{afFlag === "coupon" && (
					<View style={styles.couponContainer}>
						<Text style={styles.couponHeading}>Have a coupon code?</Text>
						<View style={styles.couponInputRow}>
							<TextInput
								style={[
									styles.couponTextInput,
									couponError ? styles.couponTextInputError : null,
								]}
								placeholder="ENTER COUPON CODE"
								placeholderTextColor="#888"
								value={couponCode}
								onChangeText={(text) => {
									setCouponCode(text.toUpperCase());
									if (couponError) setCouponError("");
								}}
								autoCapitalize="characters"
								returnKeyType="done"
								onSubmitEditing={handleApplyCoupon}
								editable={!isCouponVerifying && !appliedCouponCode}
							/>
							<TouchableOpacity
								style={[
									styles.couponApplyButton,
									(!couponCode.trim() || isCouponVerifying || !!appliedCouponCode) &&
									styles.couponApplyButtonDisabled,
								]}
								onPress={handleApplyCoupon}
								disabled={!couponCode.trim() || isCouponVerifying || !!appliedCouponCode}>
								{isCouponVerifying ? (
									<ActivityIndicator size="small" color="#000" />
								) : (
									<Text style={styles.couponApplyButtonText}>
										{appliedCouponCode ? "APPLIED" : "APPLY"}
									</Text>
								)}
							</TouchableOpacity>
						</View>
						{couponError ? (
							<Text style={styles.couponErrorText}>{couponError}</Text>
						) : null}
						{appliedCouponCode ? (
							<View style={styles.couponSuccessRow}>
								<Text style={styles.couponSuccessText}>
									Coupon applied! ₹{appliedDiscount} discount
								</Text>
								<TouchableOpacity
									onPress={handleRemoveCoupon}
									hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
									<Text style={styles.couponRemoveText}>Remove</Text>
								</TouchableOpacity>
							</View>
						) : null}
					</View>
				)}

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
							<Text style={styles.proceedText}>
								{processingFeeAmount > 0
									? `Pay Assessment Fee • ₹${processingFeeAmount}`
									: t("proceed")}
							</Text>
							<IconSymbol name="arrow.right" size={20} color="#000" />
						</View>
					)}
				</TouchableOpacity>
			</View>

			{/* Subsystem 3 & 4 Modals */}
			<PaymentSuccessModal visible={isSuccessModalVisible} />

			<PaymentStatusModal
				visible={!!paymentOutcome}
				type={paymentOutcome?.type ?? null}
				onRetry={() => {
					dismissPaymentOutcome();
					setTimeout(() => initiatePayment(), 350);
				}}
				onCheckAgain={recheckPayment}
				onContactSupport={() => {
					dismissPaymentOutcome();
					router.push("/help-support" as any);
				}}
				onClose={dismissPaymentOutcome}
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

			{/* Still Checking Details Modal */}
			<Modal
				visible={stillCheckingModalVisible}
				transparent={true}
				animationType="fade"
				statusBarTranslucent={true}>
				<View style={styles.modalBackdrop}>
					<View style={styles.modalCard}>
						<View style={styles.modalIconContainer}>
							<Ionicons name="time-outline" size={42} color="#0284C7" />
						</View>
						<Text style={styles.modalTitle}>{t("stillCheckingDetailsTitle")}</Text>
						<Text style={styles.modalDescription}>{t("stillCheckingDetailsDesc")}</Text>

						<View style={styles.modalActions}>
							<TouchableOpacity
								style={styles.primaryModalBtn}
								onPress={handleRetryChecking}
								activeOpacity={0.85}>
								<Text style={styles.primaryModalBtnText}>{t("tryAgain")}</Text>
							</TouchableOpacity>

							<TouchableOpacity
								style={styles.secondaryModalBtn}
								onPress={() => {
									setStillCheckingModalVisible(false);
									router.replace("/(tabs)");
								}}
								activeOpacity={0.85}>
								<Text style={styles.secondaryModalBtnText}>{t("goToDashboard")}</Text>
							</TouchableOpacity>
						</View>
					</View>
				</View>
			</Modal>

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
	couponContainer: {
		backgroundColor: white,
		marginHorizontal: width(4),
		marginTop: height(1.5),
		padding: width(4),
		borderRadius: width(3),
		borderWidth: 1,
		borderColor: "#E5E5E5",
	},
	couponHeading: {
		fontSize: font(1.6),
		fontWeight: "600",
		color: dark,
		marginBottom: height(1),
	},
	couponInputRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: width(2),
	},
	couponTextInput: {
		flex: 1,
		height: height(5.5),
		borderWidth: 1,
		borderColor: "#CCC",
		borderRadius: width(2),
		paddingHorizontal: width(3),
		fontSize: font(1.6),
		color: dark,
		fontWeight: "600",
		backgroundColor: "#FAFAFA",
	},
	couponTextInputError: {
		borderColor: "#E53935",
	},
	couponApplyButton: {
		backgroundColor: "#B7FB52",
		height: height(5.5),
		paddingHorizontal: width(5),
		borderRadius: width(2),
		alignItems: "center",
		justifyContent: "center",
	},
	couponApplyButtonDisabled: {
		opacity: 0.5,
	},
	couponApplyButtonText: {
		color: dark,
		fontWeight: "bold",
		fontSize: font(1.5),
		letterSpacing: 0.5,
	},
	couponErrorText: {
		marginTop: height(0.6),
		color: "#E53935",
		fontSize: font(1.4),
		fontWeight: "500",
	},
	couponSuccessRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		marginTop: height(0.6),
	},
	couponSuccessText: {
		color: "#2E7D32",
		fontSize: font(1.4),
		fontWeight: "600",
	},
	couponRemoveText: {
		color: "#E53935",
		fontSize: font(1.4),
		fontWeight: "600",
		textDecorationLine: "underline",
	},
	// Still Checking Modal Styles
	modalBackdrop: {
		flex: 1,
		backgroundColor: "rgba(0,0,0,0.6)",
		justifyContent: "center",
		alignItems: "center",
		paddingHorizontal: width(6),
	},
	modalCard: {
		backgroundColor: white,
		borderRadius: width(5),
		padding: width(6),
		width: "100%",
		alignItems: "center",
		elevation: 10,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.2,
		shadowRadius: 10,
	},
	modalIconContainer: {
		width: 72,
		height: 72,
		borderRadius: 36,
		backgroundColor: "#E0F2FE",
		justifyContent: "center",
		alignItems: "center",
		marginBottom: height(1.5),
	},
	modalTitle: {
		fontSize: font(2),
		fontWeight: "bold",
		color: dark,
		textAlign: "center",
		marginBottom: height(1),
	},
	modalDescription: {
		fontSize: font(1.5),
		color: "#4B5563",
		textAlign: "center",
		lineHeight: 22,
		marginBottom: height(2.5),
	},
	modalActions: {
		width: "100%",
		gap: height(1.2),
	},
	primaryModalBtn: {
		backgroundColor: "#B7FB52",
		borderRadius: width(3),
		paddingVertical: height(1.6),
		alignItems: "center",
		justifyContent: "center",
		width: "100%",
	},
	primaryModalBtnText: {
		color: dark,
		fontWeight: "bold",
		fontSize: font(1.6),
	},
	secondaryModalBtn: {
		backgroundColor: "#F3F4F6",
		borderRadius: width(3),
		paddingVertical: height(1.6),
		alignItems: "center",
		justifyContent: "center",
		width: "100%",
	},
	secondaryModalBtnText: {
		color: "#374151",
		fontWeight: "600",
		fontSize: font(1.6),
	},

});

export { RouteErrorBoundary as ErrorBoundary } from "@/components/ErrorBoundary";