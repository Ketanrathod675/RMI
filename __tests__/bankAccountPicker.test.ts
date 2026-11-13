/**
 * Unit test suite for Single-Page Bank Account Picker & Form helpers.
 */

import {
	buildSelectAccountPayload,
	canAddDraftAccount,
	classifyBankSelectError,
	formatMaskedAccountNumber,
	getBankAvatarInfo,
	getMissingFormHint,
	MAX_DRAFT_ACCOUNTS,
	validateBankFormFields,
	type BankFormValues,
} from "../utils/bankAccountPicker";

function assert(condition: boolean, message: string): void {
	if (!condition) {
		throw new Error(`Assertion failed: ${message}`);
	}
}

const makeValidForm = (overrides: Partial<BankFormValues> = {}): BankFormValues => ({
	accountHolderName: "Rahul Sharma",
	accountNumber: "50100492817492",
	confirmAccountNumber: "50100492817492",
	accountType: "savings",
	ifscCode: "HDFC0000128",
	bankName: "HDFC Bank",
	branchName: "Andheri East",
	city: "Mumbai",
	isIFSCValid: true,
	...overrides,
});

export async function runBankAccountPickerTests(): Promise<void> {
	// 1. Masked number formatting & last4 extraction
	{
		const m1 = formatMaskedAccountNumber("XXXXXXXX4821");
		assert(m1.last4 === "4821", `Expected last4 '4821', got '${m1.last4}'`);
		assert(m1.formatted === "•••• •••• 4821", `Expected '•••• •••• 4821', got '${m1.formatted}'`);

		const m2 = formatMaskedAccountNumber("50100492817492");
		assert(m2.last4 === "7492", "Should extract last 4 digits cleanly");
		assert(m2.formatted === "•••• •••• 7492", "Should format masked digits cleanly");
	}

	// 2. Stable bank avatar initials & color
	{
		const a1 = getBankAvatarInfo("HDFC Bank Limited");
		const a2 = getBankAvatarInfo("HDFC Bank Limited");
		const b1 = getBankAvatarInfo("Kotak Mahindra Bank");
		assert(a1.initials.length >= 2 && a1.color.startsWith("#"), "Valid avatar initials & hex color");
		assert(a1.color === a2.color && a1.initials === a2.initials, "Avatar hash must be deterministic");
		assert(b1.initials === "KM", `Expected 'KM' for Kotak Mahindra Bank, got '${b1.initials}'`);
	}

	// 3. Form validation rules
	{
		const ok = validateBankFormFields(makeValidForm());
		assert(ok.isValid === true && Object.keys(ok.errors).length === 0, "Valid form must pass");

		const mismatch = validateBankFormFields(
			makeValidForm({ confirmAccountNumber: "50100492817499" }),
		);
		assert(
			mismatch.isValid === false && mismatch.errors.confirmAccountNumber === "accountNumbersDontMatch",
			"Mismatched confirm number must fail with inline error key",
		);

		const shortAcc = validateBankFormFields(makeValidForm({ accountNumber: "12345", confirmAccountNumber: "12345" }));
		assert(
			shortAcc.isValid === false && shortAcc.errors.accountNumber === "invalidBankAccountNumber",
			"Account number < 9 digits must fail",
		);

		const badIfsc = validateBankFormFields(makeValidForm({ ifscCode: "HDFC123", isIFSCValid: false }));
		assert(badIfsc.isValid === false && Boolean(badIfsc.errors.ifscCode), "Invalid IFSC must fail");

		const blacklisted = validateBankFormFields(
			makeValidForm({ ifscBlacklistedError: "This bank is blacklisted." }),
		);
		assert(
			blacklisted.isValid === false &&
				blacklisted.errors.ifscCode === "This bank is blacklisted.",
			"Blacklisted bank must block submission with backend message",
		);

		const emptyHolder = validateBankFormFields(makeValidForm({ accountHolderName: "   " }));
		assert(
			emptyHolder.isValid === false &&
				emptyHolder.errors.accountHolderName === "accountHolderNameRequired",
			"Blank account holder name must fail with accountHolderNameRequired",
		);
	}

	// 4. Draft account limit (max 3) & payload construction (strict backend contract)
	{
		assert(MAX_DRAFT_ACCOUNTS === 3, "MAX_DRAFT_ACCOUNTS must be 3");
		assert(canAddDraftAccount(0) === true, "0 drafts can add");
		assert(canAddDraftAccount(2) === true, "2 drafts can add");
		assert(canAddDraftAccount(3) === false, "3 drafts must hit limit");

		const savedPayload = buildSelectAccountPayload({
			isDraft: false,
			id: "uuid-saved-1",
		});
		assert(
			"bank_details_id" in savedPayload &&
				savedPayload.bank_details_id === "uuid-saved-1" &&
				Object.keys(savedPayload).length === 1,
			"Saved account selection must send ONLY bank_details_id",
		);

		const draftPayload = buildSelectAccountPayload({
			isDraft: true,
			account_holder_name: "Priya Verma",
			accountNumber: "918237461902",
			confirmAccountNumber: "918237461902",
			ifsc_code: "kkbk0000261",
			account_type: "current",
		});
		assert(
			"account" in draftPayload &&
				draftPayload.account.account_holder_name === "Priya Verma" &&
				draftPayload.account.ifsc_code === "KKBK0000261" &&
				draftPayload.account.account_type === "current" &&
				!("bank_name" in draftPayload.account) &&
				!("branch_name" in draftPayload.account),
			"Draft payload must send account_holder_name, account_number, confirm_account_number, ifsc_code, account_type without bank_name/branch_name",
		);
	}

	// 5. Missing form hint for disabled state
	{
		const hint = getMissingFormHint(makeValidForm({ accountNumber: "", confirmAccountNumber: "" }));
		assert(hint === "missingAccountNumberHint", `Expected missingAccountNumberHint, got '${hint}'`);
	}

	// 6. Backend error classification (422 BANK_BLACKLISTED, 409 not accepted earlier, 422 Pydantic)
	{
		const blErr = {
			response: {
				status: 422,
				data: {
					detail: {
						code: "BANK_BLACKLISTED",
						message: "This bank is not accepted.",
					},
				},
			},
		};
		const cBl = classifyBankSelectError(blErr);
		assert(
			cBl.kind === "blacklisted" && cBl.message === "This bank is not accepted.",
			"Should classify 422 BANK_BLACKLISTED cleanly",
		);

		const rejectedErr = {
			response: {
				status: 409,
				data: {
					detail: "This account was not accepted earlier. Please use a different account.",
				},
			},
		};
		const cRej = classifyBankSelectError(rejectedErr);
		assert(
			cRej.kind === "rejected_earlier",
			`Expected rejected_earlier for 409 not accepted earlier, got '${cRej.kind}'`,
		);
	}
}

