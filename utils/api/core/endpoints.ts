/**
 * Centralized API Endpoint Registry
 */
export const URLS = {
	auth: {
		// RapidMoney FastAPI Endpoints
		request_otp: "auth/request-otp",
		verify_otp: "auth/verify-otp",
		refresh_token: "auth/refresh-token",
		me: "auth/me",

		// LEGACY — old backend endpoints for MPIN / legacy flows
		login: "auth/login",
		set_mpin: "auth/setup-mpin",
		mpin_login: "auth/verify-mpin",
		forgot_mpin: "auth/forgot-mpin",
		reset_mpin: "auth/reset-mpin",
		verify_mpin_reset_otp: "auth/verify-mpin-reset-otp",
		send_email_otp: "auth/send-email-otp",
		verify_email_otp: "auth/verify-email-otp",
	},
	user: {
		// RapidMoney Generic User CRUD
		base: "users",
		by_id: (id: string) => `users/${id}`,
		// NOT IN NEW BACKEND (competing legacy endpoint - see Phase 2 / ASK BACKEND)
		basic_details: "users/basic-details",

		// Workflow endpoints (NOT IN NEW BACKEND)
		// NOT IN NEW BACKEND
		get_dashboard: "users/dashboard",
		// NOT IN NEW BACKEND: GET users/me conflicts with GET /users/{id} -> use URLS.auth.me instead
		me: "users/me",
		// NOT IN NEW BACKEND
		mark_permissions: "users/permissions",
		// NOT IN NEW BACKEND
		changeLanguage: (language: "Hindi" | "English" = "English") =>
			`users/change-language?language=${language}`,
		// NOT IN NEW BACKEND
		delete_user: "users/delete-user",
	},
	profile: {
		submit: "profile/submit",
	},
	kyc: {
		submit: "profile/submit",
		// NOT IN NEW BACKEND
		verify_pan: "kyc/verify-pan",
		// NOT IN NEW BACKEND
		personal_details: "kyc/personal-details",
		// NOT IN NEW BACKEND
		employment_details: "kyc/employment-details",
		// NOT IN NEW BACKEND
		order_id_for_assessment: "kyc/order-id-for-assessment",
		// NOT IN NEW BACKEND
		confirm_payment: "kyc/processing-fee/confirm",
		// NOT IN NEW BACKEND
		personal_details_lite: "kyc/personal-details-lite",
		// NOT IN NEW BACKEND
		fetch_selfie: "kyc/fetch-selfie",
		// NOT IN NEW BACKEND
		address: "kyc/address",
		// NOT IN NEW BACKEND
		save_digilocker: "kychub-digilocker/save-digilocker",
		// NOT IN NEW BACKEND
		verify_email: (email: string) => `kyc/verify-email/${email}`,
		// NOT IN NEW BACKEND
		get_my_details: "kyc/get-my-details",
		// LEGACY — replaced by URLS.ckyc.status / identity.service
		get_my_ckyc: "kyc/get-my-ckyc",
		// LEGACY — replaced by URLS.address_v2.upload_proof / URLS.selfie.upload_file
		upload_document: "/documents/upload",
		// NOT IN NEW BACKEND
		verify_lead_creation: "kyc/verify-lead-creation",
		// NOT IN NEW BACKEND
		professional_details: "kyc/professional-details",
		// NOT IN NEW BACKEND
		personal_details_hb_partner: "users/personal-details-hb-partner",
		// NOT IN NEW BACKEND
		employment_details_hb_partner: "users/employment-details-hb-partner",
	},
	// NEW IDENTITY ROUTERS (FastAPI)
	ckyc: {
		status: "ckyc/status",
		send_otp: "ckyc/send-otp",
		validate_otp: "ckyc/validate-otp",
		digilocker_init: "ckyc/digilocker/init",
		digilocker_complete: "ckyc/digilocker/complete",
	},
	selfie: {
		status: "selfie/status",
		upload_file: "selfie/upload-file",
	},
	address_v2: {
		status: "address/status",
		document_types: "address/document-types",
		upload_proof: "address/upload-proof",
		submit: "address/submit",
	},
	ekyc: {
		// LEGACY — replaced by URLS.selfie.upload_file
		upload_document: "ekyc/upload-selfie",
		// LEGACY — old Aadhaar OTP not supported on new backend
		aadhaar_send_otp: "ekyc/aadhaar/send-otp",
		// LEGACY — old Aadhaar OTP not supported on new backend
		aadhaar_verify_otp: "ekyc/aadhaar/verify-otp",
	},
	address: {
		// LEGACY — replaced by URLS.address_v2.submit
		verify_address: "address-verification/submit",
	},
	loans: {
		// NOT IN NEW BACKEND
		loan_terms: "loans/loan-terms",
		// NOT IN NEW BACKEND
		submit_loan_application: "loans/submit-loan-application",
		// NOT IN NEW BACKEND
		noc: (loanId: string) => `loans/admin/noc/${loanId}`,
	},
	lender_approval: {
		// NOT IN NEW BACKEND
		check_approval: "lender-approval/check-approval",
	},
	loan_agreement: {
		// NOT IN NEW BACKEND
		generate: "loan-agreement/generate",
		// NOT IN NEW BACKEND
		initiate_signing: "loan-agreement/initiate-signing",
		// NOT IN NEW BACKEND
		sign: "loan-agreement/sign",
		// NOT IN NEW BACKEND
		download: (loanNumber: string) => `loan-agreement/${loanNumber}/download`,
	},
	bank_details: {
		// NOT IN NEW BACKEND
		submit: "bank-details/submit",
		// NOT IN NEW BACKEND
		get_accounts: "bank-details/bank-accounts",
		// NOT IN NEW BACKEND
		hb_partner: "users/bank-details-hb-partner",
	},
	payments: {
		initiate_assessment_fee: "payment/initiate-assessment-fee",
		verify_status: (txnid: string) => `payment/verify-status/${txnid}`,
		initiate_payment: "payment/initiate-assessment-fee",
		handshake_status: "payment/handshake-status",
		retry_assessment_checks: "payment/retry-assessment-checks",
	},
	pincode: {
		lookup: (pin: string) => `pincode/lookup/${pin}`,
	},
	digilocker: {
		// LEGACY — replaced by URLS.ckyc.digilocker_init / complete
		generate_url: "kyc/india/digital/locker/v1/generate-url",
		// LEGACY — replaced by URLS.ckyc.digilocker_complete
		kyc_details: "kyc/india/digital/locker/v1/kyc-details",
		// LEGACY
		redirection_url: "kychub-digilocker/redirecting",
	},
	workflow: {
		// NOT IN NEW BACKEND
		start_consent_permission: "workflow/mark-consent-permission",
	},
	notifications: {
		// NOT IN NEW BACKEND
		register_token: "notifications/register-token",
		// NOT IN NEW BACKEND
		send: "notifications/send",
		// NOT IN NEW BACKEND
		loan: "notifications/loan",
		// NOT IN NEW BACKEND
		payment: "notifications/payment",
		// NOT IN NEW BACKEND
		get_notifications: ({ skip = 0, limit = 50, unread_only = false }) =>
			`notifications/?skip=${skip}&limit=${limit}&unread_only=${unread_only}`,
	},
	faq: {
		list: "faqs",
	},
	general_info: {
		customer_care: "general-info/customer-care",
		list: "general-info",
	},
	sanction_letter: {
		// NOT IN NEW BACKEND
		generate: "sanction-letter/generate",
		// NOT IN NEW BACKEND
		kfs_document: "sanction-letter/kfs-document",
	},
	loan_status: {
		// NOT IN NEW BACKEND
		simple_loan_status: "loan-status/simple-loan-status",
	},
	loan_reapplication: {
		can_reapply: "loan-reapplication/can-reapply",
		reapply: "loan-reapplication/reapply",
	},
	autocollect: {
		// NOT IN NEW BACKEND
		check_mandate: (txnId: string) => `autocollect/mandate/check/${txnId}`,
	},
	videos: {
		list: "videos",
	},
	rate_us: {
		base: "rate-us",
		by_id: (id: string) => `rate-us/${id}`,
	},
	lender_allocations: {
		allocate_for_user: (userId: string) => `lender-allocations/allocate-for-user/${userId}`,
	},
	coupons: {
		verify: "coupons/verify",
	},
	lenders: {
		list: "lenders",
	},
	products: {
		list: "products",
	},
	professional: {
		professional_details: "professional-details",
	},
} as const;
