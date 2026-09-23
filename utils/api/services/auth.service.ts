import * as Application from "expo-application";
import { Platform } from "react-native";
import { getBranchDeviceToken } from "@/utils/branch";
import { getBranchDeviceContext } from "@/utils/deviceContext";
import { axios } from "../core/client";
import { URLS } from "../core/endpoints";
import type {
	FastApiRequestOtpPayload,
	FastApiRequestOtpResponse,
	FastApiTokenResponse,
	FastApiVerifyOtpPayload,
	LoginRequestType,
	LoginResponseType,
	MpinLoginRequestType,
	MpinLoginResponseType,
	RefreshTokenResponseType,
	SendEmailOtpRequestType,
	SendEmailOtpResponseType,
	SetMpinRequestType,
	SetMpinResponseType,
	VerifyEmailOtpRequestType,
	VerifyEmailOtpResponseType,
	VerifyOtpRequestType,
	VerifyOtpResponseType,
} from "../types/auth.types";
import type { StandardResponse } from "../types/common";

/**
 * Request OTP / Login
 * Compatible with both FastAPI (`/auth/request-otp`) and legacy backend (`/auth/login`)
 */
export const requestOtp = async (data: LoginRequestType): Promise<Partial<LoginResponseType>> => {
	const payload = {
		...data,
		client_type: "app" as const,
		version: Application.nativeApplicationVersion,
		platform: Platform.OS,
	};

	// Attempt FastAPI /auth/request-otp directly
	const response = await axios.post<
		StandardResponse<FastApiRequestOtpResponse> | Partial<LoginResponseType>
	>(URLS.auth.request_otp, payload);

	const resData = response.data;

	// Normalized FastAPI envelope handling
	if (resData && "data" in resData && (resData as any).data?.sign_in_key) {
		const fastApiData = (resData as StandardResponse<FastApiRequestOtpResponse>).data;
		return {
			next_action: "verify_otp",
			otp_id: fastApiData.sign_in_key,
			expires_in: fastApiData.expires_in_seconds,
			sign_in_key: fastApiData.sign_in_key,
			test_otp: fastApiData.test_otp,
			message: resData.message || "OTP sent successfully",
		};
	}

	return resData as Partial<LoginResponseType>;
};

/**
 * Backward compatibility alias for requestOtp
 */
export const login = requestOtp;

/**
 * Verify OTP
 * Compatible with both FastAPI (`/auth/verify-otp`) and legacy backend
 */
export const verifyOtp = async (
	data: VerifyOtpRequestType,
): Promise<Partial<VerifyOtpResponseType>> => {
	const branchDeviceContext = await getBranchDeviceContext(getBranchDeviceToken());

	const payload = {
		...data,
		otp: data.otp,
		sign_in_key: data.sign_in_key,
		client_type: "app" as const,
		version: Application.nativeApplicationVersion,
		platform: Platform.OS,
		branch_device_context: branchDeviceContext,
	};

	const response = await axios.post<
		StandardResponse<FastApiTokenResponse> | Partial<VerifyOtpResponseType>
	>(URLS.auth.verify_otp, payload);

	const resData = response.data;

	// Normalized FastAPI envelope handling
	if (resData && "data" in resData && (resData as any).data?.access_token) {
		const fastApiData = (resData as StandardResponse<FastApiTokenResponse>).data;
		const user = fastApiData.user;
		const userId = user?.uuid || "";

		return {
			success: true,
			message: resData.message || "Authentication successful",
			user_id: userId,
			is_new_user: fastApiData.is_new_user,
			is_profile_completed: fastApiData.is_profile_completed,
			next_step: fastApiData.next_step,
			access_token: fastApiData.access_token,
			refresh_token: fastApiData.refresh_token,
			token_type: fastApiData.token_type || "bearer",
			user: {
				id: userId,
				user_id: userId,
				customer_id: userId,
				phone_number: user?.phone_number || data.phone_number,
				is_phone_verified: user?.phone_verified ?? true,
				is_first_login: fastApiData.is_new_user === true,
				email: user?.email || undefined,
			},
		};
	}

	return resData as Partial<VerifyOtpResponseType>;
};

/**
 * Fetch Current Authenticated User Profile (`/auth/me`)
 */
export const getCurrentUser = async () => {
	const response = await axios.get(URLS.auth.me);
	return response.data;
};

/**
 * Refresh Session (`/auth/refresh-token`)
 */
export const refreshSession = async (
	refreshToken: string,
): Promise<Partial<RefreshTokenResponseType>> => {
	const response = await axios.post<
		StandardResponse<{ access_token: string; token_type: string }> | Partial<RefreshTokenResponseType>
	>(URLS.auth.refresh_token, {
		refresh_token: refreshToken,
	});

	const resData = response.data;
	if (resData && "data" in resData && (resData as any).data?.access_token) {
		return {
			access_token: (resData as any).data.access_token,
			refresh_token: refreshToken,
			token_type: (resData as any).data.token_type || "bearer",
		};
	}

	return resData as Partial<RefreshTokenResponseType>;
};

// LEGACY — old backend, disabled during in-house rebuild
// The following MPIN and Email OTP services are commented out until backend implements them:
/*
export const setMpin = async (data: SetMpinRequestType) => {
	const response = await axios.post<Partial<SetMpinResponseType>>((URLS.auth as any).set_mpin, data);
	return response.data;
};

export const mpinLogin = async (data: MpinLoginRequestType) => {
	const payload = {
		...data,
		version: Application.nativeApplicationVersion,
		platform: "android",
	};

	const response = await axios.post<Partial<MpinLoginResponseType>>((URLS.auth as any).mpin_login, payload);
	return response.data;
};

export const sendEmailOtp = async (data: SendEmailOtpRequestType) => {
	const response = await axios.post<Partial<SendEmailOtpResponseType>>(
		(URLS.auth as any).send_email_otp,
		data,
	);
	return response.data;
};

export const verifyEmailOtp = async (data: VerifyEmailOtpRequestType) => {
	const response = await axios.post<Partial<VerifyEmailOtpResponseType>>(
		(URLS.auth as any).verify_email_otp,
		data,
	);
	return response.data;
};
*/
