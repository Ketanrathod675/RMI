/**
 * Unit test suite for app/+native-intent.tsx: redirectSystemPath
 *
 * Verifies the 4 critical deep link intent cases:
 * 1. Payment return (assessment-fee-success with txnid)
 * 2. Mandate return (status=true|pending|false with txnid)
 * 3. Unrelated link (returned unchanged)
 * 4. Malformed URL / invalid URI (returned unchanged)
 */

import { redirectSystemPath } from "../app/+native-intent";

function assert(condition: boolean, message: string): void {
	if (!condition) {
		throw new Error(`Assertion failed: ${message}`);
	}
}

export function runNativeIntentTests(): void {
	// Case 1: Payment return
	{
		const result = redirectSystemPath({
			path: "/assessment-fee-success?txnid=TXN_TEST_123&status=success",
			initial: false,
		});
		assert(
			typeof result === "string" && result.startsWith("/new-assessment-fee"),
			"Payment return should redirect to /new-assessment-fee",
		);
		assert(
			typeof result === "string" && result.includes("txnid=TXN_TEST_123"),
			"Payment return should preserve txnid",
		);
	}

	// Case 2a: Mandate return (status=true), without txnid
	{
		const result = redirectSystemPath({
			path: "/emandate-status?status=true",
			initial: false,
		});
		assert(
			typeof result === "string" && result.startsWith("/emandate-status"),
			"Mandate return (status=true) should redirect to /emandate-status",
		);
		assert(
			typeof result === "string" && result.includes("source=deeplink_success"),
			"Mandate return (status=true) should set source=deeplink_success",
		);
	}

	// Case 2b: Mandate return (status=pending)
	{
		const result = redirectSystemPath({
			path: "/emandate-return?status=pending&txnid=MAND_789",
			initial: false,
		});
		assert(
			typeof result === "string" && result.startsWith("/emandate-status"),
			"Mandate return (status=pending) should redirect to /emandate-status",
		);
		assert(
			typeof result === "string" && result.includes("source=deeplink_pending"),
			"Mandate return (status=pending) should set source=deeplink_pending",
		);
	}

	// Case 2c: Mandate return (status=false)
	{
		const result = redirectSystemPath({
			path: "/emandate-return?status=false",
			initial: false,
		});
		assert(
			typeof result === "string" && result.startsWith("/emandate-status"),
			"Mandate return (status=false) should redirect to /emandate-status",
		);
		assert(
			typeof result === "string" && result.includes("source=deeplink_failure"),
			"Mandate return (status=false) should set source=deeplink_failure",
		);
	}

	// Case 3: Unrelated link (returned unchanged)
	{
		const testPath = "/?status=success";
		const result = redirectSystemPath({
			path: testPath,
			initial: false,
		});
		assert(
			result === testPath,
			"Root status link should be returned unchanged",
		);
	}

	// Case 4: Malformed URL (returned unchanged without throwing)
	{
		const malformedPath = "%%%invalid-uri-path%%%";
		const result = redirectSystemPath({
			path: malformedPath,
			initial: false,
		});
		assert(
			result === malformedPath,
			"Malformed URL should return original path unchanged without throwing",
		);
	}
}

// Execute tests if running standalone in node
if (typeof process !== "undefined" && process.env?.NODE_ENV === "test") {
	runNativeIntentTests();
}
