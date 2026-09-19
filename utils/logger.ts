import CONFIG from "@/utils/config";

type LogLevel = "debug" | "info" | "warn" | "error";

const priorities: Record<LogLevel | "silent", number> = { debug: 0, info: 1, warn: 2, error: 3, silent: Number.POSITIVE_INFINITY };
const sensitiveKey = /(?:access|refresh|push|fcm)[_-]?token|sign[_-]?in[_-]?key|authorization|password|mpin|\botp\b|pan(?:[_-]?(?:card|number))?|aadhaar|email|phone(?:[_-]?number)?|mobile|user[_-]?id|ssn|account(?:[_-]?(?:number|no))?|ifsc|selfie|document|cookie/i;

const redact = (value: unknown, seen = new WeakSet<object>()): unknown => {
	if (value === null || typeof value !== "object") return value;
	if (seen.has(value)) return "[CIRCULAR]";
	seen.add(value);
	if (Array.isArray(value)) return value.map((item) => redact(item, seen));
	return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, sensitiveKey.test(key) ? "[REDACTED]" : redact(item, seen)]));
};

const shouldLog = (level: LogLevel) => priorities[level] >= priorities[CONFIG.LOGGING.LEVEL];
const timestamp = () => new Date().toISOString().slice(11, 19);
const format = (level: LogLevel, message: string) => `[${timestamp()}] [${level.toUpperCase()}] ${message}`;

export const Logger = {
	debug(message: string, data?: unknown) { if (shouldLog("debug")) console.log(format("debug", message), data === undefined ? "" : redact(data)); },
	info(message: string, data?: unknown) { if (shouldLog("info")) console.info(format("info", message), data === undefined ? "" : redact(data)); },
	warn(message: string, data?: unknown) { if (shouldLog("warn")) console.warn(format("warn", message), data === undefined ? "" : redact(data)); },
	error(message: string, error?: unknown) {
		if (!shouldLog("error")) return;
		const value = CONFIG.IS_PROD && error instanceof Error ? { message: error.message } : redact(error);
		console.error(format("error", message), value ?? "");
	},
};

export default Logger;
