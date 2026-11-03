import { AnimatedSplashScreen } from "@/components/splash/AnimatedSplashScreen";
const DevMockBanner = __DEV__ ? require("@/components/dev/DevMockBanner").DevMockBanner : () => null;
import { ErrorBoundary as RootErrorBoundary, RouteErrorBoundary } from "@/components/ErrorBoundary";
import { ForceUpdateView } from "@/components/splash/ForceUpdateView";
import { SecurityAlertView } from "@/components/splash/SecurityAlertView";
import { useColorScheme } from "@/hooks/useColorScheme";
import { useSplashController } from "@/hooks/useSplashController";
import { store } from "@/store";
import { DarkTheme, DefaultTheme, ThemeProvider } from "expo-router/react-navigation";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { NavigationBar } from "expo-navigation-bar";
import React from "react";
import { Platform, StatusBar as RNStatusBar, StyleSheet, Text, View } from "react-native";
import "react-native-reanimated";
import {
	useFonts,
	PlusJakartaSans_400Regular,
	PlusJakartaSans_500Medium,
	PlusJakartaSans_600SemiBold,
	PlusJakartaSans_700Bold,
} from "@expo-google-fonts/plus-jakarta-sans";
import { Provider } from "react-redux";
import Toast from "react-native-toast-message";
import { installToastDefaults, toastConfig } from "@/utils/toastConfig";
import { JourneyLoaderProvider } from "@/context/JourneyLoaderProvider";
import { initBranch } from "@/utils/branch";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { installNetworkAwareness, useNetworkStatus } from "@/hooks/useNetworkStatus";
import { useTranslation } from "@/hooks/useTranslation";
import { installGlobalErrorHandlers, subscribeFatalErrors } from "@/utils/errorHandling";
import { useRouter } from "expo-router";
import { handleApplicationRejected, setApplicationRejectedHandler } from "@/utils/applicationRejection";

installToastDefaults();
installGlobalErrorHandlers();

export { RouteErrorBoundary as ErrorBoundary };

// Prevent native splash screen from auto-hiding before JavaScript initializes
SplashScreen.preventAutoHideAsync().catch(() => {
	/* No-op */
});

export const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: 30_000,
			gcTime: 5 * 60_000,
			retry: 1,
			refetchOnWindowFocus: false,
		},
	},
});

