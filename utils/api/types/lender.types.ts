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
 * POST /coupons/verify
 */
export interface CouponVerifyPayload {
	coupon_code: string;
	lead_id?: string;
}

export interface CouponVerifyResponse {
	success: boolean;
	message: string;
	data: {
		coupon_code: string;
		discount: number;
		original_amount?: number;
		final_amount?: number;
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
