import { useAuth } from "@/hooks/useAuth";
import { useAppDispatch } from "@/store";
import { setStartupCompleted } from "@/store/slices/global";
import { checkDeviceSecurity, type SecurityBlockReason } from "@/utils/securityCheck";
import { getStorageItem, removeStorageItem, STORAGE_KEYS } from "@/utils/storage";
import { checkAppVersion, type VersionCheckResult } from "@/utils/versionCheckService";
import * as Font from "expo-font";
import * as Linking from "expo-linking";
import * as SplashScreen from "expo-splash-screen";
import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";

export type SplashStatus = "initializing" | "ready" | "animating_out" | "completed";

export interface SplashControllerState {
	status: SplashStatus;
	isSplashVisible: boolean;
	securityBlockReason: SecurityBlockReason;
	versionResult: VersionCheckResult | null;
	resolvedTarget: string;
	onAnimationComplete: () => void;
	onNativeSplashHandoff: () => void;
}

export function useSplashController(): SplashControllerState {
	const [status, setStatus] = useState<SplashStatus>("initializing");
	const [isSplashVisible, setIsSplashVisible] = useState(true);
	const [securityBlockReason, setSecurityBlockReason] = useState<SecurityBlockReason>(null);
	const [versionResult, setVersionResult] = useState<VersionCheckResult | null>(null);
	const [resolvedTarget, setResolvedTarget] = useState<string>("/login");

	const { loadAuth } = useAuth(false);
	const dispatch = useAppDispatch();
	const startTimeRef = useRef<number>(Date.now());
	const hasHandedOffRef = useRef(false);
	const hasRunStartupRef = useRef(false);
	const hasNavigatedRef = useRef(false);

	// Seamless native splash handoff
	const onNativeSplashHandoff = useCallback(async () => {
		if (hasHandedOffRef.current) return;
		hasHandedOffRef.current = true;
		try {
			await SplashScreen.hideAsync();
		} catch {
			// Native splash already hidden
		}
	}, []);

	// Run startup checks concurrently (ONLY ONCE on cold boot)
	useEffect(() => {
		if (hasRunStartupRef.current) return;
		hasRunStartupRef.current = true;

		let isMounted = true;
		startTimeRef.current = Date.now();

		async function runStartupChecks() {
			try {
				// Execute all critical startup checks in parallel
				const [
					fontResult,
					securityResult,
					authResult,
					versionCheckRes,
					initialUrl,
					paymentTimer,
					digilockerStatus,
				] = await Promise.all([
					Font.loadAsync({
						SpaceMono: require("@/assets/fonts/SpaceMono-Regular.ttf"),
					}).catch(() => null),
					checkDeviceSecurity(),
					loadAuth(),
					checkAppVersion(),
					Linking.getInitialURL().catch(() => null),
					getStorageItem(STORAGE_KEYS["@payment-timer-start"]),
					getStorageItem(STORAGE_KEYS["@digilocker-status"]),
				]);

				if (!isMounted) return;

				// Handle Security Check Failures
				if (!securityResult.isSecure && securityResult.reason) {
					setSecurityBlockReason(securityResult.reason);
					setStatus("ready");
					return;
				}

				// Handle Version Check
				setVersionResult(versionCheckRes);
				if (versionCheckRes.status === "force-update") {
					setStatus("ready");
					return;
				}

				// Pre-compute destination before dismissing splash to eliminate FOWS
				let targetRoute = "/login";
				const now = Date.now();
				const TIMEOUT_MS = 5 * 60 * 1000;

				const isPaymentActive =
					paymentTimer && now - parseInt(paymentTimer, 10) <= TIMEOUT_MS;
				const isDigilockerActive = digilockerStatus === "open";

				if (initialUrl && !initialUrl.includes("expo-development-client")) {
					// Deep link handling — deep link handler takes precedence
					targetRoute = authResult ? "/(tabs)" : "/login";
				} else if (isPaymentActive || isDigilockerActive) {
					targetRoute = "/(tabs)";
				} else if (authResult) {
					targetRoute = "/(tabs)";
					// Pre-hydrate dashboard data & storage in background so dashboard has instant data
					try {
						const { getUserDashboardData } = await import("@/utils/api/services/user.service");
						getUserDashboardData().catch((wfErr) => {
							console.warn("⚠️ [useSplashController] Pre-fetch dashboard error:", wfErr);
						});
					} catch {
						// Safe fallback
					}
				} else {
					targetRoute = "/login";
				}

				// Clean up stale flags if cold start without active link
				if (!initialUrl && !isPaymentActive) {
					if (digilockerStatus) {
						await removeStorageItem(STORAGE_KEYS["@digilocker-status"]);
						await removeStorageItem(STORAGE_KEYS["@digilocker-timestamp"]);
					}
				}

				setResolvedTarget(targetRoute);
				setStatus("ready");

				// Pre-navigate directly behind the opaque splash screen once navigation is mounted
				setTimeout(() => {
					try {
						router.replace(targetRoute as any);
						hasNavigatedRef.current = true;
					} catch {
						// Safe fallback if navigation is still mounting
					}
				}, 50);
			} catch (error) {
				if (!isMounted) return;
				setResolvedTarget("/login");
				setStatus("ready");
				setTimeout(() => {
					try {
						router.replace("/login");
						hasNavigatedRef.current = true;
					} catch {
						// Safe fallback
					}
				}, 50);
			}
		}

		runStartupChecks();

		return () => {
			isMounted = false;
		};
		// Only run on initial cold launch
	}, []);

	// Callback triggered when Reanimated exit sequence finishes
	const onAnimationComplete = useCallback(() => {
		setIsSplashVisible(false);
		setStatus("completed");
		dispatch(setStartupCompleted(true));

		// Only navigate if pre-navigation behind the splash hasn't already executed
		if (!hasNavigatedRef.current) {
			hasNavigatedRef.current = true;
			try {
				router.replace(resolvedTarget as any);
			} catch (navErr) {
				console.warn("⚠️ [Splash] Navigation handoff error:", navErr);
			}
		}

		// Run deferred, non-blocking telemetry and background tasks post-splash
		requestAnimationFrame(() => {
			if (__DEV__) {
				console.log("⚡ [Splash] Startup completed seamlessly. Target:", resolvedTarget);
			}
		});
	}, [dispatch, resolvedTarget]);

	return {
		status,
		isSplashVisible,
		securityBlockReason,
		versionResult,
		resolvedTarget,
		onAnimationComplete,
		onNativeSplashHandoff,
	};
}
