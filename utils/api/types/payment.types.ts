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
	status: "COMPLETED" | "PENDING" | "FAILED" | string;
	payment_id?: string;
	txnid?: string;
	easepayid?: string;
}

export interface PaymentStatusResponse {
	success: boolean;
	message: string;
	data: PaymentStatusData;
}
