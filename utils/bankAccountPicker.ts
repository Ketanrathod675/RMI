import { extractFieldErrors } from "./api/core/fieldErrors";
import type { BankAccount, SelectBankAccountPayload } from "./api/bank";

export const MAX_DRAFT_ACCOUNTS = 3;
export const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;

const AVATAR_PALETTE = [
	"#1E3A8A",
	"#C2410C",
	"#1D4ED8",
	"#DC2626",
	"#047857",
	"#6D28D9",
	"#0F766E",
	"#9D174D",
] as const;

export interface BankFormValues {
	accountHolderName: string;
	accountNumber: string;
	confirmAccountNumber: string;
	accountType: "savings" | "current";
	ifscCode: string;
	bankName: string;
	branchName: string;
	city: string;
	isIFSCValid: boolean;
	ifscBlacklistedError?: string | null;
}

export type BankFormErrorKey =
	| "accountHolderName"
	| "accountNumber"
	| "confirmAccountNumber"
	| "accountType"
	| "ifscCode";

export interface DraftBankAccount {
	id: string;
	isDraft: true;
	account_holder_name?: string;
	accountNumber: string;
	confirmAccountNumber: string;
	account_number_masked: string;
	last4: string;
	ifsc_code: string;
	bank_name: string;
	branch_name: string;
	city: string;
	account_type: "savings" | "current";
	isBlacklisted?: boolean;
	blacklistError?: string;
}

export interface SavedPickerAccount extends BankAccount {
	isDraft: false;
	last4: string;
}

export type PickerAccountItem = DraftBankAccount | SavedPickerAccount;

/**
 * Formats an account number or masked account string into "•••• •••• 4821" and extracts last 4 digits.
 */
export function formatMaskedAccountNumber(maskedOrRaw?: string | null): {
	formatted: string;
	last4: string;
} {
	const cleaned = String(maskedOrRaw || "").replace(/\s+/g, "");
	const last4 = cleaned.length >= 4 ? cleaned.slice(-4) : cleaned;
	return {
		formatted: last4 ? `•••• •••• ${last4}` : "••••",
		last4,
	};
}

/**
 * Derives deterministic 2-letter uppercase initials and an accessible dark pill background color.
 */
export function getBankAvatarInfo(bankName?: string | null): {
	initials: string;
	color: string;
} {
	const clean = String(bankName || "").trim();
	const stopWords = new Set(["of", "the", "and", "limited", "ltd", "&"]);
	const words = clean
		.split(/\s+/)
		.filter((w) => w.length > 0 && !stopWords.has(w.toLowerCase()));

	let initials = "BK";
	if (words.length >= 2) {
		initials = `${words[0][0]}${words[1][0]}`.toUpperCase();
	} else if (words.length === 1) {
		initials = words[0].slice(0, 2).toUpperCase();
	}

	let hash = 0;
	const source = clean.toUpperCase() || "BANK";
	for (let i = 0; i < source.length; i += 1) {
		hash = (hash * 31 + source.charCodeAt(i)) >>> 0;
	}
	const color = AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
	return { initials, color };
}

/**
 * Validates bank account form inputs and returns field-level error keys/messages.
 */
export function validateBankFormFields(values: BankFormValues): {
	isValid: boolean;
	errors: Partial<Record<BankFormErrorKey, string>>;
} {
	const errors: Partial<Record<BankFormErrorKey, string>> = {};
	const holder = String(values.accountHolderName || "").trim();
	const acc = values.accountNumber.trim();
	const confirmAcc = values.confirmAccountNumber.trim();
	const ifsc = values.ifscCode.trim().toUpperCase();

	if (!holder) {
		errors.accountHolderName = "accountHolderNameRequired";
	}

	if (!acc) {
		errors.accountNumber = "bankAccountNumberRequired";
	} else if (!/^\d{9,18}$/.test(acc)) {
		errors.accountNumber = "invalidBankAccountNumber";
	}

	if (!confirmAcc) {
		errors.confirmAccountNumber = "pleaseConfirmYourBankAccountNumber";
	} else if (!/^\d{9,18}$/.test(confirmAcc)) {
		errors.confirmAccountNumber = "invalidConfirmationAccountNumber";
	} else if (acc && acc !== confirmAcc) {
		errors.confirmAccountNumber = "accountNumbersDontMatch";
	}

	if (values.accountType !== "savings" && values.accountType !== "current") {
		errors.accountType = "pleaseSelectYourAccountType";
	}

	if (values.ifscBlacklistedError) {
		errors.ifscCode = values.ifscBlacklistedError;
	} else if (!ifsc) {
		errors.ifscCode = "validIFSCCodeRequired";
	} else if (ifsc.length !== 11 || !IFSC_REGEX.test(ifsc)) {
		errors.ifscCode = "ifscCodeMustBe11CharactersLong";
	} else if (!values.isIFSCValid) {
		errors.ifscCode = "invalidIFSCCodeValidation";
	}

	return {
		isValid: Object.keys(errors).length === 0,
		errors,
	};
}

