import { TranslatedText } from "@/components/TranslatedText";
import { IconSymbol } from "@/components/ui/IconSymbol";
import { dark, primary, white } from "@/constants/Colors";
import { Images } from "@/constants/images";
import { useJourneyTracker } from "@/hooks/useJourneyTracker";
import { useTranslation } from "@/hooks/useTranslation";
import { setApplicationComplete, useDispatch } from "@/store";
import { trackDisbursement } from "@/utils/analytics";
import { axios, URLS } from "@/utils/api";
import { font, height, width } from "@/utils/dimensions";
import { encode } from "@/utils/encode_decode";
import { clearLastVisitedScreen } from "@/utils/journey-tracker";
import { setStorageItem, STORAGE_KEYS } from "@/utils/storage";
import { Image } from "expo-image";
import * as Linking from "expo-linking";
import { Stack, useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
	ActivityIndicator,
	BackHandler,
	Modal,
	StyleSheet,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from "react-native";

const COINS_GROUPED = Images.COINS_GROUPED;
const GREEN_CHECKMARK = Images.GREEN_CHECKMARK;

export default function LoanCongratulations() {
	useJourneyTracker("/loan-congratulations");
	const router = useRouter();
	const navigation = useNavigation();
	const { t } = useTranslation();
	const dispatch = useDispatch();

	const [modalVisible, setModalVisible] = useState(false);
	const [rating, setRating] = useState(0);
	const [feedback, setFeedback] = useState("");
	const [status, setStatus] = useState<"success" | "failure" | null>(null);
	const [apiMessage, setApiMessage] = useState<string | null>(null);
	const [redirectModalVisible, setRedirectModalVisible] = useState(false);
	const [redirectCountdown, setRedirectCountdown] = useState(15);
	const [showFinalScreen, setShowFinalScreen] = useState(false);

	const urlHook = Linking.useLinkingURL();
	const params = useLocalSearchParams();
	const processedRef = useRef(false);
	const verifiedTxnIdRef = useRef<string | null>(null); // Lock to prevent race conditions
	const allowNavigationRef = useRef(false); // Flag to allow programmatic navigation
	const hasResetRef = useRef(false);

	useEffect(() => {
		if (status && !hasResetRef.current) {
			hasResetRef.current = true;
			(navigation as any).reset({
				index: 0,
				routes: [{ name: "loan-congratulations", params }],
			});
		}
	}, [status, navigation, params]);

	// Clear journey tracker when user reaches final success screen
	useEffect(() => {
		clearLastVisitedScreen();
	}, []);

	// Check for params passed from navigation
	useEffect(() => {
		const checkParams = async () => {
			if (verifiedTxnIdRef.current) return;

			if (params?.txnid) {
				const txnid = params.txnid as string;
				processedRef.current = true;
				await checkMandateStatus(txnid, params.status as string);
			} else if (params?.status) {
				const paramStatus = params.status as string;
				if (paramStatus === "failure") {
					setStatus("failure");
				} else if (paramStatus === "success") {
					setStatus("success");
				} else {
					setStatus("failure");
				}
				processedRef.current = true;
			}
		};

		checkParams();
	}, [params]);

	// Check initial URL deep link
	useEffect(() => {
		const parseInitialUrl = async () => {
			if (verifiedTxnIdRef.current || processedRef.current) {
				return;
			}

			const initialUrl = await Linking.getInitialURL();
			if (initialUrl) {
				try {
					const parsed = Linking.parse(initialUrl);
					console.log("🔗 [LoanCongrats] Processing initial deep link");

					if (parsed?.queryParams?.txnid) {
						processedRef.current = true;
						await checkMandateStatus(
							parsed.queryParams.txnid as string,
							parsed.queryParams.status as string,
						);
					} else if (parsed?.queryParams?.status) {
						processedRef.current = true;
						const parsedStatus = parsed.queryParams.status as string;
						if (parsedStatus === "success") {
							setStatus("success");
						} else {
							setStatus("failure");
						}
					}
				} catch (error) {
					console.error("❌ [LoanCongrats] Error processing initial URL");
					setStatus("failure");
				}
			}
		};

		parseInitialUrl();
	}, []);

	// Listen for live deep link events
	useEffect(() => {
		if (!urlHook || processedRef.current) {
			return;
		}

		const processDeepLink = async () => {
			try {
				if (verifiedTxnIdRef.current) return;

				const parsed = Linking.parse(urlHook);
				console.log("🔗 [LoanCongrats] Processing incoming deep link");

				if (parsed?.queryParams?.txnid) {
					processedRef.current = true;
					await checkMandateStatus(
						parsed.queryParams.txnid as string,
						parsed.queryParams.status as string,
					);
				} else if (parsed?.queryParams?.status) {
					processedRef.current = true;
					const parsedStatus = parsed.queryParams.status as string;
					if (parsedStatus === "success") {
						setStatus("success");
					} else {
						setStatus("failure");
					}
				}
			} catch (error) {
				console.error("❌ [LoanCongrats] Error processing deep link");
				setStatus("failure");
			}
		};

		processDeepLink();
	}, [urlHook]);

	const checkMandateStatus = async (txnId: string, clientStatus?: string) => {
		if (verifiedTxnIdRef.current) {
			return;
		}

		let apiVerifiedSuccess = false;

		try {
			console.log("🔍 [LoanCongrats] Checking mandate status with server");
			const response = await axios.get(URLS.autocollect.check_mandate(txnId));

			if (response.data) {
				const msg = response.data.message;
				if (msg) {
					setApiMessage(msg);
				}

				if (response.data.status === "success" || response.data.success === true) {
					apiVerifiedSuccess = true;
				} else if (response.data.status === "failure") {
					apiVerifiedSuccess = false;
				}
			}
		} catch (error) {
			console.error("❌ [LoanCongrats] Error checking mandate status side-effect");
		}

		// Fail-safe logic: clientStatus must be success AND not flagged as API failure
		if (clientStatus === "success") {
			console.log("✅ [LoanCongrats] Mandate verification successful");
			verifiedTxnIdRef.current = txnId;
			setStatus("success");

			// Analytics: Disbursement tracking
			trackDisbursement(txnId).catch(() => {});
		} else if (clientStatus === "failure") {
			console.log("❌ [LoanCongrats] Mandate status reported failure");
			setStatus("failure");
		} else if (apiVerifiedSuccess) {
			console.log("✅ [LoanCongrats] Server confirmed mandate success");
			verifiedTxnIdRef.current = txnId;
			setStatus("success");
			trackDisbursement(txnId).catch(() => {});
		} else {
			console.log("⚠️ [LoanCongrats] No success status confirmed. Defaulting to failure.");
			setStatus("failure");
		}
	};

	// Back handler and gesture navigation lock
	useEffect(() => {
		navigation.setOptions({
			gestureEnabled: false,
			headerLeft: () => null,
		});

		const unsubscribe = navigation.addListener("beforeRemove", (e) => {
			if (!allowNavigationRef.current) {
				e.preventDefault();
			}
		});

		const backHandler = BackHandler.addEventListener("hardwareBackPress", () => {
			return true;
		});

		return () => {
			unsubscribe();
			backHandler.remove();
		};
	}, [navigation]);

	const handleOkGreat = async () => {
		const date = new Date();
		date.setMonth(date.getMonth() + 6);
		date.setDate(10);

		const formattedDate = date.toLocaleDateString("en-GB", {
			day: "2-digit",
			month: "long",
			year: "numeric",
		});

		await setStorageItem(STORAGE_KEYS["@completion-date"], encode(formattedDate));
		setModalVisible(true);
		dispatch(setApplicationComplete(true));
	};

	const handleStarPress = (starIndex: number) => {
		setRating(starIndex + 1);
	};

	const handleSubmit = () => {
		console.log("📝 [LoanCongrats] Feedback submitted, rating:", rating);
		setModalVisible(false);
		setRedirectModalVisible(true);
	};

	useEffect(() => {
		let interval: ReturnType<typeof setInterval>;
		if (redirectModalVisible) {
			interval = setInterval(() => {
				setRedirectCountdown((prev) => {
					if (prev <= 1) {
						clearInterval(interval);
						allowNavigationRef.current = true;
						router.push("/(tabs)");
						return 0;
					}
					return prev - 1;
				});
			}, 1000);
		}
		return () => {
			if (interval) clearInterval(interval);
		};
	}, [redirectModalVisible, router]);

	const handleCloseModal = () => {
		setModalVisible(false);
		allowNavigationRef.current = true;
		router.push("/(tabs)");
	};

	const handleRetryMandate = () => {
		allowNavigationRef.current = true;
		router.replace("/auto-debit-setup");
	};

	const handleBackToDashboard = () => {
		allowNavigationRef.current = true;
		router.replace("/(tabs)");
	};

	const handleContinue = () => {
		setShowFinalScreen(true);
	};

	if (status === "failure") {
		return (
			<View style={styles.failureContainer}>
				<View style={styles.failureContent}>
					<View style={styles.failureCircle}>
						<Text style={styles.failureCross}>✕</Text>
					</View>
					<Text style={styles.failureTitle}>{t("mandateFailed")}</Text>
					{apiMessage ? (
						<Text style={styles.failureSubtitle}>
							{apiMessage === "Mandate setup failed. Please try again."
								? t("mandateSetupFailed")
								: apiMessage}
						</Text>
					) : (
						<Text style={styles.failureSubtitle}>{t("mandateFailedDescription")}</Text>
					)}

					<TouchableOpacity style={styles.retryButton} onPress={handleRetryMandate}>
						<View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
							<Text style={styles.retryButtonText}>{t("retryMandate")}</Text>
							<IconSymbol name="arrow.right" size={20} color={dark} />
						</View>
					</TouchableOpacity>

					<TouchableOpacity style={styles.dashboardButton} onPress={handleBackToDashboard}>
						<Text style={styles.dashboardButtonText}>{t("backToDashboard")}</Text>
					</TouchableOpacity>
				</View>
			</View>
		);
	}

	if (status === "success" && !showFinalScreen) {
		return (
			<View style={styles.failureContainer}>
				<View style={styles.failureContent}>
					<View style={[styles.failureCircle, { backgroundColor: "#DCFCE7" }]}>
						<Text style={[styles.failureCross, { color: "#16A34A" }]}>✓</Text>
					</View>
					<Text style={styles.failureTitle}>{t("mandateSuccessful")}</Text>
					{apiMessage ? (
						<Text style={styles.failureSubtitle}>
							{apiMessage === "Mandate setup in progress. Please wait..."
								? t("mandateSetupInProgress")
								: apiMessage === "Auto-debit setup successful! Your mandate is now active."
								? t("mandateSetupSuccessful")
								: apiMessage}
						</Text>
					) : (
						<Text style={styles.failureSubtitle}>{t("mandateVerificationSuccessful")}</Text>
					)}

					<TouchableOpacity style={styles.retryButton} onPress={handleContinue}>
						<View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
							<Text style={styles.retryButtonText}>{t("continue")}</Text>
							<IconSymbol name="arrow.right" size={20} color={dark} />
						</View>
					</TouchableOpacity>
				</View>
			</View>
		);
	}

	return (
		<>
			<Stack.Screen options={{ headerShown: false }} />
			<View style={styles.container}>
				{/* Coins Background with Centered Checkmark */}
				<View style={styles.imageContainer}>
					<Image source={COINS_GROUPED} style={styles.coinsImage} contentFit="contain" />
					<Image
						source={GREEN_CHECKMARK}
						style={styles.checkmarkImage}
						contentFit="contain"
					/>
				</View>

				<View style={styles.content}>
					<TranslatedText
						style={styles.congratulationsText}
						translationKey="congratulationsExclamation"
					/>
					<TranslatedText
						style={styles.descriptionText}
						translationKey="loanAmountCreditedMessage"
					/>
				</View>

				{/* Bottom Button */}
				<View style={styles.bottomContainer}>
					<TouchableOpacity style={styles.okButton} onPress={handleOkGreat}>
						<View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
							<TranslatedText style={styles.okButtonText} translationKey="okGreat" />
							<IconSymbol name="arrow.right" size={20} color="#000000" />
						</View>
					</TouchableOpacity>
				</View>

				{/* Review & Feedback Modal */}
				<Modal
					visible={modalVisible}
					transparent={true}
					animationType="slide"
					onRequestClose={handleCloseModal}>
					<TouchableOpacity
						style={styles.modalOverlay}
						activeOpacity={1}
						onPress={handleCloseModal}>
						<TouchableOpacity
							style={styles.modalContent}
							activeOpacity={1}
							onPress={(e) => e.stopPropagation()}>
							{/* Modal Header Line */}
							<View style={styles.modalHeaderLine} />

							{/* Title */}
							<TranslatedText
								style={styles.modalTitle}
								translationKey="reviewFeedback"
							/>

							{/* Rating Section */}
							<TranslatedText
								style={styles.ratingQuestion}
								translationKey="howWouldYouRate"
							/>
							<View style={styles.starsContainer}>
								{[...Array(5)].map((_, index) => (
									<TouchableOpacity
										key={index}
										onPress={() => handleStarPress(index)}
										style={styles.starButton}>
										<Text
											style={[
												styles.star,
												index < rating
													? styles.filledStar
													: styles.emptyStar,
											]}>
											★
										</Text>
									</TouchableOpacity>
								))}
							</View>

							{/* Feedback Section */}
							<TranslatedText
								style={styles.feedbackLabel}
								translationKey="tellUsWhatYourLoansAbout"
							/>

							{/* Text Input */}
							<TextInput
								style={styles.feedbackInput}
								placeholder={t("enterFeedback")}
								placeholderTextColor="#999"
								multiline={true}
								numberOfLines={4}
								value={feedback}
								onChangeText={setFeedback}
								textAlignVertical="top"
							/>

							{/* Submit Button */}
							<TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
								<View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
									<TranslatedText
										style={styles.submitButtonText}
										translationKey="submit"
									/>
									<IconSymbol name="arrow.right" size={20} color="#000000" />
								</View>
							</TouchableOpacity>
						</TouchableOpacity>
					</TouchableOpacity>
				</Modal>

				{/* Redirect Modal */}
				<Modal
					visible={redirectModalVisible}
					transparent={true}
					animationType="fade"
					onRequestClose={() => {}}>
					<View style={styles.redirectModalOverlay}>
						<View style={styles.redirectModalContent}>
							<ActivityIndicator size="large" color="#000000" style={styles.loader} />
							<TranslatedText
								style={styles.redirectText}
								translationKey="redirectingToDashboardIn"
								values={{ seconds: redirectCountdown.toString() }}
							/>
						</View>
					</View>
				</Modal>
			</View>
		</>
	);
}

export { RouteErrorBoundary as ErrorBoundary } from "@/components/ErrorBoundary";

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#000000",
		justifyContent: "space-between",
		alignItems: "center",
		paddingBottom: height(8),
	},
	imageContainer: {
		position: "relative",
		alignItems: "center",
		justifyContent: "center",
	},
	coinsImage: {
		width: width(100),
		height: height(50),
	},
	checkmarkImage: {
		position: "absolute",
		width: width(45),
		height: width(45),
		top: "50%",
		left: "50%",
		transform: [{ translateX: -width(20) }, { translateY: -width(20) }],
	},
	contentAmount: {
		justifyContent: "center",
		alignItems: "center",
		paddingHorizontal: width(6),
		marginTop: -height(40),
	},
	content: {
		justifyContent: "center",
		alignItems: "center",
		paddingHorizontal: width(6),
		marginTop: -height(25),
	},
	congratulationsText: {
		fontSize: 28,
		fontWeight: "bold",
		color: "white",
		textAlign: "center",
		marginBottom: height(3),
	},
	descriptionText: {
		fontSize: 14,
		color: "white",
		textAlign: "center",
		lineHeight: 20,
		opacity: 0.8,
	},
	bottomContainer: {
		width: "100%",
		paddingHorizontal: width(6),
	},
	okButton: {
		backgroundColor: "#A4E65E",
		borderRadius: 25,
		paddingVertical: height(2),
		alignItems: "center",
		width: "100%",
	},
	okButtonText: {
		fontSize: 18,
		fontWeight: "600",
		color: "#000000",
	},
	modalOverlay: {
		flex: 1,
		backgroundColor: "rgba(0, 0, 0, 0.5)",
		justifyContent: "flex-end",
	},
	modalContent: {
		backgroundColor: "white",
		borderTopLeftRadius: 20,
		borderTopRightRadius: 20,
		paddingHorizontal: width(6),
		paddingTop: height(2),
		paddingBottom: height(4),
		minHeight: height(60),
	},
	modalHeaderLine: {
		width: width(12),
		height: 4,
		backgroundColor: "#E0E0E0",
		borderRadius: 2,
		alignSelf: "center",
		marginBottom: height(3),
	},
	modalTitle: {
		fontSize: 20,
		fontWeight: "600",
		color: "#333",
		textAlign: "center",
		marginBottom: height(4),
	},
	ratingQuestion: {
		fontSize: 16,
		color: "#333",
		marginBottom: height(2),
	},
	starsContainer: {
		flexDirection: "row",
		marginBottom: height(4),
	},
	starButton: {
		marginRight: width(2),
	},
	star: {
		fontSize: 32,
	},
	emptyStar: {
		color: "#E0E0E0",
	},
	filledStar: {
		color: "#FFD700",
	},
	feedbackLabel: {
		fontSize: 14,
		color: "#333",
		marginBottom: height(2),
		lineHeight: 20,
	},
	feedbackInput: {
		borderWidth: 1,
		borderColor: "#E0E0E0",
		borderRadius: 8,
		padding: width(4),
		fontSize: 14,
		color: "#333",
		minHeight: height(12),
		marginBottom: height(4),
	},
	submitButton: {
		backgroundColor: "#A4E65E",
		borderRadius: 25,
		paddingVertical: height(2),
		alignItems: "center",
		width: "100%",
	},
	submitButtonText: {
		fontSize: 18,
		fontWeight: "600",
		color: "#000000",
	},
	failureContainer: {
		flex: 1,
		backgroundColor: white,
		justifyContent: "center",
		alignItems: "center",
		paddingHorizontal: width(6),
	},
	failureContent: {
		width: "100%",
		alignItems: "center",
	},
	failureCircle: {
		width: width(20),
		height: width(20),
		borderRadius: width(10),
		backgroundColor: "#FEE2E2",
		alignItems: "center",
		justifyContent: "center",
		marginBottom: height(3),
	},
	failureCross: {
		color: "#EF4444",
		fontSize: width(10),
		lineHeight: width(10),
		textAlign: "center",
		fontWeight: "bold",
	},
	failureTitle: {
		fontSize: font(2.2),
		fontWeight: "700",
		color: dark,
		textAlign: "center",
		marginBottom: height(1),
	},
	failureSubtitle: {
		fontSize: font(1.8),
		color: "#6B7280",
		textAlign: "center",
		marginBottom: height(5),
	},
	retryButton: {
		backgroundColor: primary,
		paddingVertical: height(2.5),
		paddingHorizontal: width(8),
		borderRadius: width(3),
		width: "100%",
		alignItems: "center",
		justifyContent: "center",
		marginBottom: height(2),
	},
	retryButtonText: {
		color: dark,
		fontSize: font(1.9),
		fontWeight: "600",
	},
	dashboardButton: {
		backgroundColor: "#E5E7EB",
		paddingVertical: height(2.5),
		paddingHorizontal: width(8),
		borderRadius: width(3),
		width: "100%",
		alignItems: "center",
		justifyContent: "center",
	},
	dashboardButtonText: {
		color: dark,
		fontSize: font(1.9),
		fontWeight: "600",
	},
	redirectModalOverlay: {
		flex: 1,
		backgroundColor: "rgba(0, 0, 0, 0.7)",
		justifyContent: "center",
		alignItems: "center",
	},
	redirectModalContent: {
		backgroundColor: "white",
		borderRadius: 16,
		padding: width(8),
		alignItems: "center",
		width: width(85),
		elevation: 5,
		shadowColor: "#000",
		shadowOffset: {
			width: 0,
			height: 2,
		},
		shadowOpacity: 0.25,
		shadowRadius: 3.84,
	},
	loader: {
		marginBottom: height(3),
		transform: [{ scale: 1.5 }],
	},
	redirectText: {
		fontSize: 18,
		fontWeight: "600",
		color: "#000",
		textAlign: "center",
		lineHeight: 26,
	},
});
