import { AnimatedSplashScreen } from "@/components/splash/AnimatedSplashScreen";
import { DevMockBanner } from "@/components/dev/DevMockBanner";
import { ErrorBoundary } from "@/components/ErrorBoundary";
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
import { Platform, StatusBar as RNStatusBar, StyleSheet, View } from "react-native";
import "react-native-reanimated";
import { Provider } from "react-redux";
import Toast from "react-native-toast-message";
import { toastConfig } from "@/utils/toastConfig";

// Prevent native splash screen from auto-hiding before JavaScript initializes
SplashScreen.preventAutoHideAsync().catch(() => {
	/* No-op */
});

export const queryClient = new QueryClient();

function RootLayoutNav() {
	const colorScheme = useColorScheme();

	React.useEffect(() => {
		if (Platform.OS === "android") {
			try {
				if (typeof RNStatusBar?.setTranslucent === "function") {
					RNStatusBar.setTranslucent(true);
				}
				if (typeof RNStatusBar?.setBackgroundColor === "function") {
					RNStatusBar.setBackgroundColor("transparent");
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
				if (typeof navBarAny?.setVisibilityAsync === "function") {
					navBarAny.setVisibilityAsync("hidden").catch(() => {});
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

	return (
		<ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
			{Platform.OS === "android" && <NavigationBar hidden={true} />}
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
					<Stack.Screen name="professional-details" options={{ headerShown: false }} />
					<Stack.Screen name="professional-details-success" options={{ headerShown: false }} />
					<Stack.Screen name="ckyc-instructions" options={{ headerShown: false }} />
					<Stack.Screen name="ckyc-otp" options={{ headerShown: false }} />
					<Stack.Screen name="aadhaar-kyc" options={{ headerShown: false }} />
					<Stack.Screen name="auto-debit-setup" options={{ headerShown: false }} />
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
						isReady={status === "ready"}
						onAnimationComplete={onAnimationComplete}
						onNativeSplashHandoff={onNativeSplashHandoff}
					/>
				)}

				<StatusBar style="dark" />
				{__DEV__ && <DevMockBanner />}
				<Toast
					config={toastConfig}
					position="bottom"
					bottomOffset={65}
					visibilityTime={3000}
				/>
			</View>
		</ThemeProvider>
	);
}

export default function RootLayout() {
	return (
		<ErrorBoundary>
			<Provider store={store}>
				<QueryClientProvider client={queryClient}>
					<RootLayoutNav />
				</QueryClientProvider>
			</Provider>
		</ErrorBoundary>
	);
}

const styles = StyleSheet.create({
	rootContainer: {
		flex: 1,
		backgroundColor: "#ffffff",
	},
});
