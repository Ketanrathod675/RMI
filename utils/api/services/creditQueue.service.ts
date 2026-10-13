import Logger from "@/utils/logger";
import { axios } from "../core/client";
import { URLS } from "../core/endpoints";
import type { CreditQueueStatus } from "../types/loan.types";

export class CreditQueueApiError extends Error {
	status?: number;
	detail?: string;

	constructor(message: string, status?: number, detail?: string) {
		super(message);
		this.name = "CreditQueueApiError";
		this.status = status;
		this.detail = detail;
	}
}

/**
 * Fetches the credit queue / underwriting status for the current borrower.
 * Unwraps the `{ success, message, data }` response envelope and returns the inner data.
 */
export async function getCreditQueueStatus(): Promise<CreditQueueStatus> {
	try {
		const res = await axios.get(URLS.credit_queue.status);
		const raw = res.data;

		if (raw && typeof raw === "object" && "data" in raw && raw.data !== undefined) {
			Logger.debug("Credit queue status retrieved", {
				success: raw.success,
				status: raw.data?.status,
				can_proceed: raw.data?.can_proceed,
			});
			return raw.data as CreditQueueStatus;
		}

		Logger.debug("Credit queue status retrieved (direct)", {
			hasData: Boolean(raw),
			status: raw?.status,
		});
		return raw as CreditQueueStatus;
	} catch (err: any) {
		const status = err.response?.status;
		const detail =
			typeof err.response?.data?.detail === "string"
				? err.response.data.detail
				: Array.isArray(err.response?.data?.detail)
				? err.response.data.detail[0]?.msg
				: err.response?.data?.message || err.message;

		Logger.error("Credit queue status request error", { status });
		throw new CreditQueueApiError(detail || "Failed to fetch credit queue status", status, detail);
	}
}
