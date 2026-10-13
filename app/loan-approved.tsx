import ExitIntentModal from "@/components/assessment-fee/ExitIntentModal";
import { Select, SelectOption } from "@/components/select";
import { TranslatedText } from "@/components/TranslatedText";
import { dark, white } from "@/constants/Colors";
import { IconSymbol } from "@/components/ui/IconSymbol";
import { Images } from "@/constants/images";
import { useJourneyTracker } from "@/hooks/useJourneyTracker";
import { useNetworkAwareMutation } from "@/hooks/useNetworkAwareMutation";
import { useNetworkAwareQuery } from "@/hooks/useNetworkAwareQuery";
import { useTranslation } from "@/hooks/useTranslation";
import { Logger } from "@/utils/logger";
import {
	generateSanctionLetter,
	getLoanOffer,
} from "@/utils/api/services/loanOffer.service";
import type { LoanOffer } from "@/utils/api/types/loan.types";
import { font, height, width } from "@/utils/dimensions";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useNavigation, useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
	ActivityIndicator,
	Animated,
	BackHandler,
	Linking,
	Modal,
	ScrollView,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

const ASSESSMENT_BANNER = Images.CONGRATULATIONS_BANNER;
const RUPEE_COIN = Images.RUPEE_COIN;

// Function to format amount using Intl formatter
const formatAmount = (amount: number): string => {
	return new Intl.NumberFormat("en-IN", {
		style: "currency",
		currency: "INR",
		minimumFractionDigits: 0,
		maximumFractionDigits: 0,
	}).format(amount);
};

