export type ConsentKey =
	| "kycVerification"
	| "creditBureau"
	| "deviceFraud"
	| "bankAmlMnrl"
	| "dataSharing"
	| "communication";

export type ConsentPayload = Record<ConsentKey, boolean> & {
	otp?: number;
	signInKey?: string;
};

export interface ConsentOtpInitiateResponse {
	success: boolean;
	message: string;
	sign_in_key: string;
	expires_in_seconds: number;
	masked_phone: string;
	resend_after_seconds: number;
	test_otp?: number | string;
}

export interface ConsentSignResponse {
	success: boolean;
	message: string;
	signed: boolean;
	signed_at?: string;
	signed_document_url?: string;
	signature_type?: string;
}

export interface ConsentStatusResponse {
	success: boolean;
	signed: boolean;
	signed_at?: string | null;
	current_step?: string | null;
	required?: boolean;
}
