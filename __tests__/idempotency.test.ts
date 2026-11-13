/**
 * Unit test suite for utils/idempotency.ts
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
	clearIdempotencyKey,
	getIdempotencyEntry,
	getOrCreateIdempotencyKey,
	updateIdempotencyKeyMeta,
} from "../utils/idempotency";
import {
	clearIdempotencyKeys,
	clearStorage,
	RemovableKeys,
	removeMultipleStorageItems,
	STORAGE_KEYS,
} from "../utils/storage";
import Logger from "../utils/logger";
import { sanitizeSentryBreadcrumb, sanitizeSentryEvent } from "../utils/errorHandling";

function assert(condition: boolean, message: string): void {
	if (!condition) {
		throw new Error(`Assertion failed: ${message}`);
	}
}

export async function runIdempotencyTests(): Promise<void> {
	await AsyncStorage.clear();

	// 1. Same fingerprint reuses key
	{
		const key1 = await getOrCreateIdempotencyKey("assessment-fee", "lead_1|SAVE50");
		const key2 = await getOrCreateIdempotencyKey("assessment-fee", "lead_1|SAVE50");
		assert(typeof key1 === "string" && key1.length > 10, "Key should be a valid UUID");
		assert(key1 === key2, "Same scope + fingerprint within TTL must reuse key");
	}

	// 2. Different fingerprint rotates key
	{
		const key1 = await getOrCreateIdempotencyKey("assessment-fee", "lead_1|SAVE50");
		const key2 = await getOrCreateIdempotencyKey("assessment-fee", "lead_1|OTHER");
		const key3 = await getOrCreateIdempotencyKey("assessment-fee", "lead_2|OTHER");
		assert(key2 !== key1, "Changed coupon fingerprint must rotate key");
		assert(key3 !== key2, "Changed lead_id fingerprint must rotate key");
	}

	// 3. Expired key (via ttlMs) rotates key
	{
		const storageKey = "@idem:assessment-fee";
		await AsyncStorage.setItem(
			storageKey,
			JSON.stringify({
				key: "old-expired-uuid",
				fingerprint: "lead_9|",
				createdAt: Date.now() - 40 * 60 * 1000,
			}),
		);
		const rotated = await getOrCreateIdempotencyKey("assessment-fee", "lead_9|", 30 * 60 * 1000);
		assert(rotated !== "old-expired-uuid", "Expired TTL entry must rotate to a new key");
	}

	// 4. Optional expiresAt metadata expires & discards key
	{
		const key1 = await getOrCreateIdempotencyKey("repayment", "15000");
		await updateIdempotencyKeyMeta("repayment", {
			amount: 15000,
			expiresAt: Date.now() - 5000,
		});
		const metaEntry = await getIdempotencyEntry("repayment");
		assert(metaEntry === null, "Expired expiresAt entry should be discarded by getIdempotencyEntry");

		const key2 = await getOrCreateIdempotencyKey("repayment", "15000");
		assert(key2 !== key1, "Expired expiresAt entry must rotate on next getOrCreateIdempotencyKey");
	}

	// 5. clearIdempotencyKey removes entry
	{
		const key1 = await getOrCreateIdempotencyKey("assessment-fee", "lead_3|");
		await clearIdempotencyKey("assessment-fee");
		const key2 = await getOrCreateIdempotencyKey("assessment-fee", "lead_3|");
		assert(key2 !== key1, "clearIdempotencyKey should force a fresh key on next call");
	}

	// 6. clearStorage removes all @idem:* entries while keeping @otp-lock
	{
		await getOrCreateIdempotencyKey("assessment-fee", "lead_4|");
		await getOrCreateIdempotencyKey("repayment", "5000");
		await AsyncStorage.setItem(
			STORAGE_KEYS["@otp-lock"],
			JSON.stringify({ phone: "OTg3NjU0MzIxMA==", until: Date.now() + 60_000 }),
		);

		await clearStorage();

		assert((await AsyncStorage.getItem("@idem:assessment-fee")) === null, "@idem:assessment-fee must be removed by clearStorage");
		assert((await AsyncStorage.getItem("@idem:repayment")) === null, "@idem:repayment must be removed by clearStorage");
		assert((await AsyncStorage.getItem(STORAGE_KEYS["@otp-lock"])) !== null, "@otp-lock must survive clearStorage");
	}

	// 7. Logout cleanup (RemovableKeys + clearIdempotencyKeys) deletes @idem:* while keeping @otp-lock
	{
		await getOrCreateIdempotencyKey("assessment-fee", "lead_5|");
		await AsyncStorage.setItem("@idem:custom-scope", "custom-val");
		await AsyncStorage.setItem(
			STORAGE_KEYS["@otp-lock"],
			JSON.stringify({ phone: "OTg3NjU0MzIxMA==", until: Date.now() + 90_000 }),
		);

		await Promise.all([
			removeMultipleStorageItems(RemovableKeys),
			clearIdempotencyKeys(),
		]);

		assert((await AsyncStorage.getItem("@idem:assessment-fee")) === null, "@idem:assessment-fee must be removed on logout");
		assert((await AsyncStorage.getItem("@idem:custom-scope")) === null, "Arbitrary @idem:* must be removed on logout");
		assert((await AsyncStorage.getItem(STORAGE_KEYS["@otp-lock"])) !== null, "@otp-lock must survive logout");
	}

	// 8. Logger and Sentry helpers redact Idempotency-Key / idempotency-key / lead_id
	{
		let loggedText = "";
		const origWarn = console.warn;
		console.warn = (...args: any[]) => {
			loggedText = args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" ");
		};
		try {
			Logger.warn("Payment request debug", {
				headers: {
					"Idempotency-Key": "secret-idem-UPPER",
					"idempotency-key": "secret-idem-lower",
				},
				lead_id: "secret-lead-999",
			});
		} finally {
			console.warn = origWarn;
		}
		assert(!loggedText.includes("secret-idem-UPPER"), "Logger must redact Idempotency-Key");
		assert(!loggedText.includes("secret-idem-lower"), "Logger must redact idempotency-key");
		assert(!loggedText.includes("secret-lead-999"), "Logger must redact lead_id");
		assert(loggedText.includes("[REDACTED]"), "Logger output must contain [REDACTED] placeholder");

		const sanitizedCrumb = sanitizeSentryBreadcrumb({
			category: "http",
			message: 'POST header idempotency-key="secret-msg-key"',
			data: {
				headers: {
					"Idempotency-Key": "secret-crumb-upper",
					"idempotency-key": "secret-crumb-lower",
				},
			},
		});
		const crumbJson = JSON.stringify(sanitizedCrumb);
		assert(!crumbJson.includes("secret-msg-key"), "Breadcrumb message must redact idempotency-key");
		assert(!crumbJson.includes("secret-crumb-upper"), "Breadcrumb data must redact Idempotency-Key");
		assert(!crumbJson.includes("secret-crumb-lower"), "Breadcrumb data must redact idempotency-key");

		const sanitizedEvent = sanitizeSentryEvent({
			extra: {
				"Idempotency-Key": "secret-event-key",
			},
		});
		assert(!JSON.stringify(sanitizedEvent).includes("secret-event-key"), "Sentry event must redact Idempotency-Key");
	}
}

if (typeof process !== "undefined" && process.env?.NODE_ENV === "test") {
	runIdempotencyTests().catch((err) => {
		console.error(err);
		process.exit(1);
	});
}
