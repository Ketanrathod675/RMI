import { store } from "@/store";
import { clearAuth } from "@/store/slices/auth";
import { decode, encode } from "@/utils/encode_decode";
import {
	AuthKeys,
	getStorageItem,
	setStorageItem,
	removeMultipleStorageItems,
	STORAGE_KEYS,
} from "@/utils/storage";
import { showLocalizedToast } from "@/utils/toast_translations";
import a, { isAxiosError, type AxiosError } from "axios";
import { router } from "expo-router";
import Toast from "react-native-toast-message";



export const API_URL = process.env.EXPO_PUBLIC_API_URL;
export const DIGILOCKER_BASE_URL = process.env.EXPO_PUBLIC_DIGILOCKER_BASE_URL;
export const DIGILOCKER_ACCESS_TOKEN = process.env.EXPO_PUBLIC_DIGILOCKER_ACCESS_TOKEN;


// Global state to track if network toast has been shown
let networkToastShown = false;

// Function to show network unavailable toast (only once)
const showNetworkUnavailableToast = async () => {
	if (!networkToastShown) {
		await showLocalizedToast(Toast.show, {
			type: "error",
			text1Key: "networkUnavailable",
			text2Key: "pleaseCheckInternetConnection",
			visibilityTime: 4000,
		});
		networkToastShown = true;

		// Reset the flag after 5 seconds to allow showing again
		setTimeout(() => {
			networkToastShown = false;
		}, 5000);
	}
};

export const axios = a.create({
	baseURL: API_URL,
	// timeout: 10000,
	headers: {
		"Content-Type": "application/json",
	},
});

