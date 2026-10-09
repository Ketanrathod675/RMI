import { setStorageItem, STORAGE_KEYS } from "@/utils/storage";
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
 * Adapts FastAPI /auth/me current_workflow to legacy UserDashboardResponseType
 * so all dashboard cards, progress indicators, and resume journey continue working.
 */
export const getUserDashboardData = async (): Promise<UserDashboardResponseType> => {
	const response = await axios.get<any>(URLS.auth.me);
	const authData = response.data?.data || response.data;
	const workflow = authData?.current_workflow;
	const kyc = authData?.profile;
	const kycResponse = workflow?.profile_response;

	// Hydrate local storage with workflow metadata for offline / recovery support
	try {
		const leadId = workflow?.lead_id || kycResponse?.lead_id;
		if (leadId) {
			await setStorageItem(STORAGE_KEYS["@lead-id"], String(leadId));
		}
		const fee = kycResponse?.af_amount || kycResponse?.assessment_fee;
		if (fee) {
			await setStorageItem(STORAGE_KEYS["@assessment-fee-amount"], String(fee));
			await setStorageItem(STORAGE_KEYS["@assessment-fee"], String(fee));
		}
		if (kycResponse?.af) {
			await setStorageItem(STORAGE_KEYS["@af-flag"], String(kycResponse.af));
		}
		if (kycResponse?.allocated_lender_id) {
			await setStorageItem(
				STORAGE_KEYS["@allocated-lender-id"],
				String(kycResponse.allocated_lender_id),
			);
		}
		if (kycResponse?.lender_name) {
			await setStorageItem(
				STORAGE_KEYS["@allocated-lender-name"],
				String(kycResponse.lender_name),
			);
		}
		if (kycResponse) {
			await setStorageItem(STORAGE_KEYS["@kyc-response"], JSON.stringify(kycResponse));
		}
		if (workflow?.overall_status === "rejected" && workflow?.bre_status !== "rejected") {
			await setStorageItem(STORAGE_KEYS["@loan-rejected-flag"], "true");
			await setStorageItem(STORAGE_KEYS["@no-approved-amount-flag"], "true");
		}
	} catch (storageErr) {
		console.warn("⚠️ [getUserDashboardData] Failed to hydrate storage from workflow:", storageErr);
	}

	const currentStep = workflow?.current_step || "basic_details";
	const nextStep = workflow?.next_step || "";
	const percentage = workflow?.overall_percentage ?? 0;
	const overallStatus = workflow?.overall_status || "in_progress";

	return {
		dashboard_type: "workflow_dashboard",
		user_summary: {
			name: kyc?.full_name || authData?.phone_number || "Applicant",
			customer_id: authData?.id || "",
			phone_number: authData?.phone_number || "",
			profile_completion: percentage,
			kyc_status: overallStatus,
			member_since: authData?.created_at || new Date().toISOString(),
			last_login: new Date(),
		},
		workflow_progress: {
			current_step: currentStep,
			current_step_name: currentStep.replace(/_/g, " "),
			completion_percentage: percentage,
			overall_status: overallStatus,
			steps_completed: Math.round((percentage / 100) * 10),
			total_steps: 10,
			last_activity_at: new Date(),
			next_required_step: nextStep,
			workflow_started_at: new Date(),
			bre_status: workflow?.bre_status || null,
			bre_failed_rule: workflow?.bre_failed_rule || null,
		},
		workflow_steps: [],
		current_step_info: {
			step: currentStep,
			step_name: currentStep.replace(/_/g, " "),
			percentage: percentage,
			is_accessible: true,
			description: "",
		},
		notifications: {
			unread_count: 0,
			recent_notifications: [],
		},
		progress_summary: {
			days_since_started: 0,
			estimated_completion_time: "",
			next_milestone: nextStep,
		},
	};
};

/**
 * Submit Basic Details (POST /profile/submit)
 * Creates Profile record + lead + advances workflow.
 * Working path in RapidMoney PostgreSQL Backend.
 */
export const submitBasicDetails = async (
	payload: KycSubmitPayload,
): Promise<KycSubmitResponse> => {
	const response = await axios.post<KycSubmitResponse>(
		URLS.profile.submit,
		payload,
	);
	return response.data;
};

