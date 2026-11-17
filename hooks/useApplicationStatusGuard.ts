import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useFocusEffect, useRouter } from "expo-router";
import { useAuth } from "@/hooks/useAuth";
import { getWorkflowProgress } from "@/utils/api/services/user.service";
import {
	handleApplicationRejected,
	isApplicationRejectedError,
	isRejectedStatus,
} from "@/utils/applicationRejection";

const GUARD_POLL_INTERVAL_MS = 30_000;

/**
 * useApplicationStatusGuard
 * Watches for mid-flow rejections (e.g. lender webhook arrived late).
 *
 * Requirements:
 * - Polls GET /workflow/progress every 30s while focused & active
 * - Pauses when not focused or app in background
 * - Stops when status is "completed" or application is rejected
 * - Refetches on AppState change to "active" from background/inactive
 * - On rejection: calls handleApplicationRejected
 * - Silent: no loaders, no toasts, errors ignored
 * - At most one request in flight
 */
export function useApplicationStatusGuard(options?: {
	enabled?: boolean;
}): void {
	const router = useRouter();
	const queryClient = useQueryClient();
	const { userId } = useAuth();
	const [isFocused, setIsFocused] = useState(true);
	const [isAppActive, setIsAppActive] = useState(AppState.currentState === "active");
	const [isStopped, setIsStopped] = useState(false);
	const isStoppedRef = useRef(false);
	const appStateRef = useRef<string>(AppState.currentState || "active");

	const stopGuard = useCallback(() => {
		isStoppedRef.current = true;
		setIsStopped(true);
	}, []);

	useFocusEffect(
		useCallback(() => {
			setIsFocused(true);
			return () => {
				setIsFocused(false);
			};
		}, [])
	);

	const isEnabled = (options?.enabled ?? true) && isFocused && isAppActive && !isStopped;

	const { data, error, refetch } = useQuery({
		queryKey: ["application-status-guard", userId],
		queryFn: async () => {
			const res = await getWorkflowProgress();
			return res?.data ?? null;
		},
		enabled: isEnabled && !!userId,
		refetchInterval: (query) => {
			if (!isEnabled) return false;
			const currentData = query.state.data;
			if (currentData) {
				const status = String(currentData.overall_status ?? "").toLowerCase();
				if (status === "completed" || isRejectedStatus(currentData)) {
					return false;
				}
			}
			return GUARD_POLL_INTERVAL_MS;
		},
		refetchIntervalInBackground: false,
		staleTime: 5_000,
		retry: false,
		refetchOnWindowFocus: false,
	});

	useEffect(() => {
		const subscription = AppState.addEventListener("change", (nextState: AppStateStatus) => {
			const wasBackground = /inactive|background/.test(appStateRef.current);
			const isNowActive = nextState === "active";
			appStateRef.current = nextState;
			setIsAppActive(isNowActive);

			// Only refetch on actual transition from background to active when enabled
			if (wasBackground && isNowActive && (options?.enabled ?? true) && !!userId && !isStoppedRef.current && isFocused) {
				refetch().catch(() => {});
			}
		});
		return () => {
			subscription.remove();
		};
	}, [options?.enabled, userId, isFocused, refetch]);

	// Check returned data for rejection
	useEffect(() => {
		if (data) {
			const status = String(data.overall_status ?? "").toLowerCase();
			if (status === "completed") {
				stopGuard();
				return;
			}
			if (isRejectedStatus(data)) {
				stopGuard();
				handleApplicationRejected({ router, queryClient, source: "useApplicationStatusGuard" });
			}
		}
	}, [data, router, queryClient, stopGuard]);

	// Check if error is application rejection 403
	useEffect(() => {
		if (error) {
			if (isApplicationRejectedError(error)) {
				stopGuard();
				handleApplicationRejected({ router, queryClient, source: "useApplicationStatusGuard_403" });
			}
		}
	}, [error, router, queryClient, stopGuard]);
}