export default function LoanApproved() {
	const { t } = useTranslation();
	const router = useRouter();
	const navigation = useNavigation();
	const queryClient = useQueryClient();

	// Track this screen in the journey
	useJourneyTracker("/loan-approved");

	const [modalVisible] = useState(false);
	const [rejectionModalVisible, setRejectionModalVisible] = useState(false);
	const [rejectionCountdown, setRejectionCountdown] = useState(15);
	const [selectedAmount, setSelectedAmount] = useState<number>(0);
	const [selectedDueDate, setSelectedDueDate] = useState<string>("");
	const [error, setError] = useState<string | null>(null);
	const [isExitModalVisible, setIsExitModalVisible] = useState(false);
	const scaleAnim = useRef(new Animated.Value(0)).current;
	const rejectionScaleAnim = useRef(new Animated.Value(0)).current;

	// Handle back navigation prevention
	useEffect(() => {
		// If rejection modal is visible, prevent all navigation
		if (rejectionModalVisible) {
			const unsubscribe = navigation.addListener("beforeRemove", (e) => {
				e.preventDefault();
			});

			const backHandler = BackHandler.addEventListener(
				"hardwareBackPress",
				() => {
					return true;
				},
			);

			return () => {
				unsubscribe();
				backHandler.remove();
			};
		}

		// Normal navigation prevention when not in rejection modal
		const unsubscribe = navigation.addListener("beforeRemove", (e) => {
			if (["GO_BACK", "POP"].includes(e.data.action.type)) {
				e.preventDefault();
				setIsExitModalVisible(true);
			}
		});

		// Intercept Android hardware back button
		const backHandler = BackHandler.addEventListener(
			"hardwareBackPress",
			() => {
				setIsExitModalVisible(true);
				return true;
			},
		);

		return () => {
			unsubscribe();
			backHandler.remove();
		};
	}, [navigation, rejectionModalVisible]);

	// Fetch loan offer using React Query
	const {
		data: offer,
		error: queryError,
		isPending: isLoading,
		refetch: refetchLoanOffer,
	} = useNetworkAwareQuery<LoanOffer>({
		queryKey: ["loan", "offer"],
		queryFn: async () => {
			Logger.debug("Fetching loan offer");
			const result = await getLoanOffer();
			Logger.debug("Loan offer loaded");
			return result;
		},
		staleTime: 30000,
	});

	// Handle query errors
	useEffect(() => {
		if (queryError) {
			const err: any = queryError;
			const status = err?.response?.status;
			const detail = err?.response?.data?.detail;
			const message = err?.response?.data?.message || err?.message || "";
			const combinedMsg = `${typeof detail === "string" ? detail : ""} ${typeof message === "string" ? message : ""}`.toLowerCase();

			Logger.debug("Loan offer query error", { status });

			if (status === 403) {
				if (combinedMsg.includes("underwriting")) {
					router.replace("/application-verification");
					return;
				}
				router.replace("/no-approved-amount");
				return;
			}

			if (status === 404 && combinedMsg.includes("no lender product allocated")) {
				router.replace("/no-lenders-available");
				return;
			}

			if (status === 409) {
				queryClient.invalidateQueries({ queryKey: ["user", "dashboard"] });
				router.replace("/(tabs)");
				return;
			}

			if (status === 400) {
				const displayErr =
					typeof detail === "string"
						? detail
						: typeof message === "string"
							? message
							: "Invalid request";
				Toast.show({
					type: "error",
					text1: t("error") || "Error",
					text2: displayErr,
				});
				return;
			}

			setError(t("failedToLoadLoanTerms"));
		} else {
			setError(null);
		}
	}, [queryError, router, queryClient, t]);

	// Initialize / default selected amount to sanctioned_amount
	useEffect(() => {
		if (offer?.sanctioned_amount && (!selectedAmount || !offer.amount_options?.includes(selectedAmount))) {
			setSelectedAmount(offer.sanctioned_amount);
		}
	}, [offer?.sanctioned_amount, offer?.amount_options, selectedAmount]);

	// Amount options for dropdown
	const amountOptions: SelectOption[] = useMemo(() => {
		if (offer?.amount_options && Array.isArray(offer.amount_options) && offer.amount_options.length > 0) {
			return offer.amount_options.map((amt) => ({
				label: `₹ ${Number(amt).toLocaleString("en-IN")}`,
				value: Number(amt),
			}));
		}
		if (offer?.sanctioned_amount) {
			return [
				{
					label: `₹ ${Number(offer.sanctioned_amount).toLocaleString("en-IN")}`,
					value: Number(offer.sanctioned_amount),
				},
			];
		}
		return [];
	}, [offer?.amount_options, offer?.sanctioned_amount]);

	// Due date options for dropdown
	const dueDateOptions: SelectOption[] = useMemo(() => {
		if (offer?.due_date_options && Array.isArray(offer.due_date_options)) {
			return offer.due_date_options
				.filter((opt) => opt && (opt.display_date || opt.date))
				.map((opt) => ({
					label: String(opt.display_date || opt.date),
					value: String(opt.date || opt.display_date),
				}));
		}
		return [];
	}, [offer?.due_date_options]);

	// Preselect due date option (recommended === true, else selected_due_date, else first option)
	useEffect(() => {
		if (offer?.due_date_options && offer.due_date_options.length > 0 && !selectedDueDate) {
			const recommended = offer.due_date_options.find((opt) => opt.recommended);
			if (recommended?.date) {
				setSelectedDueDate(recommended.date);
			} else if (offer.selected_due_date) {
				setSelectedDueDate(offer.selected_due_date);
			} else {
				setSelectedDueDate(offer.due_date_options[0].date);
			}
		}
	}, [offer?.due_date_options, offer?.selected_due_date, selectedDueDate]);

	// Selected due date item from backend options
	const selectedDueDateOption = useMemo(() => {
		if (!offer?.due_date_options) return undefined;
		return offer.due_date_options.find((opt) => opt.date === selectedDueDate);
	}, [offer?.due_date_options, selectedDueDate]);

	// GST label derivation: gst_percent when present, else breakdown, else rupee amount
	const gstLabel = useMemo(() => {
		if (offer?.gst_percent !== undefined && offer?.gst_percent !== null) {
			return `${offer.gst_percent}% ( GST )`;
		}
		if (offer?.processing_fee_breakdown) {
			return offer.processing_fee_breakdown;
		}
		if (offer?.gst !== undefined && offer?.gst !== null) {
			return `₹ ${offer.gst.toLocaleString("en-IN")} ( GST )`;
		}
		return "";
	}, [offer?.gst_percent, offer?.processing_fee_breakdown, offer?.gst]);

	// Tenure display from backend
	const tenure = useMemo(() => {
		const days = selectedDueDateOption?.tenure_days ?? offer?.tenure_days ?? 0;
		if (!selectedDueDate || days <= 0) {
			return t("selectDueDatePlaceholder");
		}
		return `${days} day${days !== 1 ? "s" : ""}`;
	}, [selectedDueDateOption?.tenure_days, offer?.tenure_days, selectedDueDate, t]);

	// Interest rate display from backend
	const interestRate = useMemo(() => {
		if (selectedDueDateOption?.interest_description) {
			return selectedDueDateOption.interest_description;
		}
		if (selectedDueDateOption?.monthly_interest_rate) {
			return `${selectedDueDateOption.monthly_interest_rate}% ${t("perMonth")}`;
		}
		if (offer?.monthly_interest_rate) {
			return `${offer.monthly_interest_rate}% ${t("perMonth")}`;
		}
		return "-";
	}, [selectedDueDateOption, offer?.monthly_interest_rate, t]);

	// Amount to repay and net disbursal from backend
	const amountToRepay = selectedDueDateOption?.amount_to_repay ?? offer?.amount_to_repay ?? 0;
	const netDisbursalAmount = offer?.net_disbursal_amount ?? 0;

	// Mutation for generating digital sanction letter and moving to OTP
	const { mutate: generateSanctionMutation, isPending: isSubmitting } =
		useNetworkAwareMutation({
			mutationFn: generateSanctionLetter,
			onSuccess: (result) => {
				Logger.debug("Sanction letter generated successfully");
				router.push({
					pathname: "/loan-enter-otp",
					params: {
						sanction_number: result.sanction_number,
						accepted_amount: String(result.sanctioned_amount),
						selected_due_date: result.due_date,
					},
				});
			},
			onError: (err: any) => {
				const status = err?.response?.status;
				const detail = err?.response?.data?.detail;
				const message = err?.response?.data?.message || err?.message || "";
				const combinedMsg = `${typeof detail === "string" ? detail : ""} ${typeof message === "string" ? message : ""}`.toLowerCase();

				Logger.debug("Generate sanction letter error", { status });

				if (status === 403) {
					if (combinedMsg.includes("underwriting")) {
						router.replace("/application-verification");
						return;
					}
					router.replace("/no-approved-amount");
					return;
				}

				if (status === 404 && combinedMsg.includes("no lender product allocated")) {
					router.replace("/no-lenders-available");
					return;
				}

				if (status === 409) {
					queryClient.invalidateQueries({ queryKey: ["user", "dashboard"] });
					router.replace("/(tabs)");
					return;
				}

				const displayErr =
					typeof detail === "string"
						? detail
						: typeof message === "string"
							? message
							: t("pleaseRefreshAndTryAgain");

				Toast.show({
					type: "error",
					text1: t("error") || "Error",
					text2: displayErr,
				});
			},
		});

	const handleAccept = () => {
		if (!selectedDueDate) {
			Toast.show({
				type: "error",
				text1: t("pleaseSelectDueDate"),
				text2: t("dueDateSelectionRequired"),
			});
			return;
		}

		const acceptedAmount = selectedAmount || offer?.sanctioned_amount || 0;
		if (acceptedAmount <= 0) {
			Toast.show({
				type: "error",
				text1: t("invalidLoanAmount"),
				text2: t("pleaseRefreshAndTryAgain"),
			});
			return;
		}

		const chosenTenureDays = selectedDueDateOption?.tenure_days ?? offer?.tenure_days;

		generateSanctionMutation({
			accepted_amount: acceptedAmount,
			selected_due_date: selectedDueDate,
			tenure_days: chosenTenureDays,
		});
	};

	useEffect(() => {
		if (modalVisible) {
			const timeout = setTimeout(() => {
				Animated.timing(scaleAnim, {
					toValue: 1,
					duration: 50,
					useNativeDriver: true,
				}).start();
			}, 1500);
			return () => clearTimeout(timeout);
		}
	}, [modalVisible, scaleAnim]);

	// Handle rejection modal animation and auto-redirect
	useEffect(() => {
		if (rejectionModalVisible) {
			setRejectionCountdown(15);

			const animationTimeout = setTimeout(() => {
				Animated.timing(rejectionScaleAnim, {
					toValue: 1,
					duration: 300,
					useNativeDriver: true,
				}).start();
			}, 100);

			const countdownInterval = setInterval(() => {
				setRejectionCountdown((prev) => {
					if (prev <= 1) {
						clearInterval(countdownInterval);
						setTimeout(() => {
							setRejectionModalVisible(false);
							router.replace("/(tabs)");
						}, 0);
						return 0;
					}
					return prev - 1;
				});
			}, 1000);

			return () => {
				clearTimeout(animationTimeout);
				clearInterval(countdownInterval);
			};
		}
	}, [rejectionModalVisible, rejectionScaleAnim, router]);

	// Show loading state while fetching loan offer
	if (isLoading) {
		return (
			<SafeAreaView style={{ flex: 1, backgroundColor: white }}>
				<View
					style={[
						styles.container,
						{ justifyContent: "center", alignItems: "center" },
					]}>
					<TranslatedText
						style={{ fontSize: 18, fontWeight: "600", color: "#333" }}
						translationKey="loadingLoanTerms"
					/>
				</View>
			</SafeAreaView>
		);
	}

	// Show error state if API fails
	if (error) {
		return (
			<SafeAreaView style={{ flex: 1, backgroundColor: white }}>
				<View
					style={[
						styles.container,
						{
							justifyContent: "center",
							alignItems: "center",
							padding: 20,
						},
					]}>
					<Text
						style={{
							fontSize: 18,
							fontWeight: "600",
							color: "#FF6B6B",
							textAlign: "center",
							marginBottom: 20,
						}}>
						{error}
					</Text>
					<TouchableOpacity
						style={{
							backgroundColor: "#4F6EF7",
							paddingHorizontal: 20,
							paddingVertical: 12,
							borderRadius: 8,
						}}
						onPress={() => {
							setError(null);
							refetchLoanOffer();
						}}>
						<TranslatedText
							style={{ color: "white", fontWeight: "600" }}
							translationKey="retry"
						/>
					</TouchableOpacity>
				</View>
			</SafeAreaView>
		);
	}

	const displayBannerAmount = selectedAmount || offer?.sanctioned_amount || 0;

	return (
		<>
			<SafeAreaView style={{ flex: 1, backgroundColor: white }}>
				<ScrollView
					style={styles.scrollContainer}
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
						<Image
							source={RUPEE_COIN}
							style={[styles.coin, styles.rupeeCoin2]}
							contentFit="contain"
						/>
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
						<Image
							source={RUPEE_COIN}
							style={[styles.coin, styles.rupeeCoin5]}
							contentFit="contain"
						/>
						<Image
							source={RUPEE_COIN}
							style={[styles.coin, styles.rupeeCoin6]}
							contentFit="contain"
						/>

						{/* Back button */}
						<TouchableOpacity
							style={styles.backButton}
							onPress={() => setIsExitModalVisible(true)}>
							<Ionicons name="arrow-back" size={24} color="white" />
						</TouchableOpacity>

						{/* Congratulations text */}
						<View style={styles.textContainer}>
							<TranslatedText
								style={styles.congratsText}
								translationKey="congratulations"
							/>
							<TranslatedText
								style={styles.subText}
								translationKey="yourLoanIsApprovedFor"
							/>
							<Text style={styles.amountText}>
								{formatAmount(displayBannerAmount)}/-
							</Text>
						</View>
					</View>

					{/* Loan Details Table */}
					<View style={styles.detailsContainer}>
						<View style={styles.detailRow}>
							<TranslatedText
								style={styles.detailLabel}
								translationKey="amountApproved"
							/>
							<Text style={styles.detailValue}>
								₹ {(offer?.sanctioned_amount ?? 0).toLocaleString("en-IN")}
							</Text>
						</View>

						<View style={styles.separator} />

						{/* Amount to Accept Dropdown */}
						<View style={styles.detailRow}>
							<TranslatedText
								style={styles.detailLabel}
								translationKey="amountToAccept"
							/>
							<View style={styles.selectContainer}>
								<Select
									options={amountOptions}
									selectedValue={selectedAmount || ""}
									onSelect={(val) => setSelectedAmount(Number(val))}
									placeholder={t("selectAmount")}
									title={t("selectAmount")}
									containerStyle={styles.selectWrapper}
									buttonStyle={styles.selectButton}
									buttonTextStyle={styles.selectButtonText}
								/>
							</View>
						</View>

						<View style={styles.separator} />

						<View style={styles.detailRow}>
							<TranslatedText
								style={styles.detailLabel}
								translationKey="processingFee"
							/>
							<Text style={styles.detailValue}>
								₹ {(offer?.processing_fee ?? 0).toLocaleString("en-IN")}
								{gstLabel ? ` + ${gstLabel}` : ""}
							</Text>
						</View>

						<View style={styles.separator} />

						{/* Due Date Selection */}
						<View style={styles.detailRow}>
							<TranslatedText
								style={styles.detailLabel}
								translationKey="selectDueDate"
							/>
							<View style={styles.selectContainer}>
								<Select
									options={dueDateOptions}
									selectedValue={selectedDueDate || ""}
									onSelect={(val) => setSelectedDueDate(String(val))}
									placeholder={t("select")}
									title={t("selectDueDate")}
									containerStyle={styles.selectWrapper}
									buttonStyle={styles.selectButton}
									buttonTextStyle={styles.selectButtonText}
								/>
							</View>
						</View>

						<View style={styles.separator} />

						<View style={styles.detailRow}>
							<TranslatedText
								style={styles.detailLabel}
								translationKey="tenure"
							/>
							<Text style={styles.detailValue}>{tenure}</Text>
						</View>

						<View style={styles.separator} />

						<View style={styles.detailRow}>
							<TranslatedText
								style={styles.detailLabel}
								translationKey="interestRate"
							/>
							<Text style={styles.detailValue}>{interestRate}</Text>
						</View>

						<View style={styles.separator} />

						<View style={styles.detailRow}>
							<TranslatedText
								style={styles.detailLabel}
								translationKey="netDisbursalAmount"
							/>
							<Text style={styles.detailValue}>
								{netDisbursalAmount > 0
									? formatAmount(netDisbursalAmount)
									: "-"}
							</Text>
						</View>

						<View style={styles.separator} />

						<View style={styles.detailRow}>
							<TranslatedText
								style={styles.detailLabel}
								translationKey="amountToRepay"
							/>
							<Text style={styles.detailValue}>
								{amountToRepay > 0
									? formatAmount(amountToRepay)
									: "-"}
							</Text>
						</View>

						<TouchableOpacity
							style={[
								styles.proceedButton,
								isSubmitting && styles.proceedButtonDisabled,
							]}
							onPress={handleAccept}
							disabled={isSubmitting}>
							{isSubmitting ? (
								<ActivityIndicator size="small" color="#333" />
							) : (
								<View
									style={{
										flexDirection: "row",
										alignItems: "center",
										gap: 8,
									}}>
									<Text style={styles.proceedButtonText}>
										{t("accept")}
									</Text>
									<IconSymbol
										name="arrow.right"
										size={20}
										color={dark}
									/>
								</View>
							)}
						</TouchableOpacity>
					</View>
				</ScrollView>
			</SafeAreaView>

			{/* Rejection Modal */}
			<Modal
				visible={rejectionModalVisible}
				transparent={true}
				animationType="fade">
				<View style={styles.modalOverlay}>
					<View style={styles.rejectionModalContent}>
						<TranslatedText
							style={styles.rejectionTitle}
							translationKey="sorryCouldntApproveLoan"
						/>
						<TranslatedText
							style={styles.rejectionSubtitle}
							translationKey="applicationDidntMeetCriteria"
						/>

						<View style={styles.tipsCard}>
							<View style={styles.tipsHeader}>
								<TranslatedText
									style={styles.tipsHeaderText}
									translationKey="heresHowToBoostChances"
								/>
							</View>

							<View style={styles.tipsList}>
								{/* Tip 1 - Credit Score */}
								<View style={styles.tipItem}>
									<Image
										source={require("@/assets/images/creditscore.png")}
										style={styles.tipIcon}
									/>
									<View style={styles.tipTextContainer}>
										<TranslatedText
											style={styles.tipTitle}
											translationKey="improveCreditScore"
										/>
										<TranslatedText
											style={styles.tipDescription}
											translationKey="buildStrongerCreditScore"
										/>
									</View>
								</View>

								{/* Tip 2 - Reduce Debts */}
								<View style={styles.tipItem}>
									<Image
										source={require("@/assets/images/reducedebts.png")}
										style={styles.tipIcon}
									/>
									<View style={styles.tipTextContainer}>
										<TranslatedText
											style={styles.tipTitle}
											translationKey="reduceExistingDebts"
										/>
										<TranslatedText
											style={styles.tipDescription}
											translationKey="lowerCurrentLiabilities"
										/>
									</View>
								</View>

								{/* Tip 3 - KYC Details */}
								<View style={styles.tipItem}>
									<Image
										source={require("@/assets/images/kycdetails.png")}
										style={styles.tipIcon}
									/>
									<View style={styles.tipTextContainer}>
										<TranslatedText
											style={styles.tipTitle}
											translationKey="updateKycDetails"
										/>
										<TranslatedText
											style={styles.tipDescription}
											translationKey="keepKycUpdated"
										/>
									</View>
								</View>
							</View>
						</View>

						<TranslatedText
							style={styles.tryAgainText}
							translationKey="tryAgainIn30Days"
						/>

						<View style={styles.supportTextContainer}>
							<TranslatedText
								style={styles.supportText}
								translationKey="forAssistanceContact"
							/>
							<TouchableOpacity
								onPress={() =>
									Linking.openURL("mailto:support@rapidmoney.in")
								}>
								<Text
									style={[
										styles.supportText,
										{
											fontWeight: "bold",
											color: "#007AFF",
											textDecorationLine: "underline",
											marginTop: -height(2),
										},
									]}>
									support@rapidmoney.in
								</Text>
							</TouchableOpacity>
						</View>

						<View style={styles.redirectTextContainer}>
							<TranslatedText
								style={styles.redirectText}
								translationKey="redirectingToDashboardNew"
							/>
							<Text style={styles.redirectText}>
								{" "}
								{rejectionCountdown}{" "}
							</Text>
							<TranslatedText
								style={styles.redirectText}
								translationKey="seconds"
							/>
							<Text style={styles.redirectText}>...</Text>
						</View>
					</View>
				</View>
			</Modal>

			<ExitIntentModal
				visible={isExitModalVisible}
				onClose={() => setIsExitModalVisible(false)}
				onConfirmExit={() => {
					setIsExitModalVisible(false);
					router.replace("/(tabs)");
				}}
			/>
		</>
	);
}

