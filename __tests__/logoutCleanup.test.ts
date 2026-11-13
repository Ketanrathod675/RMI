/**
 * Unit test suite for complete logout cleanup & cross-user cache isolation (Issue 2)
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { QueryClient } from "@tanstack/react-query";
import { configureStore } from "@reduxjs/toolkit";
import { authReducer, setAuthAccessToken, setAuthPhoneNumber, setAuthUserId, toggleIsLoggedIn } from "../store/slices/auth";
import { globalReducer } from "../store/slices/global";
import {
	resetSignin,
	setCountryCode,
	setLoginResponse,
	setOtpVerifyResponse,
	setPhoneNumber,
	signinReducer,
} from "../store/slices/signin";
import {
	clearApplicationComplete,
	clearNotifications,
	clearTransactionId,
	setApplicationComplete,
	setNotifications,
	setTransactionId,
	userReducer,
} from "../store/slices/user";
import {
	clearExplicitLogoutSuppression,
	isSessionExpirySuppressed,
} from "../utils/api/core/sessionErrors";
import {
	clearStaleUserCacheOnLogin,
	performLogoutCleanup,
	registerJourneyResetHandler,
} from "../utils/authCleanup";
import { STORAGE_KEYS, UserDataKeys } from "../utils/storage";

function assert(condition: boolean, message: string): void {
	if (!condition) {
		throw new Error(`Assertion failed: ${message}`);
	}
}

export async function runLogoutCleanupTests(): Promise<void> {
	// 1. Full logout cleanup awaits clearing React Query, storage (including all UserDataKeys), Redux slices, and guards
	{
		await AsyncStorage.clear();
		const seedEntries: Array<[string, string]> = [
			// Auth keys
			[STORAGE_KEYS["@token"], "tok_a"],
			[STORAGE_KEYS["@access-token"], "access_a"],
			[STORAGE_KEYS["@refresh-token"], "refresh_a"],
			[STORAGE_KEYS["@is-logged-in"], "dHJ1ZQ=="],
			[STORAGE_KEYS["@is-mpin-set"], "dHJ1ZQ=="],
			[STORAGE_KEYS["@phone-number"], "OTg3NjU0MzIxMA=="],
			[STORAGE_KEYS["@country-code"], "Kzkx"],
			[STORAGE_KEYS["@user-id"], "dXNlcl9h"],
			// UserDataKeys (all 10)
			[STORAGE_KEYS["@lead-id"], "lead_a"],
			[STORAGE_KEYS["@af-flag"], "yes"],
			[STORAGE_KEYS["@allocated-lender-id"], "lender_a"],
			[STORAGE_KEYS["@allocated-lender-name"], "Lender A"],
			[STORAGE_KEYS["@assessment-fee-amount"], "826"],
			[STORAGE_KEYS["@assessment-fee"], "826"],
			[STORAGE_KEYS["@latest-assessment-fee-txnid"], "txn_a"],
			[STORAGE_KEYS["@kyc-response"], JSON.stringify({ lead_id: "lead_a" })],
			[STORAGE_KEYS["@no-approved-amount-flag"], "true"],
			[STORAGE_KEYS["@loan-rejected-flag"], "true"],
			[STORAGE_KEYS["@idem:assessment-fee"], JSON.stringify({ key: "k1", fingerprint: "fp", createdAt: Date.now() })],
			// Device/app keys that MUST survive logout
			[STORAGE_KEYS["@set-language"], "hindi"],
			[STORAGE_KEYS["@app-installed-flag"], "true"],
			[STORAGE_KEYS["@app-version"], "1.0.0"],
		];
		await AsyncStorage.multiSet(seedEntries);

		const testStore = configureStore({
			reducer: {
				auth: authReducer,
				global: globalReducer,
				signin: signinReducer,
				user: userReducer,
			},
		});

		testStore.dispatch(setAuthUserId("user_a"));
		testStore.dispatch(setAuthPhoneNumber("9876543210"));
		testStore.dispatch(setAuthAccessToken("access_a"));
		testStore.dispatch(toggleIsLoggedIn(true));
		testStore.dispatch(setNotifications({ unread_count: 3, recent_notifications: [] }));
		testStore.dispatch(setTransactionId("txn_a"));
		testStore.dispatch(setApplicationComplete(true));
		testStore.dispatch(setCountryCode("+91"));
		testStore.dispatch(setPhoneNumber("9876543210"));
		testStore.dispatch(setLoginResponse({ message: "ok" } as any));
		testStore.dispatch(setOtpVerifyResponse({ user_id: "user_a" } as any));

		const queryClient = new QueryClient();
		queryClient.setQueryData(["user", "dashboard", "user_a"], { name: "User A" });
		queryClient.setQueryData(["userProfile", "user_a"], { full_name: "User A" });
		assert(queryClient.getQueryCache().getAll().length === 2, "Precondition: 2 cached queries expected");

		const events: string[] = [];
		let searchSessionReset = false;
		let rejectionGuardReset = false;
		let journeyReset = false;
		registerJourneyResetHandler(() => {
			journeyReset = true;
			events.push("journey");
		});

		await performLogoutCleanup({
			queryClient,
			dispatch: testStore.dispatch,
			revokeSession: () => {
				events.push("revoke");
			},
			resetSearchSession: () => {
				searchSessionReset = true;
				events.push("search");
			},
			resetRejectionGuard: () => {
				rejectionGuardReset = true;
				events.push("rejection");
			},
		});

		registerJourneyResetHandler(null);

		assert(events[0] === "revoke", "Best-effort session revocation must trigger before clearing tokens");
		assert(
			queryClient.getQueryCache().getAll().length === 0,
			`Expected 0 cached queries after logout, got ${queryClient.getQueryCache().getAll().length}`,
		);

		// Verify all UserDataKeys + auth keys are removed
		for (const key of UserDataKeys) {
			const val = await AsyncStorage.getItem(key);
			assert(val === null, `Key ${key} must be cleared on logout, found ${val}`);
		}
		assert((await AsyncStorage.getItem(STORAGE_KEYS["@access-token"])) === null, "@access-token must be cleared");
		assert((await AsyncStorage.getItem(STORAGE_KEYS["@idem:assessment-fee"])) === null, "@idem keys must be cleared");

		// Verify device-level keys are preserved
		assert((await AsyncStorage.getItem(STORAGE_KEYS["@set-language"])) === "hindi", "@set-language must survive logout");
		assert((await AsyncStorage.getItem(STORAGE_KEYS["@app-installed-flag"])) === "true", "@app-installed-flag must survive logout");
		assert((await AsyncStorage.getItem(STORAGE_KEYS["@app-version"])) === "1.0.0", "@app-version must survive logout");

		// Verify Redux slices are reset
		const finalState = testStore.getState();
		assert(finalState.auth.isLoggedIn === false && finalState.auth.userId === undefined, "auth slice must be cleared");
		assert(finalState.user.notifications === undefined, "user.notifications must be cleared");
		assert(finalState.user.transactionId === undefined, "user.transactionId must be cleared");
		assert(finalState.user.applicationComplete === false, "user.applicationComplete must be reset");
		assert(
			finalState.signin.phoneNumber === undefined &&
				finalState.signin.loginResponse === undefined &&
				finalState.signin.otpVerifyResponse === undefined,
			"signin slice must be reset",
		);
		assert(searchSessionReset && rejectionGuardReset && journeyReset, "Module/provider guards must all reset");
	}

	// 2. Defence in depth on login: switching user A -> B clears React Query + residual UserDataKeys (keeps new auth tokens)
	{
		await AsyncStorage.clear();
		await AsyncStorage.multiSet([
			[STORAGE_KEYS["@access-token"], "token_b"],
			[STORAGE_KEYS["@lead-id"], "lead_a"],
			[STORAGE_KEYS["@kyc-response"], "kyc_a"],
			[STORAGE_KEYS["@set-language"], "english"],
		]);

		const queryClient = new QueryClient();
		queryClient.setQueryData(["user", "dashboard", "user_a"], { name: "User A" });

		await clearStaleUserCacheOnLogin({
			queryClient,
			previousUserId: "user_a",
			nextUserId: "user_b",
		});

		assert(
			queryClient.getQueryCache().getAll().length === 0,
			"User switch A -> B must clear React Query cache",
		);
		assert((await AsyncStorage.getItem(STORAGE_KEYS["@lead-id"])) === null, "User A @lead-id must be wiped on switch");
		assert((await AsyncStorage.getItem(STORAGE_KEYS["@kyc-response"])) === null, "User A @kyc-response must be wiped on switch");
		assert((await AsyncStorage.getItem(STORAGE_KEYS["@access-token"])) === "token_b", "User B token must remain intact");
		assert((await AsyncStorage.getItem(STORAGE_KEYS["@set-language"])) === "english", "@set-language must remain intact");
	}

	// 3. Unknown previous user id safely removes cached queries; explicit resetSignin/user reducers work directly
	{
		const queryClient = new QueryClient();
		queryClient.setQueryData(["user", "dashboard"], { name: "Unknown" });
		await clearStaleUserCacheOnLogin({
			queryClient,
			previousUserId: null,
			nextUserId: "user_b",
		});
		assert(queryClient.getQueryCache().getAll().length === 0, "Unknown previous user must clear queries");

		const s = signinReducer(undefined, setPhoneNumber("9876543210"));
		assert(signinReducer(s, resetSignin()).phoneNumber === undefined, "resetSignin must reset state");

		let u = userReducer(undefined, setTransactionId("t1"));
		u = userReducer(u, setApplicationComplete(true));
		u = userReducer(u, setNotifications({ unread_count: 1, recent_notifications: [] }));
		u = userReducer(userReducer(userReducer(u, clearTransactionId()), clearApplicationComplete()), clearNotifications());
		assert(!u.transactionId && !u.applicationComplete && !u.notifications, "user clear actions must reset fields");
	}

	// 4. Intentional logout suppresses 401 "Session Expired" popups briefly, and next login clears suppression
	{
		clearExplicitLogoutSuppression();
		assert(isSessionExpirySuppressed() === false, "Suppression should start false");

		const queryClient = new QueryClient();
		const state = { suppressedDuringRevoke: false };
		await performLogoutCleanup({
			queryClient,
			dispatch: () => {},
			clearTokens: async () => {},
			removeStorageKeys: async () => {},
			clearIdemKeys: async () => {},
			revokeSession: () => {
				state.suppressedDuringRevoke = isSessionExpirySuppressed();
			},
		});

		assert(state.suppressedDuringRevoke === true, "Session expiry must be suppressed when logout starts");
		assert(
			isSessionExpirySuppressed() === true,
			"Session expiry must stay briefly suppressed right after logout settles for late 401s",
		);
		assert(
			isSessionExpirySuppressed(Date.now() + 9000) === false,
			"Session expiry suppression window must expire automatically",
		);

		await clearStaleUserCacheOnLogin({
			queryClient,
			previousUserId: "user_a",
			nextUserId: "user_b",
			removeUserDataKeys: async () => {},
		});
		assert(isSessionExpirySuppressed() === false, "New login must immediately clear logout suppression");
	}
}

