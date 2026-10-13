import Logger from "@/utils/logger";
import type { AxiosResponse } from "axios";
import { axios } from "../core/client";
import { URLS } from "../core/endpoints";

export type IdentityApiResponse<T = any> = {
	success: boolean;
	message: string;
	data: T;
};

export class IdentityApiError extends Error {
	status?: number;
	detail?: string;

	constructor(message: string, status?: number, detail?: string) {
		super(message);
		this.name = "IdentityApiError";
		this.status = status;
		this.detail = detail;
	}
}

async function requestIdentity<T>(
	fn: () => Promise<AxiosResponse<any>>,
	actionName: string,
): Promise<IdentityApiResponse<T>> {
	try {
		const res = await fn();
		const raw = res.data;

		if (raw && typeof raw === "object" && ("success" in raw || "data" in raw)) {
			const success = raw.success !== undefined ? Boolean(raw.success) : true;
			const message = typeof raw.message === "string" ? raw.message : "";
			const data = (raw.data !== undefined ? raw.data : raw) as T;
			Logger.debug(`Identity API [${actionName}] responded`, { success });
			return { success, message, data };
		}

		Logger.debug(`Identity API [${actionName}] responded (raw)`, { hasData: !!raw });
		return {
			success: true,
			message: "",
			data: raw as T,
		};
	} catch (err: any) {
		const status = err.response?.status;
		const detail =
			typeof err.response?.data?.detail === "string"
				? err.response.data.detail
				: Array.isArray(err.response?.data?.detail)
				? err.response.data.detail[0]?.msg
				: err.response?.data?.message || err.message;

		Logger.error(`Identity API [${actionName}] transport/HTTP error`, { status });
		throw new IdentityApiError(detail || "Network error", status, detail);
	}
}

// ---------------------------------------------------------------------------
// 1. CKYC Types & Methods
// ---------------------------------------------------------------------------

export type CkycNextAction = "ckyc" | "digilocker" | "selfie_match";

export type CkycStatusData = {
	status?: string;
	next_action: CkycNextAction;
	ckyc_attempts?: number;
	skip_ckyc?: boolean;
	message?: string;
};

export type SendCkycOtpData = {
	session_id?: string;
};

export type ValidateCkycOtpPayload = {
	otp: string;
	session_id?: string;
};

export type ValidateCkycOtpData = {
	switch_to_digilocker?: boolean;
	ckyc_attempts?: number;
	ckyc_number?: string;
};

export type InitDigilockerPayload = {
	redirect_url: string;
};

export type InitDigilockerData = {
	txn_id: string;
	authorize_url: string;
};

export type CompleteDigilockerPayload = {
	txn_id: string;
};

export type CompleteDigilockerData = {
	aadhaar_details?: any;
};

export const getCkycStatus = async (): Promise<IdentityApiResponse<CkycStatusData>> => {
	return requestIdentity(
		() => axios.get(URLS.ckyc.status),
		"getCkycStatus",
	);
};

export const sendCkycOtp = async (): Promise<IdentityApiResponse<SendCkycOtpData>> => {
	// The new backend takes no body; it uses the authenticated user's phone number
	return requestIdentity(
		() => axios.post(URLS.ckyc.send_otp, {}),
		"sendCkycOtp",
	);
};

export const validateCkycOtp = async (
	payload: ValidateCkycOtpPayload,
): Promise<IdentityApiResponse<ValidateCkycOtpData>> => {
	// Never log OTP value
	return requestIdentity(
		() =>
			axios.post(URLS.ckyc.validate_otp, {
				otp: payload.otp,
				session_id: payload.session_id,
			}),
		"validateCkycOtp",
	);
};

export const initDigilocker = async (
	payload: InitDigilockerPayload,
): Promise<IdentityApiResponse<InitDigilockerData>> => {
	return requestIdentity(
		() => axios.post(URLS.ckyc.digilocker_init, { redirect_url: payload.redirect_url }),
		"initDigilocker",
	);
};

export const completeDigilocker = async (
	payload: CompleteDigilockerPayload,
): Promise<IdentityApiResponse<CompleteDigilockerData>> => {
	// Send ONLY txn_id; never send xml_data or aadhaar_data
	return requestIdentity(
		() => axios.post(URLS.ckyc.digilocker_complete, { txn_id: payload.txn_id }),
		"completeDigilocker",
	);
};

