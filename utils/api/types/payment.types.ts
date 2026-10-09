/**
 * Assessment Fee & Payment API Types
 * Matches FastAPI backend (/api/v1/payment)
 */

export interface InitiateAssessmentFeePayload {
	lead_id: string;
	phone_no: string;
	firstname: string;
	email: string;
	coupon_code?: string | null;
	client_type?: "app" | "web";
}

export interface InitiateAssessmentFeeData {
	access_key?: string;
	payment_url?: string;
	txnid: string;
	amount: number;
	status?: "WAIVED" | string;
	original_amount?: number;
	discount_amount?: number;
	coupon_code?: string | null;
}

export type InitiateAssessmentFeeResponse =
	| {
		success: boolean;
		message?: string;
		data: InitiateAssessmentFeeData;
	}
	| (InitiateAssessmentFeeData & {
		success?: boolean;
		message?: string;
	});

export interface PaymentStatusData {
	status: "COMPLETED" | "PENDING" | "FAILED" | "CANCELLED" | "EXPIRED" | string;
	/** "not_started" = server has no payment attempt yet (user backed out of the gateway). */
	reason?: "not_started" | string;
	payment_id?: string;
	txnid?: string;
	easepayid?: string;
}

export interface PaymentStatusResponse {
	success: boolean;
	message: string;
	data: PaymentStatusData;
}

export type AssessmentChecks = {
	status: "pending" | "approved" | "rejected" | "error";
	failed_rule: null | "age" | "pin_code" | "email" | "pan_card" | "bureau";
	message?: string;
	handshake_success?: boolean | null;
	lender_lead_id?: string | null;
	can_update_email: boolean;
	can_update_pan: boolean;
	remaining_email_updates: number;
	remaining_pan_updates: number;
};

export interface RetryAssessmentChecksPayload {
	lead_id: string;
	txnid?: string;
	updated_email?: string;
	updated_pan?: string;
}