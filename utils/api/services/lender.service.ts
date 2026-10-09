import { axios } from "../core/client";
import { URLS } from "../core/endpoints";
import type {
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
	userId: string = "me",
): Promise<NormalizedResponse<LenderAllocationResult>> => {
	const response = await axios.post<LenderAllocationResult>(
		URLS.lender_allocations.allocate_for_user("me"),
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
 * ADAPTER: Post-KYC Lender Allocation Trigger (uses authenticated user "me")
 */
export const shouldClientTriggerAllocation = true;

export const triggerPostKycAllocationAdapter = async (
	userId?: string,
): Promise<LenderAllocationResult | null> => {
	if (!shouldClientTriggerAllocation) {
		return null;
	}
	try {
		const res = await allocateLenderForUser("me");
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
 * COUPON VERIFICATION
 * POST /coupons/verify (Bearer)
 * ─────────────────────────────────────────────────────────────────────────────
 */
export const verifyCoupon = async (
	couponCode: string,
	leadId?: string,
): Promise<CouponVerifyResponse> => {
	const response = await axios.post<CouponVerifyResponse>(
		URLS.coupons.verify,
		{
			coupon_code: couponCode.trim().toUpperCase(),
			...(leadId ? { lead_id: leadId } : {}),
		},
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
