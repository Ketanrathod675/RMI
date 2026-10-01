/**
 * RapidMoney Lender Allocation & Credit Evaluation (BRE) Types
 * Compatible with FastAPI + PostgreSQL Backend
 */

/**
 * Normalized response wrapper so frontend screens don't have to handle
 * inconsistent backend envelopes (raw objects vs {success, message, data}).
 */
export interface NormalizedResponse<T> {
	success: boolean;
	message?: string;
	data: T;
}

/**
 * POST /lender-allocations/allocate-for-user/{user_id}
 * Raw response from backend
 */
export interface LenderAllocationResult {
	allocated_lender_id: string | null;
	lender_name: string | null;
	selection_reason: string;
	precedence_rule: string;
	user_category: string;
	eligible_lenders: Array<Record<string, any>>;
	excluded_lender_ids: string[];
}

/**
 * POST /credit-evaluation/evaluate
 * Request payload
 */
export interface BREEvaluationRequest {
	user_id: string;
	application_id?: string;
	product_id?: string;
	lender_id?: string;
	loan_amount?: number;
	tenure_days?: number;
	simulation_mode?: false;
}

/**
 * Step detail in BRE Evaluation
 */
export interface BRERuleResult {
	step: number;
	rule_id: string; // "age" | "pin_code" | "email" | "pan_card" | "bureau"
	rule_name: string;
	status: "PASS" | "FAIL" | "PENDING" | "SKIP" | "ERROR" | string;
	risk_level?: "LOW" | "MEDIUM" | "HIGH" | string;
	criteria?: string;
	actual_value?: string;
	expected_value?: string;
	error_message?: string;
	execution_time_ms?: number;
}

/**
 * Raw response from POST /credit-evaluation/evaluate
 */
export interface BREEvaluationResponse {
	id?: string;
	user_id?: string;
	application_id?: string | null;
	product_id?: string | null;
	lender_id?: string | null;
	final_decision: "APPROVED" | "REJECTED" | "REVIEW" | string;
	decision_reason: string;
	failed_rule?: "age" | "pin_code" | "email" | "pan_card" | "bureau" | string | null;
	overall_risk_score?: number;
	risk_level?: "LOW" | "MEDIUM" | "HIGH" | string;
	total_rules_evaluated?: number;
	rules_passed?: number;
	rules_failed?: number;
	simulation_mode?: boolean;
	rule_details?: BRERuleResult[];
	created_at?: string;
}

/**
 * POST /coupons/verify
 */
export interface CouponVerifyPayload {
	coupon_code: string;
}

export interface CouponVerifyResponse {
	success: boolean;
	message: string;
	data: {
		coupon_code: string;
		discount: number;
	};
}

/**
 * Public Lender & Product Models
 */
export interface LenderItem {
	id: string;
	company_name: string;
	description?: string;
	is_active: boolean;
	[key: string]: any;
}

export interface ProductItem {
	id: string;
	product_name: string;
	product_category?: string;
	lender_id?: string;
	is_active: boolean;
	[key: string]: any;
}
