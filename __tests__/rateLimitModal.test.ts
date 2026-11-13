/**
 * Unit test suite for utils/rateLimitModal.ts
 */

import {
	notifyRateLimitModalClosed,
	setRateLimitModalHandler,
	showRateLimitModal,
	type RateLimitModalRequest,
} from "../utils/rateLimitModal";

function assert(condition: boolean, message: string): void {
	if (!condition) {
		throw new Error(`Assertion failed: ${message}`);
	}
}

export function runRateLimitModalTests(): void {
	// 1. Safe no-op when no handler registered
	setRateLimitModalHandler(null);
	showRateLimitModal({ context: "otp_request", retryAfterSeconds: 60 });

	// 2. Forwards first request and prevents stacking on shorter locks, extends on longer locks
	const received: RateLimitModalRequest[] = [];
	setRateLimitModalHandler((req) => {
		received.push(req);
	});

	showRateLimitModal({ context: "otp_verify", retryAfterSeconds: 120 });
	assert(received.length === 1, "First showRateLimitModal should invoke handler");
	assert(received[0].retryAfterSeconds === 120, "Should forward 120s");

	// Shorter lock while visible -> ignored (no stacking)
	showRateLimitModal({ context: "otp_request", retryAfterSeconds: 30 });
	assert(received.length === 1, "Shorter call while visible should be ignored");

	// Longer lock while visible -> updates lock duration
	showRateLimitModal({ context: "otp_request", retryAfterSeconds: 300 });
	assert(received.length === 2, "Longer lock call should notify host to extend endsAt");
	assert(received[1].retryAfterSeconds === 300, "Should pass longer retryAfterSeconds");

	// After close -> fresh request fires normally
	notifyRateLimitModalClosed();
	showRateLimitModal({ context: "other", retryAfterSeconds: 15 });
	assert(received.length === 3, "Request after close should invoke handler");
	assert(received[2].context === "other" && received[2].retryAfterSeconds === 15, "Fresh request data preserved");

	setRateLimitModalHandler(null);
}

if (typeof process !== "undefined" && process.env?.NODE_ENV === "test") {
	runRateLimitModalTests();
}

