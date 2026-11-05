import { formatINR, formatDate } from "./formatters";

/**
 * Repayment currency & calendar-date calculation utilities.
 */

export function formatRupees(amount: unknown): string {
	if (amount === null || amount === undefined || amount === "") return "₹ 0";
	return `₹ ${formatINR(amount)}`;
}

export interface DueDateInfo {
	formattedDate: string;
	daysDiff: number;
	relativeText: string;
	isOverdue: boolean;
	isToday: boolean;
}

export function parseDueDateInfo(dateStr?: string | null): DueDateInfo {
	if (!dateStr) {
		return {
			formattedDate: "-",
			daysDiff: 0,
			relativeText: "-",
			isOverdue: false,
			isToday: false,
		};
	}

	const target = new Date(dateStr);
	if (!Number.isFinite(target.getTime())) {
		return {
			formattedDate: String(dateStr),
			daysDiff: 0,
			relativeText: "",
			isOverdue: false,
			isToday: false,
		};
	}

	const formattedDate = formatDate(target);

	// Normalize to midnight local time for pure calendar day arithmetic
	const today = new Date();
	const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
	const targetMidnight = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();

	const msPerDay = 24 * 60 * 60 * 1000;
	const daysDiff = Math.round((targetMidnight - todayMidnight) / msPerDay);

	const isToday = daysDiff === 0;
	const isOverdue = daysDiff < 0;

	let relativeText = "";
	if (isToday) {
		relativeText = "Today";
	} else if (daysDiff === 1) {
		relativeText = "in 1 day";
	} else if (daysDiff > 1) {
		relativeText = `in ${daysDiff} days`;
	} else if (daysDiff === -1) {
		relativeText = "Overdue by 1 day";
	} else {
		relativeText = `Overdue by ${Math.abs(daysDiff)} days`;
	}

	return {
		formattedDate,
		daysDiff,
		relativeText,
		isOverdue,
		isToday,
	};
}

