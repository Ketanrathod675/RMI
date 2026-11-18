import { axios } from "../core/client";
import { URLS } from "../core/endpoints";

export type MandateMethod = "upi" | "enach";

export type CreateMandateResponse = {
	access_key: string;
	url: string;
	txnid?: string;
};

export type MandateStatusResponse = {
	success: boolean;
	data: {
		has_mandate: boolean;
		txnid: string | null;
		mandate_type: "UPI" | "ENACH" | null;
		status: string | null;
		is_active: boolean;
		/** Backend completion state; UPI may proceed while bank authorization remains pending. */
		is_complete?: boolean;
		/** true once the gateway reported back (return page or webhook); false = nothing received yet */
		callback_received?: boolean;
		created_at?: string | null;
		updated_at?: string | null;
		current_step: string | null;
		next_step: string | null;
	};
};

/**
 * Creates an Easebuzz auto-debit mandate and returns the hosted checkout URL.
 * The amount and dates are decided by the backend from the borrower's loan.
 * client_type "app" makes the gateway return to rapid-money://emandate-status.
 */
export const createMandate = async (method: MandateMethod): Promise<CreateMandateResponse> => {
	const url = method === "upi" ? URLS.autocollect.upi_mandate : URLS.autocollect.enach_mandate;
	const res = await axios.post<CreateMandateResponse>(url, { client_type: "app" }, { timeout: 60000 });
	return res.data;
};

export const getMandateStatus = async (txnid?: string): Promise<MandateStatusResponse> => {
	const res = await axios.get<MandateStatusResponse>(URLS.autocollect.mandate_status, {
		params: txnid ? { txnid } : undefined,
	});
	return res.data;
};

export type MandateBankAccount = {
	bank_name: string | null;
	account_last4: string | null;
};

export type MandateTypeResponse = {
	success: boolean;
	data: {
		mandate_type: "UPI" | "ENACH";
		default_mandate_type: "UPI";
		upi_failed_attempts: number;
		fallback_threshold: number;
		fallback_to_enach: boolean;
		loan_id: string | null;
		bank_account: MandateBankAccount | null;
	};
};

export const getMandateType = async (): Promise<MandateTypeResponse> => {
	const res = await axios.get<MandateTypeResponse>(URLS.autocollect.mandate_type);
	return res.data;
};
