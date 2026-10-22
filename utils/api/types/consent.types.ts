export type ConsentKey =
	| "kycVerification"
	| "creditBureau"
	| "deviceFraud"
	| "bankAmlMnrl"
	| "dataSharing"
	| "communication";

export type ConsentPayload = Record<ConsentKey, boolean>;

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
