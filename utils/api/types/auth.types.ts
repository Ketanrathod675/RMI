import type { Languages } from "@/store";

/**
 * RapidMoney FastAPI Auth Payloads
 */
export type OTPType = "signup/login" | "sanction" | "consent";

export interface FastApiRequestOtpPayload {
	phone_number: string;
	otp_type?: OTPType;
	full_name?: string;
}

export interface FastApiRequestOtpResponse {
	message: string;
	phone_number: string;
	sign_in_key: string;
	expires_in_seconds: number;
	test_otp?: number;
}

export interface FastApiVerifyOtpPayload {
	phone_number: string;
	otp: number;
	sign_in_key?: string;
}

export interface FastApiTokenResponse {
	access_token: string;
	refresh_token: string;
	token_type: string;
	is_new_user?: boolean;
	is_profile_completed?: boolean;
	next_step?: string;
	user: {
		uuid: string;
		phone_number: string;
		full_name?: string | null;
		fathers_name?: string | null;
		mothers_name?: string | null;
		gender?: string | null;
		pan_card?: string | null;
		email?: string | null;
		phone_verified: boolean;
		email_verified: boolean;
		pan_verified: boolean;
		role: "borrower" | "employee" | "lender";
		is_active: boolean;
		image_url?: string | null;
		created_at: string;
		updated_at: string;
	};
}

export interface FastApiRefreshTokenPayload {
	refresh_token: string;
}

/**
 * Mobile App Compatibility Types
 */
export type LoginRequestType = {
	phone_number: string;
	preferred_language?: string;
	app_hash?: string;
};

export type LoginResponseType = {
	user_exists: boolean;
	next_action: "verify_otp" | "enter_mpin";
	otp_id: string;
	expires_in: number;
	user_id?: string;
	customer_id?: string;
	is_mpin_set?: boolean;
	message: string;
	soft_pull_consent?: boolean;
	sign_in_key?: string;
	test_otp?: number;
};

export type VerifyOtpRequestType = {
	phone_number: string;
	otp: string;
	verification_type?: string;
	language?: Languages;
	preferred_language?: Languages;
	sign_in_key?: string;
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

export type VerifyOtpResponseType = {
	message: string;
	user_id: string;
	next_action: "setup_mpin" | (string & {});
	access_token?: string;
	refresh_token?: string;
	token_type?: string;
	permission_given?: boolean;
	is_new_user?: boolean;
	is_profile_completed?: boolean;
	next_step?: string;
	is_first_login?: boolean;
	user: User;
	success: true;
};

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

export type ForgotPasswordOtpRequestType = {
	phone_number: string;
};

export type ForgotPasswordOtpResponseType = {
	message: string;
	otp_id: string;
	expires_in: number;
};

export type VerifyMpinResetOtpRequestType = {
	phone_number: string;
	otp: string;
	otp_id: string;
};

export type VerifyMpinResetOtpResponseType = {
	message: string;
	reset_token: string;
};

export type ResetMpinRequestType = {
	phone_number: string;
	mpin: string;
	reset_token: string;
};

export type ResetMpinResponseType = {
	message: string;
};

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

export type RefreshTokenResponseType = {
	access_token: string;
	refresh_token: string;
	token_type: string;
};