/**
 * @deprecated Legacy endpoint (PATCH /users/basic-details).
 * Not supported on PostgreSQL backend (references columns that do not exist on User model).
 * Kept as an uncalled fallback. Use `submitBasicDetails` (/profile/submit) instead.
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
export const getUserProfile = async (): Promise<UserProfileResponseType> => {
	const response = await axios.get<any>(URLS.auth.me);
	const raw = response.data;
	const unwrapped = raw?.data || raw;
	const kyc = unwrapped?.profile || {};

	const fullName = kyc.full_name || unwrapped.full_name || "";
	const fatherName = kyc.father_name || unwrapped.fathers_name || "";
	const panNumber = kyc.pan_number || unwrapped.pan_card || "";
	const dob = kyc.dob || unwrapped.date_of_birth || "";
	const gender = kyc.gender || unwrapped.gender || "";
	const pincode = kyc.pincode || unwrapped.pincode || "";
	const email = kyc.email || unwrapped.email || null;
	const isPanVerified = Boolean(kyc.is_pan_verified ?? unwrapped.pan_verified);
	const isEmailVerified = Boolean(kyc.is_email_verified ?? unwrapped.email_verified);

	const personal_details = {
		full_name: fullName,
		father_name: fatherName,
		pan_number: panNumber,
		date_of_birth: dob,
		gender: gender,
		pin_code: pincode,
		is_pan_verified: isPanVerified,
		preferred_language: unwrapped.preferred_language || "English",
		aadhaar_number: kyc.aadhaar_number || "",
	};

	const address = {
		address_line1: kyc.address || (pincode ? `Pincode: ${pincode}` : null),
		address_line2: null,
		city: kyc.city || "",
		state: kyc.state || "",
		pincode: pincode,
		country: "India",
		verified: isPanVerified,
		latitude: null,
		longitude: null,
		kyc_address_shown: {
			address: kyc.address || (pincode ? `Pincode: ${pincode}` : ""),
			city: kyc.city || "",
			state: kyc.state || "",
			pin_code: pincode,
		},
	};

	const normalized: UserProfileResponseType = {
		...unwrapped,
		id: unwrapped.id || "",
		user_id: unwrapped.id || "",
		customer_id: unwrapped.id || "",
		phone_number: unwrapped.phone_number || "",
		email: email,
		role: unwrapped.role || "borrower",
		status: unwrapped.is_active ? "active" : "inactive",
		is_phone_verified: Boolean(unwrapped.is_phone_verified),
		is_email_verified: isEmailVerified,
		personal_details: unwrapped.personal_details || personal_details,
		employment_details: unwrapped.employment_details || {
			employment_type: "Salaried",
			verification_type: "online",
			company_type: null,
			company_name: "",
			designation: "",
			nature_of_business: "",
			industry_type: "",
			income_range: "",
			residence_status: "",
		},
		preferred_language: unwrapped.preferred_language || "English",
		notification_preferences: unwrapped.notification_preferences || {
			email: true,
			sms: true,
			push: true,
		},
		address: unwrapped.address || address,
		kyc_address: unwrapped.kyc_address || address,
		created_at: unwrapped.created_at || new Date().toISOString(),
		last_login: unwrapped.last_login || new Date().toISOString(),
		current_workflow: unwrapped.current_workflow,
	};

	return {
		...normalized,
		profile: kyc,
		data: normalized,
		success: raw?.success ?? true,
	} as any;
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

export interface BackendCanReapplyResponse {
	can_reapply: boolean;
	reason?: string | null;
	days_remaining?: number | null;
}

export interface ReapplyLoanResponse {
	success: boolean;
	workflow_id: string;
	current_step: string;
	lead_id?: string | number;
}

/**
 * Check Loan Reapplication Eligibility (GET /loan-reapplication/can-reapply)
 */
export const checkCanReapply = async (): Promise<CanReapplyResponseType> => {
	const response = await axios.get<BackendCanReapplyResponse>(
		URLS.loan_reapplication.can_reapply
	);
	const data = response.data;
	const canApply = !!data.can_reapply;
	const daysRemaining = data.days_remaining ?? 0;

	return {
		can_apply: canApply,
		message: data.reason ?? "",
		reason: canApply ? "eligible" : (daysRemaining > 0 ? "cooldown" : "not_eligible"),
		starting_step: "assessment_fee",
		processing_fee_required: true,
		processing_fee_valid_days: daysRemaining,
		previous_applications_count: 0,
		reusable_data: {
			personal_details: false,
			ckyc_verified: false,
			employment_details: false,
			address_details: false,
		},
		rejection_count: 0,
	};
};

/**
 * Reapply for Loan (POST /loan-reapplication/reapply)
 */
export const reapplyForLoan = async (): Promise<ReapplyLoanResponse> => {
	const response = await axios.post<ReapplyLoanResponse>(
		URLS.loan_reapplication.reapply
	);
	return response.data;
};
