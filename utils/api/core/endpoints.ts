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

		// LEGACY — old backend, disabled during in-house rebuild
		// Will be restored once/if the backend team builds MPIN / legacy email OTP support
		// login: "auth/login",
		// set_mpin: "auth/setup-mpin",
		// mpin_login: "auth/verify-mpin",
		// forgot_mpin: "auth/forgot-mpin",
		// reset_mpin: "auth/reset-mpin",
		// verify_mpin_reset_otp: "auth/verify-mpin-reset-otp",
		// send_email_otp: "auth/send-email-otp",
		// verify_email_otp: "auth/verify-email-otp",
	},
	user: {
		// RapidMoney Generic User CRUD
		base: "users",
		by_id: (id: string) => `users/${id}`,
		basic_details: "users/basic-details",

		// Workflow endpoints
		get_dashboard: "users/dashboard",
		me: "users/me",
		mark_permissions: "users/permissions",
		changeLanguage: (language: "Hindi" | "English" = "English") =>
			`users/change-language?language=${language}`,
		delete_user: "users/delete-user",
	},
	kyc: {
		verify_pan: "kyc/verify-pan",
		personal_details: "kyc/personal-details",
		employment_details: "kyc/employment-details",
		order_id_for_assessment: "kyc/order-id-for-assessment",
		confirm_payment: "kyc/processing-fee/confirm",
		upload_document: "/documents/upload",
		personal_details_lite: "kyc/personal-details-lite",
		fetch_selfie: "kyc/fetch-selfie",
		address: "kyc/address",
		save_digilocker: "kychub-digilocker/save-digilocker",
		verify_email: (email: string) => `kyc/verify-email/${email}`,
		get_my_details: "kyc/get-my-details",
		get_my_ckyc: "kyc/get-my-ckyc",
		verify_lead_creation: "kyc/verify-lead-creation",
		professional_details: "kyc/professional-details",
		personal_details_hb_partner: "users/personal-details-hb-partner",
		employment_details_hb_partner: "users/employment-details-hb-partner",
	},
	ekyc: {
		upload_document: "ekyc/upload-selfie",
		aadhaar_send_otp: "ekyc/aadhaar/send-otp",
		aadhaar_verify_otp: "ekyc/aadhaar/verify-otp",
	},
	address: {
		verify_address: "address-verification/submit",
	},
	loans: {
		loan_terms: "loans/loan-terms",
		submit_loan_application: "loans/submit-loan-application",
		noc: (loanId: string) => `loans/admin/noc/${loanId}`,
	},
	lender_approval: {
		check_approval: "lender-approval/check-approval",
	},
	loan_agreement: {
		generate: "loan-agreement/generate",
		initiate_signing: "loan-agreement/initiate-signing",
		sign: "loan-agreement/sign",
		download: (loanNumber: string) => `loan-agreement/${loanNumber}/download`,
	},
	bank_details: {
		submit: "bank-details/submit",
		get_accounts: "bank-details/bank-accounts",
		hb_partner: "users/bank-details-hb-partner",
	},
	payments: {
		initiate_payment: "payments/initiate",
	},
	digilocker: {
		generate_url: "kyc/india/digital/locker/v1/generate-url",
		kyc_details: "kyc/india/digital/locker/v1/kyc-details",
		redirection_url: "kychub-digilocker/redirecting",
	},
	workflow: {
		start_consent_permission: "workflow/mark-consent-permission",
	},
	notifications: {
		register_token: "notifications/register-token",
		send: "notifications/send",
		loan: "notifications/loan",
		payment: "notifications/payment",
		get_notifications: ({ skip = 0, limit = 50, unread_only = false }) =>
			`notifications/?skip=${skip}&limit=${limit}&unread_only=${unread_only}`,
	},
	faq: {
		list: "faqs",
	},
	general_info: {
		customer_care: "general-info/customer-care",
	},
	sanction_letter: {
		generate: "sanction-letter/generate",
		kfs_document: "sanction-letter/kfs-document",
	},
	loan_status: {
		simple_loan_status: "loan-status/simple-loan-status",
	},
	loan_reapplication: {
		can_reapply: "loan-reapplication/can-reapply",
	},
	autocollect: {
		check_mandate: (txnId: string) => `autocollect/mandate/check/${txnId}`,
	},
	videos: {
		list: "videos",
	},
} as const;
