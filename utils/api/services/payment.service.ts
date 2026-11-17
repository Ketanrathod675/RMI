import Logger from "@/utils/logger";
import { axios } from "../core/client";
import { URLS } from "../core/endpoints";
import type {
	AssessmentChecks,
	InitiateAssessmentFeePayload,
	InitiateAssessmentFeeResponse,
	PaymentStatusResponse,
	RetryAssessmentChecksPayload,
} from "../types/payment.types";

export { AssessmentChecks, RetryAssessmentChecksPayload };

/**
 * Initiate Assessment Fee Payment
 * POST /payment/initiate-assessment-fee
 */
export const initiateAssessmentFee = async (
	payload: InitiateAssessmentFeePayload,
	idempotencyKey?: string,
): Promise<InitiateAssessmentFeeResponse> => {
	const response = await axios.post<InitiateAssessmentFeeResponse>(
		URLS.payments.initiate_assessment_fee,
		{
			lead_id: payload.lead_id,
			phone_no: payload.phone_no,
			firstname: payload.firstname,
			email: payload.email,
			coupon_code: payload.coupon_code ? payload.coupon_code.trim().toUpperCase() : null,
			client_type: payload.client_type ?? "app",
		},
		idempotencyKey ? { headers: { "Idempotency-Key": idempotencyKey } } : undefined,
	);
	return response.data;
};

/**
 * Check Easebuzz Payment Status
 * POST /payment/verify-status/{txnid}
 */
