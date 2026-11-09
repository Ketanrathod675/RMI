import React, { useCallback, useEffect, useRef, useState } from "react";
import {
	ActivityIndicator,
	Animated,
	AppState,
	type AppStateStatus,
	BackHandler,
	Keyboard,
	type NativeSyntheticEvent,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import Toast from "react-native-toast-message";
import { Ionicons } from "@expo/vector-icons";
import Logger from "@/utils/logger";
import { useTranslation } from "@/hooks/useTranslation";
import { useJourneyTracker } from "@/hooks/useJourneyTracker";
import {
	resendConsentOtp,
	signConsent,
} from "@/utils/api/services/consent.service";
import { URLS } from "@/utils/api/core/endpoints";
import { getApiErrorInfo } from "@/utils/api/errors";
import { getFriendlyError } from "@/utils/api/core/friendlyError";
import { finishConsent, handleConsent409Error } from "@/utils/consent/finishConsent";
import type { TextInputRef } from "@/types/rn-refs";

export default function ConsentOtpScreen() {
	useJourneyTracker("/consent-otp" as any);

	const router = useRouter();
	const queryClient = useQueryClient();
	const { t } = useTranslation();

	const params = useLocalSearchParams<{
		signInKey?: string;
		expiresIn?: string;
		maskedPhone?: string;
		resendAfter?: string;
		testOtp?: string;
	}>();

	const [signInKey, setSignInKey] = useState<string>(params.signInKey || "");
	const maskedPhone = params.maskedPhone || "";
	const testOtp = params.testOtp;

	const [otp, setOtp] = useState<string[]>(["", "", "", ""]);
	const [focusedIndex, setFocusedIndex] = useState<number | null>(0);
	const [consentChecked, setConsentChecked] = useState<boolean>(true);

	const initialExpiresIn = parseInt(params.expiresIn || "300", 10) || 300;
	const initialResendAfter = parseInt(params.resendAfter || "30", 10) || 30;

	const [expiresInSeconds, setExpiresInSeconds] = useState<number>(initialExpiresIn);
	const [resendCooldown, setResendCooldown] = useState<number>(initialResendAfter);

	// Timestamps for accurate recalculation on foregrounding
	const expiresAtRef = useRef<number>(Date.now() + initialExpiresIn * 1000);
	const resendAvailableAtRef = useRef<number>(Date.now() + initialResendAfter * 1000);

	// 429 lock state
	const [lockedSeconds, setLockedSeconds] = useState<number>(0);
	const lockedUntilRef = useRef<number>(0);

	const [isVerifying, setIsVerifying] = useState<boolean>(false);
	const [isResending, setIsResending] = useState<boolean>(false);
	const isSubmittingRef = useRef<boolean>(false);

	const inputRefs = useRef<(TextInputRef | null)[]>([]);
	const shakeAnim = useRef(new Animated.Value(0)).current;

	const triggerShake = useCallback(() => {
		Animated.sequence([
			Animated.timing(shakeAnim, { toValue: 10, duration: 45, useNativeDriver: true }),
			Animated.timing(shakeAnim, { toValue: -10, duration: 45, useNativeDriver: true }),
			Animated.timing(shakeAnim, { toValue: 8, duration: 45, useNativeDriver: true }),
			Animated.timing(shakeAnim, { toValue: -8, duration: 45, useNativeDriver: true }),
			Animated.timing(shakeAnim, { toValue: 4, duration: 40, useNativeDriver: true }),
			Animated.timing(shakeAnim, { toValue: 0, duration: 40, useNativeDriver: true }),
		]).start();
	}, [shakeAnim]);

	// Recalculate remaining seconds from fixed timestamps (prevents drift when backgrounded)
	const recalcTimers = useCallback(() => {
		const now = Date.now();
		const remExpiry = Math.max(0, Math.ceil((expiresAtRef.current - now) / 1000));
		const remResend = Math.max(0, Math.ceil((resendAvailableAtRef.current - now) / 1000));
		const remLock = Math.max(0, Math.ceil((lockedUntilRef.current - now) / 1000));

		setExpiresInSeconds(remExpiry);
		setResendCooldown(remResend);
		setLockedSeconds(remLock);
	}, []);

	// Active countdown interval
	useEffect(() => {
		const interval = setInterval(recalcTimers, 1000);
		return () => clearInterval(interval);
	}, [recalcTimers]);

	// Handle app state changes (foregrounding)
	useEffect(() => {
		const handleAppStateChange = (nextState: AppStateStatus) => {
			if (nextState === "active") {
				recalcTimers();
			}
		};
		const sub = AppState.addEventListener("change", handleAppStateChange);
		return () => sub.remove();
	}, [recalcTimers]);

	// Hardware back button returns to consent screen
	useEffect(() => {
		const onBackPress = () => {
			router.back();
			return true;
		};
		const backSub = BackHandler.addEventListener("hardwareBackPress", onBackPress);
		return () => backSub.remove();
	}, [router]);

	// Autofocus first input on mount
	useEffect(() => {
		const timer = setTimeout(() => {
			inputRefs.current[0]?.focus();
		}, 150);
		return () => clearTimeout(timer);
	}, []);

	const isLocked = lockedSeconds > 0;
	const isCodeExpired = expiresInSeconds <= 0;
	const enteredOtp = otp.join("").trim();
	const isOtpComplete = enteredOtp.length === 4;
	const isButtonEnabled = isOtpComplete && consentChecked && !isVerifying && !isLocked;

	const handleOtpChange = (value: string, index: number) => {
		if (isLocked) return;

		const digitsOnly = value.replace(/\D/g, "");

		// Paste handling: multi-digit input
		if (digitsOnly.length > 1) {
			const sliced = digitsOnly.slice(0, 4).split("");
			const newOtp = [...otp];
			for (let i = 0; i < 4; i++) {
				newOtp[i] = sliced[i] || "";
			}
			setOtp(newOtp);
			if (sliced.length === 4) {
				Keyboard.dismiss();
				inputRefs.current[3]?.focus();
			} else {
				inputRefs.current[sliced.length]?.focus();
			}
			return;
		}

		const singleDigit = digitsOnly.slice(-1);
		const newOtp = [...otp];
		newOtp[index] = singleDigit;
		setOtp(newOtp);

		if (singleDigit && index < 3) {
			inputRefs.current[index + 1]?.focus();
		} else if (singleDigit && index === 3) {
			Keyboard.dismiss();
		}
	};

	const handleKeyPress = (
		e: NativeSyntheticEvent<{ key: string }>,
		index: number,
	) => {
		if (e.nativeEvent.key === "Backspace" && !otp[index] && index > 0) {
			inputRefs.current[index - 1]?.focus();
			const newOtp = [...otp];
			newOtp[index - 1] = "";
			setOtp(newOtp);
		}
	};

	const handleResend = async () => {
		if (isResending || isVerifying || resendCooldown > 0 || isLocked) return;

		setIsResending(true);
		Logger.debug("Consent OTP resend requested");

		try {
			const res = await resendConsentOtp();
			Logger.debug("Consent OTP resent successfully");

			if (res?.sign_in_key) {
				setSignInKey(res.sign_in_key);
			}

			const newExpiry = res?.expires_in_seconds || 300;
			const newResend = res?.resend_after_seconds || 30;

			expiresAtRef.current = Date.now() + newExpiry * 1000;
			resendAvailableAtRef.current = Date.now() + newResend * 1000;
			recalcTimers();

			setOtp(["", "", "", ""]);
			inputRefs.current[0]?.focus();

			Toast.show({
				type: "success",
				text1: res?.message || t("otpSentSuccessfully") || "OTP sent successfully",
			});
		} catch (err: any) {
			const info = getApiErrorInfo(err);
			Logger.debug("Consent OTP resend error", { status: info.status });

			if (info.status === 429) {
				const retryAfter = (err as any)?.retryAfter || 60;
				lockedUntilRef.current = Date.now() + retryAfter * 1000;
				setLockedSeconds(retryAfter);
				Toast.show({
					type: "info",
					text1: t("pleaseTryAgain") || "Please try again",
					text2:
						info.detail ||
						"Too many requests. Please wait before retrying.",
				});
			} else {
				Toast.show({
					type: "error",
					text1: t("failedToSendOtp") || "Failed to resend OTP",
					text2: getFriendlyError(err).message,
				});
			}
		} finally {
			setIsResending(false);
		}
	};

	const handleVerifyAndContinue = async () => {
		if (!isButtonEnabled || isSubmittingRef.current) return;

		isSubmittingRef.current = true;
		setIsVerifying(true);
		Logger.debug("Consent OTP verify requested");

		try {
			const res = await signConsent({
				kycVerification: true,
				creditBureau: true,
				deviceFraud: true,
				bankAmlMnrl: true,
				dataSharing: true,
				communication: true,
				otp: Number(enteredOtp),
				signInKey: signInKey || undefined,
			});

			Logger.debug("Consent OTP verified successfully");
			await finishConsent({
				queryClient,
				router,
				responseMessage: res?.message,
			});
		} catch (err: any) {
			const error409 = await handleConsent409Error(err, queryClient, router);
			if (error409.isHandled) {
				if (error409.isSuccess) {
					await finishConsent({
						queryClient,
						router,
						responseMessage: error409.message,
					});
				}
				return;
			}

			const info = getApiErrorInfo(err);
			Logger.debug("Consent OTP verify failed", { status: info.status });

			if (info.status === 400) {
				// Invalid or expired OTP: shake boxes, clear, refocus first
				triggerShake();
				setOtp(["", "", "", ""]);
				inputRefs.current[0]?.focus();
				Toast.show({
					type: "error",
					text1: t("incorrectOrExpiredOtp") || "Incorrect or expired OTP. Please try again.",
					visibilityTime: 4000,
				});
				return;
			}

			if (info.status === 429) {
				// Rate limit lock
				const retryAfter = (err as any)?.retryAfter || 60;
				lockedUntilRef.current = Date.now() + retryAfter * 1000;
				setLockedSeconds(retryAfter);
				Toast.show({
					type: "error",
					text1:
						info.detail ||
						(t("tooManyAttemptsWait") || "Too many attempts. Please wait {seconds}s before trying again.").replace(
							"{seconds}",
							String(retryAfter),
						),
					visibilityTime: 4000,
				});
				return;
			}

			if (info.status === 401) {
				// Handled by axios interceptor
				return;
			}

			// Network or general server errors: keep entered digits so user doesn't retype
			Toast.show({
				type: "error",
				text1: getFriendlyError(err).message,
				visibilityTime: 4000,
			});
		} finally {
			isSubmittingRef.current = false;
			setIsVerifying(false);
		}
	};

	const handleOpenPreviewPdf = () => {
		router.push({
			pathname: "/pdf-viewer",
			params: {
				path: URLS.consent_document.preview,
				title: t("digitalConsent") || "Digital Consent",
				file: "consent-preview.pdf",
			},
		});
	};

	const formatCooldown = (seconds: number) => {
		const m = Math.floor(seconds / 60);
		const s = seconds % 60;
		return `${m}:${s < 10 ? "0" : ""}${s}`;
	};

	const subtitleText = (
		t("enterOtpSubtitle") ||
		"We've sent a 4-digit verification code to {maskedPhone}. Enter it below to securely continue."
	).replace("{maskedPhone}", maskedPhone || "your registered mobile number");

	return (
		<SafeAreaView style={styles.safeArea}>
			{/* Top Header */}
			<View style={styles.header}>
				<Pressable
					onPress={() => router.back()}
					style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.6 }]}
					hitSlop={12}
					accessibilityLabel="Back"
					accessibilityRole="button"
				>
					<Ionicons name="arrow-back" size={24} color="#0F172A" />
				</Pressable>
				<Text style={styles.headerTitle}>
					{t("digitalConsent") || "Digital Consent"}
				</Text>
				<View style={styles.headerRightSpacer} />
			</View>

			<ScrollView
				contentContainerStyle={styles.scrollContent}
				keyboardShouldPersistTaps="handled"
				showsVerticalScrollIndicator={false}
			>
				{/* Shield Badge */}
				<View style={styles.badgeWrapper}>
					<View style={styles.shieldBadge}>
						<Ionicons name="shield-checkmark" size={13} color="#0F172A" />
						<Text style={styles.badgeText}>
							{t("secureVerification") || "SECURE VERIFICATION"}
						</Text>
					</View>
				</View>

				{/* Title & Subtitle */}
				<Text style={styles.title}>{t("enterOtp") || "Enter OTP"}</Text>
				<Text style={styles.subtitle}>{subtitleText}</Text>

				{/* DEV Test OTP Pill */}
				{__DEV__ && testOtp ? (
					<View style={styles.devPill}>
						<Ionicons name="code-slash" size={14} color="#047857" />
						<Text style={styles.devPillText}>[DEV Mode] Test OTP: {testOtp}</Text>
					</View>
				) : null}

				{/* 429 Locked Message */}
				{isLocked ? (
					<View style={styles.lockedBanner}>
						<Ionicons name="time-outline" size={16} color="#DC2626" />
						<Text style={styles.lockedBannerText}>
							{(
								t("tooManyAttemptsWait") ||
								"Too many attempts. Please wait {seconds}s before trying again."
							).replace("{seconds}", String(lockedSeconds))}
						</Text>
					</View>
				) : null}

				{/* Code Expired Warning */}
				{!isLocked && isCodeExpired ? (
					<View style={styles.expiredBanner}>
						<Ionicons name="alert-circle-outline" size={16} color="#D97706" />
						<Text style={styles.expiredBannerText}>
							{t("codeExpiredPrompt") || "Code expired. Please request a new OTP."}
						</Text>
					</View>
				) : null}

				{/* 4 OTP Input Boxes */}
				<Animated.View
					style={[
						styles.otpContainer,
						{ transform: [{ translateX: shakeAnim }] },
					]}
				>
					{otp.map((digit, index) => {
						const isFocused = focusedIndex === index;
						const isFilled = Boolean(digit);

						return (
							<View
								key={index}
								style={[
									styles.otpBoxWrapper,
									isFocused && styles.otpBoxWrapperFocused,
								]}
							>
								<TextInput
									ref={(el) => {
										inputRefs.current[index] = el;
									}}
									style={[
										styles.otpBox,
										isFilled && styles.otpBoxFilled,
										isFocused && styles.otpBoxFocused,
										isLocked && styles.otpBoxDisabled,
									]}
									value={digit}
									onChangeText={(val) => handleOtpChange(val, index)}
									onKeyPress={(e) => handleKeyPress(e, index)}
									onFocus={() => setFocusedIndex(index)}
									onBlur={() => setFocusedIndex(null)}
									keyboardType="number-pad"
									maxLength={index === 0 ? 4 : 1}
									textContentType="oneTimeCode"
									autoComplete="sms-otp"
									editable={!isLocked && !isVerifying}
									selectTextOnFocus
									accessibilityLabel={`${t("otpDigit") || "OTP digit"} ${index + 1}`}
								/>
							</View>
						);
					})}
				</Animated.View>

				{/* Resend Row */}
				<View style={styles.resendRow}>
					{resendCooldown > 0 ? (
						<Text style={styles.resendCountdownText}>
							{t("resendIn") || "Resend in"} {formatCooldown(resendCooldown)}
						</Text>
					) : (
						<Pressable
							onPress={handleResend}
							disabled={isResending || isVerifying || isLocked}
							style={({ pressed }) => [
								styles.resendButton,
								(isResending || isLocked) && styles.resendButtonDisabled,
								pressed && { opacity: 0.6 },
							]}
							hitSlop={12}
						>
							{isResending ? (
								<ActivityIndicator size="small" color="#79CA01" />
							) : (
								<Text style={styles.resendButtonText}>
									{t("resendOTP") || "Resend OTP"}
								</Text>
							)}
						</Pressable>
					)}
				</View>

				{/* Consent Declaration Box (English only, never translated) */}
				<Pressable
					onPress={() => setConsentChecked((prev) => !prev)}
					style={styles.consentCard}
					accessibilityRole="checkbox"
					accessibilityState={{ checked: consentChecked }}
				>
					<View style={[styles.checkbox, consentChecked && styles.checkboxChecked]}>
						{consentChecked ? (
							<Ionicons name="checkmark" size={14} color="#FFFFFF" />
						) : null}
					</View>
					<View style={styles.consentTextContainer}>
						<Text style={styles.consentPrimaryText}>
							I am giving my consent via OTP to verify my identity, fetch credit bureau
							records, and accept terms & conditions.
						</Text>
						<Text style={styles.consentSecondaryText}>
							If you didn't request this code, please ignore it.
						</Text>
					</View>
				</Pressable>

				{/* Primary Verify Button */}
				<Pressable
					onPress={handleVerifyAndContinue}
					disabled={!isButtonEnabled}
					style={({ pressed }) => [
						styles.primaryButton,
						!isButtonEnabled && styles.primaryButtonDisabled,
						pressed && isButtonEnabled && styles.primaryButtonPressed,
					]}
					accessibilityRole="button"
				>
					{isVerifying ? (
						<View style={styles.buttonContentRow}>
							<ActivityIndicator size="small" color="#0F172A" />
							<Text style={styles.primaryButtonText}>
								{t("verifying") || "Verifying..."}
							</Text>
						</View>
					) : (
						<Text
							style={[
								styles.primaryButtonText,
								!isButtonEnabled && styles.primaryButtonTextDisabled,
							]}
						>
							{!isOtpComplete
								? t("enterValid4DigitOtp") || "Enter 4-digit OTP"
								: t("verifyAndContinue") || "Verify & Continue →"}
						</Text>
					)}
				</Pressable>

				{/* View Consent Document Link */}
				<Pressable
					onPress={handleOpenPreviewPdf}
					style={({ pressed }) => [
						styles.previewLink,
						pressed && { opacity: 0.6 },
					]}
					hitSlop={8}
				>
					<Ionicons name="document-text-outline" size={15} color="#475569" />
					<Text style={styles.previewLinkText}>
						{t("viewConsentDocument") || "View consent document"}
					</Text>
				</Pressable>

				{/* Footer Trust Badge */}
				<View style={styles.footerRow}>
					<Ionicons name="checkmark-circle" size={16} color="#79CA01" />
					<Text style={styles.footerText}>
						{t("verificationSecureAndProtected") ||
							"Your verification is secure and protected"}
					</Text>
				</View>
			</ScrollView>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	safeArea: {
		flex: 1,
		backgroundColor: "#FFFFFF",
	},
	header: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: 16,
		paddingVertical: 12,
		borderBottomWidth: 1,
		borderBottomColor: "#F1F5F9",
	},
	backButton: {
		width: 44,
		height: 44,
		alignItems: "center",
		justifyContent: "center",
	},
	headerTitle: {
		fontSize: 17,
		fontWeight: "600",
		color: "#0F172A",
	},
	headerRightSpacer: {
		width: 44,
	},
	scrollContent: {
		paddingHorizontal: 24,
		paddingTop: 24,
		paddingBottom: 40,
	},
	badgeWrapper: {
		alignSelf: "flex-start",
	},
	shieldBadge: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: "#F3FEE3",
		borderWidth: 1,
		borderColor: "#B7FB52",
		borderRadius: 20,
		paddingHorizontal: 10,
		paddingVertical: 5,
		gap: 5,
	},
	badgeText: {
		fontSize: 11,
		fontWeight: "700",
		color: "#0F172A",
		letterSpacing: 0.5,
	},
	title: {
		fontSize: 26,
		fontWeight: "800",
		color: "#0F172A",
		marginTop: 14,
		letterSpacing: -0.5,
	},
	subtitle: {
		fontSize: 14,
		lineHeight: 21,
		color: "#475569",
		marginTop: 8,
	},
	devPill: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
		backgroundColor: "#ECFDF5",
		borderWidth: 1,
		borderColor: "#A7F3D0",
		borderRadius: 8,
		paddingHorizontal: 10,
		paddingVertical: 6,
		marginTop: 12,
		alignSelf: "flex-start",
	},
	devPillText: {
		fontSize: 12,
		fontWeight: "600",
		color: "#065F46",
	},
	lockedBanner: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
		backgroundColor: "#FEF2F2",
		borderWidth: 1,
		borderColor: "#FECACA",
		borderRadius: 8,
		paddingHorizontal: 12,
		paddingVertical: 8,
		marginTop: 12,
	},
	lockedBannerText: {
		fontSize: 12,
		color: "#B91C1C",
		fontWeight: "500",
		flex: 1,
	},
	expiredBanner: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
		backgroundColor: "#FFFBEB",
		borderWidth: 1,
		borderColor: "#FDE68A",
		borderRadius: 8,
		paddingHorizontal: 12,
		paddingVertical: 8,
		marginTop: 12,
	},
	expiredBannerText: {
		fontSize: 12,
		color: "#B45309",
		fontWeight: "500",
		flex: 1,
	},
	otpContainer: {
		flexDirection: "row",
		justifyContent: "space-between",
		marginTop: 28,
		gap: 12,
	},
	otpBoxWrapper: {
		borderRadius: 12,
	},
	otpBoxWrapperFocused: {
		borderRadius: 14,
		borderWidth: 2,
		borderColor: "#E8F8D5",
	},
	otpBox: {
		width: 60,
		height: 60,
		borderRadius: 12,
		borderWidth: 2,
		borderColor: "#E5E7EB",
		backgroundColor: "#F9FAFB",
		textAlign: "center",
		fontSize: 24,
		fontWeight: "700",
		color: "#0F172A",
	},
	otpBoxFocused: {
		borderColor: "#79CA01",
		backgroundColor: "#FFFFFF",
	},
	otpBoxFilled: {
		borderColor: "#79CA01",
		backgroundColor: "#F7FFF0",
	},
	otpBoxDisabled: {
		backgroundColor: "#F1F5F9",
		borderColor: "#E2E8F0",
		color: "#94A3B8",
	},
	resendRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		marginTop: 20,
		minHeight: 32,
	},
	resendCountdownText: {
		fontSize: 14,
		fontWeight: "600",
		color: "#64748B",
	},
	resendButton: {
		paddingVertical: 4,
		paddingHorizontal: 12,
	},
	resendButtonDisabled: {
		opacity: 0.5,
	},
	resendButtonText: {
		fontSize: 14,
		fontWeight: "700",
		color: "#79CA01",
	},
	consentCard: {
		flexDirection: "row",
		alignItems: "flex-start",
		backgroundColor: "#F7FFF0",
		borderWidth: 1,
		borderColor: "#E1F8C9",
		borderRadius: 12,
		padding: 14,
		marginTop: 24,
		gap: 12,
	},
	checkbox: {
		width: 22,
		height: 22,
		borderRadius: 6,
		borderWidth: 2,
		borderColor: "#94A3B8",
		backgroundColor: "#FFFFFF",
		alignItems: "center",
		justifyContent: "center",
		marginTop: 2,
	},
	checkboxChecked: {
		backgroundColor: "#79CA01",
		borderColor: "#79CA01",
	},
	consentTextContainer: {
		flex: 1,
	},
	consentPrimaryText: {
		fontSize: 13,
		lineHeight: 18,
		fontWeight: "500",
		color: "#1E293B",
	},
	consentSecondaryText: {
		fontSize: 11,
		lineHeight: 16,
		color: "#64748B",
		marginTop: 4,
	},
	primaryButton: {
		backgroundColor: "#B7FB52",
		borderRadius: 14,
		height: 54,
		alignItems: "center",
		justifyContent: "center",
		marginTop: 24,
		shadowColor: "#79CA01",
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.2,
		shadowRadius: 8,
		elevation: 3,
	},
	primaryButtonDisabled: {
		backgroundColor: "#E2E8F0",
		shadowOpacity: 0,
		elevation: 0,
	},
	primaryButtonPressed: {
		opacity: 0.9,
		transform: [{ scale: 0.99 }],
	},
	buttonContentRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
	},
	primaryButtonText: {
		fontSize: 16,
		fontWeight: "700",
		color: "#0F172A",
	},
	primaryButtonTextDisabled: {
		color: "#94A3B8",
	},
	previewLink: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		marginTop: 18,
		gap: 6,
		paddingVertical: 6,
	},
	previewLinkText: {
		fontSize: 13,
		fontWeight: "600",
		color: "#475569",
		textDecorationLine: "underline",
	},
	footerRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		marginTop: 24,
		gap: 6,
	},
	footerText: {
		fontSize: 12,
		fontWeight: "500",
		color: "#64748B",
	},
});
