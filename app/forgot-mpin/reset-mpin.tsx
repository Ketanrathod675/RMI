import { TranslatedText } from "@/components/TranslatedText";
import { IconSymbol } from "@/components/ui/IconSymbol";
import { dark, primary, white } from "@/constants/Colors";
import { ForgotMpinContext } from "@/context/forgot_mpin";
import { PhoneNumberSchema } from "@/hooks/useAuth";
import { useNetworkAwareMutation } from "@/hooks/useNetworkAwareMutation";
import { useTranslation } from "@/hooks/useTranslation";
import { ForgotMpinLayout } from "@/layouts/forgot-mpin-layout";
import { axios, errorHandler, URLS } from "@/utils/api";
import { font, height, width } from "@/utils/dimensions";
import { router, useNavigation } from "expo-router";
import * as ScreenCapture from "expo-screen-capture";
import React, { useContext, useEffect, useRef, useState } from "react";
import {
	Alert,
	BackHandler,
	Keyboard,
	KeyboardAvoidingView,
	Platform,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from "react-native";
import Toast from "react-native-toast-message";

export default function ResetMpin() {
	const [mpin, setMpin] = useState(["", "", "", ""]);
	const [confirmMpin, setConfirmMpin] = useState(["", "", "", ""]);
	const [error, setError] = useState("");
	const [showMpin, setShowMpin] = useState(false);
	const [showConfirmMpin, setShowConfirmMpin] = useState(false);

	const { otpVerified, phoneNumber } = useContext(ForgotMpinContext);
	const { t } = useTranslation();
	const navigation = useNavigation();

	console.log("phone number, otp", phoneNumber, otpVerified);

	useEffect(() => {
		const activate = async () => {
			await ScreenCapture.preventScreenCaptureAsync("reset-mpin");
		};

		const deactivate = async () => {
			await ScreenCapture.allowScreenCaptureAsync("reset-mpin");
		};

		activate();

		return () => {
			deactivate();
		};
	}, []);

	useEffect(() => {
		if (!otpVerified) {
			Toast.show({
				type: "error",
				text1: t("otpNotVerified"),
				text2: t("pleaseVerifyOtpFirst"),
				visibilityTime: 3000,
			});

			router.replace("/forgot-mpin");
		}

		const parsedPhone = PhoneNumberSchema.safeParse(phoneNumber);

		if (!parsedPhone.success) {
			Toast.show({
				type: "error",
				text1: t("invalidPhoneNumber"),
				text2: t("pleaseVerifyPhoneFirst"),
				visibilityTime: 3000,
			});

			router.replace("/forgot-mpin");
		}
	}, [phoneNumber, otpVerified]);

	useEffect(() => {
		// Prevent swipe or navigation.goBack inside router
		const unsubscribe = navigation.addListener("beforeRemove", (e) => {
			if (["GO_BACK", "POP"].includes(e.data.action.type)) {
				e.preventDefault();

			Alert.alert(t("goBack"), t("areYouSureGoBackProgress"), [
				{
					text: t("stay"),
					style: "cancel",
				},
				{
					text: t("goBack"),
					onPress: () => {
						router.dismissAll();
					},
				},
			]);
			}
		});

	// Intercept Android hardware back button
	const backHandler = BackHandler.addEventListener("hardwareBackPress", () => {
		router.dismissAll();
		return true; // prevent default app exit
	});

		return () => {
			unsubscribe();
			backHandler.remove();
		};
	}, [navigation]);

	// Refs for MPIN inputs
	const mpinRefs = [
		useRef<TextInput>(null),
		useRef<TextInput>(null),
		useRef<TextInput>(null),
		useRef<TextInput>(null),
	];

	// Refs for confirm MPIN inputs
	const confirmRefs = [
		useRef<TextInput>(null),
		useRef<TextInput>(null),
		useRef<TextInput>(null),
		useRef<TextInput>(null),
	];

	const { mutate: resetMpinMutation, isPending: isResettingMpin } = useNetworkAwareMutation({
		mutationFn: async (data: {
			phone_number: string;
			new_mpin: string;
			confirm_mpin: string;
		}) => {
			const response = await axios.post(URLS.auth.reset_mpin, data);
			return response?.data;
		},
		onSuccess: (data) => {
			console.log("Reset MPIN API Response:", data);
			Toast.show({
				type: "success",
				text1: t("mpinResetSuccessful"),
				text2: t("mpinUpdatedSuccessfully"),
				visibilityTime: 3000,
			});

			setTimeout(() => {
				router.replace({
					// pathname: "/mpin-login",
					pathname: "/login",
					params: { fromResetMpin: "true" },
				});
			}, 1500);
		},
		onError: (err, variables, ctx) => {
			const { error } = errorHandler(err, variables, ctx);
			console.log("Reset MPIN error:", error);
			Toast.show({
				type: "error",
				text1: t("mpinResetFailed"),
				text2: error?.message || t("unableToResetMpin"),
				visibilityTime: 4000,
			});
		},
	});

	// MPIN input handlers
	const handleMpinChange = (value: string, idx: number) => {
		if (!/^[0-9]?$/.test(value)) return;
		const newMpin = [...mpin];
		newMpin[idx] = value;
		setMpin(newMpin);
		if (value && idx < 3) {
			mpinRefs[idx + 1].current?.focus();
		}
		// Auto-focus to confirm MPIN when create MPIN is complete
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
				const newMpin = [...mpin];
				newMpin[idx] = "";
				setMpin(newMpin);
			} else if (idx > 0) {
				const newMpin = [...mpin];
				newMpin[idx - 1] = "";
				setMpin(newMpin);
				setTimeout(() => {
					mpinRefs[idx - 1].current?.focus();
				}, 0);
			}
		}
	};

	// Confirm MPIN input handlers
	const handleConfirmChange = (value: string, idx: number) => {
		if (!/^[0-9]?$/.test(value)) return;
		const newMpin = [...confirmMpin];
		newMpin[idx] = value;
		setConfirmMpin(newMpin);
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
				const newMpin = [...confirmMpin];
				newMpin[idx] = "";
				setConfirmMpin(newMpin);
			} else if (idx > 0) {
				const newMpin = [...confirmMpin];
				newMpin[idx - 1] = "";
				setConfirmMpin(newMpin);
				setTimeout(() => {
					confirmRefs[idx - 1].current?.focus();
				}, 0);
			}
		}
	};

	// Reset MPIN handler
	const handleResetMpin = () => {
		// Validate MPIN
		if (mpin.some((digit) => digit === "")) {
			setError(t("pleaseEnter4DigitMpin"));
			return;
		}

		// Validate confirm MPIN
		if (confirmMpin.some((digit) => digit === "")) {
			setError(t("pleaseConfirm4DigitMpin"));
			return;
		}

		// Check if MPINs match
		if (mpin.join("") !== confirmMpin.join("")) {
			setError(t("mpinsDoNotMatch"));
			return;
		}

		setError("");

		// Call reset MPIN API
		resetMpinMutation({
			phone_number: phoneNumber,
			new_mpin: mpin.join(""),
			confirm_mpin: confirmMpin.join(""),
		});
	};

	return (
		<KeyboardAvoidingView 
			style={{ flex: 1 }} 
			behavior={Platform.OS === "ios" ? "padding" : "height"}
			keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
		>
			<ScrollView
				contentContainerStyle={styles.scrollContainer}
				keyboardShouldPersistTaps="handled"
				showsVerticalScrollIndicator={false}
				scrollEnabled={true}
			>
				<ForgotMpinLayout viewStyles={[{ paddingHorizontal: width(4) }]} scrollEnabled={false}>
					<TranslatedText style={styles.title} translationKey="pleaseSetYourMpin" />

					{/* Create MPIN Section */}
					<View style={styles.section}>
						<View style={styles.sectionHeader}>
							<TranslatedText style={styles.sectionHeading} translationKey="createYourMpin" />
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
								editable={!isResettingMpin}
							/>
						))}
					</View>
					</View>

					{/* Confirm MPIN Section */}
					<View style={styles.section}>
						<View style={styles.sectionHeader}>
							<TranslatedText
								style={styles.sectionHeading}
								translationKey="confirmYourMpin"
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
								editable={!isResettingMpin}
							/>
						))}
					</View>
					</View>

					{error ? <Text style={styles.error}>{error}</Text> : null}

					{/* Continue Button */}
					<TouchableOpacity
						style={[
							styles.button,
							{
								opacity:
									mpin.every((d) => d) && confirmMpin.every((d) => d) && !isResettingMpin
										? 1
										: 0.6,
							},
						]}
						onPress={handleResetMpin}
						disabled={!mpin.every((d) => d) || !confirmMpin.every((d) => d) || isResettingMpin}>
						<TranslatedText
							style={styles.buttonText}
							translationKey={isResettingMpin ? "settingMpin" : "resetMPIN"}
						/>
					</TouchableOpacity>
					<TouchableOpacity
						style={{ paddingHorizontal: width(3), marginVertical: height(3) }}
						onPress={() => {
							Alert.alert(t("goBack"), t("areYouSureGoBackProgress"), [
								{
									text: t("stay"),
									style: "cancel",
								},
								{
									text: t("goBack"),
									onPress: () => router.replace("/forgot-mpin"),
								},
							]);
						}}>
						<TranslatedText
							style={{ textDecorationLine: "underline" }}
							translationKey="goBack"
						/>
					</TouchableOpacity>
				</ForgotMpinLayout>
			</ScrollView>
		</KeyboardAvoidingView>
	);
}

