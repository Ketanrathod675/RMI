import * as Sentry from "@sentry/react-native";
import Constants from "expo-constants";
import { AppState } from "react-native";
import Toast from "react-native-toast-message";
import Logger from "@/utils/logger";
import { getSyncTranslation } from "@/utils/toast_translations";

type FatalListener = (error: unknown) => void;
const fatalListeners = new Set<FatalListener>();
let installed = false;
let lastToastAt = 0;
let sentryEnabled = false;

const redact = (input: string) => input
	.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
	.replace(/\b\d{10,16}\b/g, "[number]")
	.replace(/\b[A-Z]{5}\d{4}[A-Z]\b/gi, "[pan]")
	.replace(/\b\d{4}[ -]?\d{4}[ -]?\d{4}\b/g, "[aadhaar]")
	.replace(/Bearer\s+\S+/gi, "Bearer [token]");

export function reportError(error: unknown, context: string) {
	if (!sentryEnabled) return;
	Sentry.withScope((scope) => {
		scope.setTag("screen", redact(context).slice(0, 80));
		scope.setTag("app_version", Constants.expoConfig?.version ?? "unknown");
		Sentry.captureException(error instanceof Error ? error : new Error("Non-Error exception"));
	});
}

export function subscribeFatalErrors(listener: FatalListener) {
	fatalListeners.add(listener);
	return () => fatalListeners.delete(listener);
}

function recordUnhandled(error: unknown, context: string, fatal: boolean) {
	reportError(error, context);
	Logger.error(`[errorHandling] ${context} error:`, error);

	if (fatal && !__DEV__) {
		fatalListeners.forEach((listener) => listener(error));
		return;
	}

	// Unhandled promise rejections: report only (Sentry and Logger), never toast.
	if (context === "unhandled-promise" || context.includes("promise")) {
		return;
	}

	// Non-fatal synchronous errors thrown from handlers: keep one toast per 10 s,
	// but only when the app is in the foreground and the error did not come from a background task.
	const isForeground = AppState.currentState === "active";
	const isBackgroundTask = context.includes("background") || context.includes("task");

	if (!fatal && isForeground && !isBackgroundTask && Date.now() - lastToastAt > 10_000) {
		lastToastAt = Date.now();
		Toast.show({
			type: "error",
			text1: getSyncTranslation("errGeneric", "Something went wrong. Please try again."),
		});
	}
}

export function installGlobalErrorHandlers() {
	if (installed) return;
	installed = true;
	const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
	if (dsn) {
		Sentry.init({
			dsn,
			sendDefaultPii: false,
			enableNativeCrashHandling: true,
			tracesSampleRate: 0,
			environment: process.env.EXPO_PUBLIC_API_ENV || (__DEV__ ? "development" : "production"),
			beforeSend(event) {
				event.user = undefined;
				if (event.request) {
					event.request.data = undefined;
					event.request.cookies = undefined;
					event.request.headers = undefined;
					event.request.query_string = undefined;
				}
				const scrub = (value: unknown): unknown => {
					if (typeof value === "string") return redact(value);
					if (Array.isArray(value)) return value.map(scrub);
					if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, /phone|pan|aadhaar|account|email|token|authorization/i.test(k) ? "[redacted]" : scrub(v)]));
					return value;
				};
				return scrub(event) as typeof event;
			},
		});
		sentryEnabled = true;
	}
	const errorUtils = (globalThis as any).ErrorUtils;
	const previous = errorUtils?.getGlobalHandler?.();
	errorUtils?.setGlobalHandler?.((error: unknown, isFatal?: boolean) => {
		recordUnhandled(error, "global", Boolean(isFatal));
		if (__DEV__) previous?.(error, isFatal);
	});

	try {
		(globalThis as any).HermesInternal?.enablePromiseRejectionTracker?.({
			allRejections: true,
			onUnhandled: (_id: number, rejection: unknown) => {
				recordUnhandled(rejection, "unhandled-promise", false);
			},
		});
	} catch (err) {
		Logger.warn("[errorHandling] Hermes promise rejection tracker setup failed:", err);
	}
}

