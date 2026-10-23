import { TranslatedText } from "@/components/TranslatedText";
import { dark, white } from "@/constants/Colors";
import { Images } from "@/constants/images";
import { useTranslation } from "@/hooks/useTranslation";
import { Logger } from "@/utils/logger";
import { getApiErrorInfo } from "@/utils/api/errors";
import {
	sendSanctionOtp,
	verifySanctionOtp,
} from "@/utils/api/services/loanOffer.service";
import { height, width } from "@/utils/dimensions";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
	ActivityIndicator,
	Animated,
	BackHandler,
	Keyboard,
	Modal,
	StyleSheet,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from "react-native";
import Toast from "react-native-toast-message";

const PHONE_OTP = Images.PHONE_OTP;
const SUCCESS_ICON = Images.SUCCESS_ICON;

export default function LoanEnterOTP() {
	const router = useRouter();
	const queryClient = useQueryClient();
	const { t } = useTranslation();

	const { sanction_number, accepted_amount, selected_due_date } =
		useLocalSearchParams<{
			sanction_number?: string;
			accepted_amount?: string;
			selected_due_date?: string;
		}>();

	const [otp, setOtp] = useState(["", "", "", ""]);
	const [, setTimer] = useState(60);
	const [resendCooldown, setResendCooldown] = useState(30);
	const [isSendingOtp, setIsSendingOtp] = useState(false);
	const [isVerifying, setIsVerifying] = useState(false);
	const [isSuccess, setIsSuccess] = useState(false);
	const [consentAccepted, setConsentAccepted] = useState(false);
	const [disableContinueUntilResend, setDisableContinueUntilResend] =
		useState(false);
	const [modalVisible, setModalVisible] = useState(false);

	const inputRefs = useRef<(TextInput | null)[]>([]);
	const scaleAnim = useRef(new Animated.Value(0)).current;
	const initialSendCalled = useRef(false);

	const handleSendOtp = async (isResend = false) => {
		if (isSendingOtp) return;
		setIsSendingOtp(true);
		try {
			Logger.debug("Sending sanction OTP", { isResend });
			const res = await sendSanctionOtp();
			Logger.debug("Sanction OTP sent successfully");

			const expiry = res.expires_in_seconds || 60;
			setTimer(expiry);
			setResendCooldown(30);
			setDisableContinueUntilResend(false);

			if (isResend) {
				setOtp(["", "", "", ""]);
				inputRefs.current[0]?.focus();
				Toast.show({
					type: "success",
					text1: t("otpSentSuccessfully"),
					text2: res.message || "OTP sent successfully",
				});
			}
		} catch (err: any) {
			const info = getApiErrorInfo(err);
			const { status, detail } = info;
			Logger.debug("Send sanction OTP error", { status });

			if (status === 429) {
				Toast.show({
					type: "info",
					text1: t("pleaseTryAgain"),
					text2:
						detail ||
						"Too many requests. Please wait before retrying.",
				});
				setResendCooldown(30);
			} else {
				Toast.show({
					type: "error",
					text1: t("error") || "Error",
					text2:
						detail ||
						t("failedToResendOTP"),
				});
			}
		} finally {
			setIsSendingOtp(false);
		}
	};

	// On first mount send OTP once (guarded against React strict mode)
	useEffect(() => {
		if (!initialSendCalled.current) {
			initialSendCalled.current = true;
			handleSendOtp(false);
		}
	}, []);

	// Countdown interval
	useEffect(() => {
		const interval = setInterval(() => {
			setTimer((prev) => (prev > 0 ? prev - 1 : 0));
			setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
		}, 1000);

		return () => clearInterval(interval);
	}, []);

	// Handle hardware back button - do not allow back after successful verification
	useEffect(() => {
		const backHandler = BackHandler.addEventListener(
			"hardwareBackPress",
			() => {
				if (isSuccess) {
					return true;
				}
				router.back();
				return true;
			},
		);

		return () => {
			backHandler.remove();
		};
	}, [router, isSuccess]);

	const handleOtpChange = (value: string, index: number) => {
		const newOtp = [...otp];
		newOtp[index] = value;
		setOtp(newOtp);

		// Move to next input if value is entered
		if (value && index < 3) {
			inputRefs.current[index + 1]?.focus();
		} else if (value && index === 3) {
			// Dismiss keyboard after last digit is entered
			Keyboard.dismiss();
		}
	};

	const handleKeyPress = (e: any, index: number) => {
		// Move to previous input on backspace
		if (e.nativeEvent.key === "Backspace" && !otp[index] && index > 0) {
			inputRefs.current[index - 1]?.focus();
		}
	};

	const handleContinue = async () => {
		const enteredOtp = otp.join("").trim();
		if (enteredOtp.length !== 4 || isVerifying || disableContinueUntilResend || !consentAccepted) {
			return;
		}

		setIsVerifying(true);
		try {
			Logger.debug("Verifying sanction OTP");
			await verifySanctionOtp({
				otp: enteredOtp,
				sanction_number,
				accepted_amount: accepted_amount
					? Number(accepted_amount)
					: undefined,
				selected_due_date,
			});
			Logger.debug("Sanction OTP verified successfully");

			setIsSuccess(true);
			queryClient.invalidateQueries({ queryKey: ["user", "dashboard"] });

			// Show success modal
			scaleAnim.setValue(0);
			setModalVisible(true);
			Animated.timing(scaleAnim, {
				toValue: 1,
				duration: 250,
				useNativeDriver: true,
			}).start();

			// Navigate to /verify-bank-details after modal animation
			setTimeout(() => {
				setModalVisible(false);
				router.replace("/verify-bank-details");
			}, 1500);
		} catch (err: any) {
			const info = getApiErrorInfo(err);
			const { status, detail } = info;
			Logger.debug("Verify sanction OTP error", { status });

			if (status === 400) {
				setOtp(["", "", "", ""]);
				inputRefs.current[0]?.focus();
				Toast.show({
					type: "error",
					text1: t("error") || "Error",
					text2: detail || "Invalid OTP entered",
				});
				return;
			}

			if (status === 429) {
				setDisableContinueUntilResend(true);
				Toast.show({
					type: "error",
					text1: t("error") || "Error",
					text2:
						detail ||
						"Too many attempts. Please resend OTP.",
				});
				return;
			}

			if (status === 403 || status === 409) {
				queryClient.invalidateQueries({ queryKey: ["user", "dashboard"] });
				router.replace("/(tabs)");
				return;
			}

			Toast.show({
				type: "error",
				text1: t("error") || "Error",
				text2:
					detail ||
					info.message ||
					"Verification failed. Please try again.",
			});
		} finally {
			setIsVerifying(false);
		}
	};

	const handleResend = () => {
		if (resendCooldown > 0 || isSendingOtp) return;
		handleSendOtp(true);
	};

	const formatTime = (seconds: number) => {
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}s`;
	};

	return (
		<>
			<Stack.Screen options={{ headerShown: false }} />
			<View style={styles.container}>
				{/* Header */}
				<View style={styles.header}>
					<TouchableOpacity
						style={styles.backButton}
						onPress={() => {
							if (!isSuccess) {
								router.back();
							}
						}}>
						<Ionicons name="arrow-back" size={24} color={dark} />
					</TouchableOpacity>
				</View>

				{/* Phone OTP Image */}
				<View style={styles.imageContainer}>
					<Image
						source={PHONE_OTP}
						style={styles.phoneImage}
						contentFit="contain"
					/>
				</View>

				{/* Enter OTP Section */}
				<View style={styles.content}>
					<TranslatedText style={styles.heading} translationKey="enterOTP" />

					{/* OTP Input Boxes */}
					<View style={styles.otpContainer}>
						{otp.map((digit, index) => (
							<TextInput
								key={index}
								ref={(ref) => {
									inputRefs.current[index] = ref;
								}}
								style={styles.otpInput}
								value={digit}
								onChangeText={(value) => handleOtpChange(value, index)}
								onKeyPress={(e) => handleKeyPress(e, index)}
								keyboardType="numeric"
								maxLength={1}
								textAlign="center"
							/>
						))}
					</View>

					{/* Didn't Receive OTP */}
					<TranslatedText
						style={styles.didntReceiveText}
						translationKey="didntReceiveOTP"
					/>

					{/* Resend Timer */}
					<TouchableOpacity
						onPress={
							resendCooldown === 0 && !isSendingOtp ? handleResend : undefined
						}
						disabled={resendCooldown > 0 || isSendingOtp}
						style={styles.resendContainer}>
						{isSendingOtp ? (
							<ActivityIndicator size="small" color="#007AFF" />
						) : (
							<Text
								style={[
									styles.resendText,
									resendCooldown === 0 && styles.resendActive,
								]}>
								{resendCooldown > 0
									? `${t("resendIn")} ${formatTime(resendCooldown)}`
									: t("resendOTP") || t("resend") || "Resend OTP"}
							</Text>
						)}
					</TouchableOpacity>

					{/* Consent Text */}
					<TouchableOpacity
						style={styles.consentRow}
						activeOpacity={0.8}
						onPress={() => setConsentAccepted((accepted) => !accepted)}
						accessibilityRole="checkbox"
						accessibilityState={{ checked: consentAccepted }}>
						<View style={[styles.consentCheckbox, consentAccepted && styles.consentCheckboxChecked]}>
							{consentAccepted && <Ionicons name="checkmark" size={16} color={white} />}
						</View>
						<TranslatedText style={styles.consentText} translationKey="consentToSign" />
					</TouchableOpacity>
					{otp.every((digit) => digit.trim() !== "") && !consentAccepted && <Text style={{ color: "#B45309", fontSize: 13, marginTop: height(0.8) }}>{t("consentRequiredHint")}</Text>}

					{/* Warning Text */}
					<TranslatedText
						style={styles.warningText}
						translationKey="warningIgnoreCode"
					/>
				</View>

				{/* Continue Button */}
				<View style={styles.bottomContainer}>
					<TouchableOpacity
						style={[
							styles.continueButton,
							otp.every((digit) => digit.trim() !== "") &&
								!isVerifying &&
								!disableContinueUntilResend &&
								consentAccepted &&
								styles.continueButtonActive,
						]}
						onPress={handleContinue}
						disabled={
							!otp.every((digit) => digit.trim() !== "") ||
							isVerifying ||
							disableContinueUntilResend ||
							!consentAccepted
						}>
						{isVerifying ? (
							<ActivityIndicator size="small" color="#333" />
						) : (
							<TranslatedText
								style={styles.continueButtonText}
								translationKey="continue"
							/>
						)}
					</TouchableOpacity>
				</View>

				{/* Success Modal */}
				<Modal
					visible={modalVisible}
					transparent={true}
					animationType="fade">
					<View style={styles.modalOverlay}>
						<View style={styles.modalContent}>
							<Animated.Image
								source={SUCCESS_ICON}
								style={[
									styles.successImage,
									{ transform: [{ scale: scaleAnim }] },
								]}
								resizeMode="contain"
							/>
							<TranslatedText
								style={styles.successTitle}
								translationKey="loanAgreementSigned"
							/>
						</View>
					</View>
				</Modal>
			</View>
		</>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: white,
	},
	header: {
		paddingHorizontal: width(4),
		paddingTop: height(6),
		paddingBottom: height(2),
		borderBottomWidth: 1,
		borderBottomColor: "#E5E5E5",
	},
	backButton: {
		padding: 8,
		alignSelf: "flex-start",
	},
	imageContainer: {
		alignItems: "center",
		paddingTop: height(4),
		borderBottomWidth: 1,
		borderBottomColor: "#E5E5E5",
		width: width(80),
		marginHorizontal: width(10),
	},
	phoneImage: {
		width: width(60),
		height: height(25),
		bottom: -height(1),
	},
	content: {
		flex: 1,
		paddingHorizontal: width(6),
		paddingTop: height(4),
	},
	heading: {
		fontSize: 24,
		fontWeight: "600",
		color: dark,
		marginBottom: height(3),
		textAlign: "left",
	},
	otpContainer: {
		flexDirection: "row",
		justifyContent: "flex-start",
		marginBottom: height(4),
	},
	otpInput: {
		width: width(12),
		height: height(6),
		borderWidth: 1,
		borderColor: "#CCCCCC",
		borderRadius: 8,
		fontSize: 20,
		fontWeight: "600",
		color: dark,
		marginHorizontal: width(2),
	},
	didntReceiveText: {
		fontSize: 16,
		color: "#666666",
		marginBottom: height(1),
		textAlign: "left",
	},
	resendContainer: {
		alignSelf: "center",
		marginBottom: height(6),
	},
	resendText: {
		fontSize: 16,
		color: "#666666",
		textDecorationLine: "underline",
		textAlign: "left",
	},
	resendActive: {
		color: "#007AFF",
	},
	consentRow: {
		flexDirection: "row",
		alignItems: "flex-start",
		gap: width(3),
		marginBottom: height(2),
		paddingHorizontal: width(4),
	},
	consentCheckbox: {
		width: 22,
		height: 22,
		marginTop: 1,
		borderWidth: 1.5,
		borderColor: "#666666",
		borderRadius: 4,
		alignItems: "center",
		justifyContent: "center",
	},
	consentCheckboxChecked: {
		backgroundColor: "#15803d",
		borderColor: "#15803d",
	},
	consentText: {
		flex: 1,
		fontSize: 14,
		color: dark,
		textAlign: "left",
		lineHeight: 20,
		marginBottom: 0,
		paddingHorizontal: 0,
	},
	warningText: {
		fontSize: 14,
		color: "#666666",
		textAlign: "center",
		lineHeight: 20,
		paddingHorizontal: width(4),
	},
	bottomContainer: {
		paddingHorizontal: width(6),
		paddingVertical: height(3),
		backgroundColor: white,
	},
	continueButton: {
		backgroundColor: "#A4E65E",
		borderRadius: 25,
		paddingVertical: height(2),
		alignItems: "center",
		width: "100%",
		opacity: 0.5,
	},
	continueButtonActive: {
		opacity: 1,
	},
	continueButtonText: {
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
	modalContent: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		width: "100%",
		height: "100%",
		backgroundColor: "white",
		borderRadius: 0,
		alignItems: "center",
		justifyContent: "center",
	},
	successImage: {
		width: width(40),
		height: width(40),
		marginBottom: height(4),
	},
	successTitle: {
		fontSize: 22,
		fontWeight: "700",
		color: "#333",
		textAlign: "center",
		marginBottom: height(2),
		lineHeight: 30,
	},
	successSubtitle: {
		fontSize: 14,
		color: "#333",
		textAlign: "center",
		marginTop: 0,
	},
});
