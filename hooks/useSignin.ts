import {
	clearLoginResponse,
	clearOtpVerifyResponse,
	setCountryCode,
	setLoginResponse,
	setOtpVerifyResponse,
	setPhoneNumber,
	useDispatch,
	type RootState,
	type SigninState,
} from "@/store";
import SecureStorage from "@/utils/secure-storage";
import { removeStorageItem } from "@/utils/storage";
import { useCallback, useEffect } from "react";
import { useSelector } from "react-redux";

/**
 * @param shouldLoadOtpVerifyResponse - If true, will load the OTP verify response from storage
 */
export const useSignin = (shouldLoadOtpVerifyResponse = false) => {
	const countryCode = useSelector((state: RootState) => state.signin.countryCode);
	const phoneNumber = useSelector((state: RootState) => state.signin.phoneNumber);

	const loginResponse = useSelector((state: RootState) => state.signin.loginResponse);

	const otpVerifyResponse = useSelector((state: RootState) => state.signin.otpVerifyResponse);

	const dispatch = useDispatch();

	const changeCountryCode = useCallback(
		(countryCode: NonNullable<SigninState["countryCode"]>) => {
			dispatch(setCountryCode(countryCode));
		},
		[dispatch],
	);

	const loadOtpVerifyResponse = useCallback(async () => {
		const otpVerifyResponse = await SecureStorage.getSensitiveWithLegacyMigration("@otp-verify-response");

		if (!otpVerifyResponse) return false;

		try {
			dispatch(setOtpVerifyResponse(JSON.parse(otpVerifyResponse)));

			return true;
		} catch {}

		return false;
	}, [dispatch]);

	// default country code to +91
	useEffect(() => {
		changeCountryCode("+91");

		if (shouldLoadOtpVerifyResponse) {
			loadOtpVerifyResponse();
		}
	}, [changeCountryCode, loadOtpVerifyResponse, shouldLoadOtpVerifyResponse]);

	const changePhoneNumber = useCallback(
		(phoneNumber: NonNullable<SigninState["phoneNumber"]>) => {
			dispatch(setPhoneNumber(phoneNumber));
		},
		[dispatch],
	);

	const changeLoginResponse = useCallback(
		(loginResponse: NonNullable<SigninState["loginResponse"]>) => {
			dispatch(setLoginResponse(loginResponse));
		},
		[dispatch],
	);

	const changeOtpVerifyResponse = useCallback(
		(otpVerifyResponse: NonNullable<SigninState["otpVerifyResponse"]>) => {
			void SecureStorage.setSensitive("@otp-verify-response", JSON.stringify(otpVerifyResponse));

			dispatch(setOtpVerifyResponse(otpVerifyResponse));
		},
		[dispatch],
	);

	const clearOtpVerify = useCallback(() => {
		void SecureStorage.removeSensitive("@otp-verify-response");
		void removeStorageItem("@otp-verify-response");
		dispatch(clearOtpVerifyResponse());
	}, [dispatch]);

	const clearLogin = useCallback(() => {
		dispatch(clearLoginResponse());
	}, [dispatch]);

	return {
		countryCode,
		phoneNumber,
		changeCountryCode,
		changePhoneNumber,
		loginResponse,
		changeLoginResponse,
		otpVerifyResponse,
		changeOtpVerifyResponse,
		loadOtpVerifyResponse,
		clearOtpVerifyResponse: clearOtpVerify,
		clearLoginResponse: clearLogin,
	};
};
