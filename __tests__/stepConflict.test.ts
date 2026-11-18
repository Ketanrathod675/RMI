/**
 * Unit test suite for KYC step conflict handling (utils/stepConflict.ts)
 */

import {
	handleStepConflict,
	resetStepConflictGuard,
	routeForStep,
} from "../utils/stepConflict";

function assert(condition: boolean, message: string): void {
	if (!condition) {
		throw new Error(`Assertion failed: ${message}`);
	}
}

function createMockRouter() {
	const replaceCalls: any[] = [];
	return {
		replaceCalls,
		replace: (route: any) => replaceCalls.push(route),
	};
}

export async function runStepConflictTests(): Promise<void> {
	// 1. routeForStep mapping
	{
		assert(
			routeForStep("digilocker") === "/digilocker-kyc",
			"digilocker should map to /digilocker-kyc",
		);

		const selfieRoute = routeForStep("selfie_match");
		assert(
			typeof selfieRoute === "object" &&
				selfieRoute.pathname === "/ckyc-instructions" &&
				selfieRoute.params?.startSelfie === "true",
			"selfie_match should map to /ckyc-instructions with startSelfie=true",
		);

		const addressRoute = routeForStep("address_submission");
		assert(
			typeof addressRoute === "object" &&
				addressRoute.pathname === "/aadhaar-kyc" &&
				addressRoute.params?.startFromAddress === "true",
			"address_submission should map to /aadhaar-kyc with startFromAddress=true",
		);

		assert(
			routeForStep(null) === "/(tabs)",
			"null should map to /(tabs)",
		);
		assert(
			routeForStep(undefined) === "/(tabs)",
			"undefined should map to /(tabs)",
		);
		assert(
			routeForStep("unknown_step_xyz") === "/(tabs)",
			"unknown step should map to /(tabs)",
		);
	}

	// 2. handleStepConflict: non-409 returns false and does not navigate
	{
		resetStepConflictGuard();
		const router = createMockRouter();
		let progressCalled: boolean = false;
		const handled = await handleStepConflict({
			router,
			error: { status: 400, message: "Bad Request" },
			getWorkflowProgressFn: async () => {
				progressCalled = true;
				return { data: { current_step: "digilocker" } };
			},
		});

		assert(!handled, "non-409 error must return false");
		assert(!progressCalled, "non-409 must not fetch workflow progress");
		assert(router.replaceCalls.length === 0, "non-409 must not navigate");
	}

	// 3. handleStepConflict: 409 + current_step "digilocker" -> router.replace("/digilocker-kyc") and returns true
	{
		resetStepConflictGuard();
		const router = createMockRouter();
		let progressCalled: boolean = false;
		const handled = await handleStepConflict({
			router,
			error: { status: 409, detail: "Step 'digilocker' must be completed" },
			getWorkflowProgressFn: async () => {
				progressCalled = true;
				return { data: { current_step: "digilocker", is_rejected: false } };
			},
		});

		assert(Boolean(handled), "409 with valid step must return true");
		assert(Boolean(progressCalled), "409 must fetch workflow progress");
		assert(
			router.replaceCalls.length === 1 && router.replaceCalls[0] === "/digilocker-kyc",
			`Expected navigation to /digilocker-kyc, got ${JSON.stringify(router.replaceCalls)}`,
		);
	}

	// 4. handleStepConflict: 409 + current_step "selfie_match" -> router.replace to selfie instructions
	{
		resetStepConflictGuard();
		const router = createMockRouter();
		const handled = await handleStepConflict({
			router,
			error: { response: { status: 409, data: { detail: "Complete selfie first" } } },
			getWorkflowProgressFn: async () => {
				return { data: { current_step: "selfie_match", is_rejected: false } };
			},
		});

		assert(handled === true, "409 for selfie_match must return true");
		assert(
			router.replaceCalls.length === 1 &&
				router.replaceCalls[0]?.pathname === "/ckyc-instructions" &&
				router.replaceCalls[0]?.params?.startSelfie === "true",
			`Expected navigation to /ckyc-instructions with startSelfie, got ${JSON.stringify(router.replaceCalls)}`,
		);
	}

	// 5. handleStepConflict: progress call fails -> returns false and does not navigate
	{
		resetStepConflictGuard();
		const router = createMockRouter();
		const handled = await handleStepConflict({
			router,
			error: { status: 409 },
			getWorkflowProgressFn: async () => {
				throw new Error("Network failed");
			},
		});

		assert(handled === false, "Failed progress call must return false");
		assert(router.replaceCalls.length === 0, "Failed progress call must not navigate");
	}
}
