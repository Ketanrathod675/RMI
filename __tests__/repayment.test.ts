/**
 * Unit test suite for Repayment flow utilities & logic
 */

import { classify, REPAYMENT_WINDOW_MS, REPAYMENT_POLL_INTERVAL_MS } from "../utils/paymentVerification";
import { formatRupees, parseDueDateInfo } from "../utils/repaymentFormatting";

function assert(condition: boolean, message: string): void {
	if (!condition) {
		throw new Error(`Assertion failed: ${message}`);
	}
}

export function runRepaymentTests(): void {
	console.log("Running Repayment Unit Tests...");

	// 1. Classification tests
	{
		assert(classify({ data: { status: "SUCCESS" } }).kind === "SUCCESS", "SUCCESS should classify as SUCCESS");
		assert(classify({ data: { status: "completed" } }).kind === "SUCCESS", "completed should classify as SUCCESS");
		assert(classify({ data: { status: "PAID" } }).kind === "SUCCESS", "PAID should classify as SUCCESS");
		assert(classify({ data: { status: "FAILED" } }).kind === "FAILED", "FAILED should classify as FAILED");
		assert(classify({ data: { status: "failure" } }).kind === "FAILED", "failure should classify as FAILED");
		assert(classify({ data: { status: "CANCELLED" } }).kind === "CANCELLED", "CANCELLED should classify as CANCELLED");
		assert(classify({ data: { status: "usercancelled" } }).kind === "CANCELLED", "usercancelled should classify as CANCELLED");
		assert(classify({ data: { status: "EXPIRED" } }).kind === "EXPIRED", "EXPIRED should classify as EXPIRED");

		const pendingNotStarted = classify({ data: { status: "PENDING", reason: "not_started" } });
		assert(pendingNotStarted.kind === "PENDING" && pendingNotStarted.notStarted === true, "PENDING not_started flagged properly");

		const pendingInProgress = classify({ data: { status: "PENDING", reason: "in_progress" } });
		assert(pendingInProgress.kind === "PENDING" && pendingInProgress.notStarted === false, "PENDING in_progress flagged properly");
	}

	// 2. formatRupees tests
	{
		assert(formatRupees(15000) === "₹ 15,000", `formatRupees(15000) should be ₹ 15,000, got ${formatRupees(15000)}`);
		assert(formatRupees(0) === "₹ 0", "formatRupees(0) should be ₹ 0");
		assert(formatRupees(1234567) === "₹ 12,34,567", `formatRupees Indian format check, got ${formatRupees(1234567)}`);
	}

	// 3. parseDueDateInfo tests
	{
		const now = new Date();
		const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
		const todayInfo = parseDueDateInfo(todayIso);
		assert(todayInfo.isToday === true, "Today ISO date should have isToday === true");
		assert(todayInfo.relativeText === "Today", "Today relative text should be 'Today'");

		const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
		const yestIso = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;
		const yestInfo = parseDueDateInfo(yestIso);
		assert(yestInfo.isOverdue === true, "Yesterday should be isOverdue === true");
		assert(yestInfo.relativeText === "Overdue by 1 day", "relativeText should be 'Overdue by 1 day'");

		const inThreeDays = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
		const threeDaysIso = `${inThreeDays.getFullYear()}-${String(inThreeDays.getMonth() + 1).padStart(2, "0")}-${String(inThreeDays.getDate()).padStart(2, "0")}`;
		const threeDaysInfo = parseDueDateInfo(threeDaysIso);
		assert(threeDaysInfo.daysDiff === 3, "3 days remaining calculated correctly");
		assert(threeDaysInfo.relativeText === "in 3 days", "relativeText should be 'in 3 days'");
	}

	// 4. Polling window constants
	{
		assert(REPAYMENT_WINDOW_MS.deeplink_success === 90_000, "deeplink_success window should be 90s");
		assert(REPAYMENT_WINDOW_MS.deeplink_failure === 8_000, "deeplink_failure window should be 8s");
		assert(REPAYMENT_WINDOW_MS.browser_closed === 10_000, "browser_closed window should be 10s");
		assert(REPAYMENT_WINDOW_MS.manual === 30_000, "manual window should be 30s");
		assert(REPAYMENT_POLL_INTERVAL_MS === 4_000, "Poll interval should be 4s");
	}

	console.log("All Repayment Unit Tests Passed!");
}

if (typeof process !== "undefined" && process.env?.NODE_ENV === "test") {
	runRepaymentTests();
}
