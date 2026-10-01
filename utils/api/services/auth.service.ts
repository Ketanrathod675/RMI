import * as Application from "expo-application";
import { Platform } from "react-native";
import { getBranchAttribution, getBranchDeviceToken } from "@/utils/branch";
import { getBranchDeviceContext } from "@/utils/deviceContext";
import { getUserIdFromToken } from "@/utils/encode_decode";
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

const maskPhone = (phone?: string) =>
	phone ? phone.replace(/(\d{2})\d{4,}(\d{2})/, "$1******$2") : "";

/**
 * Adapter for Branch attribution & device context parameters
 * ASK BACKEND: Keep branch_device_context only if confirmed wanted by backend.
 * Currently mapped to backend attribution fields (source, campaign_id, sub_source, medium, campaign_name).
 */
const getAttributionPayload = async (): Promise<Record<string, any>> => {
	const attribution = getBranchAttribution();
	const payload: Record<string, any> = {};

	if (attribution?.source) payload.source = attribution.source;
	if (attribution?.campaign_id) payload.campaign_id = attribution.campaign_id;
	if (attribution?.sub_source) payload.sub_source = attribution.sub_source;
	if (attribution?.medium) payload.medium = attribution.medium;
	if (attribution?.campaign_name) payload.campaign_name = attribution.campaign_name;

	// One-line switch: Set to false if backend confirms branch_device_context is not needed
	const includeBranchDeviceContext = true;
	if (includeBranchDeviceContext) {
		payload.branch_device_context = await getBranchDeviceContext(getBranchDeviceToken());
	}

	return payload;
};

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

	if (__DEV__) {
		console.log(`➡️ [AUTH] Calling OTP endpoint: ${axios.defaults.baseURL}/${URLS.auth.request_otp} for phone: ${maskPhone(data.phone_number)}`);
	}

	try {
		// Attempt FastAPI /auth/request-otp directly
		const response = await axios.post<
			StandardResponse<FastApiRequestOtpResponse> | Partial<LoginResponseType>
		>(URLS.auth.request_otp, payload);
		
		if (__DEV__) {
			console.log("✅ [AUTH] OTP Response received successfully");
		}
		const resData = response.data;

		// Normalized FastAPI envelope handling
		if (resData && "data" in resData && (resData as any).data?.sign_in_key) {
			const fastApiData = (resData as StandardResponse<FastApiRequestOtpResponse>).data;
			return {
				next_action: "verify_otp",
				otp_id: fastApiData.sign_in_key,
				expires_in: fastApiData.expires_in_seconds,
				sign_in_key: fastApiData.sign_in_key,
				// test_otp used for auto-fill in __DEV__ only
				test_otp: __DEV__ ? fastApiData.test_otp : undefined,
				message: resData.message || "OTP sent successfully",
			};
		}

		return resData as Partial<LoginResponseType>;
	} catch (error: any) {
		if (__DEV__) {
			console.error("❌ [AUTH] requestOtp error status:", error?.response?.status, error?.message);
		}
		throw error;
	}
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
	const attributionPayload = await getAttributionPayload();

	const payload: FastApiVerifyOtpPayload = {
		phone_number: data.phone_number,
		// Send OTP strictly as a number to FastAPI
		otp: typeof data.otp === "number" ? data.otp : parseInt(String(data.otp).trim(), 10),
		sign_in_key: data.sign_in_key,
		client_type: "app" as const,
		...attributionPayload,
	};

	const response = await axios.post<
		StandardResponse<FastApiTokenResponse> | Partial<VerifyOtpResponseType>
	>(URLS.auth.verify_otp, payload);

	const resData = response.data;

	// Normalized FastAPI envelope handling (supports both { data: { ... } } and direct TokenResponse)
	const fastApiData: Partial<FastApiTokenResponse> | null =
		resData && "data" in resData && (resData as any).data?.access_token
			? (resData as StandardResponse<FastApiTokenResponse>).data
			: (resData as any)?.access_token
				? (resData as any)
				: null;

	if (fastApiData && fastApiData.access_token) {
		const user = fastApiData.user;
		// Backend returns user.id (UUID), or sub claim in access_token JWT
		const userId =
			user?.id ||
			(user as any)?.user_id ||
			(fastApiData as any).user_id ||
			getUserIdFromToken(fastApiData.access_token) ||
			"";

		return {
			success: true,
			message: (resData as any)?.message || "Authentication successful",
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
				is_phone_verified: user?.is_phone_verified ?? true,
				is_first_login: fastApiData.is_new_user === true,
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
	} else if ((resData as any)?.access_token) {
		return {
			access_token: (resData as any).access_token,
			refresh_token: (resData as any).refresh_token || refreshToken,
			token_type: (resData as any).token_type || "bearer",
		};
	}

	return resData as Partial<RefreshTokenResponseType>;
};

export const setMpin = async (data: SetMpinRequestType) => {
	const response = await axios.post<Partial<SetMpinResponseType>>((URLS.auth as any).set_mpin || "auth/setup-mpin", data);
	return response.data;
};

export const mpinLogin = async (data: MpinLoginRequestType) => {
	const payload = {
		...data,
		version: Application.nativeApplicationVersion,
		platform: "android",
	};

	const response = await axios.post<Partial<MpinLoginResponseType>>((URLS.auth as any).mpin_login || "auth/verify-mpin", payload);
	return response.data;
};

export const sendEmailOtp = async (data: SendEmailOtpRequestType) => {
	const response = await axios.post<Partial<SendEmailOtpResponseType>>(
		(URLS.auth as any).send_email_otp || "auth/send-email-otp",
		data,
	);
	return response.data;
};

export const verifyEmailOtp = async (data: VerifyEmailOtpRequestType) => {
	const response = await axios.post<Partial<VerifyEmailOtpResponseType>>(
		(URLS.auth as any).verify_email_otp || "auth/verify-email-otp",
		data,
	);
	return response.data;
};
