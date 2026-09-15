import { decode } from "@/utils/encode_decode";
import { getStorageItem, STORAGE_KEYS } from "@/utils/storage";
import { axios, DIGILOCKER_BASE_URL, URLS } from ".";

// region: VERIFY PAN

export type VerifyPanRequestType = {
	pan_number: string;
	name: string;
};

export type VerifyPanResponseType = {
	message: string;
	verified: boolean;
	pan_details: {
		pan_number: string;
		verified_name: string;
		provided_name: string;
		name_similarity_percentage: number;
		name_match: boolean;
		gender: string;
		constitution: string;
	};
	verification_reference: string;
	instructions?: string;
	third_party_data?: any; // Optional as it contains many fields
	is_pan_valid?: boolean;
};

export const verifyPan = async (data: VerifyPanRequestType) => {
	const encodedToken = await getStorageItem(STORAGE_KEYS["@access-token"]);
	const token = encodedToken ? decode(encodedToken) : "";
	
	const response = await axios.post<Partial<VerifyPanResponseType>>(
		URLS.kyc.verify_pan, 
		data,
		{
			headers: {
				Authorization: `Bearer ${token}`,
			},
		}
	);

	console.log("=== VERIFY PAN API RESPONSE ===");
	console.log(JSON.stringify(response.data, null, 2));

	return response.data;
};

// endregion: VERIFY PAN

// region: PERSONAL DETAILS

export type PersonalDetailsRequestType = {
	full_name: string;
	father_name: string;
	pan_number: string;
	date_of_birth: string; // Format: YYYY-MM-DD
	gender: string;
	pin_code: string;
	preferred_language?: string;
	is_pan_verified: boolean;
	email: string;
	is_pan_valid: boolean;
};

export type PersonalDetailsResponseType = {
	message: string;
	success: boolean;
	kyc_id: string;
	credit_check: {
		status: string;
		credit_score: number;
		credit_status: string;
		bureau: string;
		report_date: string;
	};
	processing_fee: {
		amount: number;
		currency: string;
		description: string;
		payment_methods: {
			id: string;
			name: string;
		}[];
	};
	pre_qualified_amount: number;
	next_step: string;
	status: string;
};

export const submitPersonalDetails = async (data: PersonalDetailsRequestType) => {
	const response = await axios.post<Partial<PersonalDetailsResponseType>>(
		URLS.kyc.personal_details,
		data,
		{
			timeout: 60000,
		},
	);

	return response.data;
};

// endregion: PERSONAL DETAILS



// region: EMPLOYMENT DETAILS

export type EmploymentDetailsRequestType = {
	employment_type: string;
	verification_type: string;
	type_of_company?: string;
	mode_of_salary?: string;
	company_name?: string;
	designation?: string;
	nature_of_business?: string;
	industry_type?: string;
	income_range: string;
	residence_status: string;
	preferred_language?: string;
};

export type EmploymentDetailsResponseType = {
	message: string;
	application_id?: string;
	is_reapplication?: boolean;
	next_action?: "digilocker" | "ckyc" | string;
	success?: boolean;
	kyc_id?: string;
	status?: string;
	next_step?: string;
};

export const submitEmploymentDetails = async (data: EmploymentDetailsRequestType) => {
	const response = await axios.post<Partial<EmploymentDetailsResponseType>>(
		URLS.kyc.employment_details,
		data,
	);

	return response.data;
};

// endregion: EMPLOYMENT DETAILS

// region: GET PROFESSIONAL DETAILS

export type ProfessionalDetailsResponseType = {
	status: boolean;
	languages?: string[];
	data: {
		employment_type: string | null;
		verification_type: string | null;
		type_of_company: string | null;
		mode_of_salary: string | null;
		company_name: string | null;
		designation: string | null;
		nature_of_business: string | null;
		industry_type: string | null;
		income_range: string | null;
		residence_status: string | null;
		preferred_language?: string | null;
	} | null;
};

export const getProfessionalDetails = async () => {
	try {
		console.log("🚀 Calling GET /kyc/professional-details");
		const response = await axios.get<ProfessionalDetailsResponseType>(URLS.kyc.professional_details);
		console.log("📥 Get Professional Details Response:", JSON.stringify(response.data, null, 2));
		return response.data;
	} catch (error: any) {
		console.error("❌ Get Professional Details API error:", error);
		// Return null or throw depending on preference. 
		// For auto-populate, we might want to fail silently or return structured error.
		// User said "log it", implies we handle it gracefully?
		// But usually we throw to let caller handle. 
		// I will rethrow to let the caller logging handle it OR return null?
		// Component expects promise.
		throw error;
	}
};

