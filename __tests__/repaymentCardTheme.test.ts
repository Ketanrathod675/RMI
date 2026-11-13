/**
 * Unit test suite for Dashboard Repayment Card theme selection & tokens.
 */

import { getRepaymentCardTheme, isRfdDisbursalLoan } from "../utils/repaymentCardTheme";
import type { DueDateInfo } from "../utils/repaymentFormatting";

function assert(condition: boolean, message: string): void {
	if (!condition) {
		throw new Error(`Assertion failed: ${message}`);
	}
}

const makeDueInfo = (overrides: Partial<DueDateInfo> = {}): DueDateInfo => ({
	formattedDate: "07 Nov 2026",
	daysDiff: 1,
	relativeText: "in 1 day",
	isOverdue: false,
	isToday: false,
	...overrides,
});

export async function runRepaymentCardThemeTests(): Promise<void> {
	// 1. Due in 1 day -> active variant
	{
		const theme = getRepaymentCardTheme({
			state: "due",
			dueInfo: makeDueInfo({ daysDiff: 1, relativeText: "in 1 day", isOverdue: false }),
		});
		assert(theme.variant === "active", `Expected 'active', got '${theme.variant}'`);
		assert(theme.dotColor === "#10B981", `Expected dotColor '#10B981', got '${theme.dotColor}'`);
		assert(theme.headerLabelKey === "amountDueTitle", `Expected 'amountDueTitle', got '${theme.headerLabelKey}'`);
		assert(
			theme.chip.bg === "#ECFDF5" &&
				theme.chip.border === "#A7F3D0" &&
				theme.chip.text === "#047857" &&
				theme.chip.label === "ACTIVE" &&
				theme.chip.labelKey === "activeChip",
			`Unexpected active chip: ${JSON.stringify(theme.chip)}`,
		);
		assert(
			theme.dueRow.isHighlighted === false &&
				theme.dueRow.labelColor === "#525252" &&
				theme.dueRow.valueColor === "#171717" &&
				theme.dueRow.icon === "⏰",
			`Unexpected active dueRow: ${JSON.stringify(theme.dueRow)}`,
		);
	}

	// 2. Explicit state: "overdue" -> overdue variant
	{
		const theme = getRepaymentCardTheme({
			state: "overdue",
			dueInfo: makeDueInfo({ daysDiff: -2, relativeText: "Overdue by 2 days", isOverdue: true }),
		});
		assert(theme.variant === "overdue", `Expected 'overdue', got '${theme.variant}'`);
		assert(theme.dotColor === "#F43F5E", `Expected dotColor '#F43F5E', got '${theme.dotColor}'`);
		assert(
			theme.headerLabelKey === "amountDueTitle",
			"Row 1 label stays AMOUNT DUE in overdue state",
		);
		assert(
			theme.chip.bg === "#FFF1F2" &&
				theme.chip.border === "#FDA4AF" &&
				theme.chip.text === "#BE123C" &&
				theme.chip.label === "OVERDUE" &&
				theme.chip.labelKey === "overdueChip",
			`Unexpected overdue chip: ${JSON.stringify(theme.chip)}`,
		);
		assert(
			theme.dueRow.isHighlighted === true &&
				theme.dueRow.bg === "#FFF1F2" &&
				theme.dueRow.border === "#FECDD3" &&
				theme.dueRow.labelColor === "#9F1239" &&
				theme.dueRow.valueColor === "#BE123C" &&
				theme.dueRow.icon === "⚠️",
			`Unexpected overdue dueRow: ${JSON.stringify(theme.dueRow)}`,
		);
	}

	// 3. state: "due" with past date (dueInfo.isOverdue: true) -> overdue variant
	{
		const theme = getRepaymentCardTheme({
			state: "due",
			dueInfo: makeDueInfo({ daysDiff: -2, relativeText: "Overdue by 2 days", isOverdue: true }),
		});
		assert(theme.variant === "overdue", `Expected 'overdue' for due+past date, got '${theme.variant}'`);
		assert(theme.dotColor === "#F43F5E", "Expected overdue dotColor");
		assert(theme.dueRow.isHighlighted === true && theme.dueRow.bg === "#FFF1F2", "Expected red dueRow");
	}

	// 4. state: "pending_payment" -> pending variant (even if date is past!)
	{
		const theme = getRepaymentCardTheme({
			state: "pending_payment",
			dueInfo: makeDueInfo({ daysDiff: -3, relativeText: "Overdue by 3 days", isOverdue: true }),
		});
		assert(theme.variant === "pending", `Expected 'pending', got '${theme.variant}'`);
		assert(theme.dotColor === "#F59E0B", `Expected dotColor '#F59E0B', got '${theme.dotColor}'`);
		assert(
			theme.headerLabelKey === "paymentInProgressTitle",
			`Expected 'paymentInProgressTitle', got '${theme.headerLabelKey}'`,
		);
		assert(
			theme.chip.bg === "#FFFBEB" &&
				theme.chip.border === "#FDE68A" &&
				theme.chip.text === "#B45309" &&
				theme.chip.label === "IN PROGRESS" &&
				theme.chip.labelKey === "inProgressChip",
			`Unexpected pending chip: ${JSON.stringify(theme.chip)}`,
		);
		assert(
			theme.dueRow.isHighlighted === false &&
				theme.dueRow.bg === "transparent" &&
				theme.dueRow.labelColor === "#525252" &&
				theme.dueRow.valueColor === "#171717" &&
				theme.dueRow.icon === "⏰",
			`Pending payment dueRow should stay normal: ${JSON.stringify(theme.dueRow)}`,
		);
	}

	// 5. Case-insensitivity & empty state fallback with past due date
	{
		const upperOverdue = getRepaymentCardTheme({
			state: "OVERDUE",
			dueInfo: makeDueInfo({ isOverdue: false }),
		});
		assert(upperOverdue.variant === "overdue", "Uppercase OVERDUE should resolve to overdue");

		const emptyOverdue = getRepaymentCardTheme({
			state: "",
			dueInfo: makeDueInfo({ isOverdue: true }),
		});
		assert(emptyOverdue.variant === "overdue", "Empty state with past date should fall back to due -> overdue");
	}

	// 6. Overdue loan with pending_payment keeps Overdue chip & red due-date row when isOverdue/overdueAmount is set
	{
		const pendingWithOverdueFlag = getRepaymentCardTheme({
			state: "pending_payment",
			dueInfo: makeDueInfo({ daysDiff: -2, relativeText: "Overdue by 2 days", isOverdue: true }),
			isOverdue: true,
		});
		assert(
			pendingWithOverdueFlag.variant === "overdue" &&
				pendingWithOverdueFlag.chip.label === "OVERDUE" &&
				pendingWithOverdueFlag.chip.bg === "#FFF1F2" &&
				pendingWithOverdueFlag.dueRow.bg === "#FFF1F2" &&
				pendingWithOverdueFlag.headerLabelKey === "paymentInProgressTitle",
			`Pending payment with isOverdue=true must show Overdue chip/dueRow while keeping PAYMENT IN PROGRESS header: ${JSON.stringify(pendingWithOverdueFlag)}`,
		);

		const pendingWithOverdueAmount = getRepaymentCardTheme({
			state: "pending_payment",
			dueInfo: makeDueInfo({ daysDiff: 1, relativeText: "in 1 day", isOverdue: false }),
			overdueAmount: 250,
		});
		assert(
			pendingWithOverdueAmount.variant === "overdue" &&
				pendingWithOverdueAmount.chip.label === "OVERDUE" &&
				pendingWithOverdueAmount.dueRow.isHighlighted === true,
			"Pending payment with overdueAmount > 0 must show Overdue chip/dueRow",
		);
	}

	// 7. RFD / pre-disbursal active loan (canPay=false and no disbursementDate) -> rfd variant
	{
		const rfdTheme = getRepaymentCardTheme({
			state: "due",
			dueInfo: makeDueInfo({ daysDiff: 0, relativeText: "", isOverdue: false }),
			canPay: false,
			disbursementDate: null,
		});
		assert(
			rfdTheme.variant === "rfd" &&
				rfdTheme.headerLabelKey === "disbursalInProgressTitle" &&
				rfdTheme.chip.label === "IN PROGRESS" &&
				rfdTheme.chip.bg === "#FFFBEB",
			`Pre-disbursal loan with canPay=false and null disbursementDate must resolve to 'rfd', got '${rfdTheme.variant}'`,
		);

		const explicitRfd = getRepaymentCardTheme({
			state: "due",
			loanStatus: "ready_for_disbursement",
			canPay: false,
			dueInfo: makeDueInfo(),
		});
		assert(explicitRfd.variant === "rfd", "Explicit ready_for_disbursement status must resolve to rfd");

		// Once disbursed (disbursementDate set) with canPay=false, it is NOT rfd
		const disbursedSchedulePreparing = getRepaymentCardTheme({
			state: "due",
			canPay: false,
			disbursementDate: "2026-11-12",
			dueInfo: makeDueInfo(),
		});
		assert(
			disbursedSchedulePreparing.variant === "active" &&
				!isRfdDisbursalLoan({
					state: "due",
					canPay: false,
					disbursementDate: "2026-11-12",
				}),
			"Disbursed loan with disbursementDate set and canPay=false must stay 'active'",
		);
	}
}

