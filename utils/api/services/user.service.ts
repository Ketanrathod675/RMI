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
 * Save Basic Details (PATCH /users/basic-details)
 * Updates full_name, pan_card, fathers_name, date_of_birth (DD-MM-YYYY), email, pincode, gender, preferred_language.
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
 * Fetch User Profile (`/users/me`)
 */
export const getUserProfile = async () => {
	const response = await axios.get<UserProfileResponseType>(URLS.user.me);
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
