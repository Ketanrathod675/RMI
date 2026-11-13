export type RateLimitModalRequest = {
	context: "otp_request" | "otp_verify" | "otp_resend" | "other";
	retryAfterSeconds: number;
	onDismiss?: () => void;
	primaryLabel?: string;
};

type RateLimitHandler = (req: RateLimitModalRequest) => void;

let registeredHandler: RateLimitHandler | null = null;
let isCurrentlyVisible = false;
let activeEndsAt: number | null = null;

export function setRateLimitModalHandler(fn: RateLimitHandler | null): void {
	registeredHandler = fn;
	isCurrentlyVisible = false;
	activeEndsAt = null;
}

export function notifyRateLimitModalClosed(): void {
	isCurrentlyVisible = false;
	activeEndsAt = null;
}

export function showRateLimitModal(req: RateLimitModalRequest): void {
	if (!registeredHandler) return;

	const safeSeconds = Math.min(3600, Math.max(1, Math.round(req.retryAfterSeconds || 60)));
	const nextEndsAt = Date.now() + safeSeconds * 1000;

	if (isCurrentlyVisible) {
		if (activeEndsAt === null || nextEndsAt > activeEndsAt) {
			activeEndsAt = nextEndsAt;
			registeredHandler({
				...req,
				retryAfterSeconds: safeSeconds,
			});
		}
		return;
	}

	isCurrentlyVisible = true;
	activeEndsAt = nextEndsAt;
	registeredHandler({
		...req,
		retryAfterSeconds: safeSeconds,
	});
}

