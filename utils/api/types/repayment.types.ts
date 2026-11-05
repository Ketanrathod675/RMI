/**
 * RapidMoney Repayment Types
 * Contracts for POST repayments/initiate-manual-payment,
 * POST repayments/payments/{txnid}/verify-status, and active_loan models.
 */

export interface ActivePayment {
	txnid: string;
	expires_at: string;
	amount?: number;
}

export type ActiveLoanState = "due" | "overdue" | "pending_payment" | string;

export interface ActiveLoan {
	loan_id: string;
	loan_number: string;
	state: ActiveLoanState;
	amount_to_repay: number;
	overdue_amount?: number;
	repayment_date?: string | null;
	next_due_date?: string | null;
	can_pay: boolean;
	active_payment?: ActivePayment | null;
	interest_amount?: number;
	principal_amount?: number;
	total_amount?: number;
	tenure_days?: number;
	disbursed_at?: string | null;
	[key: string]: any;
}

export interface InitiateRepaymentPayload {
	client_type: "app";
}

export interface InitiateRepaymentResponse {
	txnid: string;
	loan_id?: string;
	amount: number;
	payment_url: string;
	expires_at?: string;
	status?: string;
	message?: string;
	[key: string]: any;
}

export type RepaymentStatus =
	| "SUCCESS"
	| "PENDING"
	| "FAILED"
	| "CANCELLED"
	| "EXPIRED"
	| string;

export type RepaymentPendingReason =
	| "not_started"
	| "in_progress"
	| string
	| null;

export interface VerifyRepaymentData {
	status: RepaymentStatus;
	reason?: RepaymentPendingReason;
	txnid: string;
	amount?: number;
	loan_closed?: boolean;
	remaining_outstanding?: number;
	can_reapply?: boolean;
	[key: string]: any;
}

export interface VerifyRepaymentStatusResponse {
	success: boolean;
	data: VerifyRepaymentData;
	message?: string;
}

