import { IconSymbol } from "@/components/ui/IconSymbol";
import { dark, dark_primary, primary, white } from "@/constants/Colors";
import { Images } from "@/constants/images";
import { useAuth } from "@/hooks/useAuth";
import { useJourneyTracker } from "@/hooks/useJourneyTracker";
import { useNetworkAwareMutation } from "@/hooks/useNetworkAwareMutation";
import { useTranslation } from "@/hooks/useTranslation";
import {
	getUserDashboardData,
	getMyDetails,
	sendEmailOtp,
	verifyEmailOtp,
	StepHref,
	type SendEmailOtpRequestType,
	type VerifyEmailOtpRequestType,
} from "@/utils/api";
import { font, height, width } from "@/utils/dimensions";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
	ActivityIndicator,
	BackHandler,
	Image,
	KeyboardAvoidingView,
	Platform,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

const EMAIL_REGEX = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

/**
 * Checks if the backend error corresponds to email deduplication
 * (i.e. this email is already registered/linked to another account).
 */
export const isEmailDeduplicationError = (err: any): boolean => {
	const data = err?.response?.data;
	const msg = (
		data?.message ||
		data?.detail ||
		data?.error ||
		(typeof data === "string" ? data : "") ||
		err?.message ||
		""
	).toLowerCase();
	const code = (data?.code || "").toLowerCase();

	return (
		code.includes("duplicate") ||
		code.includes("email_exists") ||
		code.includes("already_exists") ||
		msg.includes("already exists") ||
		msg.includes("already registered") ||
		msg.includes("already linked") ||
		msg.includes("already used") ||
		msg.includes("already associated") ||
		msg.includes("duplicate")
	);
};

