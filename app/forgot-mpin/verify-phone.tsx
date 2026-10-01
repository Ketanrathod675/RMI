import { TermsAndPolicy } from "@/components";
import { TranslatedText } from "@/components/TranslatedText";
import { dark, dark_primary, primary, white } from "@/constants/Colors";
import { ForgotMpinContext } from "@/context/forgot_mpin";
import { PhoneNumberSchema } from "@/hooks/useAuth";
import { useNetworkAwareMutation } from "@/hooks/useNetworkAwareMutation";
import { useTranslation } from "@/hooks/useTranslation";
import { ForgotMpinLayout } from "@/layouts/forgot-mpin-layout";
import { axios, errorHandler, URLS } from "@/utils/api";
import { font, height, width } from "@/utils/dimensions";
import { router } from "expo-router";
import React, { useContext, useEffect, useRef, useState } from "react";
import { Keyboard, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import Toast from "react-native-toast-message";

export default function VerifyPhone() {
	const { phoneNumber, setOtpVerified, otpVerified, countryCode } = useContext(ForgotMpinContext);
	const { t } = useTranslation();
	const [otp, setOtp] = useState(["", "", "", ""]);
	const [error, setError] = useState("");
	const [isChecked, setIsChecked] = useState(true);
	const [countdown, setCountdown] = useState(60);
	const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
	const [showTermsAndConditions, setShowTermsAndConditions] = useState(false);

	const otpRefs = [
		useRef<TextInput>(null),
		useRef<TextInput>(null),
		useRef<TextInput>(null),
		useRef<TextInput>(null),
	];

	useEffect(() => {
		if (otpVerified) {
			setOtpVerified(false);
		}
	}, [setOtpVerified]);

	useEffect(() => {
		const parsedPhone = PhoneNumberSchema.safeParse(phoneNumber);

		if (!parsedPhone.success) {
			Toast.show({
				type: "error",
				text1: t("invalidPhoneNumber"),
				text2: t("pleaseEnterValidPhoneNumber"),
				visibilityTime: 3000,
			});

			router.replace("/forgot-mpin");
		}
	}, [phoneNumber]);

	const { mutate: resendOtp, isPending: isResendOtpPending } = useNetworkAwareMutation({
		mutationFn: async (data: {
			phone_number: string;
			otp: string;
			verification_type: string;
		}) => {
			const response = await axios.post(URLS.auth.forgot_mpin, data);
			return response?.data;
		},
		onSuccess: (data) => {
			console.log("Resend OTP success:", data);
			setCountdown(60);
			Toast.show({
				type: "success",
				text1: t("otpSentSuccessfully"),
				text2: t("newVerificationCodeSent"),
				visibilityTime: 3000,
			});
		},
		onError: (err, variables, ctx) => {
			const { error } = errorHandler(err, variables, ctx);

			console.log("error", error);
			Toast.show({
				type: "error",
				text1: t("failedToSendOtp"),
				text2: error?.message || t("unableToSendOtp"),
				visibilityTime: 4000,
			});
		},
	});

	const { mutate: verifyOtp, isPending: isVerifyingOtp } = useNetworkAwareMutation({
		mutationFn: async (data: { phone_number: string; otp: string }) => {
			const response = await axios.post(URLS.auth.verify_mpin_reset_otp, data);
			return response?.data;
		},
		onSuccess: (data) => {
			console.log("verify mpin reset otp", data);

			setOtpVerified(true);
			Toast.show({
				type: "success",
				text1: t("otpVerifiedSuccessfully"),
				text2: t("phoneVerifiedCanResetMpin"),
				visibilityTime: 2500,
			});

			setTimeout(() => {
				router.push("/forgot-mpin/reset-mpin");
			}, 1000);
		},
		onError: (err, variables, ctx) => {
			const { error } = errorHandler(err, variables, ctx);

			console.log("error", error?.message);
			Toast.show({
				type: "error",
				text1: t("otpVerificationFailed"),
				text2: error?.message || t("invalidOtpCheckCode"),
				visibilityTime: 4000,
			});
		},
	});

	// Countdown timer effect
	useEffect(() => {
		let interval: ReturnType<typeof setInterval> | undefined;
		if (countdown > 0) {
			interval = setInterval(() => {
				setCountdown((prev) => prev - 1);
			}, 1000);
		}
		return () => {
			if (interval) clearInterval(interval);
		};
	}, [countdown]);

	const handleOtpChange = (value: string, idx: number) => {
		if (!/^[0-9]?$/.test(value)) return;
		const newOtp = [...otp];
		newOtp[idx] = value;
		setOtp(newOtp);
		if (value && idx < 3) {
			(otpRefs[idx + 1].current as TextInput | null)?.focus();
		} else if (value && idx === 3) {
			// Dismiss keyboard after last digit is entered
			Keyboard.dismiss();
		}
	};

	const handleOtpKeyPress = (e: any, idx: number) => {
		if (e.nativeEvent.key === "Backspace") {
			if (otp[idx] !== "") {
				// If current box is not empty, clear it but keep focus
				const newOtp = [...otp];
				newOtp[idx] = "";
				setOtp(newOtp);
			} else if (idx > 0) {
				// If current box is empty, clear previous box and move focus
				const newOtp = [...otp];
				newOtp[idx - 1] = "";
				setOtp(newOtp);
				setTimeout(() => {
					(otpRefs[idx - 1].current as TextInput | null)?.focus();
				}, 0);
			}
		}
	};

	const handleVerifyOtp = () => {
		if (otp.some((d) => d === "")) {
			setError(t("enterValid4DigitOtp"));
			return;
		}
		setError("");

		const otpString = otp.join("");
		verifyOtp({
			phone_number: phoneNumber,
			otp: otpString,
		});
	};

	const handleEditPhone = () => {
		if (router.canGoBack()) {
			router.back();
			return;
		}

		router.replace("/forgot-mpin");
	};

	const formatCountdown = (seconds: number) => {
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
	};

	const handleResendOtp = () => {
		if (countdown > 0 || isResendOtpPending) return;

		resendOtp({ phone_number: phoneNumber, otp: "", verification_type: "forgot_mpin" });
	};

	return (
		<>
		<ForgotMpinLayout viewStyles={[{ paddingHorizontal: width(4) }]}>
		<TranslatedText style={styles.title} translationKey="enterOTP" />
		<View style={styles.subtitleContainer}>
			<Text style={styles.subtitle}>
				<TranslatedText translationKey="sentTo" />{" "}
				{phoneNumber
					? `${countryCode}${phoneNumber.slice(0, 2)}****${phoneNumber.slice(-4)}`
					: ""}
				{"  "}
			</Text>
			<TouchableOpacity onPress={handleEditPhone}>
				<TranslatedText style={styles.editLink} translationKey="edit" />
			</TouchableOpacity>
		</View>

	<View style={styles.otpRow}>
		{otp.map((digit, idx) => (
			<TextInput
				key={idx}
				ref={otpRefs[idx]}
				value={digit}
				onChangeText={(v) => handleOtpChange(v, idx)}
				onKeyPress={(e) => handleOtpKeyPress(e, idx)}
				keyboardType="number-pad"
				maxLength={1}
				style={styles.otpInput}
				textAlign="center"
				editable={!isVerifyingOtp}
			/>
		))}
	</View>

		{error ? <Text style={styles.error}>{error}</Text> : null}

		<TranslatedText style={styles.otpLabel} translationKey="didntReceiveOTP" />

			{countdown > 0 ? (
				<Text style={styles.resendText}>
					<TranslatedText translationKey="resendIn" /> {formatCountdown(countdown)}s
				</Text>
			) : (
				<TouchableOpacity onPress={handleResendOtp} disabled={isResendOtpPending}>
					<TranslatedText
						style={[styles.resendText, styles.resendClickable]}
						translationKey={isResendOtpPending ? "resending" : "resendOTP"}
					/>
			</TouchableOpacity>
		)}

	{/* Consent checkbox and text */}
		<View style={styles.consentContainer}>
			<TouchableOpacity
				style={styles.checkboxContainer}
				onPress={() => setIsChecked(!isChecked)}>
				<View style={[styles.checkbox, isChecked && styles.checkboxChecked]}>
					{isChecked && <Text style={styles.checkmark}>✓</Text>}
				</View>
			</TouchableOpacity>

			<Text style={styles.consentText}>
				<TranslatedText translationKey="consentText" />{" "}
				<TranslatedText
					style={styles.linkText}
					translationKey="privacyPolicy"
					onPress={() => setShowPrivacyPolicy(true)}
				/>
				{" & "}
				<TranslatedText
					style={styles.linkText}
					translationKey="termsAndConditions"
					onPress={() => setShowTermsAndConditions(true)}
				/>
				.
			</Text>
		</View>

			<TouchableOpacity
				style={[styles.button, isVerifyingOtp && { opacity: 0.7 }]}
				onPress={handleVerifyOtp}
				disabled={isVerifyingOtp}>
				<TranslatedText
					style={styles.buttonText}
			translationKey={isVerifyingOtp ? "verifying" : "continue"}
			/>
		</TouchableOpacity>
	</ForgotMpinLayout>

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
	</>
);
}

const styles = StyleSheet.create({
	title: {
		fontSize: font(2.5),
		fontWeight: "bold",
		color: dark,
		marginBottom: height(1),
		// textAlign: "center",
	},
	subtitleContainer: {
		flexDirection: "row",
		alignItems: "center",
		marginBottom: height(4),
		flexWrap: "wrap",
	},
	subtitle: {
		fontSize: font(1.6),
		color: dark,
		// textAlign: "center",
		opacity: 0.7,
	},
	editLink: {
		color: "darkgreen",
		textDecorationLine: "underline",
		fontSize: font(1.6),
	},
	otpRow: {
		flexDirection: "row",
		width: "100%",
		marginBottom: height(3),
		// paddingHorizontal: width(1),
	},
	otpInput: {
		width: width(12),
		height: width(12),
		borderRadius: width(2),
		borderWidth: 1,
		borderColor: "#E5E5E5",
		backgroundColor: white,
		color: dark,
		fontSize: font(2.2),
		fontWeight: "bold",
		textAlign: "center",
		marginHorizontal: width(1),
	},
	otpLabel: {
		fontSize: font(1.6),
		color: dark,
		marginBottom: height(1),
	},
	resendText: {
		fontSize: font(1.6),
		color: dark,
		marginBottom: height(3),
		textDecorationLine: "underline",
	},
	resendClickable: {
		color: "darkgreen",
	},
	button: {
		backgroundColor: primary,
		borderRadius: width(10),
		paddingVertical: height(2),
		alignItems: "center",
		justifyContent: "center",
		width: "100%",
		marginTop: height(2),
		marginBottom: height(3),
	},
	buttonText: {
		color: dark,
		fontSize: font(1.8),
		fontWeight: "bold",
	},
	error: {
		color: "#d32f2f",
		fontSize: font(1.4),
		marginBottom: height(2),
		textAlign: "left",
	},
	consentContainer: {
		marginTop: height(2),
		flexDirection: "row",
		alignItems: "flex-start",
	},
	checkboxContainer: {
		marginRight: width(3),
		marginTop: height(0.2),
	},
	checkbox: {
		width: width(5),
		height: width(5),
		borderRadius: width(1),
		backgroundColor: primary,
		alignItems: "center",
		justifyContent: "center",
	},
	checkmark: {
		color: dark,
		fontSize: font(1.8),
		fontWeight: "bold",
	},
	consentText: {
		flex: 1,
		fontSize: font(1.6),
		color: dark,
		lineHeight: font(2.2),
		opacity: 0.8,
		flexWrap: "wrap",
	},
	linkText: {
		color: dark_primary,
		textDecorationLine: "underline",
	},
	checkboxChecked: {
		backgroundColor: primary,
		borderColor: primary,
	},
});
