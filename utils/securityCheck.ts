import { NativeModules, Platform } from "react-native";

export type SecurityBlockReason = "rooted" | "emulator" | "developer_mode" | null;

export interface SecurityCheckResult {
	isSecure: boolean;
	reason: SecurityBlockReason;
}

/**
 * Validates device security status.
 * In development (__DEV__), this is bypassed to enable seamless hot reloading and emulator debugging.
 * In release builds, it validates against rooted environments, emulators, or developer mode if native modules exist.
 */
export async function checkDeviceSecurity(): Promise<SecurityCheckResult> {
	if (__DEV__) {
		return { isSecure: true, reason: null };
	}

	try {
		// Native security checks if available on Android release
		if (Platform.OS === "android" && NativeModules.SecurityModule) {
			if (typeof NativeModules.SecurityModule.isRooted === "function") {
				const isRooted = await NativeModules.SecurityModule.isRooted();
				if (isRooted) {
					return { isSecure: false, reason: "rooted" };
				}
			}

			if (typeof NativeModules.SecurityModule.isDevelopmentSettingsMode === "function") {
				const isDevMode = await NativeModules.SecurityModule.isDevelopmentSettingsMode();
				if (isDevMode) {
					return { isSecure: false, reason: "developer_mode" };
				}
			}
		}

		return { isSecure: true, reason: null };
	} catch (error) {
		if (__DEV__) console.warn("Security check failed:", error);
		// Graceful fallback to avoid bricking on unexpected device errors
		return { isSecure: true, reason: null };
	}
}
