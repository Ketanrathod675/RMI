const UNSAFE_TECHNICAL_REGEX =
	/traceback|exception|\bsql\b|psycopg|keyerror|<html|\bat\s+[\w$.<>]+\s+\([^)]*:\d+:\d+\)/i;

const INTERNAL_COOLDOWN_REGEX = /cooling|cool-off|cool\s*off|30\s*days?/i;

const PYDANTIC_PREFIX_REGEX = /^value\s+error,\s*/i;

const MAX_FIELD_ERROR_LENGTH = 200;

export interface ExtractedFieldErrors {
	fields: Record<string, string>;
	general?: string;
}

export const BASIC_DETAILS_FIELD_MAP: Record<string, string> = {
	full_name: "fullName",
	father_name: "fatherName",
	pan_number: "panNumber",
	dob: "dateOfBirth",
	gender: "gender",
	pincode: "pincode",
	email: "email",
};

const BASIC_DETAILS_FIELD_ALIASES: Record<string, string> = {
	...BASIC_DETAILS_FIELD_MAP,
	pan: "panNumber",
	pan_card: "panNumber",
	pin_code: "pincode",
	date_of_birth: "dateOfBirth",
	fullName: "fullName",
	fatherName: "fatherName",
	panNumber: "panNumber",
	dateOfBirth: "dateOfBirth",
};

export const PROFESSIONAL_DETAILS_FIELD_MAP: Record<string, string> = {
	employment_type: "employmentType",
	company_type: "companyType",
	company_name: "companyName",
	designation: "designation",
	income_range: "incomeRange",
	salary_range: "incomeRange",
	residence_status: "residenceStatus",
	nature_of_business: "natureOfBusiness",
	type_of_industry: "typeOfIndustry",
	mode_of_salary: "modeOfSalary",
	reason_for_loan: "reasonForLoan",
	preferred_language: "preferredLanguage",
	kfs_language: "preferredLanguage",
	language: "preferredLanguage",
};

export function sanitizeValidationText(
	value: unknown,
	options?: { allowCooldownKeywords?: boolean; maxLength?: number },
): string | undefined {
	if (typeof value !== "string") return undefined;
	const stripped = value.replace(PYDANTIC_PREFIX_REGEX, "").replace(/\s+/g, " ").trim();
	if (!stripped) return undefined;
	if (UNSAFE_TECHNICAL_REGEX.test(stripped)) return undefined;
	if (!options?.allowCooldownKeywords && INTERNAL_COOLDOWN_REGEX.test(stripped)) {
		return undefined;
	}
	const maxLen = options?.maxLength ?? MAX_FIELD_ERROR_LENGTH;
	if (stripped.length <= maxLen) {
		return stripped;
	}
	return `${stripped.slice(0, Math.max(1, maxLen - 3)).trimEnd()}...`;
}

