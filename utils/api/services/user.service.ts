import { axios } from "../core/client";
import { URLS } from "../core/endpoints";
import type { PaginatedResponse, StandardResponse } from "../types/common";
import type {
	BasicDetailsPayload,
	CanReapplyResponseType,
	DeleteAccountPayload,
	EmploymentDetailsHbPartnerResponseType,
	FastApiUser,
	FastApiUserUpdate,
	KycSubmitPayload,
	KycSubmitResponse,
	PersonalDetailsHbPartnerResponseType,
	UserDashboardResponseType,
	UserProfileResponseType,
} from "../types/user.types";

/**
 * Fetch User Dashboard Data
 */
export const getUserDashboardData = async () => {
	const response = await axios.get<Partial<UserDashboardResponseType>>(URLS.user.get_dashboard);
	return response.data;
};

/**
 * Submit Basic Details (POST /kyc/submit)
 * Creates KYC record + lead + advances workflow.
 * Working path in RapidMoney PostgreSQL Backend.
 */
export const submitBasicDetails = async (
	payload: KycSubmitPayload,
): Promise<KycSubmitResponse> => {
	const response = await axios.post<KycSubmitResponse>(
		URLS.kyc.submit,
		payload,
	);
	return response.data;
};

/**
 * @deprecated Legacy endpoint (PATCH /users/basic-details).
 * Not supported on PostgreSQL backend (references columns that do not exist on User model).
 * Kept as an uncalled fallback. Use `submitBasicDetails` (/kyc/submit) instead.
 */
export const updateBasicDetails = async (
	payload: BasicDetailsPayload,
): Promise<FastApiUser> => {
	const response = await axios.patch<StandardResponse<FastApiUser>>(
		URLS.user.basic_details,
		payload,
	);
	return response.data.data;
};

/**
 * Fetch User Profile
 * Switched to GET /auth/me because GET /users/me conflicts with /users/{id} (id="me") returning 422.
 * /auth/me exists on the new FastAPI backend and returns the auth user.
 */
export const getUserProfile = async () => {
	const response = await axios.get<UserProfileResponseType>(URLS.auth.me);
	return response.data;
};

/**
 * Generic User CRUD: Partial update user profile (`PATCH /users/{id}`)
 */
export const updateUserProfile = async (
	userId: string,
	payload: FastApiUserUpdate,
): Promise<StandardResponse<FastApiUser>> => {
	const response = await axios.patch<StandardResponse<FastApiUser>>(
		URLS.user.by_id(userId),
		payload,
	);
	return response.data;
};

/**
 * Generic User CRUD: List users with pagination and search (`GET /users`)
 */
export const listUsers = async (params?: {
	page?: number;
	page_size?: number;
	sort_by?: string;
	sort_order?: "asc" | "desc";
	search?: string;
	[key: string]: any;
}): Promise<PaginatedResponse<FastApiUser>> => {
	const response = await axios.get<PaginatedResponse<FastApiUser>>(URLS.user.base, {
		params,
	});
	return response.data;
};

/**
 * Delete User Account
 */
export const deleteUserAccount = async (payload: DeleteAccountPayload) => {
	const response = await axios.post(URLS.user.delete_user, {
		full_name: payload.full_name,
		email: payload.email,
		phone_number: payload.phone_number,
		reason: payload.reason,
	});
	return response.data;
};

/**
 * Change Preferred Language
 */
export const changeLanguage = async (
	language: Parameters<(typeof URLS)["user"]["changeLanguage"]>[0] = "English",
) => {
	const response = await axios.put(URLS.user.changeLanguage(language));
	return response.data;
};

/**
 * Fetch HB Partner Personal Details
 */
export const getPersonalDetailsHbPartner = async () => {
	const response = await axios.get<PersonalDetailsHbPartnerResponseType>(
		URLS.kyc.personal_details_hb_partner,
	);
	return response.data;
};

/**
 * Fetch HB Partner Employment Details
 */
export const getEmploymentDetailsHbPartner = async () => {
	const response = await axios.get<EmploymentDetailsHbPartnerResponseType>(
		URLS.kyc.employment_details_hb_partner,
	);
	return response.data;
};

/**
 * Check Loan Reapplication Eligibility
 */
export const checkCanReapply = async () => {
	const response = await axios.get<CanReapplyResponseType>(URLS.loan_reapplication.can_reapply);
	return response.data;
};