// endregion: GET PROFESSIONAL DETAILS

// region: GENERATE ORDER ID FOR ASSESSMENT FEE

export const generateOrderIdForAssessmentFee = async () => {
	return true;
};

// endregion:

// region: CONFIRM PAYMENT

export type ConfirmPaymentRequest = {
	payment_method: string;
	transaction_id: string;
};

export const confirmPayment = async (data: ConfirmPaymentRequest) => {
	const response = await axios.post(URLS.kyc.confirm_payment, data);

	return response.data;
};

// endregion

// region: EASEBUZZ PAYMENT STATUS

export type EasebuzzStatusResponse = {
	status: "success" | "failure" | "pending";
	message: string;
	order_id: string;
};

export const checkEasebuzzPaymentStatus = async (transactionId: string): Promise<EasebuzzStatusResponse> => {
	const response = await axios.post<EasebuzzStatusResponse>(`payments/payment/easebuzz/status/${transactionId}`);
	return response.data;
};

// endregion

// region: UPLOAD DOCUMENT

export type UploadDocumentRequestType = {
	fileUri: string;
	documentType: string;
	description?: string;
};

export type UploadDocumentResponseType = {
	message: string;
	status: string; // "uploaded"
	document_id?: string;
	document_type?: string;
	file_size?: number;
	file_url?: string;
	filename?: string;
	next_step?: string;
	uploaded_at?: string;
};

export const uploadDocument = async (data: UploadDocumentRequestType) => {
	const formData = new FormData();

	// Add the file
	formData.append("file", {
		uri: data.fileUri,
		type: "image/jpeg",
		name: "selfie.jpg",
	} as any);

	// Add document type
	formData.append("document_type", data.documentType);

	// Add description if provided
	if (data.description) {
		formData.append("description", data.description);
	}

	const response = await axios.post<Partial<UploadDocumentResponseType>>(
		URLS.ekyc.upload_document,
		formData,
		{
			headers: {
				"Content-Type": "multipart/form-data",
				timeout: 60000,
			},
		},
	);

	return response.data;
};

// endregion: UPLOAD DOCUMENT

// region: AADHAAR SEND OTP

export type AadhaarSendOtpRequestType = {
	aadhaar_number: string;
};

export type AadhaarSendOtpResponseType = {
	message: string;
	aadhaar_number: string;
	masked_mobile: string;
	expires_in: number;
	transaction_id: string;
	simulation_note?: string;
	valid_otp?: string;
};

export const sendAadhaarOtp = async (data: AadhaarSendOtpRequestType) => {
	const response = await axios.post<Partial<AadhaarSendOtpResponseType>>(
		URLS.ekyc.aadhaar_send_otp,
		data,
	);

	return response.data;
};

// endregion: AADHAAR SEND OTP

// region: AADHAAR VERIFY OTP

export type AadhaarVerifyOtpRequestType = {
	otp: string;
};

export type AadhaarVerifyOtpResponseType = {
	message: string;
	verified: boolean;
	verification_method: string;
	next_step: string;
	simulation_note?: string;
};

export const verifyAadhaarOtp = async (data: AadhaarVerifyOtpRequestType) => {
	const response = await axios.post<Partial<AadhaarVerifyOtpResponseType>>(
		URLS.ekyc.aadhaar_verify_otp,
		data,
	);

	return response.data;
};

// endregion: AADHAAR VERIFY OTP

// region: ADDRESS VERIFICATION

export type AddressVerificationRequestType = {
	is_current_address: boolean;
	kyc_proof_of_address_number: string;
	kyc_address: string;
	kyc_city: string;
	kyc_pin_code: string;
	kyc_state: string;
	// Optional fields for when is_current_address is false
	communication_address?: string;
	communication_city?: string;
	communication_pin_code?: string;
	communication_state?: string;
	communication_proof_of_address_number?: string;
	document_type?: string;
	address_proof_url?: string; // Full URL of uploaded address proof document
};

export type AddressVerificationResponseType = {
	message: string;
	address_type: string;
	auto_verified: boolean;
	next_step: string;
	completion_percentage: number;
	is_repeat_user?: boolean;
};

