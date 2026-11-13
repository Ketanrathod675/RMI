/**
 * Unit test suite for utils/api/core/rateLimit.ts
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
	clearOtpLock,
	formatRemainingOtpAttemptsMessage,
	formatWaitTime,
	getOtpLock,
	getRateLimitInfo,
	isNewOtpRequiredOnly,
	isResendCooldownOnly,
	parseRemainingOtpAttempts,
	saveOtpLock,
} from "../utils/api/core/rateLimit";
import { clearStorage, STORAGE_KEYS } from "../utils/storage";

function assert(condition: boolean, message: string): void {
	if (!condition) {
		throw new Error(`Assertion failed: ${message}`);
	}
}

export async function runRateLimitTests(): Promise<void> {
	// 1. Header "retry-after: 120" (lowercase) & "Retry-After" (mixed-case)
	{
		const info = getRateLimitInfo({
			response: {
				status: 429,
				headers: { "retry-after": "120" },
				data: { detail: "Too many requests" },
			},
		});
		assert(info.isRateLimited === true, "429 response should be rate limited");
		assert(info.retryAfterSeconds === 120, `Expected 120s, got ${info.retryAfterSeconds}`);
		assert(info.serverMessage === "Too many requests", "Should capture raw serverMessage");

		const mixedCase = getRateLimitInfo({
			response: {
				status: 429,
				headers: { "Retry-After": "45" },
				data: {},
			},
		});
		assert(mixedCase.retryAfterSeconds === 45, `Mixed-case Retry-After should parse 45s, got ${mixedCase.retryAfterSeconds}`);
	}

	// 2. Header as HTTP date
	{
		const futureDate = new Date(Date.now() + 90_000).toUTCString();
		const info = getRateLimitInfo({
			response: {
				status: 429,
				headers: { "Retry-After": futureDate },
				data: { detail: "Rate limit" },
			},
		});
		assert(info.isRateLimited === true, "HTTP date 429 should be rate limited");
		assert(
			info.retryAfterSeconds >= 88 && info.retryAfterSeconds <= 91,
			`Expected ~90s from HTTP date, got ${info.retryAfterSeconds}`,
		);
	}

	// 3. No header with detail "Please try again after 600 seconds."
	{
		const info = getRateLimitInfo({
			response: {
				status: 429,
				headers: {},
				data: { detail: "Please try again after 600 seconds." },
			},
		});
		assert(info.isRateLimited === true, "Should be rate limited");
		assert(info.retryAfterSeconds === 600, `Expected 600s, got ${info.retryAfterSeconds}`);
	}

	// 4. No header with detail "Please wait 15 minutes" (string & object with .message)
	{
		const infoStr = getRateLimitInfo({
			response: {
				status: 429,
				headers: {},
				data: { detail: "Please wait 15 minutes" },
			},
		});
		assert(infoStr.retryAfterSeconds === 900, `Expected 900s for 15 minutes, got ${infoStr.retryAfterSeconds}`);

		const infoObj = getRateLimitInfo({
			response: {
				status: 429,
				headers: {},
				data: { detail: { message: "Please wait 15 minutes", code: "RATE_LIMIT" } },
			},
		});
		assert(infoObj.retryAfterSeconds === 900, `Expected 900s from detail.message, got ${infoObj.retryAfterSeconds}`);
		assert(infoObj.serverMessage === "Please wait 15 minutes", "Should extract detail.message as serverMessage");
	}

	// 5. ConsentApiError-shaped object (.status and .retryAfter)
	{
		const err = {
			name: "ConsentApiError",
			status: 429,
			retryAfter: 75,
			detail: "Locked for 75 seconds",
			message: "Locked for 75 seconds",
		};
		const info = getRateLimitInfo(err);
		assert(info.isRateLimited === true, "ConsentApiError status 429 should be rate limited");
		assert(info.retryAfterSeconds === 75, `Expected 75s from ConsentApiError.retryAfter, got ${info.retryAfterSeconds}`);

		const errNoRetryAfter = {
			name: "ConsentApiError",
			status: 429,
			detail: "Try again in 2 minutes",
			message: "Try again in 2 minutes",
		};
		const info2 = getRateLimitInfo(errNoRetryAfter);
		assert(info2.retryAfterSeconds === 120, `Expected 120s from ConsentApiError detail fallback, got ${info2.retryAfterSeconds}`);
	}

	// 6. Non-429 error & null
	{
		const non429 = getRateLimitInfo({
			response: { status: 400, headers: { "retry-after": "120" }, data: { detail: "Invalid OTP" } },
		});
		assert(non429.isRateLimited === false, "400 should not be rate limited");
		assert(non429.retryAfterSeconds >= 1, "retryAfterSeconds must always be >= 1");

		const nullErr = getRateLimitInfo(null);
		assert(nullErr.isRateLimited === false, "null error should not be rate limited");
		assert(nullErr.retryAfterSeconds >= 1, "retryAfterSeconds must always be >= 1");
	}

	// 7. Clamping (min 1, max 3600) & default 60
	{
		const tooLow = getRateLimitInfo({
			response: { status: 429, headers: { "retry-after": "0" }, data: {} },
		});
		assert(tooLow.retryAfterSeconds === 1, `Expected clamp min 1, got ${tooLow.retryAfterSeconds}`);

		const pastDate = getRateLimitInfo({
			response: { status: 429, headers: { "retry-after": new Date(Date.now() - 10_000).toUTCString() }, data: {} },
		});
		assert(pastDate.retryAfterSeconds === 1, `Expected clamp min 1 for past HTTP date, got ${pastDate.retryAfterSeconds}`);

		const tooHigh = getRateLimitInfo({
			response: { status: 429, headers: { "retry-after": "99999" }, data: {} },
		});
		assert(tooHigh.retryAfterSeconds === 3600, `Expected clamp max 3600, got ${tooHigh.retryAfterSeconds}`);

		const fallback = getRateLimitInfo({
			response: { status: 429, headers: {}, data: { detail: "Too many attempts" } },
		});
		assert(fallback.retryAfterSeconds === 60, `Expected default 60, got ${fallback.retryAfterSeconds}`);
	}

	// 8. formatWaitTime
	{
		assert(formatWaitTime(45) === "45 seconds", `Expected '45 seconds', got '${formatWaitTime(45)}'`);
		assert(formatWaitTime(1) === "1 second", `Expected '1 second', got '${formatWaitTime(1)}'`);
		assert(formatWaitTime(900) === "15 minutes", `Expected '15 minutes', got '${formatWaitTime(900)}'`);
		assert(formatWaitTime(60) === "1 minute", `Expected '1 minute', got '${formatWaitTime(60)}'`);
		assert(formatWaitTime(899) === "14 min 59 sec", `Expected '14 min 59 sec', got '${formatWaitTime(899)}'`);
	}

	// 9. Lock persistence & survival across clearStorage
	{
		await clearOtpLock();
		await saveOtpLock("9876543210", 120);

		const rawStored = await AsyncStorage.getItem(STORAGE_KEYS["@otp-lock"]);
		assert(rawStored !== null, "@otp-lock should exist in AsyncStorage");
		assert(!rawStored!.includes("9876543210"), "Raw phone number must NOT be stored in plain text");

		const lockMatch = await getOtpLock("9876543210");
		assert(lockMatch !== null, "Lock should match saved phone");
		assert(
			lockMatch!.remainingSeconds >= 118 && lockMatch!.remainingSeconds <= 120,
			`Expected ~120s remaining, got ${lockMatch!.remainingSeconds}`,
		);

		const lockNoPhone = await getOtpLock();
		assert(lockNoPhone !== null, "getOtpLock() without phone should return active lock");

		const lockMismatch = await getOtpLock("9123456789");
		assert(lockMismatch === null, "Lock should return null for a different phone");
		assert(
			(await AsyncStorage.getItem(STORAGE_KEYS["@otp-lock"])) !== null,
			"Checking another phone must not erase active lock for first phone",
		);

		// clearStorage must NOT remove @otp-lock
		await clearStorage();
		const lockAfterClearStorage = await getOtpLock("9876543210");
		assert(lockAfterClearStorage !== null, "@otp-lock must survive clearStorage()");

		// Expired lock should self-clean
		await AsyncStorage.setItem(
			STORAGE_KEYS["@otp-lock"],
			JSON.stringify({ phone: JSON.parse(rawStored!).phone, until: Date.now() - 1000 }),
		);
		const expiredLock = await getOtpLock("9876543210");
		assert(expiredLock === null, "Expired lock should return null");
		assert(
			(await AsyncStorage.getItem(STORAGE_KEYS["@otp-lock"])) === null,
			"Expired lock should remove stale @otp-lock entry",
		);

		await saveOtpLock("9876543210", 60);
		await clearOtpLock();
		assert((await getOtpLock("9876543210")) === null, "clearOtpLock should remove lock");
	}

	// 10. isNewOtpRequiredOnly & parseRemainingOtpAttempts & initial resend cooldown
	{
		const sanctionFail429 = {
			response: {
				status: 429,
				headers: {},
				data: { detail: "Too many failed attempts. Please request a new OTP." },
			},
		};
		const sanctionInfo = getRateLimitInfo(sanctionFail429);
		assert(isNewOtpRequiredOnly(sanctionFail429, sanctionInfo) === true, "Sanction 429 'request a new OTP' without Retry-After should not trigger 60s full lock");

		const timedLock429 = {
			response: {
				status: 429,
				headers: { "Retry-After": "900" },
				data: { detail: "Too many failed attempts. Please request a new OTP." },
			},
		};
		assert(isNewOtpRequiredOnly(timedLock429) === false, "429 with explicit Retry-After header must use timed lockout");

		const sanctionCooldown429 = getRateLimitInfo({
			response: {
				status: 429,
				headers: {},
				data: { detail: "Please wait 30 seconds before requesting another OTP." },
			},
		});
		assert(isResendCooldownOnly(sanctionCooldown429) === true, "30s sanction wait message should classify as resend cooldown only");

		assert(parseRemainingOtpAttempts({ response: { data: { detail: "Invalid OTP. 2 attempt(s) remaining." } } }) === 2, "Should parse 2 remaining attempts");
		assert(parseRemainingOtpAttempts({ response: { data: { detail: "Invalid OTP. 1 attempt(s) remaining." } } }) === 1, "Should parse 1 remaining attempt");
		assert(parseRemainingOtpAttempts({ response: { data: { detail: "Invalid or expired OTP" } } }) === null, "Should return null when no attempt count present");

		const tMock = (key: string) => {
			if (key === "lastOtpAttemptWarning") return "LAST";
			if (key === "wrongOtpAttemptsLeft") return "LEFT:{count}";
			return "";
		};
		assert(
			formatRemainingOtpAttemptsMessage({ response: { data: { detail: "Invalid OTP. 1 attempt(s) remaining." } } }, tMock, "FB") === "LAST",
			"1 attempt remaining should map to lastOtpAttemptWarning",
		);
		assert(
			formatRemainingOtpAttemptsMessage({ response: { data: { detail: "Invalid OTP. 2 attempt(s) remaining." } } }, tMock, "FB") === "LEFT:2",
			"2 attempts remaining should interpolate wrongOtpAttemptsLeft",
		);
		assert(
			formatRemainingOtpAttemptsMessage({ response: { data: { detail: "Invalid OTP" } } }, tMock, "FB") === "FB",
			"Missing attempt count should return fallback",
		);
	}
}

if (typeof process !== "undefined" && process.env?.NODE_ENV === "test") {
	runRateLimitTests().catch((err) => {
		console.error(err);
		process.exit(1);
	});
}

