/**
 * Unit test suite for backend field error extraction & friendlyError validation messages
 */

import {
	BASIC_DETAILS_FIELD_MAP,
	extractFieldErrors,
	mapBackendFieldErrors,
} from "../utils/api/core/fieldErrors";
import { getFriendlyError } from "../utils/api/core/friendlyError";

function assert(condition: boolean, message: string): void {
	if (!condition) {
		throw new Error(`Assertion failed: ${message}`);
	}
}

export function runFieldErrorsTests(): void {
	// 1. Structured response.data.detail.errors[] and multi-field mapping
	{
		const err = {
			response: {
				status: 400,
				data: {
					detail: {
						message: "Validation failed",
						errors: [
							{ field: "dob", code: "UNDERAGE", message: "Minimum age is 21 years" },
							{ field: "email", code: "INVALID_EMAIL", message: "Email domain is not accepted" },
						],
					},
				},
			},
		};
		const extracted = extractFieldErrors(err);
		assert(extracted.fields.dob === "Minimum age is 21 years", "dob message must be extracted");
		assert(
			extracted.fields.email === "Email domain is not accepted",
			"email message must be extracted",
		);
		const mapped = mapBackendFieldErrors(extracted.fields, BASIC_DETAILS_FIELD_MAP);
		assert(mapped.dateOfBirth === "Minimum age is 21 years", "dob must map to dateOfBirth");
		assert(mapped.email === "Email domain is not accepted", "email must map to email");
	}

	// 2. Structured response.data.errors[] at top level
	{
		const err = {
			response: {
				status: 400,
				data: {
					errors: [{ field: "pan_number", code: "PAN_DUPLICATE", message: "PAN already registered" }],
				},
			},
		};
		const extracted = extractFieldErrors(err);
		assert(
			extracted.fields.pan_number === "PAN already registered",
			"Top-level data.errors[] must be extracted",
		);
	}

	// 3. FastAPI 422 loc array strips "body" and "Value error, " prefix
	{
		const err = {
			response: {
				status: 422,
				data: {
					detail: [
						{
							loc: ["body", "pan_number"],
							msg: "Value error, Invalid PAN number format",
							type: "value_error",
						},
						{
							loc: ["body", "pincode"],
							msg: "String should have at least 6 characters",
							type: "string_too_short",
						},
					],
				},
			},
		};
		const extracted = extractFieldErrors(err);
		assert(
			extracted.fields.pan_number === "Invalid PAN number format",
			`Expected Pydantic prefix stripped, got '${extracted.fields.pan_number}'`,
		);
		assert(
			extracted.fields.pincode === "String should have at least 6 characters",
			"Second 422 loc field should also be captured",
		);
		const mapped = mapBackendFieldErrors(extracted.fields, BASIC_DETAILS_FIELD_MAP);
		assert(mapped.panNumber === "Invalid PAN number format", "pan_number maps to panNumber");
		assert(mapped.pincode === "String should have at least 6 characters", "pincode maps to pincode");
	}

	// 4. Plain 400 strings infer expected fields accurately
	{
		const cases: Array<[string, string | undefined]> = [
			["PAN already registered", "pan_number"],
			["PAN does not match name", "pan_number"],
			["Father's name must only contain alphabets", "father_name"],
			["Full name cannot be shorter than 3 letters", "full_name"],
			["Date of birth must be before 2005", "dob"],
			["Applicant age must be between 21 and 58", "dob"],
			["Pincode is currently unserviceable", "pincode"],
			["Pin code must be 6 digits", "pincode"],
			["Email is already in use", "email"],
			["Invalid gender value provided", "gender"],
			["Company policy threshold exceeded", undefined],
			["Page could not be validated", undefined],
		];

		for (const [msg, expectedField] of cases) {
			const res = extractFieldErrors({ response: { status: 400, data: { detail: msg } } });
			if (expectedField) {
				assert(
					res.fields[expectedField] === msg,
					`Expected '${msg}' -> field '${expectedField}', got fields=${JSON.stringify(res.fields)}`,
				);
			} else {
				assert(
					Object.keys(res.fields).length === 0 && res.general === msg,
					`Expected '${msg}' to remain general without false-positive field match, got ${JSON.stringify(res)}`,
				);
			}
		}
	}

	// 5. Long (>140 char) validation strings truncate to ~200 chars instead of dropping, and technical leaks are dropped
	{
		const longMsg = "PAN verification failed: " + "x".repeat(210);
		const longRes = extractFieldErrors({
			response: { status: 400, data: { detail: longMsg } },
		});
		assert(
			typeof longRes.fields.pan_number === "string" &&
				longRes.fields.pan_number.length <= 200 &&
				longRes.fields.pan_number.endsWith("..."),
			"Long field message should be truncated to <=200 chars rather than dropped",
		);

		const friendlyLong = getFriendlyError({
			response: { status: 400, data: { detail: "a".repeat(160) } },
		});
		assert(
			friendlyLong.message === "a".repeat(160),
			"FriendlyError 400 branch must preserve usable messages between 140 and 200 chars",
		);

		const sqlLeak = extractFieldErrors({
			response: { status: 400, data: { detail: "psycopg2 Traceback sql error near pan" } },
		});
		assert(
			Object.keys(sqlLeak.fields).length === 0 && !sqlLeak.general,
			"SQL / Traceback details must never be surfaced",
		);
	}

	// 6. Field validation messages containing "30 days" are NOT hidden on 400/422
	{
		const msgWith30Days = "Email cannot be reused within 30 days of a previous attempt";
		const extracted = extractFieldErrors({
			response: { status: 400, data: { detail: msgWith30Days } },
		});
		assert(
			extracted.fields.email === msgWith30Days,
			"Field validation message containing '30 days' must not be hidden",
		);
		const friendly = getFriendlyError({
			response: { status: 400, data: { detail: msgWith30Days } },
		});
		assert(
			friendly.message === msgWith30Days,
			`getFriendlyError 400/422 must preserve field message with '30 days', got '${friendly.message}'`,
		);
	}
}

