export type SanctionLetterStatus = {
	status: "not_generated" | "pending_acceptance" | "accepted";
	message?: string;
	sanction_number?: string;
	generated_at?: string;
	accepted_at?: string | null;
	valid_until?: string;
	download_url?: string;
	is_signed?: boolean;
	signed_at?: string | null;
	current_step?: string;
	next_step?: string;
};

export type SanctionLetterGenerated = {
	message: string;
	sanction_number: string;
	download_url: string;
	valid_until: string;
	next_step: string;
};

export type KfsInitiateResponse = {
	success: boolean;
	message: string;
	otp_sent: boolean;
	expires_in_seconds: number;
	sign_in_key: string;
	test_otp?: number | string;
};

export type KfsSignRequest = {
	otp: string;
	sign_in_key?: string;
};

export type KfsSignResponse = {
	success: boolean;
	message: string;
	signed: boolean;
	is_signed?: boolean;
	signed_document_url?: string;
	signed_at?: string;
	status: string;
	current_step?: string;
	next_step?: string;
};