export const URLS = {
	auth: {
		login: "auth/login",
		verify_otp: "auth/verify-otp",
		set_mpin: "auth/setup-mpin",
		mpin_login: "auth/verify-mpin",
		forgot_mpin: "auth/forgot-mpin",
		reset_mpin: "auth/reset-mpin",
		verify_mpin_reset_otp: "auth/verify-mpin-reset-otp",
		send_email_otp: "auth/send-email-otp",
		verify_email_otp: "auth/verify-email-otp",
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
	user: {
		get_dashboard: "users/dashboard",
		me: "users/me",
		mark_permissions: "users/permissions",
		changeLanguage: (language: "Hindi" | "English" = "English") =>
			"users/change-language?language=" + language,
		delete_user: "users/delete-user",
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
} as const;

axios.interceptors.request.use(async (config) => {
	// Dev-Only Mock API Handler (statically eliminated in release builds)
	if (__DEV__) {
		const { handleDevMockRequest } = await import("./devMockApi");
		const mockResponse = await handleDevMockRequest(config);
		if (mockResponse) {
			config.adapter = async () => {
				if (mockResponse.status >= 200 && mockResponse.status < 300) {
					return mockResponse;
				}
				// Replicate axios's real rejection behavior for non-2xx responses
				const error: any = new Error(mockResponse.statusText || "Request failed");
				error.isAxiosError = true;
				error.response = mockResponse;
				error.config = config;
				error.request = {};
				throw error;
			};
			return config;
		}
	}

	const isRefreshTokenRequest = config.url === "auth/refresh-token" || config.url?.endsWith("auth/refresh-token");

	if (isRefreshTokenRequest) {
		const encodedRefreshToken = await getStorageItem(STORAGE_KEYS["@refresh-token"]);
		if (encodedRefreshToken) {
			const refreshToken = decode(encodedRefreshToken);
			config.headers.Authorization = `Bearer ${refreshToken}`;
			console.log("🔑 Refresh Token injected in Authorization header:", `Bearer ${refreshToken}`);
		} else {
			console.log("❌ No refresh token found in storage for refresh request");
		}
	} else {
		const encodedToken = await getStorageItem(STORAGE_KEYS["@access-token"]);
		if (encodedToken) {
			const token = decode(encodedToken);
			if (
				Object.keys(URLS.digilocker).some((key) =>
					config.url?.includes(URLS.digilocker[key as keyof typeof URLS.digilocker]),
				)
			) {
				config.headers.Authorization = `Bearer ${DIGILOCKER_ACCESS_TOKEN}`;
			} else {
				config.headers.Authorization = `Bearer ${token}`;
			}
			console.log("🔑 Access Token injected in Authorization header:", `Bearer ${token}`);
		} else {
			console.log("❌ No access token found in storage");
		}
	}

	console.log("📡 Final request headers:", config.headers);
	console.log("🌐 Request URL:", `${config.baseURL || ""}${config.url || ""}`);

	return config;
});

axios.interceptors.response.use(
	async (res) => {
		console.log("✅ API Success Response:", "\x1b[1m" + res.config.url + "\x1b[0m", res.status);
		return res;
	},
	async (error: AxiosError) => {
		console.log(
			"❌ API Error Response:",
			"\x1b[1m" + error.config?.baseURL + error.config?.url + "\x1b[0m",
			error.response?.status,
			JSON.stringify(error.response?.data, null, 2),
			error.config?.headers,
		);
		console.log("❌ API Error Request Body:", JSON.stringify(error.config?.data, null, 2));

		// Handle network errors
		if (error.code === "ERR_NETWORK" || error.message === "Network Error" || !error.response) {
			console.log("🔴 Network Error Detected");
			await showNetworkUnavailableToast();
			return Promise.reject(error);
		}

		// Handle timeout errors
		if (error.code === "ECONNABORTED" || error.message?.includes("timeout")) {
			console.log("⏱️ Request Timeout");
			await showNetworkUnavailableToast();
			return Promise.reject(error);
		}

		// Handle 401 Unauthorized (Session Expired)
		if (
			error.config &&
			error.config.url !== URLS.auth.mpin_login &&
			error.config.url !== "auth/refresh-token" &&
			!Object.keys(URLS.digilocker).some((key) =>
				error.config?.url?.includes(URLS.digilocker[key as keyof typeof URLS.digilocker]),
			) &&
			error.response?.status === 401
		) {
			const originalRequest = error.config as any;

			// If this request was not already retried, attempt a background refresh
			if (!originalRequest._retry) {
				originalRequest._retry = true;

				try {
					console.log("🔄 [Interceptor] Access token expired (401), attempting background token refresh...");
					const encodedRefreshToken = await getStorageItem(STORAGE_KEYS["@refresh-token"]);

					if (encodedRefreshToken) {
						const decodedRefreshToken = decode(encodedRefreshToken);
						
						// Dynamically require to avoid circular dependencies
						const { refreshSession: refreshSessionApi } = require("./auth");
						const newTokens = await refreshSessionApi(decodedRefreshToken);

						if (newTokens?.access_token) {
							console.log("✅ [Interceptor] Token refreshed successfully! Retrying original request...");

							// Save new tokens to storage (keeping the existing refresh token active)
							await setStorageItem(STORAGE_KEYS["@access-token"], encode(newTokens.access_token));
							await setStorageItem(STORAGE_KEYS["@token"], encode(newTokens.access_token));
							if (newTokens.token_type) {
								await setStorageItem(STORAGE_KEYS["@token-type"], encode(newTokens.token_type));
							}

							// Update Redux states dynamically
							const { setAuthAccessToken, setAuthTokenType } = require("@/store");
							store.dispatch(setAuthAccessToken(newTokens.access_token));
							if (newTokens.token_type) {
								store.dispatch(setAuthTokenType(newTokens.token_type));
							}

							// Update original request headers and retry
							originalRequest.headers.Authorization = `Bearer ${newTokens.access_token}`;
							return axios(originalRequest);
						}
					}
				} catch (refreshError) {
					console.error("❌ [Interceptor] Background token refresh failed:", refreshError);
				}
			}

			// If refresh fails or no refresh token is found, log out the user
			console.log("🚪 [Interceptor] Logging out user due to expired session...");
			await removeMultipleStorageItems(AuthKeys);
			await showLocalizedToast(Toast.show, {
				type: "error",
				text1Key: "sessionExpired",
				text2Key: "pleaseLoginAgainToContinue",
			});

			store.dispatch(clearAuth());
			router.replace("/login");
		}

		return Promise.reject(error);
	},
);

export type ErrorTypes =
	| "network-error"
	| "unauthorized"
	| "timeout"
	| "bad-request"
	| "unknown"
	| (string & {});

export type GenericErrorResponse = {
	detail?: { loc?: string[]; msg?: string; type?: string }[];
	details?: string;
	message?: string;
	error?: "HTTP_ERROR" | (string & {});
};

export const errorHandler = <T extends unknown = unknown>(
	error: Error,
	variables: unknown,
	ctx: unknown,
) => {
	if (isAxiosError<T & GenericErrorResponse>(error)) {
		const data = error.response?.data;

		// network error
		if (error.code === "ERR_NETWORK") {
			return {
				error: data,
				errorType: "network-error",
				variables,
				ctx,
			} as const;
		}

		// unauthorized
		if (error.response?.status === 401) {
			return {
				error: data,
				errorType: "unauthorized",
				variables,
				ctx,
			} as const;
		}

		// timeout
		if (error.code === "ECONNABORTED") {
			return {
				error: data,
				errorType: "timeout",
				variables,
				ctx,
			} as const;
		}

		// bad request
		if (error.response?.status === 400) {
			return {
				error: data,
				errorType: "bad-request",
				variables,
				ctx,
			} as const;
		}
	}

	return {
		error,
		errorType: "unknown",
		variables,
		ctx,
	} as const;
};

// Processing Fee API Types
export type ProcessingFeeResponseType = {
	message: string;
	success: boolean;
	processing_fee: {
		amount: number;
		currency: string;
		gst: number;
	};
};

// API function to fetch processing fee details
export const fetchProcessingFee = async (): Promise<ProcessingFeeResponseType> => {
	const response = await axios.get<ProcessingFeeResponseType>(URLS.kyc.personal_details_lite);
	return response.data;
};

export * from "./auth";
export * from "./bank";
export * from "./kyc";
export * from "./loans";
export * from "./notifications";
export * from "./user";