function RootLayoutNav() {
	const router = useRouter();
	const [fatalError, setFatalError] = React.useState<unknown>(null);
	const insets = useSafeAreaInsets();
	const { isOffline } = useNetworkStatus();
	const { t } = useTranslation();
	const colorScheme = useColorScheme();
	const [fontsLoaded] = useFonts({
		PlusJakartaSans_400Regular,
		PlusJakartaSans_500Medium,
		PlusJakartaSans_600SemiBold,
		PlusJakartaSans_700Bold,
	});
	React.useEffect(() => {
		const unsubscribe = subscribeFatalErrors(setFatalError);
		return () => { unsubscribe(); };
	}, []);

	// Global Application Rejected handler (routes out on 403 application_rejected across the entire app)
	React.useEffect(() => {
		setApplicationRejectedHandler(() => {
			handleApplicationRejected({ router, queryClient, source: "global_403" });
		});
		return () => {
			setApplicationRejectedHandler(null);
		};
	}, [router]);

	// Branch SDK Phase 1: Initialize session tracking (install / open / reinstall)
	// Must be called once on root mount. Branch auto-tracks all attribution.
	React.useEffect(() => {
		return installNetworkAwareness();
	}, []);

	React.useEffect(() => {
		const unsubscribeBranch = initBranch();
		return () => {
			unsubscribeBranch();
		};
	}, []);

	React.useEffect(() => {
		if (Platform.OS === "android") {
			try {
				if (typeof (RNStatusBar as any)?.setTranslucent === "function") {
					(RNStatusBar as any).setTranslucent(true);
				}
				if (typeof (RNStatusBar as any)?.setBackgroundColor === "function") {
					(RNStatusBar as any).setBackgroundColor("transparent");
				}
			} catch {
				// Safely ignore if native status bar module is not ready or unsupported
			}

			try {
				if (typeof NavigationBar?.setHidden === "function") {
					NavigationBar.setHidden(true);
				}

				const navBarAny = NavigationBar as any;
				if (typeof navBarAny?.setPositionAsync === "function") {
					navBarAny.setPositionAsync("absolute").catch(() => {});
				}
				if (typeof navBarAny?.setBehaviorAsync === "function") {
					navBarAny.setBehaviorAsync("overlay-swipe").catch(() => {});
				}
				if (typeof navBarAny?.setBackgroundColorAsync === "function") {
					navBarAny.setBackgroundColorAsync("#FFFFFF").catch(() => {});
				}
				if (typeof navBarAny?.setButtonStyleAsync === "function") {
					navBarAny.setButtonStyleAsync("dark").catch(() => {});
				}
			} catch {
				// Safely ignore if navigation bar methods are not available
			}
		}
	}, []);

	const {
		status,
		isSplashVisible,
		securityBlockReason,
		versionResult,
		onAnimationComplete,
		onNativeSplashHandoff,
	} = useSplashController();
	if (fatalError) return <View style={styles.fatalContainer}><Text style={styles.fatalTitle}>{t("somethingWentWrong", "Something went wrong")}</Text><Text style={styles.fatalText}>{t("friendlyError_unknown", "Something went wrong. Please try again.")}</Text><Text onPress={() => setFatalError(null)} style={styles.fatalButton}>{t("tryAgain", "Try again")}</Text><Text onPress={() => { setFatalError(null); router.replace("/(tabs)"); }} style={styles.fatalButton}>{t("goToHome", "Go to Home")}</Text></View>;

	return (
		<ThemeProvider value={DefaultTheme}>
			<View style={styles.rootContainer}>
				{/* Main App Navigation Stack */}
				<Stack screenOptions={{ headerShown: false, animation: "fade" }}>
					<Stack.Screen name="index" options={{ headerShown: false }} />
					<Stack.Screen name="login" options={{ headerShown: false }} />
					<Stack.Screen name="signin-otp" options={{ headerShown: false }} />
					<Stack.Screen name="request-permissions" options={{ headerShown: false }} />
					<Stack.Screen name="loan-application" options={{ headerShown: false }} />
					<Stack.Screen name="new-assessment-fee" options={{ headerShown: false }} />
					<Stack.Screen name="assessment-fee-success" options={{ headerShown: false }} />
					<Stack.Screen name="application-verification" options={{ headerShown: false }} />
					<Stack.Screen name="application-approved" options={{ headerShown: false }} />
					<Stack.Screen name="loan-congratulations" options={{ headerShown: false }} />
					<Stack.Screen name="no-lenders-available" options={{ headerShown: false }} />
					<Stack.Screen name="no-approved-amount" options={{ headerShown: false }} />
					<Stack.Screen name="welcome" options={{ headerShown: false }} />
					<Stack.Screen name="verify-email" options={{ headerShown: false }} />
					<Stack.Screen
						name="customer-data-consent"
						options={{ headerShown: false, gestureEnabled: false }}
					/>
					<Stack.Screen name="professional-details" options={{ headerShown: false }} />
					<Stack.Screen name="professional-details-success" options={{ headerShown: false }} />
					<Stack.Screen name="ckyc-instructions" options={{ headerShown: false }} />
					<Stack.Screen name="ckyc-otp" options={{ headerShown: false }} />
					<Stack.Screen name="aadhaar-kyc" options={{ headerShown: false }} />
					<Stack.Screen name="auto-debit-setup" options={{ headerShown: false }} />
					<Stack.Screen name="emandate-status" options={{ headerShown: false }} />
					<Stack.Screen name="bank-details-settings" options={{ headerShown: false }} />
					<Stack.Screen name="delete-account" options={{ headerShown: false }} />
					<Stack.Screen name="help-support" options={{ headerShown: false }} />
					<Stack.Screen name="lending-partners" options={{ headerShown: false }} />
					<Stack.Screen name="loan-details" options={{ headerShown: false }} />
					<Stack.Screen name="loan-history" options={{ headerShown: false }} />
					<Stack.Screen
						name="notification-settings"
						options={{
							headerShown: true,
							title: "Notification",
							headerStyle: { backgroundColor: "#FFFFFF" },
							headerTintColor: "#000000",
							headerTitleStyle: { fontWeight: "600" },
							headerShadowVisible: false,
						}}
					/>
					<Stack.Screen
						name="personal-details"
						options={{
							headerShown: true,
							title: "Personal Details",
							headerStyle: { backgroundColor: "#FFFFFF" },
							headerTintColor: "#000000",
							headerTitleStyle: { fontWeight: "600" },
							headerShadowVisible: false,
						}}
					/>
					<Stack.Screen
						name="reel-player"
						options={{
							headerShown: false,
							animation: "slide_from_bottom",
							presentation: "fullScreenModal",
						}}
					/>
					<Stack.Screen name="user-notifications" options={{ headerShown: false }} />
					<Stack.Screen name="search-loan" options={{ headerShown: false }} />
					<Stack.Screen name="aadhaar-kyc-redirect" options={{ headerShown: false }} />
					<Stack.Screen name="enter-otp" options={{ headerShown: false }} />
					<Stack.Screen name="language" options={{ headerShown: false }} />
					<Stack.Screen name="pdf-viewer" options={{ headerShown: false }} />
					<Stack.Screen name="loan-approved" options={{ headerShown: false }} />
					<Stack.Screen name="loan-enter-otp" options={{ headerShown: false }} />
					<Stack.Screen name="mpin-login" options={{ headerShown: false }} />
					<Stack.Screen name="rapidcare" options={{ headerShown: false }} />
					<Stack.Screen name="repayment-options" options={{ headerShown: false }} />
					<Stack.Screen name="repayment-success" options={{ headerShown: false }} />
					<Stack.Screen name="sanction-letter" options={{ headerShown: false }} />
					<Stack.Screen name="set-language" options={{ headerShown: false }} />
					<Stack.Screen name="set-mpin" options={{ headerShown: false }} />
					<Stack.Screen name="verify-bank-details" options={{ headerShown: false }} />
					<Stack.Screen name="verify-pan" options={{ headerShown: false }} />
					<Stack.Screen name="verifying-bank" options={{ headerShown: false }} />
					<Stack.Screen name="forgot-mpin" options={{ headerShown: false }} />
					<Stack.Screen name="dev-loader-preview" options={{ headerShown: false }} />
					<Stack.Screen name="digilocker-kyc" options={{ headerShown: false }} />
					<Stack.Screen name="(tabs)" options={{ headerShown: false }} />
					<Stack.Screen name="+not-found" options={{ title: "Oops!" }} />
				</Stack>

				{/* Blocking Security Alert (if triggered) */}
				{securityBlockReason !== null && (
					<SecurityAlertView reason={securityBlockReason} />
				)}

				{/* Blocking Force Update (if triggered) */}
				{versionResult?.status === "force-update" && (
					<ForceUpdateView playStoreUrl={versionResult.playStoreUrl} />
				)}

				{/* High-Performance Reanimated Splash Overlay (Active during boot) */}
				{isSplashVisible && (
					<AnimatedSplashScreen
						isReady={status === "ready" && Boolean(fontsLoaded)}
						onAnimationComplete={onAnimationComplete}
						onNativeSplashHandoff={onNativeSplashHandoff}
					/>
				)}

				<StatusBar style="dark" />
				{isOffline && <View style={[styles.offlineBanner, { top: insets.top }]} pointerEvents="none"><Text style={styles.offlineText}>{t("noInternetConnection", "No internet connection")}</Text></View>}
				{__DEV__ && <DevMockBanner />}
				<Toast
					config={toastConfig}
					position="top"
					topOffset={insets.top + 8}
					visibilityTime={3000}
				/>
			</View>
		</ThemeProvider>
	);
}

export default function RootLayout() {
	return (
		<SafeAreaProvider>
		<RootErrorBoundary>
			<Provider store={store}>
				<QueryClientProvider client={queryClient}>
					<JourneyLoaderProvider>
						<RootLayoutNav />
					</JourneyLoaderProvider>
				</QueryClientProvider>
			</Provider>
		</RootErrorBoundary>
		</SafeAreaProvider>
	);
}

const styles = StyleSheet.create({
	rootContainer: {
		flex: 1,
		backgroundColor: "#ffffff",
	},
	offlineBanner: { position: "absolute", left: 0, right: 0, zIndex: 999, backgroundColor: "#334155", paddingVertical: 7, alignItems: "center" },
	offlineText: { color: "#FFFFFF", fontSize: 12, fontWeight: "600" },
	fatalContainer: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, backgroundColor: "#fff" },
	fatalTitle: { fontSize: 20, fontWeight: "700", color: "#11181C", marginBottom: 8 },
	fatalText: { fontSize: 14, color: "#64748B", marginBottom: 20 },
	fatalButton: { color: "#047857", padding: 12, fontWeight: "700" },
});
