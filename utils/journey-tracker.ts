import Logger from "@/utils/logger";
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
Logger.warn("Operation failed", { code: "operation_failed" });
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
Logger.warn("Operation failed", { code: "operation_failed" });
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
Logger.warn("Operation failed", { code: "operation_failed" });
		}
	}
};
