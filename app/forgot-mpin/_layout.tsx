import { ForgotMpinContext } from "@/context/forgot_mpin";
import { useTranslation } from "@/hooks/useTranslation";
import { Stack } from "expo-router";
import { useState } from "react";

export default function ForgotMpinLayout() {
	const [countryCode, setCountryCode] = useState("+91");
	const [phoneNumber, setPhoneNumber] = useState("");
	const [otpVerified, setOtpVerified] = useState(false);
	const { t } = useTranslation();

	console.log("otp verified", otpVerified);

	return (
		<ForgotMpinContext.Provider
			value={{
				countryCode,
				setCountryCode,
				phoneNumber,
				setPhoneNumber,
				otpVerified,
				setOtpVerified,
			}}>
			<Stack>
				<Stack.Screen
					name="index"
					options={{
						headerShown: true,
						headerTitle: t("forgotMpin"),
						headerBackVisible: true,
					}}
				/>
				<Stack.Screen
					name="verify-phone"
					options={{
						headerShown: true,
						headerTitle: t("verifyYourNumber"),
						headerBackVisible: true,
					}}
				/>
				<Stack.Screen
					name="reset-mpin"
					options={{
						headerShown: true,
						headerTitle: t("mpinSetReset"),
						headerBackVisible: true,
					}}
				/>
			</Stack>
		</ForgotMpinContext.Provider>
	);
}
