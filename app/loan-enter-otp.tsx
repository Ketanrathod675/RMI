import { TranslatedText } from "@/components/TranslatedText";
import { dark, white } from "@/constants/Colors";
import { Images } from "@/constants/images";
import { useTranslation } from "@/hooks/useTranslation";
import { height, width } from "@/utils/dimensions";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Stack, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { Animated, BackHandler, Keyboard, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

const PHONE_OTP = Images.PHONE_OTP;
const SUCCESS_ICON = Images.SUCCESS_ICON;

export default function LoanEnterOTP() {
	const router = useRouter();
	const { t } = useTranslation();
	const [otp, setOtp] = useState(["", "", "", ""]);
	const [timer, setTimer] = useState(53);
	const [modalVisible, setModalVisible] = useState(false);
	const inputRefs = useRef<(TextInput | null)[]>([]);
	const scaleAnim = useRef(new Animated.Value(0)).current;

	// FIX: Remove exit alert - allow direct back navigation to sanction letter
	useEffect(() => {
		// Handle hardware back button - go back directly to sanction letter without alert
		const backHandler = BackHandler.addEventListener("hardwareBackPress", () => {
			// Go back to sanction letter (sanction-letter now checks if it's focused before showing alert)
			router.back();
			return true; // Prevent default behavior
		});

		return () => {
			backHandler.remove();
		};
	}, [router]);

	useEffect(() => {
		const interval = setInterval(() => {
			setTimer((prev) => (prev > 0 ? prev - 1 : 0));
		}, 1000);

		return () => clearInterval(interval);
	}, []);

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
	}, [modalVisible]);

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

	const handleContinue = () => {
		// Handle OTP verification
		console.log("OTP:", otp.join(""));

		// Show success modal
		scaleAnim.setValue(0);
		setModalVisible(true);

		setTimeout(() => {
			router.push("/loan-congratulations");
		}, 3000);
	};

	const handleResend = () => {
		setTimer(53);
		setOtp(["", "", ""]);
		inputRefs.current[0]?.focus();
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
					<TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
						<Ionicons name="arrow-back" size={24} color={dark} />
					</TouchableOpacity>
				</View>

				{/* Phone OTP Image */}
				<View style={styles.imageContainer}>
					<Image source={PHONE_OTP} style={styles.phoneImage} contentFit="contain" />
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
						onPress={timer === 0 ? handleResend : undefined}
						style={styles.resendContainer}>
						<Text style={[styles.resendText, timer === 0 && styles.resendActive]}>
							{t("resendIn")} {formatTime(timer)}
						</Text>
					</TouchableOpacity>

					{/* Consent Text */}
					<TranslatedText style={styles.consentText} translationKey="consentToSign" />

					{/* Warning Text */}
					<TranslatedText style={styles.warningText} translationKey="warningIgnoreCode" />
				</View>

				{/* Continue Button */}
				<View style={styles.bottomContainer}>
					<TouchableOpacity
						style={[
							styles.continueButton,
							otp.every((digit) => digit) && styles.continueButtonActive,
						]}
						onPress={handleContinue}
						disabled={!otp.every((digit) => digit)}>
						<TranslatedText
							style={styles.continueButtonText}
							translationKey="continue"
						/>
					</TouchableOpacity>
				</View>

				{/* Success Modal */}
				<Modal visible={modalVisible} transparent={true} animationType="fade">
					<View style={styles.modalOverlay}>
						<View style={styles.modalContent}>
							<Animated.Image
								source={SUCCESS_ICON}
								style={[styles.successImage, { transform: [{ scale: scaleAnim }] }]}
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
	consentText: {
		fontSize: 14,
		color: dark,
		textAlign: "center",
		lineHeight: 20,
		marginBottom: height(2),
		paddingHorizontal: width(4),
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