const styles = StyleSheet.create({
	scrollContainer: {
		flex: 1,
		backgroundColor: white,
	},
	scrollContentContainer: {
		flexGrow: 1,
		paddingBottom: height(8),
	},
	container: {
		flex: 1,
		backgroundColor: white,
		alignItems: "center",
	},
	bannerContainer: {
		width: "100%",
		alignItems: "center",
		position: "relative",
		zIndex: 10,
	},
	banner: {
		width: width(100),
		height: height(43),
		overflow: "hidden",
		borderBottomLeftRadius: width(10),
		borderBottomRightRadius: width(10),
		backgroundColor: white,
	},
	coin: {
		position: "absolute",
		zIndex: 2,
	},
	rupeeCoin1: {
		top: -height(5),
		left: width(50),
		width: width(15),
		height: height(15),
	},
	rupeeCoin2: {
		top: height(10),
		left: width(3),
		width: width(15),
		height: height(15),
		transform: [{ rotate: "-40deg" }],
	},
	rupeeCoin3: {
		bottom: height(3),
		left: width(3),
		width: width(10),
		height: height(10),
	},
	rupeeCoin4: {
		top: height(20),
		left: width(50),
		width: width(10),
		height: height(10),
		transform: [{ rotate: "40deg" }],
	},
	rupeeCoin5: {
		bottom: height(2),
		right: width(10),
		width: width(10),
		height: height(10),
		transform: [{ rotate: "20deg" }],
	},
	rupeeCoin6: {
		right: width(1),
		top: height(5),
		width: width(30),
		height: height(30),
	},
	backButton: {
		position: "absolute",
		top: height(6),
		left: width(6),
		zIndex: 20,
		padding: 10,
	},
	textContainer: {
		position: "absolute",
		top: height(6),
		alignItems: "center",
		zIndex: 20,
		width: "70%",
	},
	congratsText: {
		fontSize: 28,
		fontWeight: "bold",
		color: "white",
		textAlign: "center",
		marginBottom: height(1.3),
	},
	subText: {
		fontSize: 16,
		color: "white",
		textAlign: "center",
		marginBottom: height(1),
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
		flex: 1,
		width: "100%",
		backgroundColor: white,
	},
	contentContainer: {
		flexGrow: 1,
		paddingBottom: height(3),
	},
	detailsContainer: {
		width: "100%",
		marginBottom: height(2),
	},
	detailRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		minHeight: height(7),
		paddingVertical: height(0.6),
		paddingHorizontal: width(6),
	},
	detailLabel: {
		fontSize: 16,
		color: "#333",
		fontWeight: "500",
		flex: 1,
	},
	detailValue: {
		fontSize: 16,
		color: "#333",
		fontWeight: "600",
		textAlign: "right",
	},
	separator: {
		height: 1,
		backgroundColor: "#E5E5E5",
		width: "100%",
	},
	selectContainer: {
		width: width(35),
	},
	selectWrapper: {
		marginVertical: 0,
	},
	selectButton: {
		paddingHorizontal: 12,
		paddingVertical: 8,
		borderWidth: 1,
		borderColor: "#E5E5E5",
		borderRadius: 6,
		backgroundColor: "#FFFFFF",
		minHeight: 40,
	},
	selectButtonText: {
		fontSize: 14,
		color: "#666",
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
		marginBottom: height(6),
		backgroundColor: "#F0FFF5",
	},
	feeLabel: {
		fontSize: 14,
		fontWeight: "500",
		color: "#333",
	},
	priceContainer: {
		flexDirection: "row",
		alignItems: "center",
		gap: width(2),
	},
	originalPrice: {
		fontSize: 16,
		color: "#999",
		textDecorationLine: "line-through",
	},
	discountedPrice: {
		fontSize: 16,
		fontWeight: "600",
		color: "#4CAF50",
	},
	proceedButton: {
		backgroundColor: "#A4E65E",
		borderRadius: 25,
		paddingVertical: height(2),
		paddingHorizontal: width(8),
		width: "90%",
		alignItems: "center",
		marginHorizontal: width(6),
		marginTop: height(3),
		marginBottom: height(2),
	},
	proceedButtonDisabled: {
		opacity: 0.6,
	},
	proceedButtonText: {
		fontSize: 18,
		fontWeight: "600",
		color: "#333",
	},
	remindLaterButton: {
		backgroundColor: "white",
		borderRadius: 25,
		paddingVertical: height(2),
		paddingHorizontal: width(8),
		width: "90%",
		marginHorizontal: width(6),
		alignItems: "center",
		marginBottom: height(2),
		borderWidth: 1,
		borderColor: "#333",
	},
	remindLaterButtonText: {
		fontSize: 18,
		fontWeight: "600",
		color: "#333",
	},
	modalOverlay: {
		position: "absolute",
		top: -height(10),
		left: 0,
		right: 0,
		bottom: 0,
		width: "100%",
		height: height(110),
		backgroundColor: "rgba(0,0,0,0.08)",
		justifyContent: "center",
		alignItems: "center",
	},
	rejectionModalContent: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		width: "100%",
		height: "100%",
		backgroundColor: "white",
		paddingHorizontal: width(6),
		paddingVertical: height(4),
		alignItems: "center",
		justifyContent: "center",
	},
	rejectionTitle: {
		fontSize: font(2.4),
		fontWeight: "700",
		color: "#333",
		textAlign: "center",
		marginBottom: height(1),
	},
	rejectionSubtitle: {
		fontSize: font(1.6),
		color: "#666",
		textAlign: "center",
		marginBottom: height(3),
		lineHeight: font(2.2),
	},
	tipsCard: {
		backgroundColor: "#ECEBFF",
		borderRadius: width(4),
		width: "100%",
		overflow: "hidden",
		marginBottom: height(3),
	},
	tipsHeader: {
		backgroundColor: "#B7FB52",
		paddingVertical: height(1.2),
		paddingHorizontal: width(4),
		alignItems: "center",
		justifyContent: "center",
		borderRadius: width(5),
		marginHorizontal: width(4),
		marginTop: height(2),
		marginBottom: height(1),
	},
	tipsHeaderText: {
		fontWeight: "600",
		color: "#333",
		fontSize: font(1.5),
	},
	tipsList: {
		padding: width(4),
		gap: height(2.5),
	},
	tipItem: {
		flexDirection: "row",
		alignItems: "flex-start",
		gap: width(3),
	},
	tipIcon: {
		width: width(6),
		height: width(6),
	},
	tipTextContainer: {
		flex: 1,
	},
	tipTitle: {
		fontSize: font(1.6),
		fontWeight: "600",
		color: "#333",
		marginBottom: height(0.5),
	},
	tipDescription: {
		fontSize: font(1.4),
		color: "#666",
		lineHeight: font(1.8),
	},
	tryAgainText: {
		fontSize: font(1.8),
		fontWeight: "700",
		color: "#333",
		textAlign: "center",
		marginBottom: height(2),
	},
	supportText: {
		fontSize: font(1.4),
		color: "#666",
		textAlign: "center",
		marginBottom: height(3),
		lineHeight: font(2),
	},
	redirectText: {
		fontSize: font(1.4),
		color: "#999",
		textAlign: "center",
		fontStyle: "italic",
	},
	supportTextContainer: {
		flexDirection: "column",
		alignItems: "center",
	},
	redirectTextContainer: {
		flexDirection: "row",
		justifyContent: "center",
		alignItems: "center",
		flexWrap: "wrap",
	},
});
