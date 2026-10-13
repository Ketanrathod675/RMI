import * as Application from "expo-application";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const STORAGE_DEVICE_ID_KEY = "@device-id";

let cachedDeviceId: string | null = null;
let cachedDeviceName: string | null = null;

/**
 * Returns a stable device identifier.
 * - Android: android-<AndroidId>
 * - iOS: ios-<IdForVendor>
 * - Fallback: <platform>-<random UUID/string> stored in AsyncStorage under `@device-id`
 * Note: `@device-id` is not cleared on logout so it survives across sessions.
 */
export async function getDeviceId(): Promise<string> {
	if (cachedDeviceId) {
		return cachedDeviceId;
	}

	try {
		// Check persistent storage first (handles fallback and persistence)
		const storedId = await AsyncStorage.getItem(STORAGE_DEVICE_ID_KEY);
		if (storedId) {
			cachedDeviceId = storedId;
			return cachedDeviceId;
		}

		let nativeId: string | null = null;

		if (Platform.OS === "android") {
			try {
				nativeId = Application.getAndroidId();
			} catch (e) {
				console.warn("⚠️ [deviceId] Failed to get Android ID:", e);
			}
		} else if (Platform.OS === "ios") {
			try {
				nativeId = await Application.getIosIdForVendorAsync();
			} catch (e) {
				console.warn("⚠️ [deviceId] Failed to get iOS ID for vendor:", e);
			}
		}

		let finalId: string;
		if (nativeId && nativeId.trim().length > 0) {
			finalId = `${Platform.OS}-${nativeId.trim()}`;
		} else {
			// Generate random unique identifier
			const randomSeed = `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 12)}`;
			finalId = `${Platform.OS}-${randomSeed}`;
		}

		await AsyncStorage.setItem(STORAGE_DEVICE_ID_KEY, finalId);
		cachedDeviceId = finalId;
		return cachedDeviceId;
	} catch (error) {
		console.warn("⚠️ [deviceId] Error obtaining device ID:", error);
		const fallbackId = `${Platform.OS}-fallback-${Date.now().toString(36)}`;
		cachedDeviceId = fallbackId;
		return fallbackId;
	}
}

/**
 * Returns a user-friendly device name.
 * - Android: "<Brand> <Model>" (e.g. "Google Pixel 8", "Samsung Galaxy S23")
 * - iOS: "iPhone" or "iPad"
 * - Other: "Mobile Device"
 */
export function getDeviceName(): string {
	if (cachedDeviceName) {
		return cachedDeviceName;
	}

	if (Platform.OS === "android") {
		const constants: any = Platform.constants || {};
		const brand = constants.Brand || constants.brand || constants.Manufacturer || "";
		const model = constants.Model || constants.model || "";

		const parts = [brand, model].map((s) => String(s || "").trim()).filter(Boolean);
		// Avoid duplicate prefix like "Google Google Pixel 8"
		let name = "";
		if (parts.length === 2 && parts[1].toLowerCase().startsWith(parts[0].toLowerCase())) {
			name = parts[1];
		} else {
			name = parts.join(" ");
		}

		cachedDeviceName = name || "Android Device";
		return cachedDeviceName;
	}

	if (Platform.OS === "ios") {
		const isPad = (Platform as any).isPad || Platform.constants?.interfaceIdiom === "pad";
		cachedDeviceName = isPad ? "iPad" : "iPhone";
		return cachedDeviceName;
	}

	cachedDeviceName = "Device";
	return cachedDeviceName;
}
