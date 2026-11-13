import { useCallback, useEffect, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";

export interface UseRateLimitLockResult {
	lockEndsAt: number | null;
	remainingSeconds: number;
	isLocked: boolean;
	lockForSeconds: (seconds: number) => void;
	clearLock: () => void;
}

/**
 * Timestamp-based rate-limit lock state hook that resists background drift.
 */
export function useRateLimitLock(): UseRateLimitLockResult {
	const [lockEndsAt, setLockEndsAt] = useState<number | null>(null);
	const [remainingSeconds, setRemainingSeconds] = useState<number>(0);

	const recalc = useCallback(() => {
		if (!lockEndsAt) {
			setRemainingSeconds(0);
			return;
		}
		const rem = Math.max(0, Math.ceil((lockEndsAt - Date.now()) / 1000));
		setRemainingSeconds(rem);
		if (rem <= 0) {
			setLockEndsAt(null);
		}
	}, [lockEndsAt]);

	useEffect(() => {
		const syncTimer = setTimeout(recalc, 0);
		if (!lockEndsAt) {
			return () => clearTimeout(syncTimer);
		}

		const interval = setInterval(recalc, 1000);
		const sub = AppState.addEventListener("change", (nextState: AppStateStatus) => {
			if (nextState === "active") {
				recalc();
			}
		});

		return () => {
			clearTimeout(syncTimer);
			clearInterval(interval);
			sub.remove();
		};
	}, [lockEndsAt, recalc]);

	const lockForSeconds = useCallback((seconds: number) => {
		const safeSeconds = Math.max(1, Math.round(seconds || 60));
		const nextEndsAt = Date.now() + safeSeconds * 1000;
		setLockEndsAt((prev) => (prev && prev > nextEndsAt ? prev : nextEndsAt));
		setRemainingSeconds((prev) => Math.max(prev, safeSeconds));
	}, []);

	const clearLock = useCallback(() => {
		setLockEndsAt(null);
		setRemainingSeconds(0);
	}, []);

	return {
		lockEndsAt,
		remainingSeconds,
		isLocked: remainingSeconds > 0,
		lockForSeconds,
		clearLock,
	};
}
