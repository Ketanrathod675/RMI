/**
 * Unit test suite for Prompt 7 loan reapplication flow (utils/reapply.ts)
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { STORAGE_KEYS } from "../utils/storage";
import {
	executeLoanReapply,
	formatReapplyAvailableDate,
	isFutureCooldownDate,
} from "../utils/reapply";

function assert(condition: boolean, message: string): void {
	if (!condition) {
		throw new Error(`Assertion failed: ${message}`);
	}
}

function createMockRouter() {
	const calls: { method: string; arg: any }[] = [];
	return {
		calls,
		push: (arg: any) => calls.push({ method: "push", arg }),
		replace: (arg: any) => calls.push({ method: "replace", arg }),
	};
}

function createMockQueryClient() {
	const invalidated: any[] = [];
	return {
		invalidated,
		invalidateQueries: async (opts: any) => {
			invalidated.push(opts?.queryKey);
		},
		cancelQueries: async () => {},
	};
}

async function seedOldApplicationAndAuthKeys(): Promise<void> {
	await AsyncStorage.clear();
	await AsyncStorage.multiSet([
		[STORAGE_KEYS["@lead-id"], "old_lead_999"],
		[STORAGE_KEYS["@assessment-fee"], "499"],
		[STORAGE_KEYS["@assessment-fee-amount"], "499"],
		[STORAGE_KEYS["@af-flag"], "yes"],
		[STORAGE_KEYS["@transaction-id"], "old_txn_123"],
		[STORAGE_KEYS["@latest-assessment-fee-txnid"], "old_txn_123"],
		[STORAGE_KEYS["@payment-timer-start"], "1700000000"],
		[STORAGE_KEYS["@assessment-timer-id"], "timer_old"],
		[STORAGE_KEYS["@completed-journey-steps"], JSON.stringify(["assessment_fee"])],
		[STORAGE_KEYS["@idem:assessment-fee"], JSON.stringify({ key: "old-idem-uuid", fingerprint: "old_lead_999|", createdAt: Date.now() })],
		[STORAGE_KEYS["@loan-rejected-flag"], "true"],
		[STORAGE_KEYS["@no-approved-amount-flag"], "true"],
		// Protected user/device keys that MUST survive reapply
		[STORAGE_KEYS["@access-token"], "jwt_access_token"],
		[STORAGE_KEYS["@refresh-token"], "jwt_refresh_token"],
		[STORAGE_KEYS["@phone-number"], "9876543210"],
		[STORAGE_KEYS["@set-language"], "english"],
		[STORAGE_KEYS["@is-mpin-set"], "true"],
		[STORAGE_KEYS["@otp-lock"], JSON.stringify({ until: Date.now() + 60000, phone: "abc" })],
	]);
}

export async function runReapplyTests(): Promise<void> {
	// 1. Happy path: stores new lead_id, clears stale fee keys, keeps auth/phone/language/mpin/otp-lock, routes via replace
	{
		await seedOldApplicationAndAuthKeys();
		const router = createMockRouter();
		const queryClient = createMockQueryClient();
		let reduxCleared = false;
		let rejectionResetCalled = false;

		const ok = await executeLoanReapply(router, queryClient, undefined, {
			checkCanReapply: async () => ({
				can_apply: true,
				reason: "eligible",
				message: "",
				starting_step: "assessment_fee",
				processing_fee_required: true,
				processing_fee_valid_days: 0,
				previous_applications_count: 1,
				reusable_data: { personal_details: true, ckyc_verified: true, employment_details: true, address_details: true },
				rejection_count: 0,
				can_reapply_at: null,
			}),
			reapplyForLoan: async () => ({
				success: true,
				workflow_id: "wf_new_2",
				current_step: "assessment_fee",
				next_step: "professional_details",
				lead_id: "new_lead_2026",
				message: "Reapplication started",
			}),
			getWorkflowProgress: async () => ({
				success: true,
				message: "ok",
				data: {
					workflow_id: "wf_new_2",
					lead_id: "new_lead_2026",
					current_step: "assessment_fee",
					overall_status: "in_progress",
					is_rejected: false,
				},
			}),
			resetApplicationRejectionGuard: () => {
				rejectionResetCalled = true;
			},
			clearTransactionId: () => {
				reduxCleared = true;
			},
		});

		assert(ok === true, "Happy reapply should return true");
		assert(rejectionResetCalled, "Rejection guard must be reset");
		assert(reduxCleared, "Redux transaction id must be cleared");

		const newLead = await AsyncStorage.getItem(STORAGE_KEYS["@lead-id"]);
		assert(newLead === "new_lead_2026", `New lead id must be saved, got ${newLead}`);

		for (const staleKey of [
			STORAGE_KEYS["@assessment-fee"],
			STORAGE_KEYS["@assessment-fee-amount"],
			STORAGE_KEYS["@af-flag"],
			STORAGE_KEYS["@transaction-id"],
			STORAGE_KEYS["@latest-assessment-fee-txnid"],
			STORAGE_KEYS["@payment-timer-start"],
			STORAGE_KEYS["@assessment-timer-id"],
			STORAGE_KEYS["@completed-journey-steps"],
			STORAGE_KEYS["@idem:assessment-fee"],
			STORAGE_KEYS["@loan-rejected-flag"],
			STORAGE_KEYS["@no-approved-amount-flag"],
		]) {
			const val = await AsyncStorage.getItem(staleKey);
			assert(val === null, `Stale application key ${staleKey} must be cleared, got ${val}`);
		}

		for (const keepKey of [
			STORAGE_KEYS["@access-token"],
			STORAGE_KEYS["@refresh-token"],
			STORAGE_KEYS["@phone-number"],
			STORAGE_KEYS["@set-language"],
			STORAGE_KEYS["@is-mpin-set"],
			STORAGE_KEYS["@otp-lock"],
		]) {
			const val = await AsyncStorage.getItem(keepKey);
			assert(val !== null, `Protected key ${keepKey} must NOT be cleared during reapply`);
		}

		assert(router.calls.length === 1 && router.calls[0].method === "replace", "Must navigate via router.replace");
		assert(router.calls[0].arg?.pathname === "/new-assessment-fee", "Should route to /new-assessment-fee");
		assert(router.calls[0].arg?.params?.fromReapply === "true", "Should pass fromReapply=true");
		assert(router.calls[0].arg?.params?.lead_id === "new_lead_2026", "Should pass new lead_id param");
	}

	// 2. Missing lead_id in reapply response removes stale @lead-id so resolveLeadId can recover from /auth/me
	{
		await seedOldApplicationAndAuthKeys();
		const router = createMockRouter();
		const queryClient = createMockQueryClient();
		const ok = await executeLoanReapply(router, queryClient, undefined, {
			checkCanReapply: async () => ({
				can_apply: true,
				reason: "eligible",
				message: "",
				starting_step: "assessment_fee",
				processing_fee_required: true,
				processing_fee_valid_days: 0,
				previous_applications_count: 1,
				reusable_data: { personal_details: false, ckyc_verified: false, employment_details: false, address_details: false },
				rejection_count: 0,
			}),
			reapplyForLoan: async () => ({
				success: true,
				workflow_id: "wf_no_lead",
				current_step: "assessment_fee",
			}),
			getWorkflowProgress: async () => ({
				success: true,
				message: "ok",
				data: { current_step: "assessment_fee", overall_status: "in_progress", is_rejected: false },
			}),
		});
		assert(ok === true, "Reapply without lead_id in body should succeed");
		assert((await AsyncStorage.getItem(STORAGE_KEYS["@lead-id"])) === null, "Old @lead-id must be removed when response omits lead_id");
	}

	// 3. Instant BRE rejection after reapplyForLoan routes to rejection handling, NEVER fee page
	{
		await seedOldApplicationAndAuthKeys();
		const router = createMockRouter();
		const queryClient = createMockQueryClient();
		let rejectedHandlerCalls = 0;

		const ok = await executeLoanReapply(router, queryClient, undefined, {
			checkCanReapply: async () => ({
				can_apply: true,
				reason: "eligible",
				message: "",
				starting_step: "assessment_fee",
				processing_fee_required: true,
				processing_fee_valid_days: 0,
				previous_applications_count: 1,
				reusable_data: { personal_details: false, ckyc_verified: false, employment_details: false, address_details: false },
				rejection_count: 0,
			}),
			reapplyForLoan: async () => ({
				success: true,
				workflow_id: "wf_bre_rejected",
				current_step: "assessment_fee",
				lead_id: "lead_bre_rej",
			}),
			getWorkflowProgress: async () => ({
				success: true,
				message: "ok",
				data: {
					workflow_id: "wf_bre_rejected",
					current_step: "assessment_fee",
					overall_status: "rejected",
					is_rejected: true,
					bre_status: "rejected",
				},
			}),
			handleApplicationRejected: async (opts: any) => {
				rejectedHandlerCalls++;
				opts?.router?.replace("/no-approved-amount");
			},
		});

		assert(ok === false, "Instant BRE rejection should return false");
		assert(rejectedHandlerCalls === 1, "handleApplicationRejected must be invoked on instant BRE rejection");
		const routedToFee = router.calls.some((c) => String(c.arg?.pathname || c.arg).includes("assessment-fee"));
		assert(!routedToFee, "Instant BRE rejection must NOT navigate to assessment fee screen");
	}

	// 4. Cooldown 403 shows dated alert/popup without "30 days" or "cooldown"
	{
		await seedOldApplicationAndAuthKeys();
		const router = createMockRouter();
		const queryClient = createMockQueryClient();
		const alerts: { title: string; message: string }[] = [];

		const ok = await executeLoanReapply(router, queryClient, undefined, {
			checkCanReapply: async () => ({
				can_apply: true,
				reason: "eligible",
				message: "",
				starting_step: "assessment_fee",
				processing_fee_required: true,
				processing_fee_valid_days: 0,
				previous_applications_count: 1,
				reusable_data: { personal_details: false, ckyc_verified: false, employment_details: false, address_details: false },
				rejection_count: 0,
			}),
			reapplyForLoan: async () => {
				const err: any = new Error("Forbidden");
				err.response = {
					status: 403,
					data: {
						success: false,
						code: "REAPPLY_COOLDOWN_ACTIVE",
						message: "Cooldown 30 days active. You can apply again after 2026-12-12",
						can_reapply_at: "2026-12-12T10:30:00+05:30",
					},
				};
				throw err;
			},
			showAlert: (title, message) => alerts.push({ title, message }),
			showToast: () => {},
		});

		assert(ok === false, "Cooldown 403 should return false");
		assert(alerts.length === 1, `Expected 1 cooldown popup alert, got ${alerts.length}`);
		assert(alerts[0].title === "You can apply again soon", `Unexpected title: ${alerts[0].title}`);
		const expectedDate = formatReapplyAvailableDate("2026-12-12T10:30:00+05:30");
		assert(alerts[0].message.includes(expectedDate), `Message "${alerts[0].message}" should include date "${expectedDate}"`);
		assert(!/30\s*days|cooldown/i.test(`${alerts[0].title} ${alerts[0].message}`), "Popup copy must NOT mention '30 days' or 'cooldown'");
	}

	// 4c. Cooldown 403 nested under response.data.detail also works cleanly
	{
		const router = createMockRouter();
		const queryClient = createMockQueryClient();
		const alerts: { title: string; message: string }[] = [];
		const ok = await executeLoanReapply(router, queryClient, undefined, {
			checkCanReapply: async () => ({
				can_apply: true,
				reason: "eligible",
				message: "",
				starting_step: "assessment_fee",
				processing_fee_required: true,
				processing_fee_valid_days: 0,
				previous_applications_count: 1,
				reusable_data: { personal_details: false, ckyc_verified: false, employment_details: false, address_details: false },
				rejection_count: 0,
			}),
			reapplyForLoan: async () => {
				const err: any = new Error("Forbidden");
				err.response = {
					status: 403,
					data: {
						detail: {
							code: "REAPPLY_COOLDOWN_ACTIVE",
							message: "30 days cooldown",
							can_reapply_at: "2026-12-15T09:00:00+05:30",
						},
					},
				};
				throw err;
			},
			showAlert: (title, message) => alerts.push({ title, message }),
			showToast: () => {},
		});
		assert(ok === false, "Nested detail cooldown 403 should return false");
		assert(alerts.length === 1 && alerts[0].message.includes(formatReapplyAvailableDate("2026-12-15T09:00:00+05:30")), "Nested detail.can_reapply_at must render date");
		assert(!/30\s*days|cooldown/i.test(alerts[0].message), "Nested cooldown copy must not mention 30 days or cooldown");
	}

	// 4b. checkCanReapply returning can_apply: false with can_reapply_at also shows dated popup instead of generic toast
	{
		const router = createMockRouter();
		const queryClient = createMockQueryClient();
		const alerts: { title: string; message: string }[] = [];
		let toasts = 0;

		const ok = await executeLoanReapply(router, queryClient, undefined, {
			checkCanReapply: async () => ({
				can_apply: false,
				reason: "cooldown",
				message: "Wait 30 days cooldown",
				starting_step: "assessment_fee",
				processing_fee_required: true,
				processing_fee_valid_days: 12,
				previous_applications_count: 1,
				reusable_data: { personal_details: false, ckyc_verified: false, employment_details: false, address_details: false },
				rejection_count: 1,
				can_reapply_at: "2026-12-12T00:00:00+05:30",
			}),
			showAlert: (title, message) => alerts.push({ title, message }),
			showToast: () => {
				toasts++;
			},
		});

		assert(ok === false, "can_apply=false with date should return false");
		assert(alerts.length === 1 && toasts === 0, "Should show dated popup instead of toast");
		assert(!/30\s*days|cooldown/i.test(alerts[0].message), "Popup must not mention 30 days or cooldown");
	}

	// 5. HTTP 400 "already have an application in progress" is treated as success and routes to current step
	{
		await seedOldApplicationAndAuthKeys();
		const router = createMockRouter();
		const queryClient = createMockQueryClient();

		const ok = await executeLoanReapply(router, queryClient, undefined, {
			checkCanReapply: async () => ({
				can_apply: true,
				reason: "eligible",
				message: "",
				starting_step: "assessment_fee",
				processing_fee_required: true,
				processing_fee_valid_days: 0,
				previous_applications_count: 1,
				reusable_data: { personal_details: false, ckyc_verified: false, employment_details: false, address_details: false },
				rejection_count: 0,
			}),
			reapplyForLoan: async () => {
				const err: any = new Error("Bad Request");
				err.response = {
					status: 400,
					data: {
						detail: "You already have an application in progress.",
					},
				};
				throw err;
			},
			getWorkflowProgress: async () => ({
				success: true,
				message: "ok",
				data: {
					workflow_id: "wf_existing",
					lead_id: "existing_lead_777",
					current_step: "professional_details",
					overall_status: "in_progress",
					is_rejected: false,
				},
			}),
			getUserDashboardData: async () => ({
				workflow_progress: {
					current_step: "professional_details",
					overall_status: "in_progress",
				},
			} as any),
		});

		assert(ok === true, "400 'already have an application in progress' should be treated as success");
		assert(router.calls.length === 1 && router.calls[0].method === "replace", "Must replace route to current step");
		assert(router.calls[0].arg?.pathname === "/professional-details", `Expected /professional-details, got ${router.calls[0].arg?.pathname}`);
		assert((await AsyncStorage.getItem(STORAGE_KEYS["@lead-id"])) === "existing_lead_777", "Should persist active lead_id from workflow progress");
	}

	// 6. Double tap triggers a SINGLE API call via module-level in-flight guard
	{
		await seedOldApplicationAndAuthKeys();
		const router = createMockRouter();
		const queryClient = createMockQueryClient();
		let canReapplyCount = 0;
		let reapplyCount = 0;

		const deps = {
			checkCanReapply: async () => {
				canReapplyCount++;
				await new Promise((r) => setTimeout(r, 25));
				return {
					can_apply: true,
					reason: "eligible",
					message: "",
					starting_step: "assessment_fee",
					processing_fee_required: true,
					processing_fee_valid_days: 0,
					previous_applications_count: 1,
					reusable_data: { personal_details: false, ckyc_verified: false, employment_details: false, address_details: false },
					rejection_count: 0,
				};
			},
			reapplyForLoan: async () => {
				reapplyCount++;
				await new Promise((r) => setTimeout(r, 25));
				return {
					success: true,
					workflow_id: "wf_dbl",
					current_step: "assessment_fee",
					lead_id: "lead_dbl",
				};
			},
			getWorkflowProgress: async () => ({
				success: true,
				message: "ok",
				data: { current_step: "assessment_fee", overall_status: "in_progress", is_rejected: false },
			}),
		};

		const [r1, r2] = await Promise.all([
			executeLoanReapply(router, queryClient, undefined, deps),
			executeLoanReapply(router, queryClient, undefined, deps),
		]);

		assert(r1 === true && r2 === true, "Both coalesced double taps must resolve to true");
		assert(canReapplyCount === 1, `Expected 1 checkCanReapply call, got ${canReapplyCount}`);
		assert(reapplyCount === 1, `Expected 1 reapplyForLoan call, got ${reapplyCount}`);
		assert(router.calls.length === 1, `Expected 1 navigation call, got ${router.calls.length}`);
	}

	// 7. Helper sanity checks: future vs past can_reapply_at
	{
		const futureIso = new Date(Date.now() + 86_400_000).toISOString();
		const pastIso = new Date(Date.now() - 86_400_000).toISOString();
		assert(isFutureCooldownDate(futureIso) === true, "Future ISO should be detected as active cooldown date");
		assert(isFutureCooldownDate(pastIso) === false, "Past ISO should not be considered future");
		assert(isFutureCooldownDate(null) === false, "Null date should not be considered future");
	}
}
