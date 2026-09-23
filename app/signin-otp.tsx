import { TermsAndPolicy } from "@/components";
import { dark, dark_primary, primary, white } from "@/constants/Colors";
import { Images } from "@/constants/images";
import { useAuth } from "@/hooks/useAuth";
import { useDefault } from "@/hooks/useDefault";
import { useNetworkAwareMutation } from "@/hooks/useNetworkAwareMutation";
import { useSignin } from "@/hooks/useSignin";
import { useTranslation } from "@/hooks/useTranslation";
import { setAuthApplicantFrom } from "@/store";
import { setUserType, trackSignup } from "@/utils/analytics";
import { errorHandler, login, verifyOtp } from "@/utils/api";
import { setBranchIdentity } from "@/utils/branch";
import { font, height, width } from "@/utils/dimensions";
import { encode } from "@/utils/encode_decode";
import Logger from "@/utils/logger";
import RNOtpVerify from "@/utils/otpVerify";
import { setStorageItem, STORAGE_KEYS } from "@/utils/storage";
import { MaterialIcons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { Image } from "expo-image";
import { router, useFocusEffect, useLocalSearchParams, useNavigation } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useRef, useState } from "react";
import {
	ActivityIndicator,
	BackHandler,
	Keyboard,
	Platform,
	ScrollView,
	StatusBar as RNStatusBar,
	StyleSheet,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { useDispatch } from "react-redux";

const ErrorVerifyingOtp = "Error verifying OTP";
const LoginAgain = "Please Login again";
const ValidatePhoneNumber = "Please enter a valid country code and phone number";

export default function SigninSignupOtp() {
	const { t } = useTranslation();
	const [otp, setOtp] = useState(["", "", "", ""]);
	const [isChecked, setIsChecked] = useState(true);
	const [isSoftPullChecked, setIsSoftPullChecked] = useState(true);
	const [countdown, setCountdown] = useState(60);
	const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
	const [showTermsAndConditions, setShowTermsAndConditions] = useState(false);
	const inputRefs = useRef<(TextInput | null)[]>([]);

	const params = useLocalSearchParams<{ signInKey?: string }>();
	const { countryCode, phoneNumber, changeOtpVerifyResponse, loginResponse, changeLoginResponse } = useSignin();
	const [currentSignInKey, setCurrentSignInKey] = useState<string | undefined>(
		params.signInKey || loginResponse?.sign_in_key || loginResponse?.otp_id
	);

	useEffect(() => {
		if (params.signInKey) {
			setCurrentSignInKey(params.signInKey);
		} else if (loginResponse?.sign_in_key || loginResponse?.otp_id) {
			setCurrentSignInKey(loginResponse.sign_in_key ?? loginResponse.otp_id);
		}
	}, [params.signInKey, loginResponse?.sign_in_key, loginResponse?.otp_id]);

	const { handleLoginAndSignup, validateMobileAndCountryCode, handleSetTokens } = useAuth(false);
	const dispatch = useDispatch();

	const { language } = useDefault();
	const insets = useSafeAreaInsets();
	const navigation = useNavigation();

	// Intercept navigation events to prevent alerts
	useEffect(() => {
		const unsubscribe = navigation.addListener("beforeRemove", () => {
			// Allow navigation silently
		});

		return () => {
			unsubscribe();
		};
	}, [navigation]);

	// Handle hardware back button & status bar style
	useFocusEffect(
		React.useCallback(() => {
			RNStatusBar.setBarStyle("dark-content");
			if (Platform.OS === "android") {
				RNStatusBar.setBackgroundColor("transparent");
				RNStatusBar.setTranslucent(true);
			}

			const onBackPress = () => {
				router.back();
				return true;
			};

			const subscription = BackHandler.addEventListener("hardwareBackPress", onBackPress);
			return () => subscription.remove();
		}, [])
	);

	const { mutate: verifyOtpMutation, isPending } = useNetworkAwareMutation({
		mutationFn: verifyOtp,
		onSuccess: async (data) => {
			Logger.debug("OTP verification succeeded", {
				user_id: data?.user_id,
				next_action: data?.next_action,
				is_mpin_set: data?.user?.is_mpin_set,
				access_token: data?.access_token,
				refresh_token: data?.refresh_token,
			});

			// Store the OTP verification response data (including user_id)
			changeOtpVerifyResponse(data as any);

			// ── Branch Integration: Set Identity ──────────────────────────────────
			const customerId = (data as any)?.customer_id ?? data?.user?.customer_id;
			if (customerId) {
				try {
					setBranchIdentity(customerId);
				} catch (branchErr) {
					console.error("❌ [Branch] Failed to set identity:", branchErr);
				}
			}

			// ── Analytics: User Segmentation ──────────────────────────────────
			const userType = "new_user";
			const resolvedUserId = data?.user_id ?? data?.user?.user_id ?? "";

			setUserType(userType).catch(() => {});

			const isFirstLogin = (data as any)?.user?.is_first_login === true;
			if (isFirstLogin) {
				trackSignup(resolvedUserId).catch(() => {});
			}

			// Store applicant_from if available
			if (data?.user?.applicant_from) {
				await setStorageItem(STORAGE_KEYS["@applicant-from"], encode(data.user.applicant_from));
				dispatch(setAuthApplicantFrom(data.user.applicant_from));
			} else {
				await setStorageItem(STORAGE_KEYS["@applicant-from"], encode("OG"));
				dispatch(setAuthApplicantFrom("OG"));
			}

			// Check if the response has user_id or user
			if (!data?.user_id && !data?.user) {
				Toast.show({
					type: "error",
					text1: ErrorVerifyingOtp,
					text2: LoginAgain,
				});
				return;
			}

			// Block to handle valid login and signup
			if (
				handleLoginAndSignup(
					countryCode!,
					phoneNumber!,
					data.user_id ?? data.user?.user_id ?? ""
				)
			) {
				// Block to handle set tokens
				if (data?.access_token && data?.refresh_token && data?.token_type) {
					await handleSetTokens(
						data?.access_token,
						data?.refresh_token,
						data?.token_type
					);
				} else {
					Toast.show({
						type: "error",
						text1: t("somethingWentWrong"),
						text2: t("pleaseLoginAgain"),
					});
					return;
				}

				const rawPermissionGiven =
					(data as any)?.permission_given ?? (data as any)?.user?.permission_given;
				const isNewUser =
					data?.is_new_user === true ||
					data?.is_profile_completed === false ||
					loginResponse?.user_exists === false ||
					(data as any)?.user?.is_first_login === true ||
					(data as any)?.is_first_login === true ||
					rawPermissionGiven === false ||
					rawPermissionGiven === "false";

				if (__DEV__) {
					console.log("🔍 [FOWS-DIAG][signin-otp] OTP verified successfully:", {
						rawPermissionGiven,
						isNewUser,
						loginResponseUserExists: loginResponse?.user_exists,
						target: isNewUser ? "/request-permissions" : "/(tabs)",
					});
				}

				Toast.show({
					type: "success",
					text1: t("loginSuccessful"),
					visibilityTime: 2500,
				});

				// Direct new users or users with pending permissions directly to /request-permissions
				if (isNewUser) {
					router.replace("/request-permissions");
					return;
				}

				router.replace("/(tabs)");
				return;
			}

			Toast.show({
				type: "error",
				text1: ErrorVerifyingOtp,
				text2: LoginAgain,
			});
		},
		onError: (err, variables, ctx) => {
			if (__DEV__) {
				console.log("Verify OTP API Error:", err);
			}

			const { error } = errorHandler(err, variables, ctx);

			Toast.show({
				type: "error",
				text1: ErrorVerifyingOtp,
				text2: error?.message ?? LoginAgain,
			});
		},
	});

	const autoVerify = async (otpCode: string) => {
		const validate = validateMobileAndCountryCode(countryCode!, phoneNumber!);

		if (!validate.countryCode.success || !validate.phoneNumber.success) {
			console.error("❌ [Auto-OTP] Phone number validation failed");
			return;
		}

		const isFirstTimeUser = loginResponse?.user_exists === false;

		const requestPayload: any = {
			phone_number: validate.phoneNumber.data,
			otp: otpCode,
			sign_in_key: currentSignInKey,
			verification_type: "",
			language,
			version: Constants.expoConfig?.version,
		};

		if (isFirstTimeUser) {
			requestPayload.preferred_language = language;
		}

		if (loginResponse?.soft_pull_consent === false) {
			requestPayload.soft_pull_consent = isSoftPullChecked;
			requestPayload.soft_pull_consent_message = t("softPullConsentText");
		}

		verifyOtpMutation(requestPayload);
	};

	const startOtpListener = () => {
		if (Platform.OS !== "android") return;

		RNOtpVerify.getOtp()
			.then(() => {
				RNOtpVerify.addListener((message) => {
					try {
						const parsedOtp = /(\d{4})/.exec(message)?.[1];
						if (parsedOtp && parsedOtp.length === 4) {
							setOtp([parsedOtp[0], parsedOtp[1], parsedOtp[2], parsedOtp[3]]);
							RNOtpVerify.removeListener();
							autoVerify(parsedOtp);
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

	// Start listening on mount
	useEffect(() => {
		startOtpListener();
		return () => {
			if (Platform.OS === "android") {
				RNOtpVerify.removeListener();
			}
		};
	}, []);

	// Countdown timer
	useEffect(() => {
		if (countdown > 0) {
			const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
			return () => clearTimeout(timer);
		}
	}, [countdown]);

	const handleOtpChange = (value: string, index: number) => {
		const newOtp = [...otp];
		newOtp[index] = value;
		setOtp(newOtp);

		// Move to next input if value is entered
		if (value && index < 3) {
			inputRefs.current[index + 1]?.focus();
		} else if (value && index === 3) {
			Keyboard.dismiss();
		}
	};

	const handleBackspace = (value: string, index: number) => {
		if (value !== "") {
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
	};

	const { mutate: resendMutation, isPending: isResendOtpPending } = useNetworkAwareMutation({
		mutationFn: login,
		onSuccess: (res) => {
			const newSignInKey = res?.sign_in_key ?? res?.otp_id;
			if (!newSignInKey || !res?.expires_in) {
				Toast.show({
					type: "error",
					text1: t("errorOccurredWhileRequestingOTP"),
					text2: t("pleaseTryAgain"),
				});
				return;
			}

			if (newSignInKey) {
				setCurrentSignInKey(newSignInKey);
			}
			changeLoginResponse(res as any);

			Toast.show({
				type: "success",
				text1: t("otpResentSuccessfully"),
			});

			setCountdown(60);
			setOtp(["", "", "", ""]);
			inputRefs.current[0]?.focus();
			startOtpListener();
		},
		onError: (err, variables, ctx) => {
			const { error } = errorHandler(err, variables, ctx);

			Toast.show({
				type: "error",
				text1: t("errorOccurredWhileRequestingOTP"),
				text2: error?.message ?? t("pleaseTryAgain"),
			});
		},
	});

	const handleContinue = async () => {
		const validate = validateMobileAndCountryCode(countryCode!, phoneNumber!);

		if (!validate.countryCode.success || !validate.phoneNumber.success) {
			Toast.show({
				type: "error",
				text1: ErrorVerifyingOtp,
				text2: ValidatePhoneNumber,
			});
			return;
		}

		const isFirstTimeUser = loginResponse?.user_exists === false;

		const requestPayload: any = {
			phone_number: validate.phoneNumber.data,
			otp: otp.join(""),
			sign_in_key: currentSignInKey,
			verification_type: "",
			language,
			version: Constants.expoConfig?.version,
		};

		if (isFirstTimeUser) {
			requestPayload.preferred_language = language;
		}

		if (loginResponse?.soft_pull_consent === false) {
			requestPayload.soft_pull_consent = isSoftPullChecked;
			requestPayload.soft_pull_consent_message = t("softPullConsentText");
		}

		verifyOtpMutation(requestPayload);
	};

	const handleResend = () => {
		if (!phoneNumber) {
			Toast.show({
				type: "error",
				text1: t("somethingWentWrong"),
				text2: t("pleaseTryAgain"),
			});
			return;
		}

		resendMutation({ phone_number: phoneNumber });
	};

	const formatTime = (seconds: number) => {
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
	};

	return (
		<View style={styles.container}>
			<StatusBar style="dark" />

			{/* Top Header App Bar */}
			<View style={[styles.header, { paddingTop: insets.top + height(1) }]}>
				<TouchableOpacity
					style={styles.backButton}
					onPress={() => router.back()}
					hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
					<MaterialIcons name="arrow-back" size={24} color={dark} />
				</TouchableOpacity>
				<Text style={styles.headerTitle}>Verify your number!</Text>
			</View>

			<ScrollView
				style={styles.scrollContainer}
				contentContainerStyle={[
					styles.scrollContent,
					{ paddingBottom: insets.bottom + height(3) },
				]}
				keyboardShouldPersistTaps="handled"
				showsVerticalScrollIndicator={false}>
				{/* Centered Shield Illustration */}
				<View style={styles.shieldRow}>
					<Image
						source={Images.SHIELD_MPIN}
						style={styles.shieldGraphic}
						contentFit="contain"
					/>
				</View>

				{/* Form Content */}
				<View style={styles.content}>
					<Text style={styles.title}>Enter OTP</Text>

					<View style={styles.phoneSection}>
						<Text style={styles.phoneText}>Sent To {phoneNumber || "1234567890"} </Text>
						<TouchableOpacity
							onPress={() => {
								router.back();
							}}>
							<Text style={styles.editLink}>Edit</Text>
						</TouchableOpacity>
					</View>

					{/* 4-Digit OTP Boxes */}
					<View style={styles.otpContainer}>
						{otp.map((digit, index) => (
							<TextInput
								key={index}
								ref={(ref) => {
									inputRefs.current[index] = ref;
								}}
								style={[
									styles.otpInput,
									digit ? styles.otpInputFilled : null,
								]}
								value={digit}
								onChangeText={(value) => handleOtpChange(value, index)}
								onKeyPress={({ nativeEvent }) => {
									if (nativeEvent.key === "Backspace") {
										handleBackspace(digit, index);
									}
								}}
								keyboardType="numeric"
								maxLength={1}
								selectTextOnFocus
								editable={!isPending}
							/>
						))}
					</View>

					{/* Didn't Receive OTP & Resend Row in the same line */}
					<View style={styles.resendRow}>
						<Text style={styles.didntReceiveText}>Didn’t Receive OTP ?</Text>
						{countdown > 0 ? (
							<Text style={styles.countdownText}>
								Re-send in {formatTime(countdown)}s
							</Text>
						) : (
							<TouchableOpacity
								onPress={handleResend}
								disabled={isResendOtpPending}
								hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
								{isResendOtpPending ? (
									<ActivityIndicator size="small" color={dark_primary} />
								) : (
									<Text style={styles.resendLink}>Re-send OTP</Text>
								)}
							</TouchableOpacity>
						)}
					</View>

					{/* Continue Button */}
					<TouchableOpacity
						style={[
							styles.continueButton,
							{
								opacity:
									!isChecked || !otp.every((digit) => digit) || isPending
										? 0.7
										: 1,
							},
						]}
						onPress={handleContinue}
						disabled={!otp.every((digit) => digit) || isPending || !isChecked}>
						{isPending ? (
							<ActivityIndicator size="small" color={dark} />
						) : (
							<Text style={styles.continueButtonText}>Continue</Text>
						)}
					</TouchableOpacity>

					{/* Bottom Terms & Consent Section (pushed to complete bottom) */}
					<View style={styles.bottomTermsContainer}>
						{/* Consent Checkbox */}
						<View style={styles.consentSection}>
							<TouchableOpacity
								style={styles.checkboxContainer}
								onPress={() => setIsChecked(!isChecked)}
								activeOpacity={0.8}>
								<View
									style={[
										styles.checkbox,
										isChecked && styles.checkboxChecked,
									]}>
									{isChecked && <Text style={styles.checkmark}>✓</Text>}
								</View>
							</TouchableOpacity>

							<Text style={styles.consentText}>
								I hereby provide my consent to access credit information from CICs,
								KYC and agree to the{" "}
								<Text
									style={styles.consentLink}
									onPress={() => setShowTermsAndConditions(true)}>
									Terms
								</Text>
								,{" "}
								<Text
									style={styles.consentLink}
									onPress={() => setShowPrivacyPolicy(true)}>
									Privacy Policy
								</Text>
								, and to be contacted via SMS, WhatsApp, call, or email, including
								on DND-registered numbers".
							</Text>
						</View>

						{/* Soft-Pull Consent if required */}
						{loginResponse?.soft_pull_consent === false && (
							<View style={[styles.consentSection, { marginTop: -height(0.5), marginBottom: height(1) }]}>
								<TouchableOpacity
									style={styles.checkboxContainer}
									onPress={() => setIsSoftPullChecked(!isSoftPullChecked)}
									activeOpacity={0.8}>
									<View
										style={[
											styles.checkbox,
											isSoftPullChecked && styles.checkboxChecked,
										]}>
										{isSoftPullChecked && <Text style={styles.checkmark}>✓</Text>}
									</View>
								</TouchableOpacity>

								<Text style={styles.consentText}>
									I provide consent to fetch my credit bureau score for eligibility assessment.
								</Text>
							</View>
						)}
					</View>
				</View>
			</ScrollView>

			{/* Privacy Policy Modal */}
			<TermsAndPolicy
				displayType="policy"
				showModal={showPrivacyPolicy}
				setShowModal={setShowPrivacyPolicy}
			/>

			{/* Terms and Conditions Modal */}
			<TermsAndPolicy
				displayType="terms"
				showModal={showTermsAndConditions}
				setShowModal={setShowTermsAndConditions}
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: white,
	},
	header: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: width(5),
		paddingBottom: height(1.5),
		backgroundColor: white,
		borderBottomWidth: 1,
		borderBottomColor: "#F0F0F0",
	},
	backButton: {
		marginRight: width(3),
	},
	headerTitle: {
		fontSize: font(2.4),
		fontWeight: "700",
		color: dark,
	},
	scrollContainer: {
		flex: 1,
		backgroundColor: white,
	},
	scrollContent: {
		flexGrow: 1,
		paddingTop: height(2),
	},
	shieldRow: {
		alignItems: "center",
		justifyContent: "center",
		marginTop: height(1),
		marginBottom: height(3.5),
	},
	shieldGraphic: {
		width: width(42),
		height: (width(42) * 224) / 203,
	},
	content: {
		flex: 1,
		paddingHorizontal: width(6),
	},
	title: {
		fontSize: font(2.3),
		fontWeight: "700",
		color: dark,
		marginBottom: 4,
	},
	phoneSection: {
		flexDirection: "row",
		alignItems: "center",
		marginBottom: height(2),
	},
	phoneText: {
		fontSize: font(1.7),
		color: "#666666",
	},
	editLink: {
		fontSize: font(1.7),
		color: dark_primary,
		fontWeight: "600",
		textDecorationLine: "underline",
	},
	otpContainer: {
		flexDirection: "row",
		gap: width(3.5),
		marginBottom: height(1.8),
	},
	otpInput: {
		width: width(14.5),
		height: width(14.5),
		borderWidth: 1.5,
		borderColor: "#E2E8F0",
		borderRadius: width(3),
		textAlign: "center",
		fontSize: font(2.4),
		fontWeight: "700",
		color: dark,
		backgroundColor: white,
	},
	otpInputFilled: {
		borderColor: dark,
	},
	resendRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		marginBottom: height(3.5),
	},
	didntReceiveText: {
		fontSize: font(1.6),
		color: "#333333",
	},
	countdownText: {
		fontSize: font(1.6),
		color: dark,
		fontWeight: "600",
		textDecorationLine: "underline",
	},
	resendLink: {
		fontSize: font(1.6),
		color: dark_primary,
		fontWeight: "700",
		textDecorationLine: "underline",
	},
	bottomTermsContainer: {
		marginTop: "auto",
		paddingTop: height(2),
	},
	consentSection: {
		flexDirection: "row",
		alignItems: "flex-start",
		marginBottom: height(1),
	},
	checkboxContainer: {
		marginRight: width(3),
		marginTop: 2,
	},
	checkbox: {
		width: 20,
		height: 20,
		borderWidth: 1.5,
		borderColor: "#D1D5DB",
		borderRadius: 4,
		backgroundColor: white,
		alignItems: "center",
		justifyContent: "center",
	},
	checkboxChecked: {
		backgroundColor: dark_primary,
		borderColor: dark_primary,
	},
	checkmark: {
		color: white,
		fontSize: font(1.4),
		fontWeight: "bold",
	},
	consentText: {
		flex: 1,
		color: "#333333",
		fontSize: font(1.4),
		lineHeight: height(2.2),
	},
	consentLink: {
		color: "#333333",
		textDecorationLine: "underline",
		fontWeight: "600",
	},
	continueButton: {
		backgroundColor: primary,
		borderRadius: width(7),
		paddingVertical: height(2.1),
		alignItems: "center",
		justifyContent: "center",
		width: "100%",
		shadowColor: primary,
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.3,
		shadowRadius: 6,
		elevation: 3,
		marginBottom: height(2.5),
	},
	continueButtonText: {
		color: dark,
		fontSize: font(2.1),
		fontWeight: "700",
	},
});
