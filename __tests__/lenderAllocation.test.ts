/**
 * Unit test suite for Lender Allocation Adapter (triggerPostKycAllocationAdapter).
 *
 * Verifies that:
 * (a) when /auth/me has an allocated lender, triggerPostKycAllocationAdapter returns it
 *     and makes NO request to lender-allocations/allocate-for-user.
 * (b) when /auth/me has none, it returns null and makes NO request to allocate-for-user.
 * (c) when /auth/me fails, it returns null and does NOT throw.
 * (d) shouldClientTriggerAllocation is false.
 */

import { axios } from "../utils/api/core/client";
import {
	triggerPostKycAllocationAdapter,
	shouldClientTriggerAllocation,
} from "../utils/api/services/lender.service";

function assert(condition: boolean, message: string): void {
	if (!condition) {
		throw new Error(`Assertion failed: ${message}`);
	}
}

export async function runLenderAllocationTests(): Promise<void> {
	const originalGet = axios.get;
	const originalPost = axios.post;

	// (d) shouldClientTriggerAllocation must be false
	{
		assert(
			shouldClientTriggerAllocation === false,
			`Expected shouldClientTriggerAllocation to be false, got: ${shouldClientTriggerAllocation}`
		);
	}

	// (a) when /auth/me has an allocated lender it returns it and makes no request to lender-allocations/allocate-for-user
	{
		let postCalledWithAllocateRoute = false;
		axios.post = (async (url: string, ...args: any[]) => {
			if (typeof url === "string" && url.includes("allocate-for-user")) {
				postCalledWithAllocateRoute = true;
			}
			return { data: {} };
		}) as any;

		axios.get = (async (url: string) => {
			if (url.includes("auth/me")) {
				return {
					data: {
						status: "success",
						data: {
							id: "user_test_123",
							current_workflow: {
								profile_response: {
									allocated_lender_id: "lender_abc_999",
									lender_name: "Fintech NBFC Partners",
									lender_allocated: true,
								},
							},
						},
					},
				};
			}
			return { data: {} };
		}) as any;

		try {
			const res = await triggerPostKycAllocationAdapter();
			assert(res !== null, "Expected allocation result, got null");
			assert(
				res?.allocated_lender_id === "lender_abc_999",
				`Expected allocated_lender_id 'lender_abc_999', got: ${res?.allocated_lender_id}`
			);
			assert(
				res?.lender_name === "Fintech NBFC Partners",
				`Expected lender_name 'Fintech NBFC Partners', got: ${res?.lender_name}`
			);
			assert(
				!postCalledWithAllocateRoute,
				"Must NEVER call lender-allocations/allocate-for-user when resolving allocated lender"
			);
		} finally {
			axios.get = originalGet;
			axios.post = originalPost;
		}
	}

	// (b) when /auth/me has none it returns null and makes no request to allocate-for-user
	{
		let postCalledWithAllocateRoute = false;
		axios.post = (async (url: string, ...args: any[]) => {
			if (typeof url === "string" && url.includes("allocate-for-user")) {
				postCalledWithAllocateRoute = true;
			}
			return { data: {} };
		}) as any;

		axios.get = (async (url: string) => {
			if (url.includes("auth/me")) {
				return {
					data: {
						status: "success",
						data: {
							id: "user_test_123",
							current_workflow: {
								profile_response: null,
							},
						},
					},
				};
			}
			return { data: {} };
		}) as any;

		try {
			const res = await triggerPostKycAllocationAdapter();
			assert(res === null, `Expected null when no lender allocated, got: ${JSON.stringify(res)}`);
			assert(
				!postCalledWithAllocateRoute,
				"Must NEVER call lender-allocations/allocate-for-user when /auth/me has no allocation"
			);
		} finally {
			axios.get = originalGet;
			axios.post = originalPost;
		}
	}

	// (c) when /auth/me fails it returns null and does not throw
	{
		let postCalledWithAllocateRoute = false;
		axios.post = (async (url: string, ...args: any[]) => {
			if (typeof url === "string" && url.includes("allocate-for-user")) {
				postCalledWithAllocateRoute = true;
			}
			return { data: {} };
		}) as any;

		axios.get = (async (url: string) => {
			if (url.includes("auth/me")) {
				throw new Error("Network / 500 error from /auth/me");
			}
			return { data: {} };
		}) as any;

		try {
			let errorThrown = false;
			let res: any = undefined;
			try {
				res = await triggerPostKycAllocationAdapter();
			} catch (e) {
				errorThrown = true;
			}
			assert(!errorThrown, "triggerPostKycAllocationAdapter must NEVER throw on failure");
			assert(res === null, `Expected null on failure, got: ${res}`);
			assert(
				!postCalledWithAllocateRoute,
				"Must NEVER call lender-allocations/allocate-for-user on /auth/me failure"
			);
		} finally {
			axios.get = originalGet;
			axios.post = originalPost;
		}
	}
}

