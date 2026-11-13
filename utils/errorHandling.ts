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

const SENSITIVE_KEY_RE =
	/phone|pan|aadhaar|account|email|token|authorization|idempotency[_-]?key|cookie/i;

const redact = (input: string) => input
	.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
	.replace(/\b\d{10,16}\b/g, "[number]")
	.replace(/\b[A-Z]{5}\d{4}[A-Z]\b/gi, "[pan]")
	.replace(/\b\d{4}[ -]?\d{4}[ -]?\d{4}\b/g, "[aadhaar]")
	.replace(/Bearer\s+\S+/gi, "Bearer [token]")
	.replace(/(["']?idempotency[_-]?key["']?\s*[:=]\s*["']?)[^\s"',}]+/gi, "$1[redacted]");

const scrubValue = (value: unknown, seen = new WeakSet<object>()): unknown => {
	if (typeof value === "string") return redact(value);
	if (value === null || typeof value !== "object") return value;
	if (seen.has(value)) return "[circular]";
	seen.add(value);
	if (Array.isArray(value)) return value.map((item) => scrubValue(item, seen));
	return Object.fromEntries(
		Object.entries(value as Record<string, unknown>).map(([k, v]) => [
			k,
			SENSITIVE_KEY_RE.test(k) ? "[redacted]" : scrubValue(v, seen),
		]),
	);
};

export function sanitizeSentryBreadcrumb<T extends Record<string, any>>(breadcrumb: T): T {
	if (!breadcrumb || typeof breadcrumb !== "object") return breadcrumb;
	return scrubValue(breadcrumb) as T;
}

export function sanitizeSentryEvent<T extends Record<string, any>>(event: T): T {
	if (!event || typeof event !== "object") return event;
	const copy: any = { ...event, user: undefined };
	if (copy.request) {
		copy.request = {
			...copy.request,
			data: undefined,
			cookies: undefined,
			headers: undefined,
			query_string: undefined,
		};
	}
	return scrubValue(copy) as T;
}

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
				return sanitizeSentryEvent(event as Record<string, any>) as typeof event;
			},
			beforeBreadcrumb(breadcrumb) {
				return sanitizeSentryBreadcrumb(breadcrumb as Record<string, any>) as typeof breadcrumb;
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

