import { axios } from "../core/client";
import { URLS } from "../core/endpoints";

export interface ProfessionalDetailsPayload {
	employmentType: "salaried" | "self_employed";
	residenceStatus: string;
	typeOfCompany?: string;
	companyName?: string;
	designation?: string;
	salaryRange: string;
	modeOfSalary?: string;
	natureOfBusiness?: string;
	typeOfIndustry?: string;
	kfsLanguage: string;
	reasonForLoan: string;
}

export interface ProfessionalDetailsData {
	id?: string;
	user_id?: string;
	employment_type: string;
	residence_status: string;
	type_of_company?: string;
	company_name?: string;
	designation?: string;
	salary_range: string;
	monthly_income?: string | number;
	mode_of_salary?: string;
	nature_of_business?: string;
	type_of_industry?: string;
	kfs_language: string;
	reason_for_loan?: string;
}

export interface ProfessionalDetailsResponse {
	success: boolean;
	message: string;
	data: ProfessionalDetailsData | null;
	options?: {
		reason_for_loan?: Array<{ value: string; label: string }>;
		languages?: string[];
	};
}

/**
 * Fetch Professional Details
 * GET /professional-details
 */
export const getProfessionalDetails = async (): Promise<ProfessionalDetailsData | null> => {
	try {
		const response = await axios.get<ProfessionalDetailsResponse>(
			URLS.professional.professional_details,
		);
		return response.data?.data ?? null;
	} catch (error: any) {
		const rawDetail =
			error?.response?.data?.detail ||
			error?.response?.data?.message ||
			error?.message ||
			"Failed to fetch professional details";
		const detailStr = typeof rawDetail === "string" ? rawDetail : JSON.stringify(rawDetail);
		const err = new Error(detailStr) as any;
		err.detail = detailStr;
		err.status = error?.response?.status;
		throw err;
	}
};

/**
 * Fetch Full Professional Details Response with options
 * GET /professional-details
 */
export const getProfessionalDetailsWithMeta = async (): Promise<ProfessionalDetailsResponse> => {
	try {
		const response = await axios.get<ProfessionalDetailsResponse>(
			URLS.professional.professional_details,
		);
		return response.data;
	} catch (error: any) {
		const rawDetail =
			error?.response?.data?.detail ||
			error?.response?.data?.message ||
			error?.message ||
			"Failed to fetch professional details";
		const detailStr = typeof rawDetail === "string" ? rawDetail : JSON.stringify(rawDetail);
		const err = new Error(detailStr) as any;
		err.detail = detailStr;
		err.status = error?.response?.status;
		throw err;
	}
};

/**
 * Submit Professional Details
 * POST /professional-details
 */
export const submitProfessionalDetails = async (
	payload: ProfessionalDetailsPayload,
): Promise<ProfessionalDetailsResponse> => {
	try {
		const response = await axios.post<ProfessionalDetailsResponse>(
			URLS.professional.professional_details,
			payload,
		);
		return response.data;
	} catch (error: any) {
		const rawDetail =
			error?.response?.data?.detail ||
			error?.response?.data?.message ||
			error?.message ||
			"Failed to submit professional details";
		const detailStr = typeof rawDetail === "string" ? rawDetail : JSON.stringify(rawDetail);
		const err = new Error(detailStr) as any;
		err.detail = detailStr;
		err.status = error?.response?.status;
		throw err;
	}
};
