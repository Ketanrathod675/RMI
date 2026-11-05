/**
 * Unit test suite for pickMessages and isGenericTitle from utils/toastConfig
 */

import { isGenericTitle, pickMessages } from "../utils/toastConfig";

function assert(condition: boolean, message: string): void {
	if (!condition) {
		throw new Error(`Assertion failed: ${message}`);
	}
}

export function runToastMessageTests(): void {
	// 1. Generic title + real message in text2 -> drops generic title, primary = text2
	{
		const res = pickMessages("Error", "Invalid OTP entered. Please try again.");
		assert(
			res.primary === "Invalid OTP entered. Please try again.",
			"Generic 'Error' title should be dropped and text2 become primary",
		);
		assert(res.secondary === undefined, "Secondary should be undefined when generic title dropped");
	}

	{
		const res = pickMessages("Success", "Profile updated successfully");
		assert(
			res.primary === "Profile updated successfully",
			"Generic 'Success' title should be dropped",
		);
		assert(res.secondary === undefined, "Secondary should be undefined");
	}

	{
		const res = pickMessages("oops", "Network connection failed");
		assert(
			res.primary === "Network connection failed",
			"Generic 'oops' title should be dropped (case-insensitive)",
		);
		assert(res.secondary === undefined, "Secondary should be undefined");
	}

	{
		const res = pickMessages("FAILED", "Transaction timed out");
		assert(
			res.primary === "Transaction timed out",
			"Generic 'FAILED' title should be dropped",
		);
		assert(res.secondary === undefined, "Secondary should be undefined");
	}

	// 2. Short two-line (non-generic text1 + text2)
	{
		const res = pickMessages("KYC Verified", "Aadhaar & identity check");
		assert(res.primary === "KYC Verified", "Non-generic text1 should be primary");
		assert(res.secondary === "Aadhaar & identity check", "text2 should be secondary");
	}

	// 3. Long two-line
	{
		const longTitle = "Bank Account Verification In Progress";
		const longDesc = "Please allow up to 24 hours for bank confirmation and Penny drop.";
		const res = pickMessages(longTitle, longDesc);
		assert(res.primary === longTitle, "Long title should be primary");
		assert(res.secondary === longDesc, "Long description should be secondary");
	}

	// 4. Only text1
	{
		const res = pickMessages("OTP resent successfully", undefined);
		assert(res.primary === "OTP resent successfully", "Only text1 should become primary");
		assert(res.secondary === undefined, "Secondary should be undefined");
	}

	{
		const res = pickMessages("Please accept permissions", null);
		assert(res.primary === "Please accept permissions", "Only text1 with null text2 should become primary");
		assert(res.secondary === undefined, "Secondary should be undefined");
	}

	// 5. Only text2
	{
		const res = pickMessages(undefined, "Something went wrong. Please retry.");
		assert(res.primary === "Something went wrong. Please retry.", "Only text2 should become primary");
		assert(res.secondary === undefined, "Secondary should be undefined");
	}

	{
		const res = pickMessages("", "Server busy");
		assert(res.primary === "Server busy", "Empty text1 should result in text2 as primary");
		assert(res.secondary === undefined, "Secondary should be undefined");
	}

	// 6. Generic title alone (no text2) -> fallback to generic title as primary
	{
		const res = pickMessages("Error", undefined);
		assert(res.primary === "Error", "Generic title alone should be preserved if no text2 is present");
		assert(res.secondary === undefined, "Secondary should be undefined");
	}

	// 7. Empty strings / whitespace
	{
		const res = pickMessages("   ", "   ");
		assert(res.primary === "", "Whitespace-only strings should resolve to empty primary");
		assert(res.secondary === undefined, "Secondary should be undefined");
	}

	// 8. Null / undefined
	{
		const res = pickMessages(null, null);
		assert(res.primary === "", "Null values should resolve to empty primary");
		assert(res.secondary === undefined, "Secondary should be undefined");
	}

	{
		const res = pickMessages(undefined, undefined);
		assert(res.primary === "", "Undefined values should resolve to empty primary");
		assert(res.secondary === undefined, "Secondary should be undefined");
	}

	// 9. isGenericTitle tests
	{
		assert(isGenericTitle("error"), "'error' should be generic");
		assert(isGenericTitle("SUCCESS"), "'SUCCESS' should be generic");
		assert(isGenericTitle("Warning"), "'Warning' should be generic");
		assert(isGenericTitle("Notice"), "'Notice' should be generic");
		assert(!isGenericTitle("Account Suspended"), "'Account Suspended' should NOT be generic");
		assert(!isGenericTitle(""), "Empty string should NOT be generic");
		assert(!isGenericTitle(null), "Null should NOT be generic");
	}
}

// Run immediately if executed
try {
	runToastMessageTests();
} catch (error) {
	throw error;
}

