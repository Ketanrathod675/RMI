import { axios, URLS } from ".";

// region: LOAN AGREEMENT DIGITAL SIGNING

export type InitiateSigningResponseType = {
	success: boolean;
	message: string;
	otp_sent?: boolean;
};

export const initiateDigitalSigning = async (app_hash?: string) => {
	const response = await axios.post<Partial<InitiateSigningResponseType>>(
		URLS.loan_agreement.initiate_signing,
		{ app_hash },
	);
	return response.data;
};

export type VerifyOtpAndSignRequestType = {
	otp: string;
};

export type VerifyOtpAndSignResponseType = {
	success: boolean;
	message: string;
	signed?: boolean;
	documents_signed?: string[];
	status?: "signed" | (string & {})
};

export const verifyOtpAndSign = async (data: VerifyOtpAndSignRequestType) => {
	const response = await axios.post<Partial<VerifyOtpAndSignResponseType>>(
		URLS.loan_agreement.sign,
		data,
	);
	return response.data;
};

// endregion: LOAN AGREEMENT DIGITAL SIGNING
