/**
 * Loan & Credit Queue Types
 * Matches the FastAPI Backend response contracts (INR numbers, step 5 models)
 */

export type CreditQueueStatus = {
	status: "not_started" | "pending" | "approved" | "rejected";
	current_step: string;
	can_proceed: boolean;
	message: string;
	rejection_reason?: string | null;
	credit_queue_enabled?: boolean;
};

export type DueDateOption = {
	date: string; /* YYYY-MM-DD */
	display_date: string;
	recommended: boolean;
	tenure_days: number;
	monthly_interest_rate: number;
	annual_interest_rate: number;
	interest_description: string;
	interest_amount?: number;
	amount_to_repay?: number;
};

export type LoanOffer = {
	loan_id: string | null;
	application_id: string;
	product_id: string | null;
	product_name: string;
	lender_name: string;
	lender_nbfc_info: string;
	max_loan_amount: number;
	sanctioned_amount: number;
	quoted_amount?: number;
	amount_options: number[];
	processing_fee: number;
	gst: number;
	total_processing_fee: number;
	processing_fee_breakdown: string;
	net_disbursal_amount: number;
	interest_rate_apr: number;
	monthly_interest_rate: number;
	interest_amount: number;
	tenure_days: number;
	amount_to_repay: number;
	due_date_options: DueDateOption[];
	selected_due_date: string;
	repayment_type: string;
	kfs_summary: Record<string, any>;
	processing_fee_percent?: number;
	gst_percent?: number;
};

export type SanctionLetterRequest = {
	accepted_amount?: number;
	selected_due_date?: string;
	tenure_days?: number;
};

export type SanctionLetter = {
	sanction_number: string;
	application_id: string;
	borrower_name: string;
	pan_number: string;
	address: string;
	lender_name: string;
	lender_nbfc_info: string;
	sanctioned_amount: number;
	net_disbursal_amount: number;
	repayment_amount: number;
	interest_rate_apr: number;
	monthly_interest_rate: number;
	interest_amount: number;
	processing_fee: number;
	gst: number;
	tenure_days: number;
	due_date: string;
	kfs_terms: Record<string, any>;
	sanction_letter_url?: string | null;
	status: string;
};

export type SanctionOtpSendResponse = {
	success: boolean;
	message: string;
	phone_number: string;
	expires_in_seconds: number;
};

export type SanctionOtpVerifyRequest = {
	otp: string;
	sanction_number?: string;
	accepted_amount?: number;
	selected_due_date?: string;
};

export type SanctionOtpVerifyResponse = {
	success: boolean;
	message: string;
	loan_id: string;
	sanction_number: string;
	current_step: string;
	next_step: string;
	status: string;
	workflow_completed: boolean;
};
