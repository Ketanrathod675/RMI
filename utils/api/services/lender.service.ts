import { axios } from "../core/client";
import { URLS } from "../core/endpoints";
import type {
	BREEvaluationRequest,
	BREEvaluationResponse,
	CouponVerifyResponse,
	LenderAllocationResult,
	LenderItem,
	NormalizedResponse,
	ProductItem,
} from "../types/lender.types";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * LENDER ALLOCATION (User-facing part)
 * POST /lender-allocations/allocate-for-user/{user_id}
 * Backend returns raw LenderAllocationSelectionResult.
 * Normalised into NormalizedResponse<LenderAllocationResult> so screens never care.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export const allocateLenderForUser = async (
	userId: string,
): Promise<NormalizedResponse<LenderAllocationResult>> => {
	const response = await axios.post<LenderAllocationResult>(
		URLS.lender_allocations.allocate_for_user(userId),
	);

	// Raw object returned by FastAPI backend; normalise into standard shape
	const rawData = response.data;
	return {
		success: rawData?.allocated_lender_id !== null,
		message: rawData?.selection_reason || "Lender evaluated successfully",
		data: rawData,
	};
};

/**
 * ADAPTER: Post-KYC Lender Allocation Trigger
 * ASK BACKEND:
 * (a) The endpoint currently has no auth required and expects user_id in the URL path.
 *     It should require Bearer token and use the authenticated user.
 * (b) The old `PATCH /users/basic-details` triggered `allocate_lender_by_age`,
 *     but `/kyc/submit` does NOT. Who triggers allocation now, and when?
 * One-line switch: toggle `shouldClientTriggerAllocation` below.
 */
export const shouldClientTriggerAllocation = true;

export const triggerPostKycAllocationAdapter = async (
	userId: string,
): Promise<LenderAllocationResult | null> => {
	if (!shouldClientTriggerAllocation || !userId) {
		return null;
	}
	try {
		const res = await allocateLenderForUser(userId);
		return res.data ?? null;
	} catch (error) {
		if (__DEV__) {
			console.warn("⚠️ [Post-KYC Allocation Adapter] Failed to allocate lender:", error);
		}
		return null;
	}
};

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * CREDIT EVALUATION (BRE)
 * POST /credit-evaluation/evaluate
 * Backend returns raw BREEvaluationResponse.
 * Normalised into NormalizedResponse<BREEvaluationResponse>.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export const evaluateCredit = async (
	payload: BREEvaluationRequest,
): Promise<NormalizedResponse<BREEvaluationResponse>> => {
	// Guard: Never send simulation_mode: true or custom_bureau_report from app
	const cleanPayload: BREEvaluationRequest = {
		user_id: payload.user_id,
		application_id: payload.application_id,
		product_id: payload.product_id,
		lender_id: payload.lender_id,
		loan_amount: payload.loan_amount,
		tenure_days: payload.tenure_days,
		simulation_mode: false,
	};

	const response = await axios.post<BREEvaluationResponse>(
		URLS.credit_evaluation.evaluate,
		cleanPayload,
	);

	const rawData = response.data;
	return {
		success: rawData?.final_decision === "APPROVED",
		message: rawData?.decision_reason || "Credit evaluated successfully",
		data: rawData,
	};
};

/**
 * ADAPTER: Credit Evaluation (BRE) Trigger
 * ASK BACKEND:
 * Exact position in the flow (after assessment fee vs before professional-details),
 * and whether the server will call BRE itself so the client only reads the result.
 * One-line switch: toggle `shouldClientCallBRE` below.
 */
export const shouldClientCallBRE = true;

export const runCreditEvaluationAdapter = async (params: {
	userId: string;
	applicationId?: string;
	productId?: string;
	lenderId?: string;
}): Promise<BREEvaluationResponse | null> => {
	if (!shouldClientCallBRE || !params.userId) {
		return null;
	}
	try {
		const res = await evaluateCredit({
			user_id: params.userId,
			application_id: params.applicationId,
			product_id: params.productId,
			lender_id: params.lenderId,
		});
		return res.data;
	} catch (error) {
		if (__DEV__) {
			console.warn("⚠️ [Credit Evaluation Adapter] BRE evaluation error:", error);
		}
		throw error;
	}
};

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * COUPON VERIFICATION
 * POST /coupons/verify (Bearer)
 * ─────────────────────────────────────────────────────────────────────────────
 */
export const verifyCoupon = async (
	couponCode: string,
): Promise<CouponVerifyResponse> => {
	const response = await axios.post<CouponVerifyResponse>(
		URLS.coupons.verify,
		{ coupon_code: couponCode.trim().toUpperCase() },
	);
	return response.data;
};

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * PUBLIC LENDER & PRODUCT LIST ENDPOINTS
 * GET /lenders, GET /products
 * ─────────────────────────────────────────────────────────────────────────────
 */
export const getLenders = async (): Promise<LenderItem[]> => {
	try {
		const response = await axios.get<any>(URLS.lenders.list);
		const raw = response.data;
		if (Array.isArray(raw)) {
			return raw;
		}
		if (raw && Array.isArray(raw.items)) {
			return raw.items;
		}
		if (raw && Array.isArray(raw.data)) {
			return raw.data;
		}
		return [];
	} catch (err) {
		if (__DEV__) {
			console.warn("⚠️ [getLenders] Failed to fetch lenders list:", err);
		}
		return [];
	}
};

export const getProducts = async (): Promise<ProductItem[]> => {
	const response = await axios.get<ProductItem[]>(URLS.products.list);
	return response.data;
};
