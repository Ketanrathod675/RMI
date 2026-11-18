import { getMandateMethod, formatAccountTail } from "../utils/mandateMethod";
import type { MandateTypeResponse } from "../utils/api/services/autocollect.service";

function assert(condition: boolean, message: string): void {
	if (!condition) {
		throw new Error(`Assertion failed: ${message}`);
	}
}

export async function runMandateMethodTests(): Promise<void> {
	// 1. Fallback to eNACH when fallback_to_enach is true
	{
		const data: MandateTypeResponse["data"] = {
			mandate_type: "ENACH",
			default_mandate_type: "UPI",
			upi_failed_attempts: 3,
			fallback_threshold: 3,
			fallback_to_enach: true,
			loan_id: "loan_123",
			bank_account: { bank_name: "HDFC Bank", account_last4: "1234" },
		};
		assert(getMandateMethod(data) === "enach", "fallback true -> 'enach'");
	}

	// 2. Default to UPI when fallback_to_enach is false
	{
		const data: MandateTypeResponse["data"] = {
			mandate_type: "UPI",
			default_mandate_type: "UPI",
			upi_failed_attempts: 0,
			fallback_threshold: 3,
			fallback_to_enach: false,
			loan_id: "loan_123",
			bank_account: { bank_name: "HDFC Bank", account_last4: "1234" },
		};
		assert(getMandateMethod(data) === "upi", "fallback false -> 'upi'");
	}

	// 3. Default to UPI when typeData is undefined or null
	{
		assert(getMandateMethod(undefined) === "upi", "undefined data -> 'upi'");
		assert(getMandateMethod(null) === "upi", "null data -> 'upi'");
	}

	// 4. formatAccountTail formatting & null/empty handling
	{
		assert(formatAccountTail(null) === "", "null last4 -> ''");
		assert(formatAccountTail(undefined) === "", "undefined last4 -> ''");
		assert(formatAccountTail("") === "", "empty string last4 -> ''");
		assert(formatAccountTail("   ") === "", "whitespace last4 -> ''");
		assert(formatAccountTail("1234") === "•••• 1234", "valid last4 -> '•••• 1234'");
	}
}