export const verifyAddress = async (data: AddressVerificationRequestType) => {
	try {
		const response = await axios.post<Partial<AddressVerificationResponseType>>(
			URLS.address.verify_address,
			data,
		);

		return response.data;
	} catch (error: any) {
		console.error("Address verification API error:", error);
		throw error;
	}
};

// endregion: ADDRESS VERIFICATION

// region: UPLOAD DOCUMENT

export type UploadKycDocumentRequestType = {
	document_type: string;
	file: File | { uri: string; name: string; type: string };
};

export type UploadKycDocumentResponseType = {
	uploaded: boolean;
	document_id: string;
	document_type: string;
	filename: string;
	file_size: number;
	upload_url?: string;
	file_url?: string; // Full URL from S3
	uploaded_at: string;
	status?: string;
};

export const uploadKycDocument = async (data: UploadKycDocumentRequestType) => {
	try {
		const formData = new FormData();
		formData.append("document_type", data.document_type);

		// Handle file upload for React Native
		if ("uri" in data.file) {
			formData.append("file", {
				uri: data.file.uri,
				name: data.file.name,
				type: data.file.type || "application/pdf",
			} as any);
		} else {
			formData.append("file", data.file);
		}

		const response = await axios.post<UploadKycDocumentResponseType>(
			URLS.kyc.upload_document,
			formData,
			{
				headers: {
					"Content-Type": "multipart/form-data",
				},
				timeout: 60000, // 60 seconds timeout
			},
		);

		return response.data;
	} catch (error: any) {
		console.error("Upload document API error:", error);
		throw error;
	}
};

// endregion: UPLOAD DOCUMENT

// region: LOAN TERMS

export type DueDateOption = {
	display_date: string;
	date: string;
};

export type FeeBreakdown = {
	[key: string]: any; // Since fee_breakdown structure is not specified, keeping it flexible
};

export type LoanTermsResponseType = {
	success: boolean;
	loan_terms: {
		amount_approved: number;
		processing_fee: number;
		gst_amount: number;
		total_processing_fee: number;
		interest_rate: number;
		monthly_rate: number;
		tenure_days: number;
		due_date_options: DueDateOption[];
		fee_breakdown: FeeBreakdown;
	};
	product_details: {
		product_id: string;
		product_name: string;
		product_category: string;
		repayment_type: string;
		lender_id: string;
	};
	data_source: string;
	message: string;
};

export const getLoanTerms = async () => {
	try {
		console.log("🚀 Calling GET /api/v1/loans/loan-terms for interest rate data");
		const response = await axios.get<Partial<LoanTermsResponseType>>(URLS.loans.loan_terms);

		console.log("📥 Loan Terms API Full Response:", JSON.stringify(response.data, null, 2));
		
		// Log specific interest rate data
		if (response.data?.loan_terms) {
			const { interest_rate, monthly_rate } = response.data.loan_terms;
			console.log("💰 Interest Rate Data from Backend:");
			console.log(`   - Interest Rate: ${interest_rate}%`);
			console.log(`   - Monthly Rate: ${monthly_rate}%`);
			console.log(`   - Amount Approved: ${response.data.loan_terms.amount_approved}`);
			console.log(`   - Tenure Days: ${response.data.loan_terms.tenure_days}`);
		} else {
			console.warn("⚠️ No loan_terms found in response");
		}

		return response.data;
	} catch (error: any) {
		console.error("❌ Loan terms API error:", error);
		throw error;
	}
};

// endregion: LOAN TERMS

// region: SUBMIT LOAN APPLICATION

export type SubmitLoanApplicationRequestType = {
	selected_due_date: string;
	agreed_to_terms: boolean;
	loan_terms: {
		amount_approved: number;
		processing_fee: number;
		gst_amount: number;
		total_processing_fee: number;
		interest_rate: number;
		monthly_rate: number;
	};
};

export type SubmitLoanApplicationResponseType = {
	success: boolean;
	message: string;
	loan_details: {
		loan_id: string;
		loan_number: string | null;
		application_id: string;
		amount_approved: number;
		tenure_days: number;
		total_repayment: number;
		due_date: string;
		selected_due_date: string;
		processing_fee: number;
		gst_amount: number;
		total_processing_fee: number;
		interest_amount: number;
		interest_rate: number;
		monthly_rate: number;
		daily_rate: number;
		processing_fee_percentage: number;
		loan_type: string;
	};
	workflow_completed: boolean;
	completion_percentage: number;
};

