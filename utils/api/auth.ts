import type { Languages } from "@/store";
import * as Application from "expo-application";
import { getBranchDeviceToken } from "@/utils/branch";
import { getBranchDeviceContext } from "@/utils/deviceContext";
import { axios, URLS } from ".";

// region: LOGIN
export type LoginRequestType = {
	phone_number: string;
	preferred_language?: string; 
	app_hash?: string;
};

export type LoginResponseType = {
	user_exists: boolean;
	next_action: "verify_otp" | "enter_mpin";
	otp_id: string;
	/** 
	 * expires in seconds
	 * If value is `600`, then OTP will expire in 10 minutes
	 */
	expires_in: number;
	user_id?: string;
	customer_id?: string;
	is_mpin_set?: boolean;
	message: string;
	soft_pull_consent?: boolean;
};

export const login = async (data: LoginRequestType) => {
	const payload = {
		...data,
		version: Application.nativeApplicationVersion,
		platform: "android",
	};

	const response = await axios.post<Partial<LoginResponseType>>(URLS.auth.login, payload);

	console.log("response", response.data);

	return response.data;
};

// endregion: LOGIN

// region: VERIFY OTP

export type VerifyOtpRequestType = {
	phone_number: string;
	otp: string;
	verification_type?: string;
	language?: Languages;
	preferred_language?: Languages;
};

export type VerifyOtpResponseType = {
	message: string;
	user_id: string;
	next_action: "setup_mpin" | (string & {});
	access_token?: string;
	refresh_token?: string;
	token_type?: string;
	permission_given?: boolean;
	user: User;
	success: true;
};

export type User = {
	id: string;
	user_id: string;
	customer_id: string;
	phone_number: string;
	is_phone_verified: boolean;
	is_first_login?: boolean;
	email?: string;
	requires_password_change?: boolean;
	is_mpin_set?: boolean;
	applicant_from?: string;
};

export const verifyOtp = async (data: VerifyOtpRequestType) => {
	// Collect device context for Branch attribution enrichment
	console.log("📱 [VerifyOtp] Collecting branch_device_context...");
	const branchDeviceContext = await getBranchDeviceContext(getBranchDeviceToken());

	const payload = {
		...data,
		version: Application.nativeApplicationVersion,
		platform: "android",
		branch_device_context: branchDeviceContext,
	};
	console.log("🚀 Verify OTP API Request Payload:", {
		...payload,
		branch_device_context: "[see 📱 log above for details]",
	});

	const response = await axios.post<Partial<VerifyOtpResponseType>>(URLS.auth.verify_otp, payload);

	return response.data;
};

// endregion: VERIFY OTP

// region: SET MPIN

export type SetMpinRequestType = {
	user_id: string;
	mpin: string;
};

export type SetMpinResponseType = {
	message: string;
	access_token: string;
	refresh_token: string;
	token_type: string;
};

export const setMpin = async (data: SetMpinRequestType) => {
	const response = await axios.post<Partial<SetMpinResponseType>>(URLS.auth.set_mpin, data);

	return response.data;
};

// endregion: SET MPIN

// region: MPIN LOGIN

export type MpinLoginRequestType = {
	phone_number: string;
	mpin: string;
};

export type MpinLoginResponseType = {
	access_token: string;
	message: string;
	refresh_token: string;
	token_type: string;
	user: Partial<User>;
};

export const mpinLogin = async (data: MpinLoginRequestType) => {
	const payload = {
		...data,
		version: Application.nativeApplicationVersion,
		platform: "android",
	};

	const response = await axios.post<Partial<MpinLoginResponseType>>(URLS.auth.mpin_login, payload);

	console.log("response", response.data);

	return response.data;
};

// endregion: MPIN LOGIN

// region: EMAIL OTP

export type SendEmailOtpRequestType = {
	user_id?: string;
	email: string;
};

export type SendEmailOtpResponseType = {
	success?: boolean;
	message: string;
	otp_id?: string;
	expires_in?: number;
	email?: string;
};

export const sendEmailOtp = async (data: SendEmailOtpRequestType) => {
	const response = await axios.post<Partial<SendEmailOtpResponseType>>(
		URLS.auth.send_email_otp,
		data,
	);
	return response.data;
};

export type VerifyEmailOtpRequestType = {
	user_id?: string;
	email: string;
	otp: string;
};

export type VerifyEmailOtpResponseType = {
	success?: boolean;
	message: string;
	email?: string;
	is_email_verified?: boolean;
	user_id?: string;
	verified?: boolean;
};

export const verifyEmailOtp = async (data: VerifyEmailOtpRequestType) => {
	const response = await axios.post<Partial<VerifyEmailOtpResponseType>>(
		URLS.auth.verify_email_otp,
		data,
	);
	return response.data;
};

// endregion: EMAIL OTP

// region: REFRESH TOKEN

export type RefreshTokenResponseType = {
	access_token: string;
	refresh_token: string;
	token_type: string;
};

export const refreshSession = async (refreshToken: string) => {
	const response = await axios.post<Partial<RefreshTokenResponseType>>("auth/refresh-token", {
		refresh_token: refreshToken,
	});
	return response.data;
};

// endregion: REFRESH TOKEN
