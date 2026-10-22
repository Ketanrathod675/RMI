import { TranslatedText } from "@/components/TranslatedText";
import { dark, dark_primary, white } from "@/constants/Colors";
import { IconSymbol } from "@/components/ui/IconSymbol";
import { Images } from "@/constants/images";
import { useNetworkAwareMutation } from "@/hooks/useNetworkAwareMutation";
import { useTranslation } from "@/hooks/useTranslation";
import RNOtpVerify from "@/utils/otpVerify";
import {
	signKfs,
	resendKfsOtp,
	type KfsSignRequest,
} from "@/utils/api";
import { getApiErrorInfo, errorText } from "@/utils/api/errors";
import Logger from "@/utils/logger";
import { useQueryClient } from "@tanstack/react-query";
import { height, width } from "@/utils/dimensions";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
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
	View,
} from "react-native";
import Toast from "react-native-toast-message";

const PHONE_OTP = Images.PHONE_OTP;
const SUCCESS_ICON = Images.SUCCESS_ICON;

export default function EnterOTP() {
	const router = useRouter();
	const navigation = useNavigation();
	const { t } = useTranslation();
	const queryClient = useQueryClient();

	const params = useLocalSearchParams<{
		sign_in_key?: string;
		expires_in_seconds?: string;
	}>();

	// Keep sign_in_key in React state; replaced on resend
	const [signInKey, setSignInKey] = useState<string | undefined>(
		params.sign_in_key ? String(params.sign_in_key) : undefined,
	);
	const [isLocked, setIsLocked] = useState(false);
	const [isConsentChecked, setIsConsentChecked] = useState(false);
	const [otp, setOtp] = useState(["", "", "", ""]);
	const [timer, setTimer] = useState(53);
	const [modalVisible, setModalVisible] = useState(false);
	const inputRefs = useRef<(TextInput | null)[]>([]);
	const scaleAnim = useRef(new Animated.Value(0)).current;

	// Verify OTP and Sign Mutation
	const { mutate: verifyOtpAndSignMutation, isPending: isVerifying } = useNetworkAwareMutation({
		mutationFn: (payload: KfsSignRequest) => signKfs(payload),
		onSuccess: (data) => {
			Logger.debug("KFS signing response received", {
				signed: data?.signed,
				status: data?.status,
			});

			if (data?.signed === true) {
				Logger.debug("KFS signed successfully");
				queryClient.invalidateQueries({ queryKey: ["user", "dashboard"] });
				setIsLocked(false);

				// Show success modal
				scaleAnim.setValue(0);
				setModalVisible(true);

				setTimeout(() => {
					router.replace("/auto-debit-setup");

					setTimeout(() => {
						setModalVisible(false);
					}, 1000);
				}, 3000);
			} else {
				Toast.show({
					type: "error",
					text1: t("otpVerificationFailed") || "OTP verification failed",
					text2: data?.message || t("invalidOTPTryAgain") || "Invalid OTP, please try again",
				});
			}
		},
		onError: (err: any) => {
			const info = getApiErrorInfo(err);
			const text = errorText(info);
			Logger.debug("KFS signing verification error", { status: info.status });

			if (info.status === 400) {
				if (text.includes("already signed")) {
					queryClient.invalidateQueries({ queryKey: ["user", "dashboard"] });
					router.replace("/auto-debit-setup");
					return;
				}
				setOtp(["", "", "", ""]);
				inputRefs.current[0]?.focus();
				Toast.show({
					type: "error",
					text1: t("otpVerificationFailed") || "OTP verification failed",
					text2: info.detail || info.message || t("invalidOTPTryAgain") || "Invalid OTP, please try again",
				});
				return;
			}

			if (info.status === 429) {
				setIsLocked(true);
				Toast.show({
					type: "error",
					text1: t("alert") || "Notice",
					text2: info.detail || info.message || "Too many attempts. Please wait or tap Resend.",
				});
				return;
			}

			if (info.status === 409) {
				queryClient.invalidateQueries({ queryKey: ["user", "dashboard"] });
				router.replace("/(tabs)");
				return;
			}

			Toast.show({
				type: "error",
				text1: t("otpVerificationFailed") || "OTP verification failed",
				text2: info.detail || info.message || t("pleaseTryAgain") || "Please try again",
			});
		},
	});

	// Resend OTP Mutation
	const { mutate: resendOtpMutation, isPending: isResending } = useNetworkAwareMutation({
		mutationFn: () => resendKfsOtp(),
		onSuccess: (data) => {
			Logger.debug("KFS OTP resent", { otp_sent: data?.otp_sent });

			if (data?.sign_in_key) {
				setSignInKey(data.sign_in_key);
			}
			setIsLocked(false);
			setOtp(["", "", "", ""]);
			inputRefs.current[0]?.focus();
			setTimer(53);
			startOtpListener();

			if (__DEV__ && data?.test_otp) {
				Toast.show({
					type: "info",
					text1: `Test OTP: ${data.test_otp}`,
					visibilityTime: 10000,
				});
			}

			Toast.show({
				type: "success",
				text1: t("otpResentSuccessfully") || "OTP Resent Successfully",
				text2: data?.message || t("checkRegisteredMobile") || "Please check your registered mobile number",
			});
		},
		onError: (err: any) => {
			const info = getApiErrorInfo(err);
			Logger.debug("KFS OTP resend error", { status: info.status });

			Toast.show({
				type: "error",
				text1: t("failedToResendOTP") || "Failed to resend OTP",
				text2: info.detail || info.message || t("pleaseTryAgain") || "Please try again",
			});
		},
	});

	// Back navigation handler
	useEffect(() => {
		const unsubscribe = navigation.addListener("beforeRemove", (e) => {
			if (e.data.action.type === "GO_BACK") {
				e.preventDefault();
				navigation.dispatch(e.data.action);
			}
		});

		const backHandler = BackHandler.addEventListener("hardwareBackPress", () => {
			router.back();
			return true;
		});

		return () => {
			unsubscribe();
			backHandler.remove();
		};
	}, [navigation, router]);

	const autoVerify = (otpCode: string) => {
		Logger.debug("Auto-verifying OTP from SMS");
		verifyOtpAndSignMutation({
			otp: otpCode,
			sign_in_key: signInKey,
		});
	};

	const startOtpListener = () => {
		if (Platform.OS !== "android") return;

		RNOtpVerify.getOtp()
			.then(() => {
				RNOtpVerify.addListener((message) => {
					try {
						const parsedOtp = /(\d{4})/.exec(message)?.[1];
						if (parsedOtp && parsedOtp.length === 4) {
							Logger.debug("Valid 4-digit OTP parsed from SMS");
							setOtp([parsedOtp[0], parsedOtp[1], parsedOtp[2], parsedOtp[3]]);
							RNOtpVerify.removeListener();
							autoVerify(parsedOtp);
						}
					} catch (err: any) {
						Logger.debug("Error handling SMS parsing", { message: err?.message });
					}
				});
			})
			.catch((err: any) => {
				Logger.debug("Failed to start SMS retriever", { message: err?.message });
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
			setTimer((prev) => {
				if (prev <= 1) {
					setIsLocked(false);
					return 0;
				}
				return prev - 1;
			});
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
		const numericValue = value.replace(/[^0-9]/g, "");

		const newOtp = [...otp];
		newOtp[index] = numericValue;
		setOtp(newOtp);

		if (numericValue && index < 3) {
			inputRefs.current[index + 1]?.focus();
		} else if (numericValue && index === 3) {
			Keyboard.dismiss();
		}
	};

	const handleKeyPress = (e: any, index: number) => {
		if (e.nativeEvent.key === "Backspace") {
			if (otp[index] !== "") {
				const newOtp = [...otp];
				newOtp[index] = "";
				setOtp(newOtp);
			} else if (index > 0) {
				const newOtp = [...otp];
				newOtp[index - 1] = "";
				setOtp(newOtp);

				setTimeout(() => {
					inputRefs.current[index - 1]?.focus();
				}, 0);
			}
		}
	};

	const handleContinue = () => {
		const otpString = otp.join("");
		if (otpString.length !== 4 || isVerifying || isLocked || !isConsentChecked) {
			return;
		}

		verifyOtpAndSignMutation({
			otp: otpString,
			sign_in_key: signInKey,
		});
	};

	const handleResend = () => {
		if (timer > 0 || isResending) return;
		resendOtpMutation();
	};

	const formatTime = (seconds: number) => {
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}s`;
	};

	const isOtpComplete = otp.every((digit) => Boolean(digit && digit.length === 1));
	const isContinueDisabled = !isOtpComplete || isVerifying || isLocked || !isConsentChecked;

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
				showsVerticalScrollIndicator={false}>
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

					{/* Consent checkbox and text */}
					<TouchableOpacity
						style={styles.consentContainer}
						activeOpacity={0.8}
						onPress={() => setIsConsentChecked((checked) => !checked)}
						accessibilityRole="checkbox"
						accessibilityState={{ checked: isConsentChecked }}>
						<View style={[styles.consentCheckbox, isConsentChecked && styles.consentCheckboxChecked]}>
							{isConsentChecked && <Ionicons name="checkmark" size={16} color={white} />}
						</View>
						<TranslatedText style={styles.consentText} translationKey="consentToSign" />
					</TouchableOpacity>

					{/* Warning Text */}
					<TranslatedText style={styles.warningText} translationKey="warningIgnoreCode" />

					{/* Continue Button */}
					<View style={styles.bottomContainer}>
						<TouchableOpacity
							style={[
								styles.continueButton,
								!isContinueDisabled && styles.continueButtonActive,
								isContinueDisabled && styles.continueButtonDisabled,
							]}
							onPress={handleContinue}
							disabled={isContinueDisabled}>
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
	consentContainer: {
		width: "100%",
		marginTop: height(2),
		marginBottom: height(2),
		paddingHorizontal: width(4),
		flexDirection: "row",
		alignItems: "flex-start",
		gap: width(3),
	},
	consentCheckbox: {
		width: 24,
		height: 24,
		flexShrink: 0,
		marginTop: 1,
		backgroundColor: white,
		borderWidth: 2,
		borderColor: "#5B6470",
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
		opacity: 0.5,
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