/**
 * Returns a short translation key describing the first missing or invalid input when disabled.
 */
export function getMissingFormHint(values: BankFormValues): string | null {
	const holder = String(values.accountHolderName || "").trim();
	const acc = values.accountNumber.trim();
	const confirmAcc = values.confirmAccountNumber.trim();
	const ifsc = values.ifscCode.trim().toUpperCase();

	if (!holder) {
		return "missingAccountHolderHint";
	}
	if (!acc || !/^\d{9,18}$/.test(acc)) {
		return "missingAccountNumberHint";
	}
	if (!confirmAcc || !/^\d{9,18}$/.test(confirmAcc)) {
		return "missingConfirmAccountHint";
	}
	if (acc !== confirmAcc) {
		return "accountNumbersDontMatch";
	}
	if (values.ifscBlacklistedError) {
		return "blacklistedBankHint";
	}
	if (!ifsc || !IFSC_REGEX.test(ifsc) || !values.isIFSCValid) {
		return "missingIfscHint";
	}
	return null;
}

export function canAddDraftAccount(currentDraftCount: number): boolean {
	return currentDraftCount < MAX_DRAFT_ACCOUNTS;
}

/**
 * Strictly constructs POST /bank-details/select body (extra="forbid" on backend).
 * Never sends bank_name or branch_name for new accounts.
 */
export function buildSelectAccountPayload(
	selected:
		| { isDraft: false; id: string }
		| {
				isDraft: true;
				account_holder_name?: string;
				accountNumber: string;
				confirmAccountNumber: string;
				ifsc_code: string;
				account_type: "savings" | "current";
		  },
): SelectBankAccountPayload {
	if (!selected.isDraft) {
		return { bank_details_id: selected.id };
	}
	const holder = String(selected.account_holder_name || "").trim();
	return {
		account: {
			...(holder ? { account_holder_name: holder } : {}),
			account_number: selected.accountNumber.trim(),
			confirm_account_number: selected.confirmAccountNumber.trim(),
			ifsc_code: selected.ifsc_code.trim().toUpperCase(),
			account_type: selected.account_type,
		},
	};
}

export type BankSelectErrorClassification =
	| { kind: "blacklisted"; message: string }
	| { kind: "rejected_earlier"; message: string }
	| { kind: "validation"; fields: Record<string, string>; message: string }
	| { kind: "other"; message: string };

/**
 * Classifies errors from POST /bank-details/select for inline & list-level UI recovery.
 */
export function classifyBankSelectError(err: any): BankSelectErrorClassification {
	const status = err?.response?.status ?? err?.status;
	const detail = err?.response?.data?.detail;
	const code =
		detail && typeof detail === "object" ? String(detail.code || "").toUpperCase() : "";
	const detailMsg =
		typeof detail === "string"
			? detail
			: detail && typeof detail === "object" && typeof detail.message === "string"
				? detail.message
				: typeof err?.response?.data?.message === "string"
					? err.response.data.message
					: "";
	const msgLower = detailMsg.toLowerCase();

	if (
		status === 422 &&
		(code === "BANK_BLACKLISTED" || msgLower.includes("blacklisted"))
	) {
		return {
			kind: "blacklisted",
			message:
				detailMsg ||
				"This bank is currently blacklisted. Please choose another bank account.",
		};
	}

	if (
		status === 409 &&
		(msgLower.includes("not accepted earlier") ||
			msgLower.includes("inactive") ||
			msgLower.includes("different account"))
	) {
		return {
			kind: "rejected_earlier",
			message:
				detailMsg ||
				"This account was not accepted earlier. Please use a different account.",
		};
	}

	if (status === 422) {
		const { fields, general } = extractFieldErrors(err);
		if (Object.keys(fields).length > 0) {
			return {
				kind: "validation",
				fields,
				message: general || Object.values(fields)[0] || detailMsg,
			};
		}
	}

	return {
		kind: "other",
		message: detailMsg || "Unable to save your bank account. Please try again.",
	};
}

