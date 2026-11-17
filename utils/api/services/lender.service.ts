import Logger from "@/utils/logger";
import { axios } from "../core/client";
import { URLS } from "../core/endpoints";
import { getUserProfile } from "./user.service";
import type {
	CouponVerifyResponse,
	LenderAllocationResult,
	LenderItem,
	NormalizedResponse,
	ProductItem,
} from "../types/lender.types";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * LENDER ALLOCATION (Employee / Admin use only)
 * POST /lender-allocations/allocate-for-user/{user_id}
 * ⚠️ WARNING: This endpoint is employee-only (Depends(require_active_employee)).
 * For a borrower token it returns 401 ("Employee not found") which logs the user out.
 * Must NOT be called from borrower screens. The borrower's allocated lender
 * is assigned server-side and retrieved via GET /auth/me.
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
 * The borrower app must never call lender-allocations/allocate-for-user (employee-only,
 * returns 401 and would log the user out); the allocated lender comes from GET /auth/me.
 */
export const shouldClientTriggerAllocation = false;

/**
 * ADAPTER: Post-KYC Lender Allocation Reader.
 * Safely resolves the server-allocated lender for the borrower from GET /auth/me.
 * Never calls the employee-only allocate-for-user route and never throws.
 */
export const triggerPostKycAllocationAdapter = async (
	userId?: string,
): Promise<LenderAllocationResult | null> => {
	try {
		const profile = await getUserProfile();
		const meData = (profile as any)?.data || profile;
		const wf = meData?.current_workflow;
		const kycResp = wf?.profile_response;

		const allocatedId =
			kycResp?.allocated_lender_id ??
			wf?.allocated_lender_id ??
			meData?.allocated_lender_id ??
			meData?.lead?.allocated_lender_id ??
			null;

		const lenderName =
			kycResp?.lender_name ??
			wf?.allocated_lender_name ??
			wf?.lender_name ??
			meData?.allocated_lender_name ??
			meData?.lender_name ??
			meData?.lead?.allocated_lender_name ??
			meData?.lead?.lender_name ??
			null;

		if (!allocatedId && !lenderName) {
			return null;
		}

		const cleanId =
			allocatedId !== null && allocatedId !== undefined && String(allocatedId) !== "null"
				? String(allocatedId)
				: null;
		const cleanName =
			lenderName !== null && lenderName !== undefined && String(lenderName).trim() !== ""
				? String(lenderName).trim()
				: null;

		if (!cleanId && !cleanName) {
			return null;
		}

		return {
			allocated_lender_id: cleanId,
			lender_name: cleanName,
			selection_reason: "Server-side allocated lender from /auth/me",
			precedence_rule: "server_allocated",
			user_category: "standard",
			eligible_lenders: [],
			excluded_lender_ids: [],
		};
	} catch (error) {
		if (__DEV__) {
			Logger.warn("Operation failed", { code: "operation_failed" });
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
			Logger.warn("Operation failed", { code: "operation_failed" });
		}
		return [];
	}
};

export const getProducts = async (): Promise<ProductItem[]> => {
	const response = await axios.get<ProductItem[]>(URLS.products.list);
	return response.data;
};
