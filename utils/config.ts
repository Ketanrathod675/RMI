import { Platform } from "react-native";

type Environment = "development" | "staging" | "production";
type LogLevel = "debug" | "info" | "warn" | "error" | "silent";

const publicEnvironment = {
	API_URL: process.env.EXPO_PUBLIC_API_URL,
	API_ENV: process.env.EXPO_PUBLIC_API_ENV,
	LOG_LEVEL: process.env.EXPO_PUBLIC_LOG_LEVEL,
} as const;

const getPublicEnv = (key: keyof typeof publicEnvironment, fallback?: string): string => {
	const value = publicEnvironment[key];
	if (value) return value;
	if (fallback !== undefined) return fallback;
	throw new Error(`Missing required public environment variable: EXPO_PUBLIC_${key}`);
};

const defaultApiUrl =
	Platform.OS === "android"
		// ? "http://172.16.16.124:8000/api/v1"
		? "https://rendering-underuse-viewless.ngrok-free.dev/api/v1"
		: "http://localhost:8000/api/v1";

let apiBaseUrl: string;
if (__DEV__) {
	apiBaseUrl = getPublicEnv("API_URL", defaultApiUrl);
} else {
	const rawUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
	if (!rawUrl) {
		throw new Error("EXPO_PUBLIC_API_URL is required in release builds");
	}
	apiBaseUrl = rawUrl;
}

if (!/^https?:\/\//i.test(apiBaseUrl)) {
	throw new Error("EXPO_PUBLIC_API_URL must be an absolute HTTP(S) URL");
}

const environment = getPublicEnv("API_ENV", __DEV__ ? "development" : "production") as Environment;
const allowUnsafeApiUrl = environment !== "production" && process.env.EXPO_PUBLIC_ALLOW_UNSAFE_API_URL === "true";

if (!__DEV__ && !allowUnsafeApiUrl) {
	const host = apiBaseUrl.replace(/^https?:\/\//i, "").split(/[:/?#]/)[0].toLowerCase();
	if (
		host.includes("ngrok") ||
		host === "localhost" ||
		host.includes("127.0.0.1") ||
		/^10\./.test(host) ||
		/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host) ||
		/^192\.168\./.test(host)
	) {
		throw new Error(`Production API URL cannot use local, private or ngrok address: ${host}`);
	}
}

if (!["development", "staging", "production"].includes(environment)) {
	throw new Error("EXPO_PUBLIC_API_ENV must be development, staging, or production");
}
if (environment === "production" && !apiBaseUrl.startsWith("https://")) {
	throw new Error("Production API URLs must use HTTPS");
}

const logLevel = getPublicEnv("LOG_LEVEL", __DEV__ ? "debug" : "warn") as LogLevel;
if (!["debug", "info", "warn", "error", "silent"].includes(logLevel)) {
	throw new Error("EXPO_PUBLIC_LOG_LEVEL is invalid");
}

export const CONFIG = {
	API: { BASE_URL: apiBaseUrl, ENVIRONMENT: environment, REQUEST_TIMEOUT_MS: 30_000 },
	LOGGING: { LEVEL: logLevel },
	IS_DEV: __DEV__,
	IS_PROD: !__DEV__,
} as const;

export default CONFIG;