export const checkPaymentStatus = async (
	txnid: string,
	options: { timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<PaymentStatusResponse> => {
	const response = await axios.post<PaymentStatusResponse>(
		URLS.payments.verify_status(txnid),
		undefined,
		{ timeout: options.timeoutMs, signal: options.signal },
	);
	return response.data;
};

/**
 * Normalise assessment checks response into a consistent contract.
 * Tolerates both the v2 target backend contract (clean status) and older/intermediate backend shapes.
 */
export const normalizeAssessmentChecks = (raw: any): AssessmentChecks => {
	if (!raw || typeof raw !== "object") {
		return {
			status: "pending",
			failed_rule: null,
			can_update_email: false,
			can_update_pan: false,
			remaining_email_updates: 0,
			remaining_pan_updates: 0,
		};
	}

	let status: "pending" | "approved" | "rejected" | "needs_update" | "error" | "service_unavailable" = "pending";

	if (raw.status && typeof raw.status === "string") {
		const s = raw.status.toLowerCase().trim();
		if (
			s === "approved" ||
			s === "rejected" ||
			s === "needs_update" ||
			s === "error" ||
			s === "pending" ||
			s === "service_unavailable"
		) {
			status = s as any;
		} else if (s === "success") {
			status = "approved";
		} else if (s === "failed" || s === "fail") {
			status = "error";
		} else if (s === "in_progress") {
			status = "pending";
		}
	} else if (raw.bre_status && typeof raw.bre_status === "string") {
		const bs = raw.bre_status.toLowerCase().trim();
		if (
			bs === "approved" ||
			bs === "rejected" ||
			bs === "needs_update" ||
			bs === "error" ||
			bs === "service_unavailable"
		) {
			status = bs as any;
		}
	}

	const validFailedRules = ["age", "pin_code", "email", "pan_card", "bureau"] as const;
	let failed_rule: AssessmentChecks["failed_rule"] = null;
	if (raw.failed_rule && typeof raw.failed_rule === "string") {
		const fr = raw.failed_rule.toLowerCase().trim();
		if (validFailedRules.includes(fr as any)) {
			failed_rule = fr as any;
		}
	}

	const can_update_email = Boolean(raw.can_update_email);
	const can_update_pan = Boolean(raw.can_update_pan);

	const remaining_email_updates =
		typeof raw.remaining_email_updates === "number"
			? raw.remaining_email_updates
			: can_update_email
				? 1
				: 0;

	const remaining_pan_updates =
		typeof raw.remaining_pan_updates === "number"
			? raw.remaining_pan_updates
			: can_update_pan
				? 1
				: 0;

	const retry_after_seconds =
		typeof raw.retry_after_seconds === "number" ? raw.retry_after_seconds : undefined;
	const unavailable_service =
		typeof raw.unavailable_service === "string" ? raw.unavailable_service : undefined;

	const validBookingStatuses = ["pending", "success", "error", "service_unavailable"] as const;
	const rawBookingStatus =
		typeof raw.booking_status === "string" ? raw.booking_status.toLowerCase().trim() : null;
	const booking_status =
		rawBookingStatus && (validBookingStatuses as readonly string[]).includes(rawBookingStatus)
			? (rawBookingStatus as AssessmentChecks["booking_status"])
			: null;

	return {
		status,
		failed_rule,
		message: raw.message || raw.msg || undefined,
		booking_success:
			typeof raw.booking_success === "boolean" ? raw.booking_success : null,
		booking_status,
		lender_lead_id: raw.lender_lead_id ? String(raw.lender_lead_id) : null,
		loan_account_number: raw.loan_account_number ? String(raw.loan_account_number) : null,
		can_update_email,
		can_update_pan,
		remaining_email_updates,
		remaining_pan_updates,
		retry_after_seconds,
		unavailable_service,
	};
};

/**
 * Fetch BRE and Booking Status
 * GET /payment/booking-status?txnid={txnid}&lead_id={leadId}
 */
export const getBookingStatus = async (
	params?: { txnid?: string; leadId?: string },
	options?: { signal?: AbortSignal },
): Promise<AssessmentChecks> => {
	Logger.debug("Fetching booking status", params || {});
	const queryParams: Record<string, string> = {};
	if (params?.txnid) {
		queryParams.txnid = params.txnid;
	}
	if (params?.leadId) {
		queryParams.lead_id = params.leadId;
	}

	try {
		const response = await axios.get(URLS.payments.booking_status, {
			params: Object.keys(queryParams).length > 0 ? queryParams : undefined,
			signal: options?.signal,
		});
		const raw = response.data?.data || response.data;
		return normalizeAssessmentChecks(raw);
	} catch (error: any) {
		const httpStatus = error?.response?.status;
		const rawDetail =
			error?.response?.data?.detail ||
			error?.response?.data?.message ||
			error?.message ||
			"Failed to fetch booking status";
		const detailStr =
			typeof rawDetail === "string" ? rawDetail : JSON.stringify(rawDetail);
		const err = new Error(detailStr) as any;
		err.detail = detailStr;
		err.status = httpStatus;
		if (httpStatus === 404) {
			err.isNotFound = true;
		} else if (httpStatus === 409) {
			err.isPaymentPending = true;
		}
		throw err;
	}
};

/**
 * Retry Assessment Checks after updating email or PAN
 * POST /payment/retry-assessment-checks
 */
export const retryAssessmentChecks = async (
	payload: RetryAssessmentChecksPayload,
): Promise<AssessmentChecks> => {
	Logger.debug("Retrying assessment checks", { lead_id: payload.lead_id });
	const body: Record<string, any> = {
		lead_id: payload.lead_id,
		retry_email: true,
		retry_pan: true,
		max_retries: 1,
	};
	if (payload.txnid) {
		body.txnid = payload.txnid;
	}
	if (payload.updated_email) {
		body.updated_email = payload.updated_email.trim().toLowerCase();
	}
	if (payload.updated_pan) {
		body.updated_pan = payload.updated_pan.trim().toUpperCase();
	}

	try {
		const response = await axios.post(URLS.payments.retry_assessment_checks, body);
		const raw = response.data?.data || response.data;
		return normalizeAssessmentChecks(raw);
	} catch (error: any) {
		const rawDetail =
			error?.response?.data?.detail ||
			error?.response?.data?.message ||
			error?.message ||
			"Failed to retry assessment checks";
		const detailStr =
			typeof rawDetail === "string" ? rawDetail : JSON.stringify(rawDetail);
		const err = new Error(detailStr) as any;
		err.detail = detailStr;
		err.status = error?.response?.status;
		throw err;
	}
};
