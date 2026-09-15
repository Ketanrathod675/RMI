import type { Href } from "expo-router";
import { getStorageItem, removeStorageItem, setStorageItem, STORAGE_KEYS } from "./storage";

/**
 * Save the current screen to storage for journey resumption
 */
export const saveCurrentScreen = async (screen: Href) => {
	try {
		await setStorageItem(STORAGE_KEYS["@last-visited-screen"], screen as string);
		if (__DEV__) {
			console.log("📍 [JourneyTracker] Saved current screen:", screen);
		}
	} catch (error) {
		if (__DEV__) {
			console.error("❌ [JourneyTracker] Error saving current screen:", error);
		}
	}
};

/**
 * Get the last visited screen from storage
 */
export const getLastVisitedScreen = async (): Promise<string | null> => {
	try {
		const screen = await getStorageItem(STORAGE_KEYS["@last-visited-screen"]);
		return screen;
	} catch (error) {
		if (__DEV__) {
			console.error("❌ [JourneyTracker] Error getting last visited screen:", error);
		}
		return null;
	}
};

/**
 * Clear the last visited screen (when journey is complete)
 */
export const clearLastVisitedScreen = async () => {
	try {
		await removeStorageItem(STORAGE_KEYS["@last-visited-screen"]);
		if (__DEV__) {
			console.log("📍 [JourneyTracker] Cleared last visited screen");
		}
	} catch (error) {
		if (__DEV__) {
			console.error("❌ [JourneyTracker] Error clearing last visited screen:", error);
		}
	}
};
