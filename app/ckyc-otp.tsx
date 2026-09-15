import { TranslatedText } from "@/components/TranslatedText";
import { IconSymbol } from "@/components/ui/IconSymbol";
import { dark, primary, white } from "@/constants/Colors";
import { useJourneyTracker } from "@/hooks/useJourneyTracker";
import { useTranslation } from "@/hooks/useTranslation";
import { axios } from "@/utils/api";
import { font, height, width } from "@/utils/dimensions";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useRef, useState } from "react";
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

export default function CKYCOTP() {
	const { t } = useTranslation();
	useJourneyTracker("/ckyc-otp");

	const [otp, setOtp] = useState(["", "", "", "", "", ""]);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [attemptCount, setAttemptCount] = useState(0);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const inputRefs = useRef<(TextInput | null)[]>([]);
	const RESEND_TIME = 60;

	const [resendTimer, setResendTimer] = useState(RESEND_TIME);
	const [canResend, setCanResend] = useState(false);
	const resendIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

	const startResendTimer = () => {
		if (resendIntervalRef.current) {
			clearInterval(resendIntervalRef.current);
			resendIntervalRef.current = null;
		}

		setCanResend(false);
		setResendTimer(RESEND_TIME - 1);

		resendIntervalRef.current = setInterval(() => {
			setResendTimer((prev) => {
				if (prev <= 1) {
					if (resendIntervalRef.current) {
						clearInterval(resendIntervalRef.current);
						resendIntervalRef.current = null;
					}
					setCanResend(true);
					return 0;
				}
				return prev - 1;
			});
		}, 1000);
	};

	useEffect(() => {
		startResendTimer();

		return () => {
			if (resendIntervalRef.current) {
				clearInterval(resendIntervalRef.current);
			}
		};
	}, []);

	useEffect(() => {
		const showSub = Keyboard.addListener("keyboardDidShow", () => {});
		const back = BackHandler.addEventListener("hardwareBackPress", () => {
			router.replace("/ckyc-instructions");
			return true;
		});

		return () => {
			showSub.remove();
			back.remove();
		};
	}, []);

	const handleOtpChange = (value: string, index: number) => {
		// Only allow numeric characters
		const numericValue = value.replace(/[^0-9]/g, "");

		const newOtp = [...otp];
		newOtp[index] = numericValue;
		setOtp(newOtp);

		// Move to next input if value is entered
		if (numericValue && index < 5) {
			inputRefs.current[index + 1]?.focus();
		} else if (numericValue && index === 5) {
			// Dismiss keyboard after last digit is entered
			Keyboard.dismiss();
		}
	};

	const handleResendOtp = async () => {
		if (!canResend) return;

		try {
			if (__DEV__) {
				console.log("📤 [CKYC] Resending CKYC OTP...");
			}
			await axios.post("onefin/ckyc/resend-otp");
			startResendTimer();
		} catch (e) {
			if (__DEV__) {
				console.warn("⚠️ [CKYC] Resend OTP failed, allowing retry");
			}
			setCanResend(true);
		}
	};

	const handleKeyPress = (e: any, index: number) => {
		if (e.nativeEvent.key === "Backspace") {
			if (!otp[index] && index > 0) {
				const newOtp = [...otp];
				newOtp[index - 1] = "";
				setOtp(newOtp);

				setTimeout(() => {
					inputRefs.current[index - 1]?.focus();
				}, 0);
			}
		}
	};

	const handleSubmit = async () => {
		const otpString = otp.join("");
		if (otpString.length !== 6) return;
		setIsSubmitting(true);
		setErrorMessage(null);

		try {
			if (__DEV__) {
				console.log("📤 [CKYC] Validating 6-digit OTP...");
			}
			const response = await axios.post("onefin/ckyc/validate-otp", { otp: otpString });

			if (__DEV__) {
				console.log("✅ [CKYC] OTP validated successfully (status: 200)");
			}

			// After OTP success, reset attempt count and proceed
			setAttemptCount(0);
			setErrorMessage(null);

			// Extract address parts and hand off to ckyc-instructions
			const addrPerm = JSON.stringify(
				response.data?.ckyc_data?.permanent_address_parts || {}
			);
			const addrCorr = JSON.stringify(
				response.data?.ckyc_data?.correspondence_address_parts || {}
			);

			router.replace({
				pathname: "/ckyc-instructions",
				params: { startSelfie: "true", permAddressData: addrPerm, corrAddressData: addrCorr },
			});
		} catch (error: any) {
			// Increment attempt count
			const newAttemptCount = attemptCount + 1;
			setAttemptCount(newAttemptCount);

			// Check if this is the last attempt (3rd attempt)
			const isLastAttempt = newAttemptCount >= 3;

			// Extract remaining attempts from API response (if available)
			let remainingAttempts = 3 - newAttemptCount;

			try {
				const errorData = error?.response?.data;
				const rawErrorMsg = errorData?.error?.message || errorData?.message || "";
				const remainingMatch = rawErrorMsg.match(/Remaining attempts: (\d+)/i);
				if (remainingMatch) {
					remainingAttempts = parseInt(remainingMatch[1], 10);
				}
			} catch (e) {
				// Ignore JSON parse errors
			}

			if (__DEV__) {
				console.log(
					`❌ [CKYC] OTP validation failed. Attempt ${newAttemptCount}/3. Remaining: ${remainingAttempts}`
				);
			}

			// If last attempt failed, silently fallback directly to /aadhaar-kyc without showing error
			if (isLastAttempt || remainingAttempts <= 0) {
				if (__DEV__) {
					console.log(
						"❌ [CKYC] CKYC verification failed after 3 attempts — silently falling back to Aadhaar KYC (/aadhaar-kyc)"
					);
				}
				setErrorMessage(null);
				setOtp(["", "", "", "", "", ""]);
				router.replace("/aadhaar-kyc" as any);
				return;
			}

			// Professional error message (not showing raw API error)
			const professionalErrorMsg = t(
				"invalidOtpEnteredPleaseTryAgain",
				"Invalid OTP entered. Please try again."
			);

			// Show error message with remaining attempts count (for attempts 1 and 2)
			setErrorMessage(professionalErrorMsg);

			// Clear OTP fields after failed attempt and focus first input
			setOtp(["", "", "", "", "", ""]);
			inputRefs.current[0]?.focus();
		} finally {
			setTimeout(() => setIsSubmitting(false), 300);
		}
	};

	return (
		<View style={styles.container}>
			<StatusBar style="dark" />
			<Stack.Screen
				options={{
					headerShown: true,
					title: t("ckycVerification", "CKYC Verification"),
					headerLeft: () => (
						<TouchableOpacity
							onPress={() => router.replace("/ckyc-instructions")}
							style={styles.headerBackButton}
							hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
							accessibilityLabel="Back to CKYC instructions"
						>
							<MaterialIcons name="arrow-back" size={24} color={dark} />
						</TouchableOpacity>
					),
				}}
			/>

			<View style={styles.card}>
				<TranslatedText
					style={styles.subtitle}
					translationKey={"enter6DigitOtpSentToRegisteredMobile" as any}
					fallback="Please enter the 6 digit OTP sent to your registered mobile number."
				/>

				{/* OTP Input Boxes */}
				<View style={styles.otpContainer}>
					{otp.map((digit, index) => (
						<TextInput
							key={index}
							ref={(ref) => {
								inputRefs.current[index] = ref;
							}}
							style={[styles.otpInput, errorMessage ? styles.otpInputError : null]}
							value={digit}
							onChangeText={(value) => {
								handleOtpChange(value, index);
								if (errorMessage) {
									setErrorMessage(null);
								}
							}}
							onKeyPress={(e) => handleKeyPress(e, index)}
							keyboardType="numeric"
							maxLength={1}
							textAlign="center"
							editable={!isSubmitting}
						/>
					))}
				</View>

				{/* Error Message */}
				{errorMessage ? (
					<View style={styles.errorContainer}>
						<Text style={styles.errorText}>
							{errorMessage}
							{attemptCount < 3 &&
								` (${3 - attemptCount} ${
									3 - attemptCount !== 1
										? t("attemptsRemaining", "attempts remaining")
										: t("attemptRemaining", "attempt remaining")
								})`}
						</Text>
					</View>
				) : null}

				{/* CTA Button */}
				<TouchableOpacity
					style={[
						styles.ctaBtn,
						(otp.join("").length !== 6 || isSubmitting) && styles.ctaDisabled,
					]}
					onPress={handleSubmit}
					disabled={otp.join("").length !== 6 || isSubmitting}
					activeOpacity={0.85}
				>
					{isSubmitting ? (
						<ActivityIndicator color={dark} />
					) : (
						<View style={styles.ctaContentRow}>
							<TranslatedText
								style={styles.ctaText}
								translationKey={"verifyAndContinue" as any}
								fallback="Verify and Continue"
							/>
							<IconSymbol name="arrow.right" size={20} color={dark} />
						</View>
					)}
				</TouchableOpacity>

				{/* Resend OTP Button */}
				<TouchableOpacity
					style={[styles.resendBtn, !canResend && { opacity: 0.6 }]}
					onPress={handleResendOtp}
					disabled={!canResend}
					activeOpacity={0.7}
				>
					<Text style={[styles.resendText, !canResend && styles.resendDisabled]}>
						{canResend
							? t("resendOTP", "Resend OTP")
							: `${t("resendOTP", "Resend OTP")} (${resendTimer}s)`}
					</Text>
				</TouchableOpacity>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: white,
		paddingTop: height(6),
		paddingHorizontal: width(6),
	},
	headerBackButton: {
		marginRight: 16,
		padding: 4,
	},
	card: {
		backgroundColor: white,
		borderRadius: width(4),
		padding: width(5),
		elevation: 2,
		shadowColor: "#000",
		shadowOpacity: 0.06,
		shadowRadius: 8,
		shadowOffset: { width: 0, height: 2 },
	},
	subtitle: {
		marginTop: height(1),
		fontSize: font(1.6),
		color: "#6B7280",
		textAlign: "center",
		lineHeight: font(2.2),
	},
	otpContainer: {
		flexDirection: "row",
		justifyContent: "space-between",
		marginTop: height(3),
		paddingHorizontal: width(2),
	},
	otpInput: {
		width: width(10),
		height: width(12),
		borderRadius: width(2),
		borderWidth: 2,
		borderColor: "#E5E7EB",
		fontSize: font(2.2),
		color: dark,
		fontWeight: "700",
		backgroundColor: white,
	},
	ctaBtn: {
		marginTop: height(3),
		backgroundColor: primary,
		paddingVertical: height(1.8),
		borderRadius: width(3),
		alignItems: "center",
	},
	ctaDisabled: {
		opacity: 0.6,
	},
	ctaContentRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
	},
	ctaText: {
		color: dark,
		fontWeight: "700",
		fontSize: font(2),
	},
	resendBtn: {
		marginTop: height(2),
		alignItems: "center",
		paddingVertical: 6,
	},
	resendText: {
		color: primary,
		fontWeight: "600",
		fontSize: font(1.6),
	},
	resendDisabled: {
		color: "#9CA3AF",
	},
	otpInputError: {
		borderColor: "#EF4444",
		backgroundColor: "#FEF2F2",
	},
	errorContainer: {
		marginTop: height(2),
		paddingHorizontal: width(2),
	},
	errorText: {
		fontSize: font(1.4),
		color: "#EF4444",
		textAlign: "center",
		lineHeight: 20,
	},
});
