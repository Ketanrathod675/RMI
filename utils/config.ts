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
		? "http://172.16.16.124:8000/api/v1"
		: "http://localhost:8000/api/v1";

const apiBaseUrl = getPublicEnv("API_URL", defaultApiUrl);
if (!/^https?:\/\//i.test(apiBaseUrl)) {
	throw new Error("EXPO_PUBLIC_API_URL must be an absolute HTTP(S) URL");
}

const environment = getPublicEnv("API_ENV", __DEV__ ? "development" : "production") as Environment;
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
