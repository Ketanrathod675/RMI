import { getFriendlyError } from "@/utils/api/core/friendlyError";
import { TranslatedText } from "@/components/TranslatedText";
import { dark, primary, white } from "@/constants/Colors";
import { useJourneyTracker } from "@/hooks/useJourneyTracker";
import { useTranslation } from "@/hooks/useTranslation";
import { initDigilocker } from "@/utils/api";
import {
	cancelDigilockerChecks,
	clearDigilockerSession,
	finishDigilocker,
	loadDigilockerSession,
	saveDigilockerSession,
	type DigilockerFinishResult,
} from "@/utils/digilocker";
import { font, height, width } from "@/utils/dimensions";
import Logger from "@/utils/logger";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import * as Linking from "expo-linking";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useEffect, useRef, useState } from "react";
import {
	ActivityIndicator,
	AppState,
	BackHandler,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

export default function DigilockerKyc() {
	const { t } = useTranslation();
	const router = useRouter();
	const params = useLocalSearchParams<{ showPending?: string; autoStart?: string }>();
	const queryClient = useQueryClient();
	useJourneyTracker("/digilocker-kyc");

	const [isLoading, setIsLoading] = useState(false);
	const [isCheckingStatus, setIsCheckingStatus] = useState(false);
	const [isStartingSession, setIsStartingSession] = useState(false);
	const [isVerifying, setIsVerifying] = useState(false);
	const [devTxnId, setDevTxnId] = useState<string | null>(null);
	const [showPendingCard, setShowPendingCard] = useState(false);
	const [statusInfo, setStatusInfo] = useState<DigilockerFinishResult | null>(null);
	const [pendingTxnId, setPendingTxnId] = useState<string | null>(null);

	const appStateRef = useRef(AppState.currentState);
	const hasCheckedActiveRef = useRef(false);
	const isFinishingRef = useRef(false);
	const autoRestartCountRef = useRef(0);
	const isMounted = useRef(true);
	const startLockRef = useRef(false);
	const hasAutoStartedRef = useRef(false);
	const browserFlowStartedInThisMountRef = useRef(false);

	const isBusy = isLoading || isCheckingStatus || isStartingSession || isVerifying;

	useEffect(() => {
		isMounted.current = true;
		return () => {
			isMounted.current = false;
			hasCheckedActiveRef.current = false;
		};
	}, []);

	useEffect(() => {
		const backHandler = BackHandler.addEventListener("hardwareBackPress", () => {
			router.replace("/(tabs)");
			return true;
		});
		return () => backHandler.remove();
	}, [router]);

	const proceedToSelfie = () => {
		queryClient.invalidateQueries({ queryKey: ["user", "dashboard"] });
		router.replace({
			pathname: "/ckyc-instructions",
			params: { startSelfie: "true", fromDigilocker: "true" },
		});
	};

	const attemptFinish = async (
		txnId: string,
		options?: { silent?: boolean; mode?: "single" | "poll" },
	): Promise<DigilockerFinishResult> => {
		if (isFinishingRef.current) return { status: "pending" };
		isFinishingRef.current = true;
		if (!options?.silent) {
			setIsVerifying(true);
		}
		try {
			const result = await finishDigilocker(txnId, options);
			if (!isMounted.current) return result;

			setStatusInfo(result);

			if (result.status === "done") {
				proceedToSelfie();
				return result;
			}

			if (result.status === "restart") {
				setPendingTxnId(null);
				await clearDigilockerSession();
				if (startLockRef.current) {
					return result;
				}
				if (autoRestartCountRef.current < 1) {
					autoRestartCountRef.current += 1;
					Toast.show({
						type: "info",
						text1: t("alert", "Alert"),
						text2: result.message || "DigiLocker session expired. Starting a new session...",
					});
					setTimeout(() => {
						if (isMounted.current) {
							handleStartDigilocker();
						}
					}, 1500);
					return result;
				}
			}

			setShowPendingCard(true);
			return result;
		} finally {
			isFinishingRef.current = false;
			if (isMounted.current) {
				setIsVerifying(false);
			}
		}
	};

	// Mount effect: check if a fresh stored session exists (no cold-start auto-finish)
	useEffect(() => {
		let isCurrent = true;
		(async () => {
			const session = await loadDigilockerSession();
			if (!isCurrent) return;
			if (session) {
				setPendingTxnId(session.txnId);
				setShowPendingCard(true);
			} else {
				setShowPendingCard(false);
				setPendingTxnId(null);
			}
		})();
		return () => {
			isCurrent = false;
		};
	}, []);

	// Handle initial route params if arriving from deep link redirect
	useEffect(() => {
		if (params.showPending === "true") {
			setShowPendingCard(true);
			setStatusInfo({
				status: "pending",
				message: t(
					"digilockerStillWaiting",
					"We're still waiting for DigiLocker to confirm. If you finished it, tap Check status in a few seconds.",
				),
			});
		}
		if (params.autoStart === "true" && !hasAutoStartedRef.current) {
			hasAutoStartedRef.current = true;
			handleStartDigilocker();
		}
	}, [params.showPending, params.autoStart]);

	// AppState listener: only do a single check if the session is fresh AND the browser flow was actually started in this mount
	useEffect(() => {
		const subscription = AppState.addEventListener("change", async (nextAppState) => {
			if (nextAppState.match(/inactive|background/)) {
				hasCheckedActiveRef.current = false;
			}
			if (
				appStateRef.current?.match(/inactive|background/) &&
				nextAppState === "active"
			) {
				if (!hasCheckedActiveRef.current && browserFlowStartedInThisMountRef.current && !isBusy) {
					const session = await loadDigilockerSession();
					if (session) {
						hasCheckedActiveRef.current = true;
						await attemptFinish(session.txnId, { silent: true, mode: "single" });
					}
				}
			}
			appStateRef.current = nextAppState;
		});

		return () => {
			subscription.remove();
		};
	}, [isBusy]);

	const handleStartDigilocker = async () => {
		if (startLockRef.current) return;
		startLockRef.current = true;

		cancelDigilockerChecks();
		await clearDigilockerSession();
		setPendingTxnId(null);

		autoRestartCountRef.current = 0;
		setIsStartingSession(true);
		setIsLoading(true);
		setShowPendingCard(false);
		hasCheckedActiveRef.current = false;

		try {
			const appReturnUrl = Linking.createURL("aadhaar-kyc-redirect");
			Logger.info("Initiating DigiLocker KYC flow");

			const res = await initDigilocker({
				redirect_url: appReturnUrl,
				client_type: "app",
				force_new: true,
			});

			if (!res.success || !res.data?.txn_id) {
				Toast.show({
					type: "error",
					text1: t("alert", "Alert"),
					text2: res.message || "We couldn't confirm DigiLocker yet. You can try again.",
				});
				setIsLoading(false);
				setIsStartingSession(false);
				return;
			}

			const txnId = res.data.txn_id;
			setPendingTxnId(txnId);
			await saveDigilockerSession(txnId);
			if (__DEV__) {
				setDevTxnId(txnId);
			}

			const authUrl = res.data.authorize_url;
			if (!authUrl) {
				Toast.show({
					type: "error",
					text1: t("alert", "Alert"),
					text2: "Authorization URL not provided",
				});
				setIsLoading(false);
				setIsStartingSession(false);
				return;
			}

			browserFlowStartedInThisMountRef.current = true;

			// Open web authentication session
			const authResult = await WebBrowser.openAuthSessionAsync(authUrl, appReturnUrl);
			Logger.info("DigiLocker: auth session result", { type: authResult.type });

			if (authResult.type === "success") {
				if (authResult.url) {
					try {
						const { queryParams } = Linking.parse(authResult.url);
						if (queryParams) {
							const urlTxn = (queryParams.txn_id || (queryParams as any).txnId || (queryParams as any).transaction_id) as string | undefined;
							const hasTxnKey = Boolean(urlTxn);
							const matchesPrefix =
								hasTxnKey && typeof urlTxn === "string"
									? urlTxn.slice(0, 6) === txnId.slice(0, 6)
									: false;
							Logger.info("DigiLocker auth redirect URL inspected", { hasTxnKey, matchesPrefix });
						}
					} catch (e) {
						Logger.warn("Failed to parse authResult.url", e);
					}
				}
				await attemptFinish(txnId, { mode: "poll" });
			} else if (
				authResult.type === "cancel" ||
				authResult.type === "dismiss" ||
				authResult.type === "locked"
			) {
				// User closed the tab; do a single check, and if pending, show "Did you finish?" card
				const resSingle = await attemptFinish(txnId, { mode: "single" });
				if (resSingle.status === "pending") {
					setShowPendingCard(true);
				}
			}
		} catch (error: any) {
			Logger.error("Failed to initialize DigiLocker:", error);
			Toast.show({
				type: "error",
				text1: t("alert", "Alert"),
				text2: getFriendlyError(error).message || "We couldn't confirm DigiLocker yet. You can try again.",
			});
		} finally {
			startLockRef.current = false;
			if (isMounted.current) {
				setIsLoading(false);
				setIsStartingSession(false);
			}
		}
	};

	const handleCheckStatus = async () => {
		const session = await loadDigilockerSession();
		const txnId = session?.txnId || pendingTxnId;
		if (!txnId) {
			Toast.show({
				type: "info",
				text1: t("alert", "Alert"),
				text2: "No active DigiLocker session found. Please start verification.",
			});
			setShowPendingCard(false);
			return;
		}

		setIsCheckingStatus(true);
		try {
			const res = await attemptFinish(txnId, { mode: "single" });
			if (res.status === "pending") {
				Toast.show({
					type: "info",
					text1: t("alert", "Alert"),
					text2: t("digilockerStillWaiting", "We're still waiting for DigiLocker to confirm. If you finished it, tap Check status in a few seconds."),
				});
			} else if (res.status === "unavailable") {
				Toast.show({
					type: "info",
					text1: t("alert", "Alert"),
					text2: t("digilockerUnavailable", "DigiLocker is taking longer than usual. Please try again in a minute."),
				});
			} else if (res.status === "retry") {
				Toast.show({
					type: "error",
					text1: t("alert", "Alert"),
					text2: t("digilockerRetryNetwork", "No internet connection. Check your network and tap Check status."),
				});
			}
		} catch {
			Toast.show({
				type: "error",
				text1: t("alert", "Alert"),
				text2: t("digilockerSomethingWrong", "Something went wrong on our side. Please try again."),
			});
		} finally {
			if (isMounted.current) {
				setIsCheckingStatus(false);
			}
		}
	};

	const handleSimulateDev = async () => {
		if (!devTxnId) return;
		setIsCheckingStatus(true);
		try {
			const done = await attemptFinish(devTxnId, { mode: "single" });
			if (done.status !== "done") {
				Toast.show({
					type: "info",
					text1: "Simulate",
					text2: "We couldn't confirm DigiLocker yet. You can try again.",
				});
			}
		} finally {
			if (isMounted.current) {
				setIsCheckingStatus(false);
			}
		}
	};

	// Determine UI text for the card
	const getCardText = () => {
		const currentStatus = statusInfo?.status;
		if (currentStatus === "retry") {
			return t("digilockerRetryNetwork", "No internet connection. Check your network and tap Check status.");
		}
		if (currentStatus === "unavailable") {
			if (__DEV__ && statusInfo?.message) {
				return statusInfo.message;
			}
			return t("digilockerUnavailable", "DigiLocker is taking longer than usual. Please try again in a minute.");
		}
		if (currentStatus === "restart") {
			return statusInfo?.message || "We couldn't read your DigiLocker details. Please try again.";
		}
		if (currentStatus === "failed") {
			return t("digilockerSomethingWrong", "Something went wrong on our side. Please try again.");
		}
		return t("digilockerStillWaiting", "We're still waiting for DigiLocker to confirm. If you finished it, tap Check status in a few seconds.");
	};

	return (
		<SafeAreaView style={styles.safeContainer}>
			{/* Top Bar */}
			<View style={styles.header}>
				<TouchableOpacity
					onPress={() => router.replace("/(tabs)")}
					style={styles.backButton}
					hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
				>
					<Feather name="arrow-left" size={24} color={dark} />
				</TouchableOpacity>
				<TranslatedText style={styles.headerTitle} translationKey="digilockerKycTitle" />
			</View>

			<View style={styles.contentContainer}>
				<View style={styles.iconCircle}>
					<Ionicons name="shield-checkmark" size={60} color={primary} />
				</View>

				<TranslatedText style={styles.title} translationKey="digilockerKycTitle" />
				<TranslatedText style={styles.subtitle} translationKey="digilockerKycSubtitle" />

				<View style={styles.infoCard}>
					<Feather name="info" size={20} color={primary} style={{ marginTop: 2 }} />
					<TranslatedText style={styles.infoText} translationKey="digilockerWhyText" />
				</View>

				{isVerifying ? (
					<View style={styles.verifyingCard}>
						<ActivityIndicator size="large" color={primary} style={{ marginBottom: 12 }} />
						<Text style={styles.verifyingCardTitle}>Verifying with DigiLocker...</Text>
						<Text style={styles.verifyingCardText}>
							We are fetching and verifying your KYC documents from DigiLocker. Please wait a moment.
						</Text>
						<TouchableOpacity
							style={styles.cancelVerifyBtn}
							onPress={() => {
								cancelDigilockerChecks();
								setIsVerifying(false);
								setShowPendingCard(true);
							}}
							activeOpacity={0.85}
						>
							<Text style={styles.cancelVerifyBtnText}>{t("cancel", "Cancel")}</Text>
						</TouchableOpacity>
					</View>
				) : showPendingCard ? (
					<View style={styles.pendingCard}>
						<View style={styles.pendingHeaderRow}>
							<Feather name="help-circle" size={20} color={primary} />
							<Text style={styles.pendingCardTitle}>Did you finish DigiLocker?</Text>
						</View>
						<Text style={styles.pendingCardText}>
							{getCardText()}
						</Text>

						{__DEV__ && (statusInfo?.httpStatus || statusInfo?.code) ? (
							<Text style={styles.devCodeText}>
								[DEV] status={statusInfo.status} code={statusInfo.code ?? "none"} http={statusInfo.httpStatus ?? "none"}
							</Text>
						) : null}

						<View style={styles.pendingBtnRow}>
							{statusInfo?.status !== "restart" ? (
								<TouchableOpacity
									style={[styles.pendingBtn, styles.checkStatusBtn, isBusy && styles.buttonDisabled]}
									onPress={handleCheckStatus}
									disabled={isBusy}
									activeOpacity={0.85}
								>
									{isCheckingStatus ? (
										<ActivityIndicator size="small" color={dark} />
									) : (
										<Text style={styles.checkStatusBtnText}>Check status</Text>
									)}
								</TouchableOpacity>
							) : null}

							{statusInfo?.status === "unavailable" ? (
								<TouchableOpacity
									style={[styles.pendingBtn, styles.tryAgainBtn, isBusy && styles.buttonDisabled]}
									onPress={() => router.replace("/(tabs)")}
									disabled={isBusy}
									activeOpacity={0.85}
								>
									<Text style={styles.tryAgainBtnText}>Try again later</Text>
								</TouchableOpacity>
							) : (
								<TouchableOpacity
									style={[styles.pendingBtn, styles.tryAgainBtn, isBusy && styles.buttonDisabled]}
									onPress={handleStartDigilocker}
									disabled={isBusy}
									activeOpacity={0.85}
								>
									{isStartingSession ? (
										<ActivityIndicator size="small" color={dark} />
									) : (
										<Text style={styles.tryAgainBtnText}>Start again</Text>
									)}
								</TouchableOpacity>
							)}
						</View>
					</View>
				) : null}

				<View style={styles.spacer} />

				{__DEV__ && devTxnId ? (
					<TouchableOpacity
						style={styles.devSimulateBtn}
						onPress={handleSimulateDev}
						disabled={isBusy}
					>
						<Text style={styles.devSimulateText}>🛠️ [DEV] Simulate DigiLocker success</Text>
					</TouchableOpacity>
				) : null}

				{!showPendingCard && !isVerifying ? (
					<TouchableOpacity
						style={[styles.continueButton, isBusy && styles.buttonDisabled]}
						onPress={handleStartDigilocker}
						disabled={isBusy}
						activeOpacity={0.85}
					>
						{isStartingSession ? (
							<ActivityIndicator size="small" color={dark} />
						) : (
							<TranslatedText style={styles.buttonText} translationKey="digilockerContinueBtn" />
						)}
					</TouchableOpacity>
				) : null}
			</View>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	safeContainer: {
		flex: 1,
		backgroundColor: white,
	},
	header: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: width(4),
		paddingVertical: height(1.5),
		borderBottomWidth: 1,
		borderBottomColor: "#F1F5F9",
	},
	backButton: {
		marginRight: width(3),
	},
	headerTitle: {
		fontSize: font(2),
		fontWeight: "700",
		color: dark,
	},
	contentContainer: {
		flex: 1,
		paddingHorizontal: width(6),
		paddingTop: height(4),
		paddingBottom: height(3),
		alignItems: "center",
	},
	iconCircle: {
		width: 100,
		height: 100,
		borderRadius: 50,
		backgroundColor: "#F0FDF4",
		justifyContent: "center",
		alignItems: "center",
		marginBottom: height(3),
	},
	title: {
		fontSize: font(2.4),
		fontWeight: "800",
		color: dark,
		textAlign: "center",
		marginBottom: height(1),
	},
	subtitle: {
		fontSize: font(1.5),
		color: "#64748B",
		textAlign: "center",
		lineHeight: 22,
		marginBottom: height(3),
	},
	infoCard: {
		flexDirection: "row",
		backgroundColor: "#F8FAFC",
		borderWidth: 1,
		borderColor: "#E2E8F0",
		borderRadius: 12,
		padding: 16,
		marginBottom: height(3),
		gap: 12,
	},
	infoText: {
		flex: 1,
		fontSize: font(1.4),
		color: "#475569",
		lineHeight: 20,
	},
	verifyingCard: {
		backgroundColor: "#F0FDF4",
		borderRadius: 16,
		padding: 20,
		width: "100%",
		alignItems: "center",
		borderWidth: 1,
		borderColor: "#BBF7D0",
		marginBottom: height(2),
	},
	verifyingCardTitle: {
		fontSize: font(1.8),
		fontWeight: "700",
		color: dark,
		marginBottom: 6,
	},
	verifyingCardText: {
		fontSize: font(1.4),
		color: "#475569",
		textAlign: "center",
		lineHeight: 20,
	},
	cancelVerifyBtn: {
		marginTop: 14,
		paddingVertical: 8,
		paddingHorizontal: 20,
		borderRadius: 8,
		backgroundColor: "#FFFFFF",
		borderWidth: 1,
		borderColor: "#CBD5E1",
	},
	cancelVerifyBtnText: {
		color: "#475569",
		fontSize: font(1.4),
		fontWeight: "600",
	},
	pendingCard: {
		backgroundColor: "#FFFBEB",
		borderRadius: 16,
		padding: 20,
		width: "100%",
		borderWidth: 1,
		borderColor: "#FDE68A",
		marginBottom: height(2),
	},
	pendingHeaderRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
		marginBottom: 8,
	},
	pendingCardTitle: {
		fontSize: font(1.8),
		fontWeight: "700",
		color: dark,
	},
	pendingCardText: {
		fontSize: font(1.4),
		color: "#475569",
		lineHeight: 20,
		marginBottom: 16,
	},
	devCodeText: {
		fontSize: 11,
		color: "#94A3B8",
		marginBottom: 12,
		fontFamily: "monospace",
	},
	pendingBtnRow: {
		flexDirection: "row",
		gap: 12,
	},
	pendingBtn: {
		flex: 1,
		paddingVertical: 12,
		borderRadius: 10,
		alignItems: "center",
		justifyContent: "center",
	},
	checkStatusBtn: {
		backgroundColor: primary,
	},
	checkStatusBtnText: {
		color: dark,
		fontWeight: "700",
		fontSize: font(1.5),
	},
	tryAgainBtn: {
		backgroundColor: "#F1F5F9",
		borderWidth: 1,
		borderColor: "#CBD5E1",
	},
	tryAgainBtnText: {
		color: "#334155",
		fontWeight: "600",
		fontSize: font(1.5),
	},
	spacer: {
		flex: 1,
	},
	continueButton: {
		backgroundColor: primary,
		width: "100%",
		paddingVertical: height(2),
		borderRadius: 12,
		alignItems: "center",
		justifyContent: "center",
	},
	buttonDisabled: {
		opacity: 0.6,
	},
	buttonText: {
		color: dark,
		fontSize: font(1.7),
		fontWeight: "700",
	},
	devSimulateBtn: {
		paddingVertical: 10,
		paddingHorizontal: 16,
		borderRadius: 8,
		backgroundColor: "#FEF3C7",
		borderWidth: 1,
		borderColor: "#F59E0B",
		marginBottom: 12,
	},
	devSimulateText: {
		fontSize: font(1.3),
		color: "#92400E",
		fontWeight: "600",
	},
});
