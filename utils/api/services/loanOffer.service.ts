import Logger from "@/utils/logger";
import { axios } from "../core/client";
import { URLS } from "../core/endpoints";
import type {
	LoanOffer,
	SanctionLetter,
	SanctionLetterRequest,
} from "../types/loan.types";

export class LoanOfferApiError extends Error {
	status?: number;
	detail?: string;

	constructor(message: string, status?: number, detail?: string) {
		super(message);
		this.name = "LoanOfferApiError";
		this.status = status;
		this.detail = detail;
	}
}

function unwrapResponse<T>(res: any, actionName: string): T {
	const raw = res.data;
	if (raw && typeof raw === "object" && "data" in raw && raw.data !== undefined) {
		Logger.debug(`LoanOffer API [${actionName}] responded`, { success: raw.success });
		return raw.data as T;
	}
	Logger.debug(`LoanOffer API [${actionName}] responded (direct)`, { hasData: Boolean(raw) });
	return raw as T;
}

function handleApiError(err: any, actionName: string): never {
	const status = err.response?.status;
	const detail =
		typeof err.response?.data?.detail === "string"
			? err.response.data.detail
			: Array.isArray(err.response?.data?.detail)
			? err.response.data.detail[0]?.msg
			: err.response?.data?.message || err.message;

	Logger.error(`LoanOffer API [${actionName}] request error`, { status });
	throw new LoanOfferApiError(detail || `Failed in ${actionName}`, status, detail);
}

/**
 * Fetches the approved loan offer and KFS summary for the current borrower.
 */
export async function getLoanOffer(amount?: number): Promise<LoanOffer> {
	try {
		const res = await axios.get(URLS.loan_offer.offer, {
			params: amount ? { amount } : undefined,
		});
		return unwrapResponse<LoanOffer>(res, "getLoanOffer");
	} catch (err: any) {
		handleApiError(err, "getLoanOffer");
	}
}

/**
 * Generates the digital sanction letter and KFS based on user-selected terms.
 */
export async function generateSanctionLetter(
	payload?: SanctionLetterRequest,
): Promise<SanctionLetter> {
	try {
		const res = await axios.post(URLS.loan_offer.sanction_letter, payload || {});
		return unwrapResponse<SanctionLetter>(res, "generateSanctionLetter");
	} catch (err: any) {
		handleApiError(err, "generateSanctionLetter");
	}
}
