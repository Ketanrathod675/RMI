import { TermsAndPolicy } from "@/components";
import { TranslatedText } from "@/components/TranslatedText";
import { dark, primary, white } from "@/constants/Colors";
import { useAuth } from "@/hooks/useAuth";
import { useNetworkAwareMutation } from "@/hooks/useNetworkAwareMutation";
import { useTranslation } from "@/hooks/useTranslation";
import { Layout01 } from "@/layouts/layout_01";
import { errorHandler, mpinLogin } from "@/utils/api";
import { height, width } from "@/utils/dimensions";
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    BackHandler,
    Keyboard,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import Toast from "react-native-toast-message";

export default function MpinLogin() {
	console.log("🔄 [MpinLogin] Rendering MpinLogin screen");
	const { t } = useTranslation();
	const [otp, setOtp] = useState(["", "", "", ""]);
	const [checked, setChecked] = useState(true);
	const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
	const [showTermsAndConditions, setShowTermsAndConditions] = useState(false);
	const inputRefs = useRef<TextInput[]>([]);

	// Exit alert state
	const [showExitAlert, setShowExitAlert] = useState(false);

	const { isMpinSet, isLoading, logout, phoneNumber, handleSetTokens, handleMpinSignIn } =
		useAuth();
	const navigation = useNavigation();
	const params = useLocalSearchParams();

	// Store back handler reference for cleanup
	const backHandlerRef = useRef<any>(null);

	// useEffect(() => {
	// 	removeStorageItem(STORAGE_KEYS["@digilocker-transaction-id"]);
	// 	setStorageItem(STORAGE_KEYS["@digilocker-status"], "open");
	// }, []);

	// Handle back press with exit confirmation
	const handleBackPress = useCallback(() => {
		// Check if we came from reset mpin flow
		if (params.fromResetMpin === "true") {
			router.replace("/login");
			return true;
		}

		// If we can go back in navigation stack, just go back (no exit alert)
		if (router.canGoBack()) {
			router.back();
			return true;
		}

		if (showExitAlert) {
			// If alert is already showing and user presses back, close alert and exit app
			setShowExitAlert(false);
			setTimeout(() => {
				if (backHandlerRef.current) {
					backHandlerRef.current.remove();
					backHandlerRef.current = null;
				}
				BackHandler.exitApp();
			}, 50);
			return true;
		}

		// Show exit confirmation alert
		setShowExitAlert(true);
		Alert.alert(
			t("exitApp"),
			t("areYouSureExitApp"),
			[
				{
					text: t("stay"),
					onPress: () => setShowExitAlert(false),
					style: "cancel",
				},
				{
					text: t("exit"),
					onPress: () => {
						setShowExitAlert(false);
						setTimeout(() => {
							if (backHandlerRef.current) {
								backHandlerRef.current.remove();
								backHandlerRef.current = null;
							}
							BackHandler.exitApp();
						}, 50);
					},
					style: "destructive",
				},
			],
			{
				cancelable: false,
				onDismiss: () => setShowExitAlert(false),
			},
		);

		return true; // Prevent default behavior
	}, [showExitAlert, t, params]);

	useEffect(() => {
		if (!isLoading && !isMpinSet) {
			Toast.show({
				type: "info",
				text1: t("notLoggedIn"),
				text2: t("pleaseLoginToContinue"),
			});

			logout();

			router.replace("/login");

			return;
		}
	}, [isLoading, isMpinSet, logout]);

	// Set up double-back exit functionality
	useEffect(() => {
		backHandlerRef.current = BackHandler.addEventListener("hardwareBackPress", handleBackPress);

		// Remove any existing beforeRemove listeners by setting up a new one that allows navigation
		const unsubscribe = navigation.addListener("beforeRemove", (e) => {
			if (params.fromResetMpin === "true" && ["GO_BACK", "POP"].includes(e.data.action.type)) {
				e.preventDefault();
				router.replace("/login");
				return;
			}
		});

		// Cleanup on unmount
		return () => {
			if (backHandlerRef.current) {
				backHandlerRef.current.remove();
				backHandlerRef.current = null;
			}
			unsubscribe();
			// Reset alert state on unmount
			setShowExitAlert(false);
		};
	}, [navigation, handleBackPress, params]);

	// useEffect(() => {
	// 	const activate = async () => {
	// 		await ScreenCapture.preventScreenCaptureAsync("mpin-login");
	// 	};

	// 	const deactivate = async () => {
	// 		await ScreenCapture.allowScreenCaptureAsync("mpin-login");
	// 	};

	// 	activate();

	// 	return () => {
	// 		deactivate();
	// 	};
	// }, []);

	const { mutate: login, isPending } = useNetworkAwareMutation<any, any, any>({
		mutationFn: mpinLogin,
		onSuccess: async (data: any) => {
			console.log("mpin login", data);

			if (data?.access_token && data?.refresh_token && data?.token_type) {
				handleSetTokens(data.access_token, data.refresh_token, data.token_type);
				handleMpinSignIn(); // Set mpinSignedIn to true

				Toast.show({
					type: "success",
					text1: t("loginSuccessful"),
					visibilityTime: 600,
				});

				setTimeout(() => {
					router.replace("/(tabs)");
				}, 1000);

				return;
			}

			Toast.show({
				type: "error",
				text1: t("somethingWentWrong"),
				text2: t("pleaseRetryPayment"),
			});
		},
		onError: (err: any, variables, ctx) => {
			const { error, errorType } = errorHandler(err, variables, ctx);

			console.log("error", error);

			  // ✅ ADD ONLY THIS BLOCK
  const message =
    err?.response?.data?.message ||
    error?.message ||
    "";

  if (message.toLowerCase().includes("inactive")) {
    Toast.show({
      type: "error",
      text1: t("accountInactive"),
      text2: t("contactSupport"),
    });
    return;
  }
  // ✅ END CHANGE


			

			if (errorType === "unknown") {
				Toast.show({
					type: "error",
					text1: t("somethingWentWrong"),
					text2: t("pleaseRetryPayment"),
				});

				return;
			}

			Toast.show({
				type: "error",
				text1: t("invalidMPIN"),
				text2: t("pleaseRetryPayment"),
			});

			console.log("errorType", errorType);
		},
	});

	const handleOtpChange = (text: string, index: number) => {
		const newOtp = [...otp];
		newOtp[index] = text;
		setOtp(newOtp);
		if (text && index < 3) {
			inputRefs.current[index + 1]?.focus();
		} else if (text && index === 3) {
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

	const handleVerify = () => {
		if (!checked) {
			Toast.show({
				type: "error",
				text1: t("confirmTermsConditionsToProceed"),
			});

			return;
		}

		if (!phoneNumber) {
			Toast.show({
				type: "error",
				text1: t("somethingWentWrong"),
				text2: t("pleaseRetryPayment"),
			});

			return;
		}

		const otpString = otp.join("");

		if (otpString.length !== 4) {
			Toast.show({
				type: "error",
				text1: t("pleaseEnter4DigitMPIN"),
			});

			return;
		}

		login({
			phone_number: phoneNumber,
			mpin: otpString,
		});
	};

	const handleForgotMpin = () => {
		router.push("/forgot-mpin");
	};

	return (
		<Layout01>
			<View style={styles.wrapper}>
				<TranslatedText style={styles.title} translationKey="pleaseEnterYourMPIN" />
				<View style={styles.otpInputContainer}>
					{otp.map((digit, index) => (
						<TextInput
							key={index}
							ref={(ref) => {
								if (ref) inputRefs.current[index] = ref;
							}}
							style={styles.otpInput}
							value={digit}
							onChangeText={(text) => handleOtpChange(text, index)}
							onKeyPress={(e) => handleKeyPress(e, index)}
							keyboardType="numeric"
							maxLength={1}
							textAlign="center"
							placeholder=""
							placeholderTextColor={dark}
						/>
					))}
				</View>
				<TouchableOpacity style={styles.forgotMpinLink} onPress={handleForgotMpin}>
					<TranslatedText style={styles.forgotMpinText} translationKey="forgotMPIN" />
				</TouchableOpacity>

				<View style={styles.termsRow}>
					<Pressable style={styles.checkbox} onPress={() => setChecked((v) => !v)}>
						<View style={[styles.checkboxBox, checked && styles.checkboxBoxChecked]}>
							{checked && <Text style={styles.checkboxTick}>✓</Text>}
						</View>
					</Pressable>
					<Text style={styles.termsText}>
						<TranslatedText translationKey="byClickingIAgreeToThe" />{" "}
						<TouchableOpacity onPress={() => setShowPrivacyPolicy(true)}>
							<Text style={styles.linkText}>
								<TranslatedText translationKey="privacyPolicy" />
							</Text>
						</TouchableOpacity>{" "}
						<TranslatedText translationKey="and" />{" "}
						<TouchableOpacity onPress={() => setShowTermsAndConditions(true)}>
							<Text style={styles.linkText}>
								<TranslatedText translationKey="termsAndConditions" />
							</Text>
						</TouchableOpacity>
						.
					</Text>
				</View>

			<TouchableOpacity
				style={styles.loginButton}
				disabled={isPending}
				onPress={handleVerify}>
				{isPending ? (
					<ActivityIndicator size="small" color="#333" />
				) : (
					<Text style={styles.loginButtonText}>{t("login")}</Text>
				)}
			</TouchableOpacity>
			</View>

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
		</Layout01>
	);
}

const styles = StyleSheet.create({
	wrapper: {
		width: "100%",
		paddingTop: height(3),
		paddingHorizontal: width(4),
	},
	title: {
		fontSize: width(5),
		fontWeight: "bold",
		color: dark,
		marginBottom: height(3),
		textAlign: "left",
	},
	otpInputContainer: {
		flexDirection: "row",
		justifyContent: "flex-start",
		alignItems: "center",
		marginBottom: height(2),
		gap: width(4),
	},
	otpInput: {
		width: width(14),
		height: width(14),
		borderWidth: 1.5,
		borderColor: "#D9D9D9",
		borderRadius: width(2),
		fontSize: width(6),
		color: dark,
		backgroundColor: white,
		marginRight: 0,
	},
	forgotMpinLink: {
		marginTop: height(1),
		marginBottom: height(6),
		alignSelf: "flex-start",
	},
	forgotMpinText: {
		color: dark,
		fontSize: width(3.5),
		textDecorationLine: "underline",
		fontWeight: "400",
		opacity: 0.7,
	},
	loginButton: {
		backgroundColor: primary,
		paddingVertical: height(2),
		borderRadius: 100,
		width: "100%",
		alignItems: "center",
		marginTop: height(6),
		marginBottom: height(3),
	},
	loginButtonText: {
		color: dark,
		fontSize: width(4.5),
		fontWeight: "bold",
	},
	termsRow: {
		flexDirection: "row",
		alignItems: "flex-start",
		marginTop: height(2),
		width: "100%",
	},
	checkbox: {
		marginRight: width(2),
		marginTop: 2,
	},
	checkboxBox: {
		width: width(5),
		height: width(5),
		borderWidth: 2,
		borderColor: primary,
		borderRadius: 5,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: white,
	},
	checkboxBoxChecked: {
		backgroundColor: primary,
		borderColor: primary,
	},
	checkboxTick: {
		color: dark,
		fontSize: width(4),
		fontWeight: "bold",
		marginVertical: -height(0.3),
	},
	termsText: {
		flex: 1,
		color: dark,
		fontSize: width(3.2),
		marginTop: 2,
	},
	link: {
		color: dark,
		fontWeight: "bold",
		textDecorationLine: "underline",
	},
	linkText: {
		color: "darkgreen",
		textDecorationLine: "underline",
		fontWeight: "bold",
		marginVertical: -height(0.5),
	},
});
