import { store } from "@/store";
import { clearAuth, setAuthAccessToken, setAuthTokenType } from "@/store/slices/auth";
import CONFIG from "@/utils/config";
import { encode } from "@/utils/encode_decode";
import Logger from "@/utils/logger";
import SecureStorage from "@/utils/secure-storage";
import {
	AuthKeys,
	removeMultipleStorageItems,
	setStorageItem,
	STORAGE_KEYS,
} from "@/utils/storage";
import { showLocalizedToast } from "@/utils/toast_translations";
import a, { isAxiosError, type AxiosError } from "axios";
import { router } from "expo-router";
import Toast from "react-native-toast-message";
import { API_URL } from "./config";
import { URLS } from "./endpoints";

let networkToastShown = false;
let refreshAccessTokenPromise: Promise<string | null> | null = null;
let sessionExpiryPromise: Promise<void> | null = null;

const refreshAccessToken = async (): Promise<string | null> => {
	if (refreshAccessTokenPromise) return refreshAccessTokenPromise;

	refreshAccessTokenPromise = (async () => {
		const refreshToken = await SecureStorage.getSensitiveWithLegacyMigration(
			STORAGE_KEYS["@refresh-token"],
		);
		if (!refreshToken) return null;

		const { refreshSession } = await import("../services/auth.service");
		const newTokens = await refreshSession(refreshToken);
		if (!newTokens?.access_token) return null;

		await SecureStorage.setSensitive(STORAGE_KEYS["@access-token"], newTokens.access_token);
		await SecureStorage.setSensitive(STORAGE_KEYS["@token"], newTokens.access_token);
		if (newTokens.token_type) {
			await setStorageItem(STORAGE_KEYS["@token-type"], encode(newTokens.token_type));
			store.dispatch(setAuthTokenType(newTokens.token_type));
		}
		store.dispatch(setAuthAccessToken(newTokens.access_token));
		return newTokens.access_token;
	})();

	try {
		return await refreshAccessTokenPromise;
	} finally {
		refreshAccessTokenPromise = null;
	}
};

const showNetworkUnavailableToast = async () => {
	if (!networkToastShown) {
		await showLocalizedToast(Toast.show, {
			type: "error",
			text1Key: "networkUnavailable",
			text2Key: "pleaseCheckInternetConnection",
			visibilityTime: 4000,
		});
		networkToastShown = true;

		setTimeout(() => {
			networkToastShown = false;
		}, 5000);
	}
};

const expireSession = async (): Promise<void> => {
	if (sessionExpiryPromise) return sessionExpiryPromise;

	sessionExpiryPromise = (async () => {
		await Promise.all([SecureStorage.clearAllTokens(), removeMultipleStorageItems(AuthKeys)]);
		await showLocalizedToast(Toast.show, {
			type: "error",
			text1Key: "sessionExpired",
			text2Key: "pleaseLoginAgainToContinue",
		});
		store.dispatch(clearAuth());
		router.replace("/login");
	})();

	try {
		await sessionExpiryPromise;
	} finally {
		sessionExpiryPromise = null;
	}
};

export const axios = a.create({
	baseURL: API_URL,
	timeout: CONFIG.API.REQUEST_TIMEOUT_MS,
	headers: {
		"Content-Type": "application/json",
	},
});

export const setApiBaseUrl = (url: string) => {
	axios.defaults.baseURL = url;
};

export const getApiBaseUrl = (): string => {
	return (axios.defaults.baseURL as string) || API_URL;
};

axios.interceptors.request.use(async (config) => {
	// Dev-Only Mock API Handler (statically eliminated in release builds)
	if (__DEV__) {
		const { handleDevMockRequest } = await import("../devMockApi");
		const mockResponse = await handleDevMockRequest(config);
		if (mockResponse) {
			config.adapter = async () => {
				if (mockResponse.status >= 200 && mockResponse.status < 300) {
					return mockResponse;
				}
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

	const isRefreshTokenRequest =
		config.url === URLS.auth.refresh_token ||
		config.url?.endsWith(URLS.auth.refresh_token);

	if (isRefreshTokenRequest) {
		const refreshToken = await SecureStorage.getSensitiveWithLegacyMigration(STORAGE_KEYS["@refresh-token"]);
		if (refreshToken) {
			config.headers.Authorization = `Bearer ${refreshToken}`;
		}
	} else {
		const token = await SecureStorage.getSensitiveWithLegacyMigration(STORAGE_KEYS["@access-token"]);
		if (token) {
			config.headers.Authorization = `Bearer ${token}`;
		}
	}

	return config;
});

axios.interceptors.response.use(
	async (res) => {
		return res;
	},
	async (error: AxiosError) => {
		// Handle network errors
		if (error.code === "ERR_NETWORK" || error.message === "Network Error" || !error.response) {
			await showNetworkUnavailableToast();
			return Promise.reject(error);
		}

		// Handle timeout errors
		if (error.code === "ECONNABORTED" || error.message?.includes("timeout")) {
			await showNetworkUnavailableToast();
			return Promise.reject(error);
		}

		// Handle 401 Unauthorized (Session Expired / Token Refresh)
		if (
			error.config &&
			error.config.url !== (URLS.auth as any).mpin_login &&
			error.config.url !== URLS.auth.refresh_token &&
			!error.config.url?.endsWith(URLS.auth.refresh_token) &&
			!Object.keys(URLS.digilocker).some((key) =>
				error.config?.url?.includes(URLS.digilocker[key as keyof typeof URLS.digilocker]),
			) &&
			error.response?.status === 401
		) {
			const originalRequest = error.config as any;

			if (!originalRequest._retry) {
				originalRequest._retry = true;

				try {
					const accessToken = await refreshAccessToken();
					if (accessToken) {
							originalRequest.headers.Authorization = `Bearer ${accessToken}`;
							return axios(originalRequest);
					}
				} catch (refreshError) {
					Logger.error("Background token refresh failed", refreshError);
				}
			}

			// A shared promise prevents multiple simultaneous 401s from showing duplicate logout UI.
			await expireSession();
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
	detail?: { loc?: string[]; msg?: string; type?: string }[] | string;
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

		if (error.code === "ERR_NETWORK") {
			return {
				error: data,
				errorType: "network-error",
				variables,
				ctx,
			} as const;
		}

		if (error.response?.status === 401) {
			return {
				error: data,
				errorType: "unauthorized",
				variables,
				ctx,
			} as const;
		}

		if (error.code === "ECONNABORTED") {
			return {
				error: data,
				errorType: "timeout",
				variables,
				ctx,
			} as const;
		}

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

export type ProcessingFeeResponseType = {
	message: string;
	success: boolean;
	processing_fee: {
		amount: number;
		currency: string;
		gst: number;
	};
};

export const fetchProcessingFee = async (): Promise<ProcessingFeeResponseType> => {
	const response = await axios.get<ProcessingFeeResponseType>(URLS.kyc.personal_details_lite);
	return response.data;
};
