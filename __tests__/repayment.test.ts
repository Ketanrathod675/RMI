/**
 * Unit test suite for Repayment flow utilities & logic
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
	classify,
	invalidatePostRepaymentQueries,
	REPAYMENT_WINDOW_MS,
	REPAYMENT_POLL_INTERVAL_MS,
} from "../utils/paymentVerification";
import { formatRupees, parseDueDateInfo } from "../utils/repaymentFormatting";
import { clearIdempotencyKey, getIdempotencyEntry } from "../utils/idempotency";
import {
	classifyRepaymentInitiate409,
	clearStoredRepaymentKeys,
	getOrCreateRepaymentIdempotencyKey,
	initiateRepaymentWithConflictRetry,
	interpretRepaymentInitiateResponse,
	saveRepaymentKeyExpiry,
} from "../utils/repaymentIdempotency";
import { STORAGE_KEYS } from "../utils/storage";

function assert(condition: boolean, message: string): void {
	if (!condition) {
		throw new Error(`Assertion failed: ${message}`);
	}
}

export async function runRepaymentTests(): Promise<void> {
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

	// 5. Repayment idempotency lifecycle & 409 handling
	{
		await AsyncStorage.clear();

		// Legacy plain-string key migration: treated as expired and deleted
		await AsyncStorage.setItem(STORAGE_KEYS["@repayment-idempotency-key"], "legacy-plain-uuid");
		const key1 = await getOrCreateRepaymentIdempotencyKey(12000);
		assert(key1 !== "legacy-plain-uuid", "Legacy plain-string key must be discarded");
		assert(
			(await AsyncStorage.getItem(STORAGE_KEYS["@repayment-idempotency-key"])) === null,
			"Legacy @repayment-idempotency-key must be deleted on migration",
		);

		// Same amount reuses key
		const keySame = await getOrCreateRepaymentIdempotencyKey(12000);
		assert(keySame === key1, "Same repayment amount must reuse stored idempotency key");

		// Amount change (partial payment) rotates key
		const keyPartial = await getOrCreateRepaymentIdempotencyKey(6000);
		assert(keyPartial !== key1, "Changing repayment amount must rotate idempotency key");

		// Expired expires_at discards & rotates key
		await saveRepaymentKeyExpiry(new Date(Date.now() - 10_000).toISOString(), 6000);
		const expiredEntry = await getIdempotencyEntry("repayment");
		assert(expiredEntry === null, "Expired repayment key must be discarded");
		const keyAfterExpiry = await getOrCreateRepaymentIdempotencyKey(6000);
		assert(keyAfterExpiry !== keyPartial, "Expired repayment key must rotate");

		// 409 "Idempotency key conflict." triggers ONE automatic retry with a NEW key
		await clearIdempotencyKey("repayment");
		const seenKeys: string[] = [];
		const conflictRes = await initiateRepaymentWithConflictRetry({
			amount: 5000,
			initiateFn: async (key) => {
				seenKeys.push(key);
				if (seenKeys.length === 1) {
					const err: any = new Error("Conflict");
					err.response = { status: 409, data: { detail: "Idempotency key conflict." } };
					throw err;
				}
				return { txnid: "REPAY_RETRY_OK", amount: 5000, payment_url: "https://example.com/pay" };
			},
		});
		assert(seenKeys.length === 2, "409 conflict must retry exactly once");
		assert(seenKeys[0] !== seenKeys[1], "409 conflict retry must use a fresh idempotency key");
		assert(conflictRes.txnid === "REPAY_RETRY_OK", "Should return successful retry response");

		// 409 "Link expired or inactive." triggers ONE retry and fails normally if retry fails again
		await clearIdempotencyKey("repayment");
		let expiredRetryCount = 0;
		let caughtSecondFailure = false;
		try {
			await initiateRepaymentWithConflictRetry({
				amount: 5000,
				initiateFn: async () => {
					expiredRetryCount += 1;
					const err: any = new Error("Expired");
					err.response = { status: 409, data: { detail: "Link expired or inactive." } };
					throw err;
				},
			});
		} catch (e: any) {
			caughtSecondFailure = e?.response?.status === 409;
		}
		assert(expiredRetryCount === 2, "Should retry at most ONCE after Link expired or inactive");
		assert(caughtSecondFailure === true, "Second 409 failure should propagate for error toast");

		// 409 in-progress classifies for routing to /repayment-status (NOT conflict retry)
		const inProgressErr = {
			response: {
				status: 409,
				data: { detail: "An active repayment payment is already in progress." },
			},
		};
		assert(
			classifyRepaymentInitiate409(inProgressErr) === "in_progress",
			"409 in-progress must classify as 'in_progress' to route to status",
		);

		const bankPendingErr = {
			response: {
				status: 409,
				data: {
					detail: "A previous payment attempt is currently pending bank confirmation. Please verify its status first.",
				},
			},
		};
		assert(
			classifyRepaymentInitiate409(bankPendingErr) === "in_progress",
			"409 gateway bank confirmation must classify as 'in_progress'",
		);

		const stale409Err = {
			response: {
				status: 409,
				data: { detail: "Previous link row could not be reused." },
			},
		};
		assert(
			classifyRepaymentInitiate409(stale409Err) === "conflict_retry",
			"Non-in-flight 409 must classify as 'conflict_retry' so app retries cleanly once",
		);
	}

	// 6. Initiate response interpretation (already_paid / resumed / open_url / invalid)
	{
		const alreadyPaid = interpretRepaymentInitiateResponse({
			success: true,
			status: "SUCCESS",
			already_paid: true,
			txnid: "TXN_ALREADY_1",
			amount: 0,
		});
		assert(
			alreadyPaid.kind === "already_paid" && alreadyPaid.txnid === "TXN_ALREADY_1",
			"already_paid without payment_url must resolve as 'already_paid'",
		);

		const successStatusOnly = interpretRepaymentInitiateResponse({
			status: "SUCCESS",
			txnid: "TXN_SUCCESS_2",
			amount: 0,
		});
		assert(
			successStatusOnly.kind === "already_paid" && successStatusOnly.txnid === "TXN_SUCCESS_2",
			"status==='SUCCESS' without payment_url must resolve as 'already_paid'",
		);

		const resumed = interpretRepaymentInitiateResponse({
			txnid: "TXN_RESUMED_1",
			amount: 3080,
			payment_url: "https://pay.easebuzz.in/pay/abc",
			resumed: true,
		});
		assert(
			resumed.kind === "open_url" &&
				resumed.resumed === true &&
				resumed.txnid === "TXN_RESUMED_1" &&
				resumed.paymentUrl === "https://pay.easebuzz.in/pay/abc",
			"resumed=true response must resolve to 'open_url' with resumed=true",
		);

		const wrappedMock = interpretRepaymentInitiateResponse({
			status: "success",
			data: {
				txnid: "TXN_WRAPPED",
				amount: 3080,
				payment_url: "https://pay.easebuzz.in/pay/xyz",
			},
		});
		assert(
			wrappedMock.kind === "open_url" && wrappedMock.txnid === "TXN_WRAPPED",
			"Wrapped data shape should still resolve cleanly",
		);

		const invalidMissing = interpretRepaymentInitiateResponse({
			txnid: "TXN_BAD",
			payment_url: "http://insecure.example.com",
		});
		assert(invalidMissing.kind === "invalid", "Non-HTTPS payment_url must classify as 'invalid'");

		// clearStoredRepaymentKeys wipes all repayment storage entries + idempotency key
		await AsyncStorage.setItem(STORAGE_KEYS["@repayment-txnid"], "TXN_1");
		await AsyncStorage.setItem(STORAGE_KEYS["@repayment-timestamp"], "123");
		await AsyncStorage.setItem(STORAGE_KEYS["@repayment-amount-before"], "5000");
		await getOrCreateRepaymentIdempotencyKey(5000);
		await clearStoredRepaymentKeys();
		assert((await AsyncStorage.getItem(STORAGE_KEYS["@repayment-txnid"])) === null, "@repayment-txnid must be cleared");
		assert((await AsyncStorage.getItem(STORAGE_KEYS["@repayment-timestamp"])) === null, "@repayment-timestamp must be cleared");
		assert((await AsyncStorage.getItem(STORAGE_KEYS["@repayment-amount-before"])) === null, "@repayment-amount-before must be cleared");
		assert((await getIdempotencyEntry("repayment")) === null, "repayment idempotency entry must be cleared");
	}

	// 7. Post-repayment query invalidation refreshes dashboard & loan caches
	{
		const invalidatedKeys: string[] = [];
		const mockQc = {
			invalidateQueries: async (filters: { queryKey: readonly unknown[] }) => {
				invalidatedKeys.push(JSON.stringify(filters.queryKey));
			},
		};
		await invalidatePostRepaymentQueries(mockQc);
		for (const expectedKey of [
			["user", "dashboard"],
			["userDashboard"],
			["loanHistory", "active"],
			["allLoans"],
		]) {
			assert(
				invalidatedKeys.includes(JSON.stringify(expectedKey)),
				`Expected invalidatePostRepaymentQueries to invalidate ${JSON.stringify(expectedKey)}`,
			);
		}
	}

	console.log("All Repayment Unit Tests Passed!");
}

if (typeof process !== "undefined" && process.env?.NODE_ENV === "test") {
	runRepaymentTests().catch((err) => {
		console.error(err);
		process.exit(1);
	});
}