// ---------------------------------------------------------------------------
// 2. Selfie Types & Methods
// ---------------------------------------------------------------------------

export type SelfieStatusData = {
	status?: string;
	workflow_completed?: boolean;
	[key: string]: any;
};

export type UploadFilePayload = {
	uri: string;
	name?: string;
	type?: string;
};

export type UploadSelfieData = {
	selfie_url?: string;
	liveness_passed?: boolean;
	liveness_score?: number;
	face_match_passed?: boolean;
	face_match_score?: number;
	workflow_completed?: boolean;
};

export const getSelfieStatus = async (): Promise<IdentityApiResponse<SelfieStatusData>> => {
	return requestIdentity(
		() => axios.get(URLS.selfie.status),
		"getSelfieStatus",
	);
};

export const uploadSelfie = async (
	payload: UploadFilePayload,
): Promise<IdentityApiResponse<UploadSelfieData>> => {
	const formData = new FormData();
	formData.append("file", {
		uri: payload.uri,
		name: payload.name || "selfie.jpg",
		type: payload.type || "image/jpeg",
	} as any);

	return requestIdentity(
		() =>
			axios.post(URLS.selfie.upload_file, formData, {
				headers: {
					"Content-Type": "multipart/form-data",
				},
			}),
		"uploadSelfie",
	);
};

// ---------------------------------------------------------------------------
// 3. Address Types & Methods
// ---------------------------------------------------------------------------

export type AddressDocumentTypeOption = {
	id?: string;
	name?: string;
	label?: string;
	value?: string;
	code?: string;
	type?: string;
	title?: string;
	description?: string;
	[key: string]: any;
};

export type AddressStatusData = {
	status?: string;
	kyc_address?: string;
	kyc_city?: string;
	kyc_pin_code?: string;
	kyc_state?: string;
	supported_document_types?: (string | AddressDocumentTypeOption)[];
	communication_address?: string;
	communication_city?: string;
	communication_pin_code?: string;
	communication_state?: string;
	is_current_address?: boolean;
	address_proof_url?: string;
	document_type?: string;
	[key: string]: any;
};

export type AddressDocumentTypesData = {
	document_types?: (string | AddressDocumentTypeOption)[];
};

export type UploadAddressProofData = {
	file_url: string;
	filename?: string;
	file_size?: number;
	content_type?: string;
};

export type SubmitAddressPayload = {
	is_current_address: boolean;
	kyc_address?: string;
	kyc_city?: string;
	kyc_pin_code?: string;
	kyc_state?: string;
	communication_address?: string;
	communication_city?: string;
	communication_pin_code?: string;
	communication_state?: string;
	document_type?: string;
	address_proof_url?: string;
	proof_of_address_number?: string;
};

export type SubmitAddressData = {
	is_current_address?: boolean;
	address_data?: any;
	workflow_completed?: boolean;
};

export const getAddressStatus = async (): Promise<IdentityApiResponse<AddressStatusData>> => {
	return requestIdentity(
		() => axios.get(URLS.address_v2.status),
		"getAddressStatus",
	);
};

export const getAddressDocumentTypes = async (): Promise<
	IdentityApiResponse<AddressDocumentTypesData>
> => {
	return requestIdentity(
		() => axios.get(URLS.address_v2.document_types),
		"getAddressDocumentTypes",
	);
};

export const uploadAddressProof = async (
	payload: UploadFilePayload,
): Promise<IdentityApiResponse<UploadAddressProofData>> => {
	const formData = new FormData();
	formData.append("file", {
		uri: payload.uri,
		name: payload.name || "address_proof.jpg",
		type: payload.type || "image/jpeg",
	} as any);

	return requestIdentity(
		() =>
			axios.post(URLS.address_v2.upload_proof, formData, {
				headers: {
					"Content-Type": "multipart/form-data",
				},
			}),
		"uploadAddressProof",
	);
};

export const submitAddress = async (
	payload: SubmitAddressPayload,
): Promise<IdentityApiResponse<SubmitAddressData>> => {
	// Never log personal address values
	Logger.debug("Submitting address verification", {
		is_current_address: payload.is_current_address,
		has_proof: !!payload.address_proof_url,
		document_type: payload.document_type,
	});

	return requestIdentity(
		() => axios.post(URLS.address_v2.submit, payload),
		"submitAddress",
	);
};
