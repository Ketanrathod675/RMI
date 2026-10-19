export interface ApiErrorInfo {
	status?: number;
	detail: string;
	message: string;
}

/**
 * Normalizes error properties whether they come from axios response,
 * custom ApiError (LoanOfferApiError, CreditQueueApiError), or native Error.
 */
export function getApiErrorInfo(err: any): ApiErrorInfo {
	const status = err?.status ?? err?.response?.status;

	const rawDetail = err?.detail ?? err?.response?.data?.detail;
	let detail = "";
	if (typeof rawDetail === "string") {
		detail = rawDetail;
	} else if (Array.isArray(rawDetail) && rawDetail.length > 0) {
		const first = rawDetail[0];
		detail = typeof first === "string" ? first : (first?.msg ?? "");
	} else if (rawDetail && typeof rawDetail === "object" && "msg" in rawDetail) {
		detail = String((rawDetail as any).msg ?? "");
	}

	const rawMessage = err?.response?.data?.message ?? err?.message ?? "";
	const message = typeof rawMessage === "string" ? rawMessage : "";

	return { status, detail, message };
}

/**
 * Returns a lowercase combined string of detail and message for pattern matching.
 */
export function errorText(info: ApiErrorInfo): string {
	return `${info.detail} ${info.message}`.toLowerCase().trim();
}
