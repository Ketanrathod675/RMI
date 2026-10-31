import { getFriendlyError } from "@/utils/api/core/friendlyError";
import FiveSecDelay from "@/components/FiveSecDelay";
import RejectionModal from "@/components/RejectionModal";
import { TranslatedText } from "@/components/TranslatedText";
import { IconSymbol } from "@/components/ui/IconSymbol";
import { dark_primary, primary, white } from "@/constants/Colors";
import Logger from "@/utils/logger";
import {
	isEmailFixable,
	isPanFixable,
	pollAssessmentChecks,
	useAssessmentChecksController,
} from "@/hooks/useAssessmentChecks";
import { useTranslation } from "@/hooks/useTranslation";
import {
	getHandshakeStatus,
	getUserProfile,
	retryAssessmentChecks,
	type AssessmentChecks,
} from "@/utils/api";
import { height, width } from "@/utils/dimensions";
import { resolveLeadId } from "@/utils/leadId";
import { useJourneyLoader } from "@/context/JourneyLoaderProvider";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
	ActivityIndicator,
	BackHandler,
	Keyboard,
	StyleSheet,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export default function VerifyEmail() {
	const router = useRouter();
	const params = useLocalSearchParams();
	const { t } = useTranslation();
	const { signal, cancel } = useAssessmentChecksController();
	const { runStepThenNavigate } = useJourneyLoader();

	const [email, setEmail] = useState("");
	const [emailError, setEmailError] = useState("");
	const [serverError, setServerError] = useState("");
	const [remainingAttempts, setRemainingAttempts] = useState<number>(2);
	const [isVerifying, setIsVerifying] = useState(false);
	const [isLoadingDetails, setIsLoadingDetails] = useState(true);

	// Still checking panel state (on network error / timeout)
	const [isStillChecking, setIsStillChecking] = useState(false);
	const [lastCheckError, setLastCheckError] = useState<"error" | "timeout" | "service_unavailable" | null>(null);

	// Cooldown and retry state
	const lastSubmittedEmailRef = useRef<string>("");
	const lastStatusRef = useRef<AssessmentChecks["status"] | "timeout" | null>(null);
	const lastRetryAtRef = useRef<number>(0);
	const retryCooldownSecondsRef = useRef<number>(60);
	const [cooldownRemaining, setCooldownRemaining] = useState<number>(0);

	useEffect(() => {

		if (cooldownRemaining <= 0) return;
		const timer = setInterval(() => {
			setCooldownRemaining((prev) => {
				if (prev <= 1) {
					clearInterval(timer);
					return 0;
				}
				return prev - 1;
			});
		}, 1000);
		return () => clearInterval(timer);
	}, [cooldownRemaining]);

	const startCooldown = (seconds: number) => {
		const s = Math.max(1, seconds);
		retryCooldownSecondsRef.current = s;
		setCooldownRemaining(s);
	};

	// Rejection modal states
	const [delayVisible, setDelayVisible] = useState(false);
	const [rejectionModalVisible, setRejectionModalVisible] = useState(false);
	const [rejectionCountdown, setRejectionCountdown] = useState(15);

	const handleBack = useCallback(() => {
		cancel();
		router.replace("/(tabs)");
	}, [cancel, router]);

	// Hardware back button handling
	useEffect(() => {
		const backHandler = BackHandler.addEventListener("hardwareBackPress", () => {
			handleBack();
			return true;
		});
		return () => backHandler.remove();
	}, [handleBack]);

	// Handle initial mount check
	useEffect(() => {
		let isMounted = true;

		const init = async () => {
			try {
				let initialEmail = (params.email as string) || "";
				try {
					const profile = await getUserProfile();
					const meData = (profile as any)?.data || profile;
					const profileEmail = meData?.email || meData?.profile?.email;
					if (profileEmail && !initialEmail) {
						initialEmail = String(profileEmail);
					}
				} catch {
					// Fallback
				}

				if (isMounted && initialEmail) {
					setEmail(initialEmail);
					lastSubmittedEmailRef.current = initialEmail.trim().toLowerCase();
				}

				// Check initial handshake status without arguments
				const checks = await getHandshakeStatus();
				if (!isMounted) return;

				if (checks.status === "approved") {
					router.replace({
						pathname: "/professional-details" as any,
						params: { disableBack: "true" },
					});
					return;
				}

				if (checks.status === "rejected" || checks.status === "needs_update") {
					if (isPanFixable(checks)) {
						router.replace("/verify-pan" as any);
						return;
					}
					if (isEmailFixable(checks)) {
						setRemainingAttempts(checks.remaining_email_updates);
						setIsLoadingDetails(false);
						return;
					}
					// Final rejection
					setIsLoadingDetails(false);
					setDelayVisible(true);
					return;
				}

				if (checks.status === "service_unavailable") {
					lastStatusRef.current = "service_unavailable";
					if (typeof checks.retry_after_seconds === "number") {
						startCooldown(checks.retry_after_seconds);
					}
					setIsLoadingDetails(false);
					setLastCheckError("service_unavailable");
					setIsStillChecking(true);
					return;
				}

				if (checks.status === "pending" || checks.status === "error") {
					router.replace({
						pathname: "/new-assessment-fee" as any,
						params: { resumeChecks: "true" },
					});
					return;
				}

				setIsLoadingDetails(false);
			} catch (err) {
				if (isMounted) {
					setIsLoadingDetails(false);
				}
			}
		};

		init();

		return () => {
			isMounted = false;
		};
	}, [params.email, router]);

	// Handle Outcome branching from AssessmentChecks
	const handleAssessmentOutcome = useCallback(
		(checks: AssessmentChecks) => {
			if (checks.status === "approved") {
				router.replace({
					pathname: "/professional-details" as any,
					params: { disableBack: "true" },
				});
				return;
			}

			if (checks.status === "rejected" || checks.status === "needs_update") {
				if (isPanFixable(checks)) {
					router.replace("/verify-pan" as any);
					return;
				}
				if (isEmailFixable(checks)) {
					setRemainingAttempts(checks.remaining_email_updates);
					setServerError(t("emailVerificationFailed"));
					return;
				}
				// Final rejection (not fixable)
				setDelayVisible(true);
				return;
			}

			if (checks.status === "service_unavailable") {
				lastStatusRef.current = "service_unavailable";
				if (typeof checks.retry_after_seconds === "number") {
					startCooldown(checks.retry_after_seconds);
				}
				setLastCheckError("service_unavailable");
				setIsStillChecking(true);
				return;
			}

			// error or pending
			lastStatusRef.current = "error";
			setLastCheckError("error");
			setIsStillChecking(true);
		},
		[router, t],
	);

	const handleVerify = async () => {
		Keyboard.dismiss();
		const cleanEmail = email.trim().toLowerCase();

		if (!cleanEmail) {
			setEmailError(t("enterValidEmail") || "Please enter a valid email address");
			return;
		}

		if (!EMAIL_REGEX.test(cleanEmail)) {
			setEmailError(t("enterValidEmail") || "Please enter a valid email address");
			return;
		}

		setEmailError("");
		setServerError("");
		setIsStillChecking(false);
		setIsVerifying(true);

		let navTarget: (() => void) | null = null;
		try {
			await runStepThenNavigate(
				"verifying_details",
				async ({ signal: loaderSignal }) => {
					const leadId = await resolveLeadId(params.lead_id as string);
					if (!leadId) {
						Toast.show({
							type: "error",
							text1: t("detailsNotFound") || "Lead details not found",
							text2: t("pleaseTryAgain") || "Please try again from dashboard",
						});
						throw new Error("Lead details not found");
					}

					const isEmailChanged = cleanEmail !== lastSubmittedEmailRef.current;
					const timeSinceLastRetry = (Date.now() - lastRetryAtRef.current) / 1000;
					const shouldCallRetryBackend =
						isEmailChanged ||
						((lastStatusRef.current === "error" || lastStatusRef.current === "service_unavailable") &&
							timeSinceLastRetry >= retryCooldownSecondsRef.current);

					if (shouldCallRetryBackend) {
						lastRetryAtRef.current = Date.now();
						lastSubmittedEmailRef.current = cleanEmail;
						startCooldown(retryCooldownSecondsRef.current);

						try {
							await retryAssessmentChecks({
								lead_id: leadId,
								updated_email: cleanEmail,
							});
						} catch (retryErr: any) {
							const status = retryErr?.status ?? retryErr?.response?.status;
							const detail =
								retryErr?.detail ??
								retryErr?.response?.data?.detail ??
								retryErr?.message ??
								"Update failed";
							const detailStr = typeof detail === "string" ? detail : JSON.stringify(detail);

							if (status === 409 && detailStr.toLowerCase().includes("cannot be retried")) {
								const checks = await getHandshakeStatus();
								if (checks.status === "approved") {
									navTarget = () =>
										router.replace({
											pathname: "/professional-details" as any,
											params: { disableBack: "true" },
										});
									return { outcome: "approved", checks };
								}
								handleAssessmentOutcome(checks);
								return { outcome: "recheck", checks };
							}

							Toast.show({
								type: "error",
								text1: getFriendlyError(retryErr).message,
							});
							throw retryErr;
						}
					}

					// Poll handshake status until terminal state
					const checks = await pollAssessmentChecks({
						signal: loaderSignal,
						leadId,
					});

					if (checks.status === "approved") {
						navTarget = () =>
							router.replace({
								pathname: "/professional-details" as any,
								params: { disableBack: "true" },
							});
						return { outcome: "approved", checks };
					}

					if (checks.status === "rejected" || checks.status === "needs_update") {
						if (isPanFixable(checks)) {
							navTarget = () =>
								router.replace({
									pathname: "/verify-pan" as any,
									params: { paymentConfirmed: "true", txnid: params.txnid || "" },
								});
							return { outcome: "needs_pan", checks };
						}
						if (isEmailFixable(checks)) {
							setRemainingAttempts(checks.remaining_email_updates);
							setServerError(t("emailVerificationFailed"));
							return { outcome: "needs_email", checks };
						}
						// Final rejection (not fixable)
						setDelayVisible(true);
						return { outcome: "final_rejected", checks };
					}

					if (checks.status === "service_unavailable") {
						lastStatusRef.current = "service_unavailable";
						if (typeof checks.retry_after_seconds === "number") {
							startCooldown(checks.retry_after_seconds);
						}
						throw { isServiceUnavailable: true, checks };
					}

					throw { isError: true, checks };
				},
				{
					timeoutMs: 65000,
					treatErrorAsAttention: true,
					markAttentionIf: (result: any) => ["needs_pan", "needs_email", "final_rejected", "recheck"].includes(result?.outcome),
					attentionBadgeLabel: t("actionNeeded"),
					navigate: () => {
						if (navTarget) navTarget();
					},
				}
			);
		} catch (pollErr: any) {
			if (pollErr?.aborted) return;
			const checks = pollErr?.checks;
			if (checks?.status === "service_unavailable" || pollErr?.isServiceUnavailable) {
				lastStatusRef.current = "service_unavailable";
				if (typeof checks?.retry_after_seconds === "number") {
					startCooldown(checks.retry_after_seconds);
				}
				setLastCheckError("service_unavailable");
			} else {
				lastStatusRef.current = pollErr?.isTimeout ? "timeout" : "error";
				setLastCheckError(pollErr?.isTimeout ? "timeout" : "error");
			}
			setIsStillChecking(true);
		} finally {
			setIsVerifying(false);
		}
	};

	const handleRetryChecking = async () => {
		setIsStillChecking(false);
		setIsVerifying(true);
		setServerError("");

		let navTarget: (() => void) | null = null;
		try {
			await runStepThenNavigate(
				"verifying_details",
				async ({ signal: loaderSignal }) => {
					const leadId = await resolveLeadId(params.lead_id as string);
					const timeSinceLastRetry = (Date.now() - lastRetryAtRef.current) / 1000;
					const shouldCallRetryBackend =
						(lastStatusRef.current === "error" || lastStatusRef.current === "service_unavailable") &&
						timeSinceLastRetry >= retryCooldownSecondsRef.current;

					if (shouldCallRetryBackend && leadId) {
						lastRetryAtRef.current = Date.now();
						startCooldown(retryCooldownSecondsRef.current);
						try {
							await retryAssessmentChecks({ lead_id: leadId });
						} catch {
							// Continue to poll
						}
					}

					const checks = await pollAssessmentChecks({
						signal: loaderSignal,
						leadId,
					});

					if (checks.status === "approved") {
						navTarget = () =>
							router.replace({
								pathname: "/professional-details" as any,
								params: { disableBack: "true" },
							});
						return { outcome: "approved", checks };
					}

					if (checks.status === "rejected" || checks.status === "needs_update") {
						if (isPanFixable(checks)) {
							navTarget = () =>
								router.replace({
									pathname: "/verify-pan" as any,
									params: { paymentConfirmed: "true", txnid: params.txnid || "" },
								});
							return { outcome: "needs_pan", checks };
						}
						if (isEmailFixable(checks)) {
							setRemainingAttempts(checks.remaining_email_updates);
							setServerError(t("emailVerificationFailed"));
							return { outcome: "needs_email", checks };
						}
						setDelayVisible(true);
						return { outcome: "final_rejected", checks };
					}

					if (checks.status === "service_unavailable") {
						lastStatusRef.current = "service_unavailable";
						if (typeof checks.retry_after_seconds === "number") {
							startCooldown(checks.retry_after_seconds);
						}
						throw { isServiceUnavailable: true, checks };
					}

					throw { isError: true, checks };
				},
				{
					timeoutMs: 65000,
					treatErrorAsAttention: true,
					markAttentionIf: (result: any) => ["needs_pan", "needs_email", "final_rejected", "recheck"].includes(result?.outcome),
					attentionBadgeLabel: t("actionNeeded"),
					navigate: () => {
						if (navTarget) navTarget();
					},
				}
			);
		} catch (err: any) {
			if (err?.aborted) return;
			const checks = err?.checks;
			if (checks?.status === "service_unavailable" || err?.isServiceUnavailable) {
				lastStatusRef.current = "service_unavailable";
				if (typeof checks?.retry_after_seconds === "number") {
					startCooldown(checks.retry_after_seconds);
				}
				setLastCheckError("service_unavailable");
			} else {
				lastStatusRef.current = err?.isTimeout ? "timeout" : "error";
				setLastCheckError(err?.isTimeout ? "timeout" : "error");
			}
			setIsStillChecking(true);
		} finally {
			setIsVerifying(false);
		}
	};

	return (
		<View style={styles.root}>
			{/* Custom Header */}
			{!isLoadingDetails && (
				<SafeAreaView edges={["top"]} style={styles.headerSafeArea}>
					<View style={styles.header}>
						<TouchableOpacity
							onPress={handleBack}
							style={styles.backButton}
							hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
						>
							<Ionicons name="arrow-back" size={24} color="#fff" />
						</TouchableOpacity>
						<TranslatedText style={styles.headerTitle} translationKey="verifyEmailAddress" />
					</View>
				</SafeAreaView>
			)}

			<SafeAreaView edges={["bottom", "left", "right"]} style={styles.container}>
				{!isLoadingDetails && (
					<View style={styles.content}>
						{params.paymentConfirmed === "true" && (
							<View style={styles.paymentSafeBanner}>
								<Ionicons name="shield-checkmark" size={20} color="#047857" />
								<Text style={styles.paymentSafeBannerText}>
									{t("paymentSafeEmailBanner", "Your payment is confirmed and safe. We just need to correct your email to continue.")}
								</Text>
							</View>
						)}
						<TranslatedText style={styles.description} translationKey="weNeedValidEmail" />

						<View style={styles.inputContainer}>
							<TranslatedText style={styles.label} translationKey="emailAddress" />
							<TextInput
								style={[
									styles.input,
									emailError || serverError ? styles.inputError : null,
								]}
								value={email}
								onChangeText={(text) => {
									const cleaned = text.replace(/\s/g, "");
									setEmail(cleaned);
									if (emailError) setEmailError("");
									if (serverError) setServerError("");
								}}
								placeholder="johndoe@example.com"
								placeholderTextColor="#9CA3AF"
								autoCapitalize="none"
								keyboardType="email-address"
								editable={!isVerifying}
							/>
							{emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}
							{serverError ? <Text style={styles.errorText}>{serverError}</Text> : null}
							{remainingAttempts > 0 && !emailError && !serverError ? (
								<Text style={styles.attemptsText}>
									{remainingAttempts}{" "}
									{remainingAttempts === 1
										? t("attemptLeft", "attempt left")
										: t("attemptsLeft", "attempts left")}
								</Text>
							) : null}
						</View>

						{/* Still checking panel on error/timeout/service_unavailable */}
						{isStillChecking && (
							<View style={styles.stillCheckingCard}>
								<Text style={styles.stillCheckingTitle}>
									{t("stillCheckingDetailsTitle", "We're still checking your details")}
								</Text>
								<Text style={styles.stillCheckingDesc}>
									{lastStatusRef.current === "service_unavailable"
										? t(
											"verificationServiceUnavailable",
											"Our verification partner is temporarily unavailable. Please try again in a few minutes.",
										)
										: t(
											"stillCheckingDetailsDesc",
											"Verification is taking longer than expected. You can try again or check your dashboard.",
										)}
								</Text>
								<View style={styles.stillCheckingActions}>
									<TouchableOpacity
										style={[
											styles.retryButton,
											(isVerifying || cooldownRemaining > 0) && styles.buttonDisabled,
										]}
										onPress={handleRetryChecking}
										disabled={isVerifying || cooldownRemaining > 0}
									>
										<Text style={styles.retryButtonText}>
											{cooldownRemaining > 0
												? `${t("tryAgain", "Try Again")} (${cooldownRemaining}s)`
												: t("tryAgain", "Try Again")}
										</Text>
									</TouchableOpacity>
									<TouchableOpacity
										style={styles.dashboardButton}
										onPress={handleBack}
									>
										<Text style={styles.dashboardButtonText}>
											{t("goToDashboard", "Go to Dashboard")}
										</Text>
									</TouchableOpacity>
								</View>
							</View>
						)}

						{!isStillChecking && (
							<TouchableOpacity
								style={[styles.button, isVerifying && styles.buttonDisabled]}
								onPress={handleVerify}
								disabled={isVerifying}
								activeOpacity={0.85}
							>
								{isVerifying ? (
									<ActivityIndicator color="white" />
								) : (
									<View style={styles.buttonInner}>
										<TranslatedText
											style={styles.buttonText}
											translationKey="verifyAndProceed"
										/>
										<IconSymbol name="arrow.right" size={20} color="white" />
									</View>
								)}
							</TouchableOpacity>
						)}
					</View>
				)}
			</SafeAreaView>

			<FiveSecDelay
				visible={delayVisible}
				onComplete={() => {
					setDelayVisible(false);
					setRejectionModalVisible(true);
				}}
			/>

			<RejectionModal
				visible={rejectionModalVisible}
				countdown={rejectionCountdown}
				setCountdown={setRejectionCountdown}
				onClose={() => {
					setRejectionModalVisible(false);
					router.replace("/(tabs)");
				}}
			/>

			{/* Fullscreen Loader while fetching initial details */}
			{isLoadingDetails && (
				<View style={styles.loaderOverlay}>
					<ActivityIndicator size="large" color="#00C853" />
					<TranslatedText
						style={styles.loadingText}
						translationKey="loadingDetails"
						fallback="Fetching details..."
					/>
				</View>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	root: {
		flex: 1,
		backgroundColor: white,
	},
	headerSafeArea: {
		backgroundColor: "#000",
	},
	header: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: 16,
		paddingVertical: 14,
		backgroundColor: "#000",
	},
	backButton: {
		marginRight: 16,
	},
	headerTitle: {
		color: "#fff",
		fontSize: 18,
		fontWeight: "bold",
	},
	container: {
		flex: 1,
		backgroundColor: white,
	},
	content: {
		flex: 1,
		padding: width(5),
		justifyContent: "flex-start",
		paddingTop: height(2),
	},
	description: {
		fontSize: 16,
		color: "#666",
		marginBottom: height(3),
		lineHeight: 24,
	},
	inputContainer: {
		marginBottom: height(3),
	},
	label: {
		fontSize: 14,
		fontWeight: "600",
		marginBottom: height(1),
		color: "#333",
	},
	input: {
		borderWidth: 1,
		borderColor: "#E5E7EB",
		borderRadius: 10,
		paddingHorizontal: 14,
		paddingVertical: 13,
		fontSize: 16,
		color: "#000",
		backgroundColor: "#FAFAFA",
	},
	inputError: {
		borderColor: "#EF4444",
		backgroundColor: "#FEF2F2",
	},
	errorText: {
		color: "#EF4444",
		fontSize: 12,
		marginTop: 6,
		fontWeight: "500",
	},
	attemptsText: {
		color: "#6B7280",
		fontSize: 12,
		marginTop: 6,
	},
	button: {
		backgroundColor: "#00C853",
		paddingVertical: 16,
		borderRadius: 12,
		alignItems: "center",
		marginTop: height(2),
		shadowColor: "#00C853",
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.2,
		shadowRadius: 6,
		elevation: 3,
	},
	buttonDisabled: {
		opacity: 0.7,
	},
	buttonInner: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
	},
	buttonText: {
		color: "white",
		fontWeight: "bold",
		fontSize: 18,
	},
	stillCheckingCard: {
		backgroundColor: "#F9FAFB",
		borderRadius: 12,
		padding: 16,
		borderWidth: 1,
		borderColor: "#E5E7EB",
		marginTop: 10,
	},
	stillCheckingTitle: {
		fontSize: 16,
		fontWeight: "600",
		color: "#1F2937",
		marginBottom: 6,
	},
	stillCheckingDesc: {
		fontSize: 14,
		color: "#6B7280",
		lineHeight: 20,
		marginBottom: 16,
	},
	stillCheckingActions: {
		flexDirection: "row",
		gap: 12,
	},
	retryButton: {
		flex: 1,
		backgroundColor: "#00C853",
		paddingVertical: 12,
		borderRadius: 8,
		alignItems: "center",
	},
	retryButtonText: {
		color: "#fff",
		fontWeight: "600",
		fontSize: 14,
	},
	dashboardButton: {
		flex: 1,
		backgroundColor: "#F3F4F6",
		paddingVertical: 12,
		borderRadius: 8,
		alignItems: "center",
	},
	dashboardButtonText: {
		color: "#374151",
		fontWeight: "600",
		fontSize: 14,
	},
	loaderOverlay: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		backgroundColor: white,
		alignItems: "center",
		justifyContent: "center",
		zIndex: 9999,
	},
	loadingText: {
		marginTop: 16,
		fontSize: 14,
		color: "#6B7280",
	},
	paymentSafeBanner: {
		flexDirection: "row",
		alignItems: "center",
		gap: 10,
		backgroundColor: "#ECFDF5",
		borderWidth: 1,
		borderColor: "#A7F3D0",
		borderRadius: 12,
		paddingHorizontal: 14,
		paddingVertical: 12,
		marginBottom: 16,
	},
	paymentSafeBannerText: {
		flex: 1,
		fontSize: 13,
		lineHeight: 18,
		color: "#065F46",
		fontWeight: "500",
	},
});