export default function VerifyEmailScreen() {
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const params = useLocalSearchParams<{ email?: string }>();
	const { t } = useTranslation();
	const { userId } = useAuth();

	// Journey tracking
	useJourneyTracker("/verify-email");

	// Screen state
	const [step, setStep] = useState<"email" | "otp">("email");
	const [email, setEmail] = useState<string>(params.email ? String(params.email).trim() : "");
	const [emailError, setEmailError] = useState<string>("");
	const [dedupError, setDedupError] = useState<string>("");

	// OTP state
	const [otp, setOtp] = useState<string[]>(["", "", "", ""]);
	const [otpError, setOtpError] = useState<string>("");
	const [resendTimer, setResendTimer] = useState<number>(0);
	const [isCheckingInitialStatus, setIsCheckingInitialStatus] = useState<boolean>(true);
	const [isAdvancing, setIsAdvancing] = useState<boolean>(false);

	const otpInputRefs = useRef<(TextInput | null)[]>([]);
	const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

	// Resend countdown timer
	useEffect(() => {
		if (resendTimer > 0) {
			timerIntervalRef.current = setInterval(() => {
				setResendTimer((prev) => {
					if (prev <= 1) {
						if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
						return 0;
					}
					return prev - 1;
				});
			}, 1000);
		}

		return () => {
			if (timerIntervalRef.current) {
				clearInterval(timerIntervalRef.current);
			}
		};
	}, [resendTimer]);

	// Navigate dynamically to the next step from dashboard data
	const advanceToNextStep = useCallback(async () => {
		setIsAdvancing(true);
		try {
			const dashboardData = await getUserDashboardData();
			const currentStep = dashboardData?.workflow_progress?.current_step;

			if (__DEV__) {
				console.log("📊 [VerifyEmail] Advancing via dashboard current_step:", currentStep);
			}

			if (currentStep && StepHref[currentStep as keyof typeof StepHref]) {
				const nextPath = StepHref[currentStep as keyof typeof StepHref];
				// Avoid loop/regression if current_step still points to pan_verification / verify-email or earlier steps
				if (nextPath !== "/verify-email" && nextPath !== "/loan-application") {
					router.replace(nextPath as any);
					return;
				}
			}
		} catch (error) {
			console.warn("⚠️ [VerifyEmail] Error fetching dashboard on email verification success:", error);
		}

		// Standard progression fallback
		router.replace("/professional-details" as any);
	}, [router]);

	// Check if user already has an email or is already verified on mount
	useEffect(() => {
		let isMounted = true;

		async function checkEmailStatus() {
			try {
				const details = await getMyDetails();
				if (!isMounted) return;

				const kyc = details?.kyc_record;
				const existingEmail = kyc?.email || details?.email || params.email;

				if (existingEmail && !email) {
					setEmail(String(existingEmail).trim());
				}

				// If already verified, advance directly without blocking
				const alreadyVerified =
					kyc?.is_email_verified === true || details?.email_verified === true;
				if (alreadyVerified) {
					if (__DEV__) {
						console.log("ℹ️ [VerifyEmail] Email already marked verified in backend. Advancing...");
					}
					await advanceToNextStep();
					return;
				}
			} catch (err) {
				if (__DEV__) {
					console.log("ℹ️ [VerifyEmail] Could not load prior kyc details:", err);
				}
			} finally {
				if (isMounted) {
					setIsCheckingInitialStatus(false);
				}
			}
		}

		checkEmailStatus();

		return () => {
			isMounted = false;
		};
	}, [advanceToNextStep, email, params.email]);

	// Handle hardware back press
	useFocusEffect(
		useCallback(() => {
			const onBackPress = () => {
				if (step === "otp") {
					// Step back to email editing
					setStep("email");
					setOtp(["", "", "", ""]);
					setOtpError("");
					return true;
				}
				router.replace("/(tabs)");
				return true;
			};

			const sub = BackHandler.addEventListener("hardwareBackPress", onBackPress);
			return () => sub.remove();
		}, [step, router])
	);

	// Mutation: Send Email OTP
	const { mutate: sendOtpMutation, isPending: isSendingOtp } = useNetworkAwareMutation({
		mutationFn: sendEmailOtp,
		onSuccess: (data) => {
			if (__DEV__) {
				console.log("📧 [VerifyEmail] sendEmailOtp success:", data);
			}
			setDedupError("");
			setEmailError("");
			setOtpError("");
			setResendTimer(data?.expires_in ? Math.min(data.expires_in, 60) : 60);
			setStep("otp");

			Toast.show({
				type: "success",
				text1: t("otpSent", "OTP Sent"),
				text2: data?.message || t("otpSentToEmail", "4-digit OTP sent to your email address"),
				visibilityTime: 3000,
			});
		},
		onError: (err: any) => {
			if (__DEV__) {
				console.error("❌ [VerifyEmail] sendEmailOtp error:", err?.response?.data || err);
			}

			// Distinct handling for email deduplication failure case
			if (isEmailDeduplicationError(err)) {
				const errorMsg =
					err?.response?.data?.message ||
					t(
						"emailAlreadyLinked",
						"This email is already linked to another account. Please use a different email address."
					);
				setDedupError(errorMsg);
				setEmailError(errorMsg);

				Toast.show({
					type: "error",
					text1: t("error", "Email Already Registered"),
					text2: errorMsg,
					visibilityTime: 5000,
				});
				return;
			}

			// Format or user not found errors
			const status = err?.response?.status;
			const backendMsg = err?.response?.data?.message || err?.response?.data?.detail;

			if (status === 404) {
				setEmailError(backendMsg || "User account not found. Please log in again.");
			} else if (status === 400) {
				setEmailError(backendMsg || t("invalidEmail", "Please enter a valid email address"));
			} else {
				setEmailError(backendMsg || t("failedToSendOTP", "Failed to send OTP. Please try again."));
			}

			Toast.show({
				type: "error",
				text1: t("failedToSendOTP", "Failed to send OTP"),
				text2: backendMsg || t("pleaseTryAgain", "Please try again"),
				visibilityTime: 4000,
			});
		},
	});

	// Mutation: Verify Email OTP
	const { mutate: verifyOtpMutation, isPending: isVerifyingOtp } = useNetworkAwareMutation({
		mutationFn: verifyEmailOtp,
		onSuccess: async (data) => {
			if (__DEV__) {
				console.log("✅ [VerifyEmail] verifyEmailOtp success:", data);
			}
			setOtpError("");

			Toast.show({
				type: "success",
				text1: t("emailVerified", "Email Verified"),
				text2: data?.message || t("yourEmailHasBeenVerified", "Your email has been verified successfully"),
				visibilityTime: 2500,
			});

			// Advance using dashboard fetch
			await advanceToNextStep();
		},
		onError: (err: any) => {
			if (__DEV__) {
				console.error("❌ [VerifyEmail] verifyEmailOtp error:", err?.response?.data || err);
			}

			// Surface whatever specific message comes back from the service
			const backendMsg =
				err?.response?.data?.message ||
				err?.response?.data?.detail ||
				err?.message ||
				t("invalidOTP", "Invalid or expired OTP");

			setOtpError(backendMsg);

			Toast.show({
				type: "error",
				text1: t("invalidOTP", "Invalid OTP"),
				text2: backendMsg,
				visibilityTime: 4000,
			});
		},
	});

	const handleSendOtp = () => {
		const trimmed = email.trim();
		setDedupError("");
		setEmailError("");

		if (!trimmed) {
			setEmailError(t("enterValidEmail", "Please enter a valid email address"));
			return;
		}

		if (!EMAIL_REGEX.test(trimmed)) {
			setEmailError(t("invalidEmail", "Please enter a valid email address"));
			return;
		}

		const payload: SendEmailOtpRequestType = {
			email: trimmed,
			...(userId ? { user_id: userId } : {}),
		};

		sendOtpMutation(payload);
	};

	const handleVerifyOtp = () => {
		const enteredOtp = otp.join("").trim();
		setOtpError("");

		if (enteredOtp.length !== 4) {
			setOtpError(t("pleaseEnter4DigitOTP", "Please enter 4-digit OTP"));
			return;
		}

		const payload: VerifyEmailOtpRequestType = {
			email: email.trim(),
			otp: enteredOtp,
			...(userId ? { user_id: userId } : {}),
		};

		verifyOtpMutation(payload);
	};

	const handleOtpChange = (value: string, index: number) => {
		setOtpError("");
		const newOtp = [...otp];
		const cleaned = value.replace(/[^0-9]/g, "");

		if (cleaned.length > 1) {
			// Handle paste into box
			const digits = cleaned.slice(0, 4).split("");
			for (let i = 0; i < 4; i++) {
				newOtp[i] = digits[i] || "";
			}
			setOtp(newOtp);
			const nextFocus = Math.min(digits.length, 3);
			otpInputRefs.current[nextFocus]?.focus();
			return;
		}

		newOtp[index] = cleaned;
		setOtp(newOtp);

		if (cleaned && index < 3) {
			otpInputRefs.current[index + 1]?.focus();
		}
	};

	const handleBackspace = (digit: string, index: number) => {
		setOtpError("");
		if (!digit && index > 0) {
			otpInputRefs.current[index - 1]?.focus();
		}
	};

	if (isCheckingInitialStatus) {
		return (
			<View style={[styles.container, styles.center]}>
				<ActivityIndicator size="large" color={dark_primary} />
				<Text style={styles.loadingStatusText}>
					{t("loadingDetails", "Fetching details...")}
				</Text>
			</View>
		);
	}

	return (
		<View style={styles.container}>
			{/* Top Header Bar */}
			<View style={[styles.header, { paddingTop: insets.top + height(1.5) }]}>
				<TouchableOpacity
					onPress={() => {
						if (step === "otp") {
							setStep("email");
							setOtp(["", "", "", ""]);
							setOtpError("");
						} else {
							router.replace("/(tabs)");
						}
					}}
					style={styles.backButton}
					hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
					<IconSymbol name="arrow-back" size={24} color={dark} />
				</TouchableOpacity>
				<Text style={styles.headerTitle}>
					{t("verifyEmailAddress", "Verify Email Address")}
				</Text>
			</View>

			<KeyboardAvoidingView
				style={styles.flexOne}
				behavior={Platform.OS === "ios" ? "padding" : "height"}>
				<ScrollView
					style={styles.scrollContainer}
					contentContainerStyle={styles.scrollContent}
					keyboardShouldPersistTaps="handled"
					showsVerticalScrollIndicator={false}>
					{/* Brand Shield Illustration */}
					<View style={styles.graphicRow}>
						<Image
							source={Images.PHONE_OTP}
							style={styles.graphicImage}
							resizeMode="contain"
						/>
					</View>

					<View style={styles.content}>
						{step === "email" ? (
							<>
								{/* Step 1: Email Entry */}
								<Text style={styles.title}>
									{t("verifyEmailAddress", "Verify Email Address")}
								</Text>
								<Text style={styles.subtitle}>
									{t(
										"weNeedValidEmail",
										"We need a valid email address to send you important loan documents."
									)}
								</Text>

								{/* Distinct Deduplication Failure Banner */}
								{dedupError ? (
									<View style={styles.dedupBanner}>
										<MaterialIcons
											name="error"
											size={20}
											color="#B91C1C"
										/>
										<View style={styles.dedupTextWrap}>
											<Text style={styles.dedupTitle}>
												Email Already Registered
											</Text>
											<Text style={styles.dedupMessage}>{dedupError}</Text>
										</View>
									</View>
								) : null}

								<View style={styles.inputSection}>
									<Text style={styles.inputLabel}>
										{t("emailAddress", "Email Address")}
									</Text>
									<View
										style={[
											styles.inputWrapper,
											(emailError || dedupError) ? styles.inputErrorBorder : null,
										]}>
										<MaterialIcons
											name="mail"
											size={18}
											color={emailError ? "#DC2626" : "#6B7280"}
										/>
										<TextInput
											style={styles.textInput}
											value={email}
											onChangeText={(text) => {
												setEmail(text);
												setEmailError("");
												setDedupError("");
											}}
											placeholder={t("enterEmailAddress", "Enter email address")}
											placeholderTextColor="#9CA3AF"
											keyboardType="email-address"
											autoCapitalize="none"
											autoCorrect={false}
											editable={!isSendingOtp}
										/>
										{email.length > 0 && !isSendingOtp && (
											<TouchableOpacity
												onPress={() => {
													setEmail("");
													setEmailError("");
													setDedupError("");
												}}
												hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
												<IconSymbol
													name="close"
													size={18}
													color="#9CA3AF"
												/>
											</TouchableOpacity>
										)}
									</View>

									{emailError ? (
										<Text style={styles.errorHelperText}>{emailError}</Text>
									) : null}
								</View>

								{/* Send OTP CTA */}
								<TouchableOpacity
									style={[
										styles.primaryButton,
										{ opacity: !email.trim() || isSendingOtp ? 0.7 : 1 },
									]}
									onPress={handleSendOtp}
									disabled={!email.trim() || isSendingOtp}
									activeOpacity={0.85}>
									{isSendingOtp ? (
										<ActivityIndicator size="small" color={dark} />
									) : (
										<Text style={styles.primaryButtonText}>
											{t("sendOtp", "Send OTP")}
										</Text>
									)}
								</TouchableOpacity>
							</>
						) : (
							<>
								{/* Step 2: 4-Box OTP Verification */}
								<Text style={styles.title}>
									{t("enterEmailOtp", "Enter Email OTP")}
								</Text>

								<View style={styles.emailDisplayRow}>
									<Text style={styles.emailDisplayText} numberOfLines={1}>
										Sent to: <Text style={styles.emailHighlight}>{email}</Text>
									</Text>
									<TouchableOpacity
										onPress={() => {
											setStep("email");
											setOtp(["", "", "", ""]);
											setOtpError("");
										}}
										hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
										<Text style={styles.editEmailLink}>
											{t("changeEmail", "Edit")}
										</Text>
									</TouchableOpacity>
								</View>

								{/* 4-Digit OTP Boxes */}
								<View style={styles.otpContainer}>
									{otp.map((digit, index) => (
										<TextInput
											key={index}
											ref={(ref) => {
												otpInputRefs.current[index] = ref;
											}}
											style={[
												styles.otpBox,
												digit ? styles.otpBoxFilled : null,
												otpError ? styles.otpBoxError : null,
											]}
											value={digit}
											onChangeText={(val) => handleOtpChange(val, index)}
											onKeyPress={({ nativeEvent }) => {
												if (nativeEvent.key === "Backspace") {
													handleBackspace(digit, index);
												}
											}}
											keyboardType="numeric"
											maxLength={1}
											selectTextOnFocus
											editable={!isVerifyingOtp && !isAdvancing}
										/>
									))}
								</View>

								{otpError ? (
									<Text style={styles.otpErrorText}>{otpError}</Text>
								) : null}

								{/* Resend OTP Row */}
								<View style={styles.resendContainer}>
									{resendTimer > 0 ? (
										<Text style={styles.resendTimerText}>
											Resend OTP in <Text style={styles.boldTimer}>{resendTimer}s</Text>
										</Text>
									) : (
										<TouchableOpacity
											onPress={handleSendOtp}
											disabled={isSendingOtp}
											activeOpacity={0.8}>
											{isSendingOtp ? (
												<ActivityIndicator size="small" color={dark_primary} />
											) : (
												<Text style={styles.resendActiveLink}>
													{t("resendOTP", "Resend OTP")}
												</Text>
											)}
										</TouchableOpacity>
									)}
								</View>

								{/* Verify & Continue CTA */}
								<TouchableOpacity
									style={[
										styles.primaryButton,
										{
											opacity:
												!otp.every((d) => d) || isVerifyingOtp || isAdvancing
													? 0.7
													: 1,
										},
									]}
									onPress={handleVerifyOtp}
									disabled={!otp.every((d) => d) || isVerifyingOtp || isAdvancing}
									activeOpacity={0.85}>
									{isVerifyingOtp || isAdvancing ? (
										<ActivityIndicator size="small" color={dark} />
									) : (
										<Text style={styles.primaryButtonText}>
											{t("verifyAndProceed", "Verify & Proceed")}
										</Text>
									)}
								</TouchableOpacity>
							</>
						)}
					</View>
				</ScrollView>
			</KeyboardAvoidingView>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: white,
	},
	flexOne: {
		flex: 1,
	},
	center: {
		justifyContent: "center",
		alignItems: "center",
	},
	loadingStatusText: {
		marginTop: 12,
		fontSize: font(1.6),
		color: "#6B7280",
	},
	header: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: width(5),
		paddingBottom: height(1.5),
		backgroundColor: white,
		borderBottomWidth: 1,
		borderBottomColor: "#F3F4F6",
	},
	backButton: {
		marginRight: width(3),
	},
	headerTitle: {
		fontSize: font(2.2),
		fontWeight: "700",
		color: dark,
	},
	scrollContainer: {
		flex: 1,
	},
	scrollContent: {
		flexGrow: 1,
		paddingTop: height(2),
		paddingBottom: height(4),
	},
	graphicRow: {
		alignItems: "center",
		justifyContent: "center",
		marginTop: height(1),
		marginBottom: height(2),
	},
	graphicImage: {
		width: width(36),
		height: width(36),
	},
	content: {
		paddingHorizontal: width(6),
	},
	title: {
		fontSize: font(2.3),
		fontWeight: "700",
		color: dark,
		marginBottom: 6,
	},
	subtitle: {
		fontSize: font(1.55),
		color: "#6B7280",
		lineHeight: 20,
		marginBottom: height(2),
	},
	dedupBanner: {
		flexDirection: "row",
		alignItems: "flex-start",
		backgroundColor: "#FEF2F2",
		borderWidth: 1,
		borderColor: "#FCA5A5",
		borderRadius: 10,
		padding: 12,
		marginBottom: height(2),
		gap: 10,
	},
	dedupTextWrap: {
		flex: 1,
	},
	dedupTitle: {
		fontSize: font(1.5),
		fontWeight: "700",
		color: "#991B1B",
		marginBottom: 2,
	},
	dedupMessage: {
		fontSize: font(1.4),
		color: "#B91C1C",
		lineHeight: 18,
	},
	inputSection: {
		marginBottom: height(3),
	},
	inputLabel: {
		fontSize: font(1.6),
		fontWeight: "600",
		color: dark,
		marginBottom: 8,
	},
	inputWrapper: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: "#F9FAFB",
		borderWidth: 1,
		borderColor: "#E5E7EB",
		borderRadius: 12,
		paddingHorizontal: width(3.5),
		height: 52,
		gap: 10,
	},
	inputErrorBorder: {
		borderColor: "#DC2626",
		backgroundColor: "#FEF2F2",
	},
	textInput: {
		flex: 1,
		fontSize: font(1.7),
		color: dark,
		paddingVertical: 0,
	},
	errorHelperText: {
		marginTop: 6,
		fontSize: font(1.35),
		color: "#DC2626",
		fontWeight: "500",
	},
	emailDisplayRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		backgroundColor: "#F9FAFB",
		paddingHorizontal: 14,
		paddingVertical: 10,
		borderRadius: 10,
		borderWidth: 1,
		borderColor: "#E5E7EB",
		marginBottom: height(2.5),
	},
	emailDisplayText: {
		fontSize: font(1.5),
		color: "#4B5563",
		flex: 1,
		marginRight: 8,
	},
	emailHighlight: {
		fontWeight: "700",
		color: dark,
	},
	editEmailLink: {
		fontSize: font(1.5),
		fontWeight: "700",
		color: dark_primary,
		textDecorationLine: "underline",
	},
	otpContainer: {
		flexDirection: "row",
		justifyContent: "space-between",
		marginBottom: height(2),
		gap: 12,
	},
	otpBox: {
		flex: 1,
		height: 60,
		borderWidth: 1.5,
		borderColor: "#D1D5DB",
		borderRadius: 12,
		textAlign: "center",
		fontSize: font(2.6),
		fontWeight: "700",
		color: dark,
		backgroundColor: "#F9FAFB",
	},
	otpBoxFilled: {
		borderColor: primary,
		backgroundColor: white,
	},
	otpBoxError: {
		borderColor: "#DC2626",
		backgroundColor: "#FEF2F2",
	},
	otpErrorText: {
		fontSize: font(1.4),
		color: "#DC2626",
		textAlign: "center",
		marginBottom: height(1.5),
		fontWeight: "500",
	},
	resendContainer: {
		alignItems: "center",
		justifyContent: "center",
		marginBottom: height(3),
		marginTop: height(0.5),
	},
	resendTimerText: {
		fontSize: font(1.5),
		color: "#6B7280",
	},
	boldTimer: {
		fontWeight: "700",
		color: dark,
	},
	resendActiveLink: {
		fontSize: font(1.55),
		fontWeight: "700",
		color: dark_primary,
		textDecorationLine: "underline",
	},
	primaryButton: {
		backgroundColor: primary,
		height: 52,
		borderRadius: 14,
		alignItems: "center",
		justifyContent: "center",
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.08,
		shadowRadius: 4,
		elevation: 2,
	},
	primaryButtonText: {
		fontSize: font(1.8),
		fontWeight: "700",
		color: dark,
	},
});
