import { TranslatedText } from "@/components/TranslatedText";
import { IconSymbol } from "@/components/ui/IconSymbol";
import { dark, primary, white } from "@/constants/Colors";
import { Images } from "@/constants/images";
import { useJourneyTracker } from "@/hooks/useJourneyTracker";
import { useTranslation } from "@/hooks/useTranslation";
import { setApplicationComplete, useDispatch } from "@/store";
import { trackDisbursement } from "@/utils/analytics";
import { getMandateStatus, getUserDashboardData } from "@/utils/api";
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
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from "react-native";

const COINS_GROUPED = Images.COINS_GROUPED;
const GREEN_CHECKMARK = Images.GREEN_CHECKMARK;

const normalizeMandateStatus = (s?: string | null): string =>
	String(s ?? "").trim().toLowerCase().replace(/[^a-z]/g, "");

const isSuccessStatus = (s?: string | null): boolean => {
	if (!s) return false;
	const lower = normalizeMandateStatus(s);
	return ["true", "success", "successful", "authorized", "authorised", "completed", "complete", "active", "activated"].includes(lower);
};

const isFailureStatus = (s?: string | null): boolean => {
	if (!s) return false;
	const lower = String(s).trim().toLowerCase();
	return ["false", "failure", "failed", "usercancelled", "usercanceled", "dropped", "bounced"].includes(lower);
};

export default function LoanCongratulations() {
	useJourneyTracker("/loan-congratulations");
	const router = useRouter();
	const navigation = useNavigation();
	const { t } = useTranslation();
	const dispatch = useDispatch();

	const [status, setStatus] = useState<"success" | "failure" | "in_progress" | null>(null);
	const [apiMessage, setApiMessage] = useState<string | null>(null);
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
				processedRef.current = true;
				if (isSuccessStatus(paramStatus)) {
					setStatus("success");
				} else if (isFailureStatus(paramStatus)) {
					setStatus("failure");
				} else {
					await checkMandateStatus(undefined, paramStatus);
				}
			} else {
				// No params: verify mandate status with server
				await checkMandateStatus();
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
						if (isSuccessStatus(parsedStatus)) {
							setStatus("success");
						} else if (isFailureStatus(parsedStatus)) {
							setStatus("failure");
						} else {
							await checkMandateStatus(undefined, parsedStatus);
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
					if (isSuccessStatus(parsedStatus)) {
						setStatus("success");
					} else if (isFailureStatus(parsedStatus)) {
						setStatus("failure");
					} else {
						await checkMandateStatus(undefined, parsedStatus);
					}
				}
			} catch (error) {
				console.error("❌ [LoanCongrats] Error processing deep link");
				setStatus("failure");
			}
		};

		processDeepLink();
	}, [urlHook]);

	const checkMandateStatus = async (txnId?: string, clientStatus?: string) => {
		if (verifiedTxnIdRef.current) {
			return;
		}

		// 1. Client status confirmed success (e.g. status=true or status=success)
		if (isSuccessStatus(clientStatus)) {
			console.log("✅ [LoanCongrats] Client indicated mandate success:", clientStatus);
			verifiedTxnIdRef.current = txnId || "confirmed";
			setStatus("success");
			trackDisbursement(txnId || "").catch(() => {});
			return;
		}

		// 2. Client status confirmed failure
		if (isFailureStatus(clientStatus)) {
			console.log("❌ [LoanCongrats] Client indicated mandate failure:", clientStatus);
			setStatus("failure");
			return;
		}

		// 3. Verify against backend mandate status endpoint
		try {
			console.log("🔍 [LoanCongrats] Checking mandate status with server");
			const response = await getMandateStatus(txnId || undefined);
			const data = response?.data;

			if (data) {
				const rawStatus = normalizeMandateStatus(data?.status);
				if (isSuccessStatus(rawStatus)) {
					console.log("✅ [LoanCongrats] Server confirmed mandate is active/authorized");
					verifiedTxnIdRef.current = txnId || data.txnid || "confirmed";
					setStatus("success");
					trackDisbursement(txnId || data.txnid || "").catch(() => {});
					return;
				}

				if (isFailureStatus(rawStatus)) {
					console.log("❌ [LoanCongrats] Server confirmed mandate failure");
					setStatus("failure");
					return;
				}

				if ((data as any)?.is_complete === true) {
					console.log("✅ [LoanCongrats] Backend confirmed mandate completion");
					verifiedTxnIdRef.current = txnId || data.txnid || "confirmed";
					setStatus("success");
					trackDisbursement(txnId || data.txnid || "").catch(() => {});
					return;
				}

				if (
					["pending", "initiated", "preinitiated", "inprogress", "inprocess", "processing", "awaiting"].includes(rawStatus) ||
					data?.is_active === true
				) {
					setApiMessage(t("mandateRegistrationInProgressDesc"));
					setStatus("in_progress");
					return;
				}
			}
		} catch (error) {
			console.error("❌ [LoanCongrats] Error checking mandate status with server", error);
		}

		// 4. Fallback check: verify user dashboard workflow progress
		try {
			const dashboard: any = await getUserDashboardData();
			const currentStep = String(
				dashboard?.workflow_progress?.current_step || dashboard?.current_step || "",
			).toLowerCase().trim();
			if (currentStep === "pdq_check") {
				setApiMessage(t("mandateRegistrationInProgressDesc"));
				setStatus("in_progress");
				return;
			}
			if (currentStep && currentStep !== "enach_mandate" && currentStep !== "auto_debit_setup") {
				console.log("✅ [LoanCongrats] Workflow step moved past mandate:", currentStep);
				verifiedTxnIdRef.current = txnId || "confirmed";
				setStatus("success");
				return;
			}
		} catch {
			// ignore
		}

		// Default to failure only if all checks are exhausted
		setStatus("failure");
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
		dispatch(setApplicationComplete(true));
		allowNavigationRef.current = true;
		router.replace("/(tabs)");
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

	if (status === "in_progress") {
		return (
			<View style={styles.failureContainer}>
				<View style={styles.failureContent}>
					<ActivityIndicator size="large" color="#15803d" />
					<Text style={styles.failureTitle}>{t("mandateRegistrationInProgress")}</Text>
					<Text style={styles.failureSubtitle}>
						{apiMessage || t("mandateRegistrationInProgressDesc")}
					</Text>
					<TouchableOpacity
						style={styles.retryButton}
						onPress={() => {
							setStatus(null);
						setApiMessage(null);
						const txnid = typeof params?.txnid === "string" ? params.txnid : undefined;
						void checkMandateStatus(txnid);
						}}>
						<Text style={styles.retryButtonText}>{t("checkAgain")}</Text>
					</TouchableOpacity>
					<TouchableOpacity style={styles.dashboardButton} onPress={handleBackToDashboard}>
						<Text style={styles.dashboardButtonText}>{t("goToDashboard")}</Text>
					</TouchableOpacity>
				</View>
			</View>
		);
	}

	if (status === null) {
		return (
			<View style={styles.failureContainer}>
				<View style={styles.failureContent}>
					<ActivityIndicator size="large" color="#15803d" />
					<Text style={styles.failureSubtitle}>{t("mandateVerifyingSubtitle")}</Text>
				</View>
			</View>
		);
	}

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

});
