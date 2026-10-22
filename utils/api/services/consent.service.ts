import Logger from "@/utils/logger";
import { axios } from "../core/client";
import { URLS } from "../core/endpoints";
import type {
	ConsentPayload,
	ConsentSignResponse,
	ConsentStatusResponse,
} from "../types/consent.types";

export class ConsentApiError extends Error {
	status?: number;
	detail?: string;

	constructor(message: string, status?: number, detail?: string) {
		super(message);
		this.name = "ConsentApiError";
		this.status = status;
		this.detail = detail;
	}
}

function handleApiError(err: any, actionName: string): never {
	const status = err.response?.status;
	const detail =
		typeof err.response?.data?.detail === "string"
			? err.response.data.detail
			: Array.isArray(err.response?.data?.detail)
			? err.response.data.detail[0]?.msg
			: err.response?.data?.message || err.message;

	Logger.error(`Consent API [${actionName}] request error`, { status });
	throw new ConsentApiError(detail || `Failed in ${actionName}`, status, detail);
}

/**
 * Signs the customer data consent document.
 * Backend returns a plain JSON object directly (no envelope).
 */
export async function signConsent(payload: ConsentPayload): Promise<ConsentSignResponse> {
	try {
		const res = await axios.post<ConsentSignResponse>(
			URLS.consent_document.sign,
			payload,
		);
		Logger.debug("Consent API [signConsent] responded", { status: res.status });
		return res.data;
	} catch (err: any) {
		handleApiError(err, "signConsent");
	}
}

/**
 * Gets the current customer consent document signing status.
 * Backend returns a plain JSON object directly (no envelope).
 */
export async function getConsentStatus(): Promise<ConsentStatusResponse> {
	try {
		const res = await axios.get<ConsentStatusResponse>(URLS.consent_document.status);
		Logger.debug("Consent API [getConsentStatus] responded", { status: res.status });
		return res.data;
	} catch (err: any) {
		handleApiError(err, "getConsentStatus");
	}
}
