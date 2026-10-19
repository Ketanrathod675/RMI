import { axios } from "../core/client";
import { URLS } from "../core/endpoints";

// ---------------------------------------------------------------------------
// KFS / agreement signing (OTP e-sign)
// ---------------------------------------------------------------------------

export type InitiateSigningResponseType = {
	success: boolean;
	message: string;
	otp_sent?: boolean;
	expires_in_seconds?: number;
	sign_in_key?: string;
	test_otp?: string;
};

/**
 * Sends the KFS signing OTP. Returns `sign_in_key`, which must be sent to verify.
 * @deprecated replaced by signing.service
 */
export const initiateDigitalSigning = async (_appHash?: string) => {
	const response = await axios.post<Partial<InitiateSigningResponseType>>(
		URLS.kfs.initiate,
		{},
	);
	return response.data;
};

/** Resends the KFS signing OTP. The returned `sign_in_key` replaces the old one. */
export const resendDigitalSigningOtp = async () => {
	const response = await axios.post<Partial<InitiateSigningResponseType>>(
		URLS.kfs.resend_otp,
		{},
	);
	return response.data;
};

export type VerifyOtpAndSignRequestType = {
	otp: string;
	sign_in_key?: string;
};

export type VerifyOtpAndSignResponseType = {
	success: boolean;
	message: string;
	signed?: boolean;
	signed_document_url?: string;
	signed_at?: string;
	status?: string;
	current_step?: string | null;
	next_step?: string | null;
};

/**
 * @deprecated replaced by signing.service
 */
export const verifyOtpAndSign = async (data: VerifyOtpAndSignRequestType) => {
	const response = await axios.post<Partial<VerifyOtpAndSignResponseType>>(
		URLS.kfs.sign,
		data,
	);
	return response.data;
};

export type KfsStatusResponseType = {
	success: boolean;
	data: {
		loan_id: string;
		application_id?: string;
		kfs_url: string;
		is_signed: boolean;
		signed_at?: string | null;
		document_ready: boolean;
		status: string;
		loan_amount: number;
		tenure_months: number;
		next_step: string;
	};
};

export const getKfsStatus = async () => {
	const response = await axios.get<KfsStatusResponseType>(URLS.sanction_letter.status);
	return response.data;
};

// ---------------------------------------------------------------------------
// Consent document
// ---------------------------------------------------------------------------

export type ConsentStatusResponseType = {
	success: boolean;
	signed: boolean;
	signed_at?: string | null;
	preview_url?: string;
	signed_document_url?: string | null;
};

export const getConsentDocumentStatus = async () => {
	const response = await axios.get<ConsentStatusResponseType>(
		URLS.consent_document.status,
	);
	return response.data;
};

export type SignConsentResponseType = {
	success: boolean;
	message: string;
	signed: boolean;
	signed_at?: string;
	signed_document_url?: string;
};

export const signConsentDocument = async () => {
	const response = await axios.post<SignConsentResponseType>(
		URLS.consent_document.sign,
		{},
	);
	return response.data;
};
