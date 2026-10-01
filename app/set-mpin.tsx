import { TranslatedText } from "@/components/TranslatedText";
import { IconSymbol } from "@/components/ui/IconSymbol";
import { dark, primary, white } from "@/constants/Colors";
import { Images } from "@/constants/images";
import { useAuth } from "@/hooks/useAuth";
import { useNetworkAwareMutation } from "@/hooks/useNetworkAwareMutation";
import { usePermissions } from "@/hooks/usePermissions";
import { useSignin } from "@/hooks/useSignin";
import { useTranslation } from "@/hooks/useTranslation";
import { errorHandler, setMpin as setMpinApi } from "@/utils/api";
import { font, height, width } from "@/utils/dimensions";
import { router, useNavigation } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
	Alert,
	BackHandler,
	Image,
	Keyboard,
	StyleSheet,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from "react-native";
import Toast from "react-native-toast-message";

export default function SetMpin() {
	const { t } = useTranslation();
	const [mpin, setMpin] = useState(["", "", "", ""]);
	const [confirmMpin, setConfirmMpin] = useState(["", "", "", ""]);
	const [error, setError] = useState("");
	const [isSubmittingSuccessfully, setIsSubmittingSuccessfully] = useState(false);
	const [showMpin, setShowMpin] = useState(false);
	const [showConfirmMpin, setShowConfirmMpin] = useState(false);

	const [isMounting, setIsMounting] = useState(true);

	useEffect(() => {
		setIsMounting(false);
	}, []);

	// Navigation
	const navigation = useNavigation();

	useEffect(() => {
		// Prevent swipe or navigation.goBack inside router
		const unsubscribe = navigation.addListener("beforeRemove", (e) => {
			console.log("action", e.data.action.type);

			if (["GO_BACK", "POP"].includes(e.data.action.type)) {
				e.preventDefault();

				Alert.alert(t("areYouSureGoBack"), t("youNeedToLoginAgain"), [
					{
						text: t("cancel"),
						style: "cancel",
					},
					{
						text: t("goBack"),
						onPress: () => {
							router.replace("/login");
						},
					},
				]);
			}
		});

		// Intercept Android hardware back button
		const backHandler = BackHandler.addEventListener("hardwareBackPress", () => {
			Alert.alert(t("areYouSureGoBack"), t("youNeedToLoginAgain"), [
				{
					text: t("cancel"),
					style: "cancel",
				},
				{
					text: t("goBack"),
					onPress: () => {
						router.replace("/login");
					},
				},
			]);
			return true; // prevent default app exit
		});

		return () => {
			unsubscribe();
			backHandler.remove();
		};
	}, [navigation, t]);

	// useEffect(() => {
	// 	const activate = async () => {
	// 		await ScreenCapture.preventScreenCaptureAsync("set-mpin");
	// 	};

	// 	const deactivate = async () => {
	// 		await ScreenCapture.allowScreenCaptureAsync("set-mpin");
	// 	};

	// 	activate();

	// 	return () => {
	// 		deactivate().then(() => console.log("disabled screen capture"));
	// 	};
	// }, []);

	const mpinRefs = [
		useRef<TextInput>(null),
		useRef<TextInput>(null),
		useRef<TextInput>(null),
		useRef<TextInput>(null),
	];
	const confirmRefs = [
		useRef<TextInput>(null),
		useRef<TextInput>(null),
		useRef<TextInput>(null),
		useRef<TextInput>(null),
	];

	const { logout, handleMpinSet, handleSetTokens, handleMpinSignIn } = useAuth(false);
	const { otpVerifyResponse, clearOtpVerifyResponse, clearLoginResponse } = useSignin(true);

	console.log("otp verify response", otpVerifyResponse);

	useEffect(() => {
		if (isMounting) return;

		console.log("Set MPIN - OTP Verify Response:", otpVerifyResponse);
		console.log("Set MPIN - User ID:", otpVerifyResponse?.user_id);
		console.log("Set MPIN - Is submitting successfully:", isSubmittingSuccessfully);

		// Only redirect to login if not in the middle of successful submission
		if (!isSubmittingSuccessfully && otpVerifyResponse?.user?.user_id == null) {
			console.log("No user_id found, redirecting to login");

			// Use setTimeout to prevent navigation conflicts
			setTimeout(() => {
				logout();
				clearOtpVerifyResponse();
				clearLoginResponse();
			}, 100);
		}
	}, [
		otpVerifyResponse,
		clearOtpVerifyResponse,
		clearLoginResponse,
		logout,
		isSubmittingSuccessfully,
		isMounting,
	]);

	const { allPermissionsGranted } = usePermissions();

	const { mutate: setMpinHandler, isPending } = useNetworkAwareMutation<any, any, any>({
		mutationFn: setMpinApi,
		onSuccess: async (data: any) => {
			console.log("Set MPIN API Response:", data);
			console.log("Set MPIN Success - Full Response:", JSON.stringify(data, null, 2));

			// Set flag to prevent logout during successful flow
			setIsSubmittingSuccessfully(true);

			const areTokensSet = await handleSetTokens(
				data?.access_token,
				data?.refresh_token,
				data?.token_type,
			);

			// Mark MPIN as set
			if (!areTokensSet) {
				Toast.show({
					type: "error",
					text1: t("errorSettingMPIN"),
					text2: t("pleaseLoginAgain"),
				});

				return;
			}

			handleMpinSet();
			handleMpinSignIn(); // Set mpinSignedIn to true when MPIN is set

			// Clear temporary OTP verification data

			Toast.show({
				type: "success",
				text1: t("mpinSetSuccessfully"),
				text2: t("welcomeToRapidMoney"),
			});

			console.log("mpin set successfully");

			// Navigate to enter MPIN screen to verify the newly set MPIN
			setTimeout(() => {
				if (!allPermissionsGranted) {
					router.replace("/request-permissions");
					return;
				}

				router.replace("/loan-application");
			}, 600);

			setTimeout(() => {
				clearOtpVerifyResponse();
				clearLoginResponse();
			}, 1000);
		},

		onError: (err, variables, ctx) => {
			console.log("Set MPIN API Error:", err);
			console.log("Set MPIN Error Variables:", variables);
			console.log("Set MPIN Error Context:", ctx);

			const { error } = errorHandler(err, variables, ctx);

			Toast.show({
				type: "error",
				text1: t("errorSettingMPIN"),
				text2: error?.message ?? t("pleaseLoginAgain"),
			});
		},
	});

	// Check if both MPIN and confirm MPIN are complete
	const isMpinComplete = mpin.every((digit) => digit !== "" && digit.length === 1);
	const isConfirmMpinComplete = confirmMpin.every((digit) => digit !== "" && digit.length === 1);
	const isButtonEnabled = isMpinComplete && isConfirmMpinComplete && !isPending;

	const handleMpinChange = (value: string, idx: number) => {
		if (!/^[0-9]?$/.test(value)) return;
		const newMpin = [...mpin];
		newMpin[idx] = value;
		setMpin(newMpin);

		// Clear error when user starts typing
		if (error) {
			setError("");
		}

		if (value && idx < 3) {
			mpinRefs[idx + 1].current?.focus();
		}
		if (newMpin.every((d) => d !== "") && idx === 3) {
			// Dismiss keyboard before moving to confirm MPIN
			Keyboard.dismiss();
			setTimeout(() => {
				confirmRefs[0].current?.focus();
			}, 200);
		}
	};

	const handleMpinKeyPress = (e: any, idx: number) => {
		if (e.nativeEvent.key === "Backspace") {
			if (mpin[idx] !== "") {
				// Clear current field
				const newMpin = [...mpin];
				newMpin[idx] = "";
				setMpin(newMpin);
			} else if (idx > 0) {
				// Current field is empty, clear previous field and move focus
				const newMpin = [...mpin];
				newMpin[idx - 1] = "";
				setMpin(newMpin);

				// Use setTimeout to ensure state update happens before focus change
				setTimeout(() => {
					mpinRefs[idx - 1].current?.focus();
				}, 0);
			}
		}
	};

	const handleConfirmChange = (value: string, idx: number) => {
		if (!/^[0-9]?$/.test(value)) return;
		const newMpin = [...confirmMpin];
		newMpin[idx] = value;
		setConfirmMpin(newMpin);

		// Clear error when user starts typing
		if (error) {
			setError("");
		}

		if (value && idx < 3) {
			confirmRefs[idx + 1].current?.focus();
		} else if (value && idx === 3) {
			// Dismiss keyboard after last digit of confirm MPIN is entered
			Keyboard.dismiss();
		}
	};

	const handleConfirmKeyPress = (e: any, idx: number) => {
		if (e.nativeEvent.key === "Backspace") {
			if (confirmMpin[idx] !== "") {
				// Clear current field
				const newMpin = [...confirmMpin];
				newMpin[idx] = "";
				setConfirmMpin(newMpin);
			} else if (idx > 0) {
				// Current field is empty, clear previous field and move focus
				const newMpin = [...confirmMpin];
				newMpin[idx - 1] = "";
				setConfirmMpin(newMpin);

				// Use setTimeout to ensure state update happens before focus change
				setTimeout(() => {
					confirmRefs[idx - 1].current?.focus();
				}, 0);
			}
		}
	};

	const handleSubmit = () => {
		if (mpin.some((d) => d === "") || confirmMpin.some((d) => d === "")) {
			setError(t("pleaseEnterAndConfirm4DigitMPIN"));
			return;
		}
		if (mpin.join("") !== confirmMpin.join("")) {
			setError(t("mpinsDoNotMatch"));
			return;
		}
		setError("");

		console.log("user id", otpVerifyResponse?.user_id);

		if (!otpVerifyResponse?.user?.user_id) {
			Toast.show({
				type: "error",
				text1: t("errorSettingMPIN"),
				text2: t("pleaseLoginAgain"),
			});

			router.replace("/login");

			return;
		}

		console.log("mpin", mpin.join(""));

		setMpinHandler({
			user_id: otpVerifyResponse.user.user_id,
			mpin: mpin.join(""),
		});
	};

	return (
		<View style={styles.container}>
			{/* Shield Icon */}
			<View style={styles.shieldContainer}>
				<Image source={Images.SHIELD_MPIN} style={styles.shield} resizeMode="contain" />
			</View>

			{/* Main Content */}
			<View style={styles.content}>
				<TranslatedText style={styles.mainHeading} translationKey="pleaseSetYourMPIN" />

				{/* Create MPIN Section */}
				<View style={styles.section}>
					<View style={styles.sectionHeader}>
						<TranslatedText
							style={styles.sectionHeading}
							translationKey="createYourMPIN"
						/>
						<TouchableOpacity onPress={() => setShowMpin(!showMpin)}>
							<IconSymbol
								name={showMpin ? "visibility" : "visibilityOff"}
								size={24}
								color={dark}
							/>
						</TouchableOpacity>
					</View>
				<View style={styles.inputRow}>
					{mpin.map((digit, idx) => (
						<TextInput
							key={idx}
							ref={mpinRefs[idx]}
							value={digit}
							onChangeText={(v) => handleMpinChange(v, idx)}
							onKeyPress={(e) => handleMpinKeyPress(e, idx)}
							keyboardType="number-pad"
							maxLength={1}
							style={styles.input}
							textAlign="center"
							placeholder=""
							secureTextEntry={!showMpin}
							editable={!isPending}
						/>
					))}
				</View>
				</View>

				{/* Confirm MPIN Section */}
				<View style={styles.section}>
					<View style={styles.sectionHeader}>
						<TranslatedText
							style={styles.sectionHeading}
							translationKey="confirmYourMPIN"
						/>
						<TouchableOpacity onPress={() => setShowConfirmMpin(!showConfirmMpin)}>
							<IconSymbol
								name={showConfirmMpin ? "visibility" : "visibilityOff"}
								size={24}
								color={dark}
							/>
						</TouchableOpacity>
					</View>
				<View style={styles.inputRow}>
					{confirmMpin.map((digit, idx) => (
						<TextInput
							key={idx}
							ref={confirmRefs[idx]}
							value={digit}
							onChangeText={(v) => handleConfirmChange(v, idx)}
							onKeyPress={(e) => handleConfirmKeyPress(e, idx)}
							keyboardType="number-pad"
							maxLength={1}
							style={styles.input}
							textAlign="center"
							placeholder=""
							secureTextEntry={!showConfirmMpin}
							editable={!isPending}
						/>
					))}
				</View>
				</View>

				{error ? <Text style={styles.error}>{error}</Text> : null}
			</View>

			{/* Continue Button */}
			<TouchableOpacity
				style={[styles.continueButton, { opacity: isButtonEnabled ? 1 : 0.6 }]}
				onPress={handleSubmit}
				disabled={!isButtonEnabled}>
				<View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
					<TranslatedText
						style={styles.continueButtonText}
						translationKey={isPending ? "settingMPIN" : "continue"}
					/>
					<IconSymbol name="arrow.right" size={20} color={dark} />
				</View>
			</TouchableOpacity>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: white,
		paddingTop: height(5),
		paddingHorizontal: width(6),
	},
	shieldContainer: {
		alignItems: "center",
		marginBottom: height(4),
	},
	shield: {
		width: width(35),
		height: width(35),
	},
	dotsContainer: {
		flexDirection: "row",
		justifyContent: "center",
		alignItems: "center",
		marginBottom: height(6),
		gap: width(4),
	},
	dot: {
		fontSize: font(3),
		color: "#B0B0B0",
		fontWeight: "bold",
	},
	content: {
		flex: 1,
	},
	mainHeading: {
		fontSize: font(2.4),
		fontWeight: "600",
		color: dark,
		marginBottom: height(4),
	},
	section: {
		marginBottom: height(3),
	},
	sectionHeader: {
		flexDirection: "row",
		gap: width(4),
		alignItems: "center",
		marginBottom: height(1.5),
	},
	sectionHeading: {
		fontSize: font(1.8),
		fontWeight: "500",
		color: dark,
	},
	inputRow: {
		flexDirection: "row",
		// justifyContent: "center",
		// alignItems: "center",
		gap: width(3),
	},
	input: {
		width: width(12),
		height: width(12),
		borderWidth: 2,
		borderColor: "#E5E7EB",
		borderRadius: width(2),
		backgroundColor: white,
		fontSize: font(2.2),
		fontWeight: "600",
		color: dark,
	},
	error: {
		color: "#d32f2f",
		fontSize: font(1.4),
		textAlign: "left",
		marginTop: height(1),
	},
	continueButton: {
		backgroundColor: primary,
		borderRadius: width(6),
		paddingVertical: height(2),
		alignItems: "center",
		marginBottom: height(8),
	},
	continueButtonText: {
		color: dark,
		fontSize: font(2.2),
		fontWeight: "600",
	},
});