export const submitLoanApplication = async (data: SubmitLoanApplicationRequestType) => {
	try {
		const response = await axios.post<Partial<SubmitLoanApplicationResponseType>>(
			URLS.loans.submit_loan_application,
			data,
		);

		return response.data;
	} catch (error: any) {
		console.error("Submit loan application API error:", error);
		throw error;
	}
};

// endregion: SUBMIT LOAN APPLICATION

// region: DIGITAL LOCKER

export type GenerateDigitalLockerUrlRequestType = {
	uid: string;
	firstName: string;
	lastName: string;
	mobile: string;
	emailId?: string;
	isSendOtp: boolean;
	isHideExplanationScreen: boolean;
	redirectionUrl: string;
};

export type GenerateDigitalLockerUrlResponseType = {
	data: {
		url: string;
		transactionId: string;
		kycUrl: string;
	};
	referenceId: number;
	statusCode: number;
};

export const generateDigitalLockerUrl = async (data: GenerateDigitalLockerUrlRequestType) => {
	try {
		// Using the external API URL from the image
		const response = await axios.post<GenerateDigitalLockerUrlResponseType>(
			URLS.digilocker.generate_url,
			data,
			{
				baseURL: DIGILOCKER_BASE_URL,
			},
		);

		return response.data;
	} catch (error: any) {
		console.error("Digital Locker API error:", error?.response?.data);
		throw error;
	}
};

// endregion: DIGITAL LOCKER

// region: FETCH KYC DETAILS

export type FetchKycDetailsRequestType = {
	transactionId: string;
};

export type FetchKycDetailsResponseType = {
	data?: Data;
	referenceId: number;
	statusCode: 101 | 102 | 400 | 401 | 402 | 500 | 503;
	errors?: string[];
	infoType?: "ERROR";
};

export type Data = {
	status: string;
	uniqueId: string;
	maskedAdharNumber: string;
	name: string;
	gender: string;
	dob: string;
	careOf: string;
	address: Partial<Address>;
	image: string;
	xmlResponse: string;
	digilockerFiles: DigilockerFile[];
};

export type Address = {
	house: string;
	street: string;
	landmark: string;
	loc: string;
	po: string;
	dist: string;
	subdist: string;
	vtc: string;
	pc: string;
	state: string;
	country: string;
};

export type DigilockerFile = {
	docLink: string;
	docType: string;
	docExtension: string;
};

export const fetchKycDetails = async (data: FetchKycDetailsRequestType) => {
	try {
		// return {
		// 	data: {
		// 		address: {
		// 			country: "India",
		// 			dist: "Bengaluru",
		// 			house: "#243",
		// 			landmark: "",
		// 			loc: "rahamathnagar",
		// 			pc: "560032",
		// 			po: "R T Nagar",
		// 			state: "Karnataka",
		// 			street: "3rd cross",
		// 			subdist: "Bangalore North",
		// 			vtc: "Bangalore North",
		// 		},
		// 		statusCode: 101,
		// 	},
		// };


		const response = await axios.post<FetchKycDetailsResponseType>(
			URLS.digilocker.kyc_details,
			data,
			{
				baseURL: DIGILOCKER_BASE_URL,
			},
		);

		return response.data;
	} catch (error: any) {
		console.error("Fetch KYC Details API error:", error);
		throw error;
	}
};

// endregion: FETCH KYC DETAILS

// region: FETCH SELFIE

export type FetchSelfieResponseType = {
	selfie_url?: string;
	message?: string;
};

export const fetchSelfie = async () => {
	const response = await axios.get<FetchSelfieResponseType>(URLS.kyc.fetch_selfie);

	return response.data;
};

// endregion: FETCH SELFIE

// region: FETCH ADDRESS

export type FetchAddressResponseType = {
	kyc_initiated?: boolean;
	data?: {
		address?: Address;
		transactionId?: string;
		status?: string;
		permanent_address_parts?: any;
		correspondence_address_parts?: any;
		[key: string]: any;
	};
	address?: Address; // Fallback for direct address field
	message?: string;
};

export const fetchAddress = async () => {
	const response = await axios.get<FetchAddressResponseType>(URLS.kyc.address);

	return response.data;
};

// endregion: FETCH ADDRESS

// region: SAVE DIGILOCKER DATA

export type SaveDigilockerDataRequestType = {
	transactionId?: string;
	address?: Partial<Address>; // Address from DigiLocker may be partial
	documents?: any; // Documents from DigiLocker
	statusCode?: number;
	[key: string]: any; // Allow any other fields from DigiLocker response
};