export function inferFieldFromMessage(message: string): string | undefined {
	const text = message.trim();
	if (!text) return undefined;

	// Order matters: "Father's name" contains "name"; "PAN does not match name" is about PAN.
	if (/\bfather(?:'?s)?(?:\s+name)?\b/i.test(text)) return "father_name";
	if (/\bpan\b|pan[_ ]?number|pan[_ ]?card/i.test(text)) return "pan_number";
	if (/\b(?:dob|date\s+of\s+birth|age)\b/i.test(text)) return "dob";
	if (/\b(?:pincode|pin\s*code)\b/i.test(text)) return "pincode";
	if (/\b(?:e-?mail)\b/i.test(text)) return "email";
	if (/\bgender\b/i.test(text)) return "gender";
	if (/\b(?:full\s+name|name)\b/i.test(text)) return "full_name";

	return undefined;
}

function getFastApiLocField(loc: unknown): string | undefined {
	if (!Array.isArray(loc)) return undefined;
	for (let i = loc.length - 1; i >= 0; i--) {
		const part = loc[i];
		if (typeof part === "string") {
			const trimmed = part.trim();
			if (trimmed && trimmed.toLowerCase() !== "body") {
				return trimmed;
			}
		}
	}
	return undefined;
}

/**
 * Normalizes backend error responses (structured errors[], FastAPI 422 detail[], or plain 400 strings)
 * into a field-keyed map (snake_case backend keys) plus an optional general fallback message.
 */
export function extractFieldErrors(err: unknown): ExtractedFieldErrors {
	const fields: Record<string, string> = {};
	let general: string | undefined;

	const anyErr = err as any;
	const data = anyErr?.response?.data ?? anyErr?.data ?? {};
	const detail = data?.detail !== undefined ? data.detail : anyErr?.detail;

	// 1. Structured validation errors: detail.errors[] or response.data.errors[]
	const structuredErrors = Array.isArray(detail?.errors)
		? detail.errors
		: Array.isArray(data?.errors)
			? data.errors
			: null;

	if (structuredErrors) {
		for (const item of structuredErrors) {
			if (!item || typeof item !== "object") continue;
			const rawField = typeof item.field === "string" ? item.field.trim() : "";
			const msg = sanitizeValidationText(item.message ?? item.msg, {
				allowCooldownKeywords: Boolean(rawField),
			});
			if (!msg) continue;

			if (rawField) {
				if (!fields[rawField]) {
					fields[rawField] = msg;
				}
			} else if (!general) {
				general = msg;
			}
		}

		if (!general) {
			const detailMsg = sanitizeValidationText(detail?.message ?? data?.message);
			if (detailMsg) general = detailMsg;
		}
		return { fields, ...(general ? { general } : {}) };
	}

	// 2. FastAPI / Pydantic 422 array: detail: [{ loc: ["body", "pan_number"], msg: "...", type: "..." }]
	if (Array.isArray(detail)) {
		for (const item of detail) {
			if (!item || typeof item !== "object") {
				const fallbackText = sanitizeValidationText(item);
				if (fallbackText && !general) general = fallbackText;
				continue;
			}

			const locField = getFastApiLocField(item.loc);
			const rawMsg = item.msg ?? item.message;
			const msg = sanitizeValidationText(rawMsg, {
				allowCooldownKeywords: Boolean(locField) || Boolean(typeof rawMsg === "string" && inferFieldFromMessage(rawMsg)),
			});
			if (!msg) continue;

			const resolvedField = locField ?? inferFieldFromMessage(msg);
			if (resolvedField) {
				if (!fields[resolvedField]) {
					fields[resolvedField] = msg;
				}
			} else if (!general) {
				general = msg;
			}
		}
		return { fields, ...(general ? { general } : {}) };
	}

	// 3. Plain string detail or object detail.message / response.data.message
	const rawString =
		typeof detail === "string"
			? detail
			: typeof detail?.message === "string"
				? detail.message
				: typeof data?.message === "string"
					? data.message
					: typeof anyErr?.response?.data === "string"
						? anyErr.response.data
						: undefined;

	if (typeof rawString === "string") {
		const preliminaryClean = rawString.replace(PYDANTIC_PREFIX_REGEX, "").trim();
		const inferredField = inferFieldFromMessage(preliminaryClean);
		const safeText = sanitizeValidationText(preliminaryClean, {
			allowCooldownKeywords: Boolean(inferredField),
		});

		if (safeText) {
			if (inferredField) {
				fields[inferredField] = safeText;
			} else {
				general = safeText;
			}
		}
	}

	return { fields, ...(general ? { general } : {}) };
}

/**
 * Maps backend field keys onto a screen's form fieldErrors keys.
 * Supports aliases for Basic Details when BASIC_DETAILS_FIELD_MAP is passed.
 */
export function mapBackendFieldErrors<TFieldKey extends string = string>(
	fields: Record<string, string>,
	fieldMap: Record<string, TFieldKey>,
): Partial<Record<TFieldKey, string>> {
	const lookup: Record<string, string> =
		fieldMap === BASIC_DETAILS_FIELD_MAP ? BASIC_DETAILS_FIELD_ALIASES : fieldMap;
	const mapped: Partial<Record<TFieldKey, string>> = {};

	for (const [rawKey, message] of Object.entries(fields)) {
		if (!message) continue;
		const mappedKey = (lookup[rawKey] ?? lookup[rawKey.toLowerCase()]) as TFieldKey | undefined;
		if (mappedKey && !mapped[mappedKey]) {
			mapped[mappedKey] = message;
		}
	}

	return mapped;
}

