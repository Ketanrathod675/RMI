import type { DueDateInfo } from "./repaymentFormatting";

export type RepaymentCardVariant = "active" | "overdue" | "pending" | "rfd";

const RFD_STATUS_VALUES = new Set([
	"ready_for_disbursement",
	"rfd",
	"disbursement_in_progress",
	"disbursal_in_progress",
	"disbursement_pending",
	"sanction_letter_accepted",
	"sanction_letter_signed",
	"autodebit_enabled",
]);

export interface RepaymentCardTheme {
	variant: RepaymentCardVariant;
	headerLabelKey:
		| "amountDueTitle"
		| "paymentInProgressTitle"
		| "disbursalInProgressTitle";
	headerLabelFallback:
		| "AMOUNT DUE"
		| "PAYMENT IN PROGRESS"
		| "DISBURSAL IN PROGRESS";
	dotColor: string;
	chip: {
		bg: string;
		border: string;
		text: string;
		labelKey: "activeChip" | "overdueChip" | "inProgressChip";
		label: "ACTIVE" | "OVERDUE" | "IN PROGRESS";
	};
	dueRow: {
		bg: string;
		border: string;
		labelColor: string;
		valueColor: string;
		icon: string;
		isHighlighted: boolean;
	};
}

const REPAYMENT_CARD_THEMES: Record<RepaymentCardVariant, RepaymentCardTheme> = {
	active: {
		variant: "active",
		headerLabelKey: "amountDueTitle",
		headerLabelFallback: "AMOUNT DUE",
		dotColor: "#10B981",
		chip: {
			bg: "#ECFDF5",
			border: "#A7F3D0",
			text: "#047857",
			labelKey: "activeChip",
			label: "ACTIVE",
		},
		dueRow: {
			bg: "transparent",
			border: "transparent",
			labelColor: "#525252",
			valueColor: "#171717",
			icon: "⏰",
			isHighlighted: false,
		},
	},
	overdue: {
		variant: "overdue",
		headerLabelKey: "amountDueTitle",
		headerLabelFallback: "AMOUNT DUE",
		dotColor: "#F43F5E",
		chip: {
			bg: "#FFF1F2",
			border: "#FDA4AF",
			text: "#BE123C",
			labelKey: "overdueChip",
			label: "OVERDUE",
		},
		dueRow: {
			bg: "#FFF1F2",
			border: "#FECDD3",
			labelColor: "#9F1239",
			valueColor: "#BE123C",
			icon: "⚠️",
			isHighlighted: true,
		},
	},
	pending: {
		variant: "pending",
		headerLabelKey: "paymentInProgressTitle",
		headerLabelFallback: "PAYMENT IN PROGRESS",
		dotColor: "#F59E0B",
		chip: {
			bg: "#FFFBEB",
			border: "#FDE68A",
			text: "#B45309",
			labelKey: "inProgressChip",
			label: "IN PROGRESS",
		},
		dueRow: {
			bg: "transparent",
			border: "transparent",
			labelColor: "#525252",
			valueColor: "#171717",
			icon: "⏰",
			isHighlighted: false,
		},
	},
	rfd: {
		variant: "rfd",
		headerLabelKey: "disbursalInProgressTitle",
		headerLabelFallback: "DISBURSAL IN PROGRESS",
		dotColor: "#F59E0B",
		chip: {
			bg: "#FFFBEB",
			border: "#FDE68A",
			text: "#B45309",
			labelKey: "inProgressChip",
			label: "IN PROGRESS",
		},
		dueRow: {
			bg: "transparent",
			border: "transparent",
			labelColor: "#525252",
			valueColor: "#171717",
			icon: "⏳",
			isHighlighted: false,
		},
	},
};

export function isRfdDisbursalLoan(params: {
	state?: string | null;
	loanStatus?: string | null;
	canPay?: boolean | null;
	disbursementDate?: string | null;
}): boolean {
	const normalizedState = String(params.state || "").toLowerCase().trim();
	if (normalizedState === "pending_payment") {
		return false;
	}
	const normalizedStatus = String(params.loanStatus || "").toLowerCase().trim();
	if (RFD_STATUS_VALUES.has(normalizedState) || RFD_STATUS_VALUES.has(normalizedStatus)) {
		return params.canPay !== true;
	}
	const hasDisbursementDate = Boolean(String(params.disbursementDate || "").trim());
	return params.canPay === false && !hasDisbursementDate;
}

/**
 * Resolves the visual variant, palette, chip text, and due-row styling for
 * Dashboard RepaymentHeaderCard from the active loan's state and parsed due date.
 */
export function getRepaymentCardTheme(params: {
	state?: string | null;
	dueInfo?: Pick<DueDateInfo, "isOverdue"> | null;
	isOverdue?: boolean | null;
	overdueAmount?: number | string | null;
	canPay?: boolean | null;
	disbursementDate?: string | null;
	loanStatus?: string | null;
}): RepaymentCardTheme {
	const normalizedState = String(params.state || "due").toLowerCase().trim();
	const hasExplicitOverdue =
		Boolean(params.isOverdue) || Number(params.overdueAmount ?? 0) > 0;

	if (normalizedState === "pending_payment") {
		if (hasExplicitOverdue) {
			return {
				...REPAYMENT_CARD_THEMES.overdue,
				headerLabelKey: "paymentInProgressTitle",
				headerLabelFallback: "PAYMENT IN PROGRESS",
			};
		}
		return REPAYMENT_CARD_THEMES.pending;
	}

	if (
		isRfdDisbursalLoan({
			state: normalizedState,
			loanStatus: params.loanStatus,
			canPay: params.canPay,
			disbursementDate: params.disbursementDate,
		})
	) {
		return REPAYMENT_CARD_THEMES.rfd;
	}

	const isOverdue =
		normalizedState === "overdue" ||
		hasExplicitOverdue ||
		(normalizedState === "due" && Boolean(params.dueInfo?.isOverdue));

	if (isOverdue) {
		return REPAYMENT_CARD_THEMES.overdue;
	}

	return REPAYMENT_CARD_THEMES.active;
}

