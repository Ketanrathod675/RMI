import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useFocusEffect, useRouter } from "expo-router";
import { getWorkflowProgress } from "@/utils/api/services/user.service";
import {
	handleApplicationRejected,
	isApplicationRejectedError,
	isRejectedStatus,
} from "@/utils/applicationRejection";

const GUARD_POLL_INTERVAL_MS = 15_000;

/**
 * useApplicationStatusGuard
 * Watches for mid-flow rejections (e.g. lender webhook arrived late).
 *
 * Requirements:
 * - Polls GET /workflow/progress every 15s while focused & active
 * - Pauses when not focused or app in background
 * - Stops when status is "completed" or application is rejected
 * - Refetches on AppState change to "active"
 * - On rejection: calls handleApplicationRejected
 * - Silent: no loaders, no toasts, errors ignored
 * - At most one request in flight
 */
export function useApplicationStatusGuard(options?: {
	enabled?: boolean;
}): void {
	const router = useRouter();
	const queryClient = useQueryClient();
	const [isFocused, setIsFocused] = useState(true);
	const [isAppActive, setIsAppActive] = useState(AppState.currentState === "active");
	const isStoppedRef = useRef(false);

	useFocusEffect(
		useCallback(() => {
			setIsFocused(true);
			return () => {
				setIsFocused(false);
			};
		}, [])
	);

	useEffect(() => {
		const subscription = AppState.addEventListener("change", (nextState: AppStateStatus) => {
			const active = nextState === "active";
			setIsAppActive(active);
		});
		return () => {
			subscription.remove();
		};
	}, []);

	const isEnabled = (options?.enabled ?? true) && isFocused && isAppActive && !isStoppedRef.current;

	const { data, error, refetch } = useQuery({
		queryKey: ["application-status-guard"],
		queryFn: async () => {
			const res = await getWorkflowProgress();
			return res?.data ?? null;
		},
		enabled: isEnabled,
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

	// Check returned data for rejection
	useEffect(() => {
		if (data) {
			const status = String(data.overall_status ?? "").toLowerCase();
			if (status === "completed") {
				isStoppedRef.current = true;
				return;
			}
			if (isRejectedStatus(data)) {
				isStoppedRef.current = true;
				handleApplicationRejected({ router, queryClient, source: "useApplicationStatusGuard" });
			}
		}
	}, [data, router, queryClient]);

	// Check if error is application rejection 403
	useEffect(() => {
		if (error) {
			if (isApplicationRejectedError(error)) {
				isStoppedRef.current = true;
				handleApplicationRejected({ router, queryClient, source: "useApplicationStatusGuard_403" });
			}
		}
	}, [error, router, queryClient]);

	// Trigger refetch on foregrounding when active & focused
	useEffect(() => {
		if (isAppActive && isFocused && !isStoppedRef.current) {
			refetch().catch(() => {});
		}
	}, [isAppActive, isFocused, refetch]);
}

