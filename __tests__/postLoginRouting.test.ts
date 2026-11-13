/**
 * Unit test suite for blocked/rejected user post-login routing and /auth/me dashboard adaptation
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { STORAGE_KEYS } from "../utils/storage";
import {
	handleApplicationRejected,
	resetApplicationRejectionGuard,
	shouldShowFeeReceivedOnRejection,
} from "../utils/applicationRejection";
import {
	adaptAuthProfileToDashboard,
	resolvePostLoginRoute,
	resolvePostPermissionsRoute,
} from "../utils/postLoginRouting";

function assert(condition: boolean, message: string): void {
	if (!condition) {
		throw new Error(`Assertion failed: ${message}`);
	}
}

export async function runPostLoginRoutingTests(): Promise<void> {
	// 1. Blocked/rejected user with current_workflow=null MUST NOT fabricate basic_details / in_progress
	{
		const dash = adaptAuthProfileToDashboard({
			id: "user_1",
			phone_number: "9876543210",
			is_rejected: true,
			rejection_source: "bre",
			rejection_reason: "Policy rejected",
			can_reapply: false,
			can_reapply_at: "2026-12-20T00:00:00+05:30",
			current_workflow: null,
			active_loan: null,
			profile: { full_name: "Blocked User" },
		});

		assert(dash.is_rejected === true, "Top-level is_rejected must be preserved when current_workflow is null");
		assert(dash.workflow_progress.is_rejected === true, "workflow_progress.is_rejected must be true");
		assert(
			dash.workflow_progress.overall_status === "rejected",
			`Expected overall_status 'rejected', got '${dash.workflow_progress.overall_status}'`,
		);
		assert(
			dash.workflow_progress.current_step !== "basic_details",
			`Rejected user must NOT default current_step to 'basic_details', got '${dash.workflow_progress.current_step}'`,
		);
		assert(dash.can_reapply === false, "can_reapply=false must be preserved");
		assert(
			dash.can_reapply_at === "2026-12-20T00:00:00+05:30",
			"can_reapply_at must be preserved",
		);
	}

	// 2a. Returning user with no open workflow and no active loan (e.g. repaid / closed) -> completed / dashboard / 100%
	{
		const dash = adaptAuthProfileToDashboard({
			id: "user_repaid",
			phone_number: "9876543210",
			is_rejected: false,
			can_reapply: false,
			current_workflow: null,
			active_loan: null,
			profile: { full_name: "Repaid User" },
		});
		assert(
			dash.workflow_progress.overall_status === "completed",
			`Repaid/returning user with null workflow must return 'completed', got '${dash.workflow_progress.overall_status}'`,
		);
		assert(
			dash.workflow_progress.current_step === "dashboard",
			`Repaid/returning user with null workflow must return 'dashboard', got '${dash.workflow_progress.current_step}'`,
		);
		assert(
			dash.workflow_progress.completion_percentage === 100,
			`Repaid/returning user must return completion_percentage=100, got ${dash.workflow_progress.completion_percentage}`,
		);
		assert(dash.is_rejected === false, "Repaid user must not be marked rejected");

		const cooldownDash = adaptAuthProfileToDashboard({
			id: "user_repaid_cd",
			phone_number: "9876543211",
			is_rejected: false,
			can_reapply: false,
			can_reapply_at: "2026-12-25T00:00:00+05:30",
			current_workflow: null,
			active_loan: null,
		});
		assert(
			cooldownDash.can_reapply === false &&
				cooldownDash.can_reapply_at === "2026-12-25T00:00:00+05:30",
			"Cooldown date must be preserved when current_workflow is null",
		);
	}

	// 2b. Brand-new user gets an in_progress basic_details workflow created by /auth/me
	{
		const dash = adaptAuthProfileToDashboard({
			id: "user_new",
			phone_number: "9999999999",
			is_rejected: false,
			current_workflow: {
				current_step: "basic_details",
				overall_status: "in_progress",
				overall_percentage: 0,
			},
			active_loan: null,
			profile: null,
		});
		assert(dash.workflow_progress.overall_status === "in_progress", "New user should be in_progress");
		assert(dash.workflow_progress.current_step === "basic_details", "New user should start at basic_details");
		assert(dash.workflow_progress.completion_percentage === 0, "New user should start at 0%");
	}

	// 3. Blocked user login response with next_step='dashboard' and is_profile_completed=false goes to /(tabs)
	{
		const dest = resolvePostLoginRoute({
			is_new_user: false,
			is_profile_completed: false,
			next_step: "dashboard",
		});
		assert(dest === "/(tabs)", `Blocked/rejected returning user must land on /(tabs), got ${dest}`);
	}

	// 4. Returning mid-workflow user goes to /(tabs) Dashboard instead of jumping straight into workflow screen
	{
		const dest = resolvePostLoginRoute({
			is_new_user: false,
			is_profile_completed: true,
			next_step: "basic_details",
		});
		assert(dest === "/(tabs)", `Returning user should land on /(tabs) Dashboard after login, got ${dest}`);
	}

	// 5. Truly new user goes to /request-permissions
	{
		const dest = resolvePostLoginRoute(
			{
				is_new_user: true,
				is_profile_completed: false,
				next_step: "basic_details",
			},
			{ user_exists: false },
		);
		assert(dest === "/request-permissions", `New user should go to /request-permissions, got ${dest}`);
	}

	// 6. Post-permissions fallback must send rejected/blocked users to /(tabs), never /loan-application
	{
		const rejectedDash = adaptAuthProfileToDashboard({
			id: "user_1",
			phone_number: "9876543210",
			is_rejected: true,
			current_workflow: null,
		});
		const dest = resolvePostPermissionsRoute(
			{ is_profile_completed: false, next_step: "basic_details" },
			rejectedDash,
		);
		assert(dest === "/(tabs)", `Post-permissions route for rejected user must be /(tabs), got ${dest}`);

		const newDest = resolvePostPermissionsRoute(
			{ is_profile_completed: false, next_step: "basic_details" },
			adaptAuthProfileToDashboard({
				id: "u2",
				phone_number: "9111111111",
				current_workflow: {
					current_step: "basic_details",
					overall_status: "in_progress",
					overall_percentage: 0,
				},
			}),
		);
		assert(newDest === "/loan-application", `Post-permissions route for active new user should be /loan-application, got ${newDest}`);
	}

	// 7. handleApplicationRejected with skipNavigation=true sets flags + refreshes queries without navigating
	{
		await AsyncStorage.clear();
		resetApplicationRejectionGuard();
		const replaceCalls: string[] = [];
		const cancelledKeys: any[] = [];
		const invalidatedKeys: any[] = [];
		const mockRouter = { replace: (route: string) => replaceCalls.push(route) };
		const mockQueryClient = {
			cancelQueries: (opts: any) => cancelledKeys.push(opts?.queryKey),
			invalidateQueries: (opts: any) => invalidatedKeys.push(opts?.queryKey),
		} as any;

		await handleApplicationRejected({
			router: mockRouter,
			queryClient: mockQueryClient,
			source: "global_403",
			skipNavigation: true,
		});

		assert(replaceCalls.length === 0, `Expected no navigation when skipNavigation=true, got ${JSON.stringify(replaceCalls)}`);
		assert(
			(await AsyncStorage.getItem(STORAGE_KEYS["@loan-rejected-flag"])) === "true",
			"@loan-rejected-flag must still be set when skipNavigation=true",
		);
		assert(
			(await AsyncStorage.getItem(STORAGE_KEYS["@no-approved-amount-flag"])) === "true",
			"@no-approved-amount-flag must still be set when skipNavigation=true",
		);
		assert(cancelledKeys.length === 3, `Expected 3 cancelled query groups, got ${cancelledKeys.length}`);
		assert(invalidatedKeys.length === 3, `Expected 3 invalidated query groups, got ${invalidatedKeys.length}`);
	}

	// 8. handleApplicationRejected without skipNavigation navigates to /no-approved-amount
	{
		await AsyncStorage.clear();
		resetApplicationRejectionGuard();
		const replaceCalls: string[] = [];
		const mockRouter = { replace: (route: string) => replaceCalls.push(route) };

		await handleApplicationRejected({
			router: mockRouter,
			source: "mid_workflow",
		});

		assert(
			replaceCalls.length === 1 && replaceCalls[0] === "/no-approved-amount",
			`Expected navigation to /no-approved-amount, got ${JSON.stringify(replaceCalls)}`,
		);
	}

	// 9. Payment-received reassurance card only shows on rejection when fee txn exists and af is not waived ("no")
	{
		assert(
			shouldShowFeeReceivedOnRejection({ latestFeeTxnId: "txn_123", afFlag: "yes" }) === true,
			"Fee received card should appear when latestFeeTxnId exists and af is yes",
		);
		assert(
			shouldShowFeeReceivedOnRejection({ latestFeeTxnId: null, afFlag: "yes" }) === false,
			"Fee received card must be hidden when no fee transaction was recorded (e.g. instant reapply rejection)",
		);
		assert(
			shouldShowFeeReceivedOnRejection({ latestFeeTxnId: "txn_123", afFlag: "no" }) === false,
			"Fee received card must be hidden when assessment fee is waived (af='no')",
		);
	}
}

