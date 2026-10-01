import { TranslatedText } from "@/components/TranslatedText";
import { dark, dark_primary, white } from "@/constants/Colors";
import { IconSymbol } from "@/components/ui/IconSymbol";
import { Images } from "@/constants/images";
import { useAuth } from "@/hooks/useAuth";
import { useNetworkAwareMutation } from "@/hooks/useNetworkAwareMutation";
import { useTranslation } from "@/hooks/useTranslation";
import RNOtpVerify from "@/utils/otpVerify";
import {
	errorHandler,
	initiateDigitalSigning,
	verifyOtpAndSign,
	type VerifyOtpAndSignRequestType,
} from "@/utils/api";
import { height, width } from "@/utils/dimensions";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useNavigation, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
	ActivityIndicator,
	Animated,
	BackHandler,
	Keyboard,
	Modal,
	Platform,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	TouchableOpacity,
	View
} from "react-native";
import Toast from "react-native-toast-message";

const PHONE_OTP = Images.PHONE_OTP;
const SUCCESS_ICON = Images.SUCCESS_ICON;

export default function EnterOTP() {
	const router = useRouter();
	const navigation = useNavigation();
	const { t } = useTranslation();
	const { logout, handleMpinSignIn } = useAuth();
	const [otp, setOtp] = useState(["", "", "", ""]);
	const [timer, setTimer] = useState(53);
	const [modalVisible, setModalVisible] = useState(false);
	const inputRefs = useRef<(TextInput | null)[]>([]);
	const scaleAnim = useRef(new Animated.Value(0)).current;

	// Verify OTP and Sign Mutation
	const { mutate: verifyOtpAndSignMutation, isPending: isVerifying } = useNetworkAwareMutation({
		mutationFn: verifyOtpAndSign,
		onSuccess: (data) => {
			console.log("Verify OTP and Sign API Response:", data);
			console.log("Digital Signing Success:", JSON.stringify(data, null, 2));

			if (data?.status === "signed") {
				Toast.show({
					type: "success",
					text1: t("documentsSignedSuccessfully"),
					text2: data?.message || t("allDocumentsDigitallySigned"),
				});

				// Show success modal
				scaleAnim.setValue(0);
				setModalVisible(true);

				setTimeout(() => {
					console.log("Navigating to auto-debit-setup");
					router.push("/auto-debit-setup");

					setTimeout(() => {
						setModalVisible(false);
					}, 1000);
				}, 3000);
			} else {
				Toast.show({
					type: "error",
					text1: t("otpVerificationFailed"),
					text2: data?.message || t("invalidOTPTryAgain"),
				});
			}
		},
		onError: (err: any, variables, ctx) => {
			console.log("❌ Verify OTP and Sign API Error:", err);
			console.log("📤 Request payload that failed:", JSON.stringify(variables, null, 2));

			const { error, errorType } = errorHandler(err, variables, ctx);

			console.log("🔥 Processed Error:", error);
			console.log("🔥 Error Type:", errorType);

			// Show detailed error message
			let errorMessage = t("pleaseLoginAgain");
			if (err?.response?.data?.message) {
				errorMessage = err.response.data.message;
			} else if (err?.response?.data?.detail) {
				errorMessage =
					typeof err.response.data.detail === "string"
						? err.response.data.detail
						: JSON.stringify(err.response.data.detail);
			} else if (error?.message) {
				errorMessage = error.message;
			}

			Toast.show({
				type: "error",
				text1: t("otpVerificationFailed"),
				text2: errorMessage,
			});
		},
	});

	// Resend OTP Mutation
	const { mutate: resendOtpMutation, isPending: isResending } = useNetworkAwareMutation({
		mutationFn: initiateDigitalSigning,
onSuccess: (data) => {
	console.log("Resend OTP API Response:", data);

	if (data?.message) {
		Toast.show({
			type: "success",
			text1: t("otpResentSuccessfully"),
			text2: data.message,
		});

		setTimer(53);               // reset timer
		setOtp(["", "", "", ""]);   // clear inputs
		inputRefs.current[0]?.focus();
		startOtpListener();
	} else {
		Toast.show({
			type: "error",
			text1: t("failedToResendOTP"),
			text2: t("pleaseLoginAgain"),
		});
	}
},

		onError: (err: any, variables, ctx) => {
			console.log("❌ Resend OTP API Error:", err);

			const { error } = errorHandler(err, variables, ctx);

			Toast.show({
				type: "error",
				text1: t("failedToResendOTP"),
				text2: error?.message ?? t("pleaseLoginAgain"),
			});
		},
	});

	// FIX: Remove exit alert - allow direct back navigation to sanction letter
	useEffect(() => {
		// Prevent any navigation alert by intercepting beforeRemove event
		const unsubscribe = navigation.addListener("beforeRemove", (e) => {
			// If the action would show an alert, prevent it
			if (e.data.action.type === 'GO_BACK') {
				e.preventDefault(); // Prevent the alert
				// Allow the navigation to proceed
				navigation.dispatch(e.data.action);
			}
		});

		// Handle hardware back button - go back directly to sanction letter without alert
		const backHandler = BackHandler.addEventListener("hardwareBackPress", () => {
			router.back();
			return true; // Prevent default behavior
		});

		return () => {
			unsubscribe();
			backHandler.remove();
		};
	}, [navigation, router]);

	// OLD CODE - Back handler with exit confirmation (COMMENTED OUT)
	// useEffect(() => {
	// 	const backHandler = BackHandler.addEventListener("hardwareBackPress", () => {
	// 		Alert.alert(
	// 			t("exitApp"),
	// 			t("areYouSureExitApp"),
	// 			[
	// 				{
	// 					text: t("cancel"),
	// 					style: "cancel",
	// 				},
	// 				{
	// 					text: t("exit"),
	// 					onPress: async () => {
	// 						// Clear all temporary/session data
	// 						await removeMultipleStorageItems(TempKeys);
	// 						
	// 						// Logout user and clear auth session
	// 						handleMpinSignIn(false); // Clear mpin session
	// 						logout(); // Clear all auth data
	// 						
	// 						// Exit the app
	// 						BackHandler.exitApp();
	// 					},
	// 				},
	// 			],
	// 			{ cancelable: false }
	// 		);
	// 		return true; // Prevent default back behavior
	// 	});

	// 	return () => {
	// 		backHandler.remove();
	// 	};
	// }, [t, logout, handleMpinSignIn]);

	const autoVerify = (otpCode: string) => {
		console.log("🚀 [Auto-OTP] Auto-verifying with OTP code:", otpCode);
		const apiData: VerifyOtpAndSignRequestType = {
			otp: otpCode,
		};
		verifyOtpAndSignMutation(apiData);
	};

	const startOtpListener = () => {
		if (Platform.OS !== "android") return;

		console.log("📱 [Auto-OTP] Starting/Restarting OTP listener...");
		RNOtpVerify.getOtp()
			.then((p) => {
				console.log("📱 [Auto-OTP] Listener registered:", p);
				RNOtpVerify.addListener((message) => {
					console.log("📥 [Auto-OTP] Incoming SMS received:", message);
					try {
						const parsedOtp = /(\d{4})/.exec(message)?.[1];
						if (parsedOtp && parsedOtp.length === 4) {
							console.log("✅ [Auto-OTP] OTP parsed successfully:", parsedOtp);
							setOtp([parsedOtp[0], parsedOtp[1], parsedOtp[2], parsedOtp[3]]);
							RNOtpVerify.removeListener();
							autoVerify(parsedOtp);
						} else {
							console.log("⚠️ [Auto-OTP] No valid 4-digit OTP parsed");
						}
					} catch (err) {
						console.error("❌ [Auto-OTP] Error handling SMS parsing:", err);
					}
				});
			})
			.catch((err) => {
				console.error("❌ [Auto-OTP] Failed to start SMS retriever:", err);
			});
	};

	useEffect(() => {
		startOtpListener();
		return () => {
			if (Platform.OS === "android") {
				RNOtpVerify.removeListener();
			}
		};
	}, []);

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
	}, [modalVisible, scaleAnim]);

	const handleOtpChange = (value: string, index: number) => {
		// Only allow numeric characters
		const numericValue = value.replace(/[^0-9]/g, "");

		const newOtp = [...otp];
		newOtp[index] = numericValue;
		setOtp(newOtp);

		// Move to next input if value is entered
		if (numericValue && index < 3) {
			inputRefs.current[index + 1]?.focus();
		} else if (numericValue && index === 3) {
			// Dismiss keyboard after last digit is entered
			Keyboard.dismiss();
		}
	};

	const handleKeyPress = (e: any, index: number) => {
		if (e.nativeEvent.key === "Backspace") {
			if (otp[index] !== "") {
				// Current field has content, clear it
				const newOtp = [...otp];
				newOtp[index] = "";
				setOtp(newOtp);
			} else if (index > 0) {
				// Current field is empty, clear previous field and move focus
				const newOtp = [...otp];
				newOtp[index - 1] = "";
				setOtp(newOtp);

				// Use setTimeout to ensure state update happens before focus change
				setTimeout(() => {
					inputRefs.current[index - 1]?.focus();
				}, 0);
			}
		}
	};

	const handleContinue = () => {
		const otpString = otp.join("");
		console.log("🔍 Verifying OTP and signing documents:", otpString);

		// Validate OTP length
		if (otpString.length !== 4) {
			Toast.show({
				type: "error",
				text1: t("invalidOTP"),
				text2: t("pleaseEnter4DigitOTP"),
			});
			return;
		}

		// Prepare API payload
		const apiData: VerifyOtpAndSignRequestType = {
			otp: otpString,
		};

		console.log("📋 Verifying OTP and signing with payload:", JSON.stringify(apiData, null, 2));
		verifyOtpAndSignMutation(apiData);
	};

	const handleResend = async () => {
		if (timer > 0 || isResending) return;

		console.log("🔄 Resending OTP for digital signing...");
		let appHash = "";
		try {
			const hashes = await RNOtpVerify.getHash();
			if (hashes && hashes.length > 0) {
				appHash = hashes[0];
				console.log("🔑 [EnterOtp] Retrieved App Hash for OTP Auto-Fetch:", appHash);
			}
		} catch (hashError) {
			console.error("❌ [EnterOtp] Failed to get app hash:", hashError);
		}
		resendOtpMutation(appHash || undefined);
	};

	const formatTime = (seconds: number) => {
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}s`;
	};

	return (
		<View style={styles.container}>
			{/* Header */}
		<View style={styles.header}>
			<TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
				<Ionicons name="arrow-back" size={24} color={dark} />
			</TouchableOpacity>
		</View>

<ScrollView
  contentContainerStyle={{ paddingBottom: height(10) }} 
  keyboardShouldPersistTaps="handled"
  showsVerticalScrollIndicator={false}
>			
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
								editable={!isVerifying}
							/>
						))}
					</View>

					{Platform.OS === "android" && timer > 0 && (
						<View style={styles.autoDetectRow}>
							<ActivityIndicator size="small" color={dark_primary} style={styles.autoDetectLoader} />
							<TranslatedText
								style={styles.autoDetectText}
								translationKey="detectingOtpAutomatically"
							/>
						</View>
					)}

					{/* Didn't Receive OTP */}
					<TranslatedText
						style={styles.didntReceiveText}
						translationKey="didntReceiveOTP"
					/>

					{/* Resend Timer */}
					<TouchableOpacity
						onPress={timer === 0 && !isResending ? handleResend : undefined}
						style={styles.resendContainer}
						disabled={timer > 0 || isResending}>
						<Text
							style={[
								styles.resendText,
								timer === 0 && !isResending && styles.resendActive,
							]}>
							{isResending
								? t("resending")
								: timer === 0
									? t("resendOTP")
									: `${t("resendIn")} ${formatTime(timer)}`}
						</Text>
					</TouchableOpacity>

					{/* Consent Text */}
					<TranslatedText style={styles.consentText} translationKey="consentToSign" />

					{/* Warning Text */}
					<TranslatedText style={styles.warningText} translationKey="warningIgnoreCode" />
					{/* Continue Button */}
					<View style={styles.bottomContainer}>
						<TouchableOpacity
							style={[
								styles.continueButton,
								otp.every((digit) => digit) &&
									!isVerifying &&
									styles.continueButtonActive,
								isVerifying && styles.continueButtonDisabled,
							]}
							onPress={handleContinue}
							disabled={!otp.every((digit) => digit) || isVerifying}>
							{isVerifying ? (
								<ActivityIndicator size="small" color="#333" />
							) : (
								<View style={{ flexDirection: "row", alignItems: "center" }}>
									<TranslatedText
										style={styles.continueButtonText}
										translationKey="continue"
									/>
									<IconSymbol name="arrow.right" size={20} color="#333" />
								</View>
							)}
						</TouchableOpacity>
					</View>
				</View>
			</ScrollView>

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
							translationKey="sanctionLetterKFSSigned"
						/>
						<TranslatedText
							style={styles.successSubtitle}
							translationKey="sanctionLetterSubmitted"
						/>
					</View>
				</View>
			</Modal>
		</View>
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
		color: "#22C55E",
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
		paddingBottom: height(6),
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
	continueButtonDisabled: {
		opacity: 0.6,
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
	autoDetectRow: {
		flexDirection: "row",
		alignItems: "center",
		marginBottom: height(1.5),
		gap: width(2),
	},
	autoDetectText: {
		fontSize: 14,
		color: dark_primary,
		fontWeight: "500",
		textAlign: "left",
	},
	autoDetectLoader: {
		marginRight: width(1),
	},
});