const styles = StyleSheet.create({
	scrollContainer: {
		flexGrow: 1,
		paddingBottom: height(5),
	},
	title: {
		fontSize: font(2.5),
		fontWeight: "bold",
		color: dark,
		marginBottom: height(4),
	},
	section: {
		marginBottom: height(3),
	},
	sectionHeader: {
		flexDirection: "row",
		// justifyContent: "space-between",
		alignItems: "center",
		marginBottom: height(1.5),
		gap: width(3),
	},
	sectionHeading: {
		fontSize: font(1.8),
		fontWeight: "500",
		color: dark,
	},
	inputRow: {
		flexDirection: "row",
		gap: width(3),
	},
	input: {
		width: width(12),
		height: width(12),
		borderWidth: 1,
		borderColor: "#E5E5E5",
		borderRadius: width(2),
		backgroundColor: white,
		fontSize: font(2.2),
		fontWeight: "bold",
		color: dark,
		textAlign: "center",
	},
	error: {
		color: "#d32f2f",
		fontSize: font(1.4),
		marginBottom: height(2),
		textAlign: "left",
	},
	button: {
		backgroundColor: primary,
		borderRadius: width(10),
		paddingVertical: height(2),
		alignItems: "center",
		justifyContent: "center",
		width: "100%",
		marginTop: height(4),
	},
	buttonText: {
		color: dark,
		fontSize: font(1.8),
		fontWeight: "bold",
	},
});
