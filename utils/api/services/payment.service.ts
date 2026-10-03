import { axios } from "../core/client";
import { URLS } from "../core/endpoints";
import type {
	InitiateAssessmentFeePayload,
	InitiateAssessmentFeeResponse,
	PaymentStatusResponse,
} from "../types/payment.types";

/**
 * Initiate Assessment Fee Payment
 * POST /payment/initiate-assessment-fee
 */
export const initiateAssessmentFee = async (
	payload: InitiateAssessmentFeePayload,
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
	);
	return response.data;
};

/**
 * Check Easebuzz Payment Status
 * POST /payment/verify-status/{txnid}
 */
export const checkPaymentStatus = async (
	txnid: string,
): Promise<PaymentStatusResponse> => {
	const response = await axios.post<PaymentStatusResponse>(
		URLS.payments.verify_status(txnid),
	);
	return response.data;
};