export type SaveDigilockerDataResponseType = {
	message?: string;
	success?: boolean;
};

export const saveDigilockerData = async (data: SaveDigilockerDataRequestType) => {
	console.log("🚀 Calling POST /kyc/save-digilocker");
	console.log("📤 Request Data:", JSON.stringify(data, null, 2));

	const response = await axios.post<SaveDigilockerDataResponseType>(
		URLS.kyc.save_digilocker,
		data,
	);

	console.log("📥 Response Data:", JSON.stringify(response.data, null, 2));

	return response.data;
};

// endregion: SAVE DIGILOCKER DATA

// region: VERIFY EMAIL

export type VerifyEmailResponse = {
	email: string;
	result: "deliverable" | "undeliverable" | string;
	message: string;
	accept_all: number;
	disposable: number;
	spamtrap: number;
	role: number;
	free_email: number;
	success: boolean;
	user: string;
	domain: string;
};

export const verifyEmail = async (email: string) => {
	const encodedToken = await getStorageItem(STORAGE_KEYS["@access-token"]);
	const token = encodedToken ? decode(encodedToken) : "";

	const response = await axios.get<VerifyEmailResponse>(
		URLS.kyc.verify_email(email),
		{
			headers: {
				Authorization: `Bearer ${token}`,
			},
		}
	);
	return response.data;
};

// endregion: VERIFY EMAIL

// region: INITIAL APPROVAL

export type InitialApprovalResponseType = {
	status: "approved" | "reject" | string;
	message?: string;
    msg?: string;
};

export type InitialApprovalRequestType = {
	email: string;
	is_deliverable: boolean;
	is_pan_verified: boolean;
	is_pan_valid: boolean;
	pan_number: string;
	name: string;
};

export const initialApproval = async (data: InitialApprovalRequestType) => {
	console.log("=== INITIAL APPROVAL REQUEST ===");
	console.log(JSON.stringify(data, null, 2));

	const response = await axios.post<InitialApprovalResponseType>("kyc/initial-approval", data);
	console.log("=== INITIAL APPROVAL RESPONSE ===");
	console.log(JSON.stringify(response.data, null, 2));
	return response.data;
};

// endregion: INITIAL APPROVAL

// region: GET MY DETAILS

export type GetMyDetailsResponseType = {
    message: string;
    success: boolean;
    reapplication?: boolean;
    next_step?: string;
    kyc_record?: {
        email: string;
        pan_number?: string;
        name?: string;
        full_name?: string;
        mobile_number?: string;
        is_email_verified?: boolean;
        is_pan_verified?: boolean;
        [key: string]: any;
    };
    [key: string]: any;
};

export const getMyDetails = async () => {
    try {
        console.log("🚀 Calling GET /kyc/get-my-details");
        const response = await axios.get<GetMyDetailsResponseType>(URLS.kyc.get_my_details);
        console.log("📥 Get My Details Response:", JSON.stringify(response.data, null, 2));
        return response.data;
    } catch (error: any) {
        console.error("❌ Get My Details API error:", error);
        throw error;
    }
};

// endregion: GET MY DETAILS

// region: GET MY CKYC

export type GetMyCkycResponseType = {
    ckyc_details: any;
    reapplication: boolean;
    message: string;
    next_step: string;
    success: boolean;
};

export const getMyCkyc = async () => {
    try {
        console.log("🚀 Calling GET /kyc/get-my-ckyc");
        const response = await axios.get<GetMyCkycResponseType>(URLS.kyc.get_my_ckyc);
        console.log("📥 Get My CKYC Response:", JSON.stringify(response.data, null, 2));
        return response.data;
    } catch (error: any) {
        console.error("❌ Get My CKYC API error:", error);
        throw error;
    }
};

// endregion: GET MY CKYC

// region: VERIFY LEAD CREATION

export type VerifyLeadCreationResponseType = {
	success: boolean;
	lead_created: boolean;
	lender_lead_id: string | null;
};

export const verifyLeadCreation = async () => {
	try {
		console.log("🚀 Calling GET /kyc/verify-lead-creation");
		const response = await axios.get<VerifyLeadCreationResponseType>(URLS.kyc.verify_lead_creation);
		console.log("📥 Verify Lead Creation Response:", JSON.stringify(response.data, null, 2));
		return response.data;
	} catch (error: any) {
		console.error("❌ Verify Lead Creation API error:", error);
		throw error;
	}
};

// endregion: VERIFY LEAD CREATION