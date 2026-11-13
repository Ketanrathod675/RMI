import { clearAuth } from "@/store/slices/auth";
import { resetSignin } from "@/store/slices/signin";
import {
	clearApplicationComplete,
	clearNotifications,
	clearTransactionId,
} from "@/store/slices/user";
import {
	clearExplicitLogoutSuppression,
	markExplicitLogoutSettled,
	markExplicitLogoutStarted,
} from "./api/core/sessionErrors";
import { resetApplicationRejectionGuard } from "@/utils/applicationRejection";
import { resetLoanSearchSession } from "@/utils/loanSearchSession";
import SecureStorage from "@/utils/secure-storage";
import {
	clearIdempotencyKeys,
	RemovableKeys,
	removeMultipleStorageItems,
	UserDataKeys,
} from "@/utils/storage";
import type { QueryClient } from "@tanstack/react-query";

let registeredJourneyStateReset: (() => void) | null = null;

export function registerJourneyResetHandler(handler: (() => void) | null): void {
	registeredJourneyStateReset = handler;
}

export function resetRegisteredJourneyState(): void {
	registeredJourneyStateReset?.();
}

export interface LogoutCleanupParams {
	queryClient: Pick<QueryClient, "cancelQueries" | "clear">;
	dispatch: (action: unknown) => void;
	revokeSession?: () => void | Promise<void>;
	clearTokens?: () => Promise<void>;
	removeStorageKeys?: (keys: readonly any[]) => Promise<void>;
	clearIdemKeys?: () => Promise<void>;
	resetSearchSession?: () => void;
	resetRejectionGuard?: () => void;
	resetJourneyState?: () => void;
}

/**
 * Runs complete awaited logout cleanup in strict order so fast re-logins
 * cannot race with stale token/storage removals or cached React Query data.
 */
export async function performLogoutCleanup(params: LogoutCleanupParams): Promise<void> {
	markExplicitLogoutStarted();
	try {
		// 1. Best-effort server session revocation before local tokens vanish
		try {
			if (params.revokeSession) {
				void Promise.resolve(params.revokeSession()).catch(() => {});
			}
		} catch {
			// Ignore session revocation errors
		}

		// 2. Cancel in-flight queries and clear the entire React Query cache
		try {
			await params.queryClient.cancelQueries();
		} catch {
			// Ignore query cancellation errors
		}
		params.queryClient.clear();

		// 3. Remove all auth, temp, idempotency, and per-user AsyncStorage/SecureStore data
		const doClearTokens = params.clearTokens ?? (() => SecureStorage.clearAllTokens());
		const doRemoveStorage = params.removeStorageKeys ?? removeMultipleStorageItems;
		const doClearIdem = params.clearIdemKeys ?? clearIdempotencyKeys;

		await Promise.all([
			doClearTokens().catch(() => {}),
			doRemoveStorage(RemovableKeys).catch(() => {}),
			doClearIdem().catch(() => {}),
		]);

		// 4. Reset all user-scoped Redux slices
		params.dispatch(clearAuth());
		params.dispatch(clearNotifications());
		params.dispatch(clearTransactionId());
		params.dispatch(clearApplicationComplete());
		params.dispatch(resetSignin());

		// 5. Reset module-level / provider session guards
		(params.resetSearchSession ?? resetLoanSearchSession)();
		(params.resetRejectionGuard ?? resetApplicationRejectionGuard)();
		(params.resetJourneyState ?? resetRegisteredJourneyState)();
	} finally {
		markExplicitLogoutSettled();
	}
}

export interface LoginCacheGuardParams {
	queryClient: Pick<QueryClient, "cancelQueries" | "clear" | "removeQueries">;
	previousUserId?: string | null;
	nextUserId?: string | null;
	forceClearCache?: boolean;
	removeUserDataKeys?: (keys: readonly any[]) => Promise<void>;
}

/**
 * Defence-in-depth cleanup on login: clears React Query cache and residual
 * per-user AsyncStorage keys whenever another user signs in or previous user is unknown.
 */
export async function clearStaleUserCacheOnLogin(params: LoginCacheGuardParams): Promise<void> {
	clearExplicitLogoutSuppression();
	const prev = params.previousUserId?.trim() || "";
	const next = params.nextUserId?.trim() || "";
	const doRemove = params.removeUserDataKeys ?? removeMultipleStorageItems;

	if (prev && next && prev !== next) {
		try {
			await params.queryClient.cancelQueries();
		} catch {
			// Ignore query cancellation errors
		}
		params.queryClient.clear();
		await doRemove(UserDataKeys).catch(() => {});
		return;
	}

	if (params.forceClearCache) {
		try {
			await params.queryClient.cancelQueries();
		} catch {
			// Ignore query cancellation errors
		}
		params.queryClient.clear();
		return;
	}

	if (!prev) {
		params.queryClient.removeQueries();
	}
}
