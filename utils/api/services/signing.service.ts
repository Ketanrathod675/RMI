import * as FileSystem from "expo-file-system/legacy";
import SecureStorage from "@/utils/secure-storage";
import { STORAGE_KEYS } from "@/utils/storage";
import Logger from "@/utils/logger";
import { axios } from "../core/client";
import { API_URL } from "../core/config";
import { getApiBaseUrl } from "../core/client";
import { URLS } from "../core/endpoints";
import type {
	SanctionLetterStatus,
	SanctionLetterGenerated,
	KfsInitiateResponse,
	KfsSignRequest,
	KfsSignResponse,
} from "../types/signing.types";

export class SigningApiError extends Error {
	status?: number;
	detail?: string;

	constructor(message: string, status?: number, detail?: string) {
		super(message);
		this.name = "SigningApiError";
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

	Logger.error(`Signing API [${actionName}] request error`, { status });
	throw new SigningApiError(detail || `Failed in ${actionName}`, status, detail);
}

/**
 * Builds the absolute URL for download endpoints from API origin.
 */
export function resolveApiOriginUrl(pathOrUrl: string): string {
	if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
	const base = getApiBaseUrl().replace(/\/+$/, "");
	const origin = base.replace(/\/api\/v\d+.*$/, "");
	const normalizedPath = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
	if (!normalizedPath.startsWith("/api/")) {
		return `${base}${normalizedPath}`;
	}
	return `${origin}${normalizedPath}`;
}

/**
 * Fetches the current sanction letter / agreement signing status.
 */
export async function getSanctionLetterStatus(): Promise<SanctionLetterStatus> {
	try {
		const res = await axios.get<SanctionLetterStatus>(URLS.sanction_letter.status);
		Logger.debug("Signing API [getSanctionLetterStatus] responded", { status: res.data?.status });
		return res.data;
	} catch (err: any) {
		handleApiError(err, "getSanctionLetterStatus");
	}
}

/**
 * Generates the sanction letter and KFS PDF.
 */
export async function generateSanctionLetterPdf(): Promise<SanctionLetterGenerated> {
	try {
		const res = await axios.post<SanctionLetterGenerated>(
			URLS.sanction_letter.generate,
			{},
			{ timeout: 60000 },
		);
		Logger.debug("Signing API [generateSanctionLetterPdf] responded");
		return res.data;
	} catch (err: any) {
		handleApiError(err, "generateSanctionLetterPdf");
	}
}

/**
 * Initiates KFS signing and sends an OTP to borrower's phone.
 */
export async function initiateKfsSigning(): Promise<KfsInitiateResponse> {
	try {
		const res = await axios.post<KfsInitiateResponse>(URLS.kfs.initiate, {});
		Logger.debug("Signing API [initiateKfsSigning] responded", { success: res.data?.success });
		return res.data;
	} catch (err: any) {
		handleApiError(err, "initiateKfsSigning");
	}
}

/**
 * Resends the KFS signing OTP. The returned sign_in_key replaces the previous key.
 */
export async function resendKfsOtp(): Promise<KfsInitiateResponse> {
	try {
		const res = await axios.post<KfsInitiateResponse>(URLS.kfs.resend_otp, {});
		Logger.debug("Signing API [resendKfsOtp] responded", { success: res.data?.success });
		return res.data;
	} catch (err: any) {
		handleApiError(err, "resendKfsOtp");
	}
}

/**
 * Verifies OTP and signs the KFS document.
 */
export async function signKfs(payload: KfsSignRequest): Promise<KfsSignResponse> {
	try {
		const res = await axios.post<KfsSignResponse>(URLS.kfs.sign, payload);
		Logger.debug("Signing API [signKfs] responded", { signed: res.data?.signed });
		return res.data;
	} catch (err: any) {
		handleApiError(err, "signKfs");
	}
}

/**
 * Downloads the sanction letter / KFS PDF with Bearer authentication into the cache directory.
 */
export async function downloadSanctionLetterPdf(
	downloadUrl: string,
	sanctionNumber?: string,
): Promise<string> {
	const token = await SecureStorage.getSensitiveWithLegacyMigration(
		STORAGE_KEYS["@access-token"],
	);
	if (!token) {
		throw new SigningApiError("Not authenticated", 401, "Not authenticated");
	}

	const destination = `${FileSystem.cacheDirectory}sanction_${sanctionNumber ?? "letter"}.pdf`;
	try {
		await FileSystem.deleteAsync(destination, { idempotent: true });
	} catch {
		// ignore
	}

	const url = resolveApiOriginUrl(downloadUrl);
	Logger.debug("Downloading sanction letter PDF", { hasSanctionNumber: Boolean(sanctionNumber) });

	let response;
	try {
		response = await FileSystem.downloadAsync(url, destination, {
			headers: { Authorization: `Bearer ${token}` },
		});
	} catch (err: any) {
		await FileSystem.deleteAsync(destination, { idempotent: true }).catch(() => undefined);
		throw new SigningApiError(err.message || "Failed to download sanction letter", undefined, err.message);
	}

	const headers = response.headers || {};
	const contentTypeKey = Object.keys(headers).find(
		(k) => k.toLowerCase() === "content-type"
	);
	const contentType = contentTypeKey ? String(headers[contentTypeKey]).toLowerCase() : "";

	if (
		response.status !== 200 ||
		(contentType && (contentType.includes("json") || contentType.includes("html")))
	) {
		await FileSystem.deleteAsync(destination, { idempotent: true }).catch(() => undefined);
		throw new SigningApiError(`PDF download failed (${response.status})`, response.status, `PDF download failed (${response.status})`);
	}

	return response.uri;
}
