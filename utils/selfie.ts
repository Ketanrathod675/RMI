import Logger from "@/utils/logger";
import { getStorageItem, setStorageItem, STORAGE_KEYS } from "./storage";

/**
 * Updates the user's selfie in storage
 * This function can be called from any component when a selfie is captured
 */
export const updateUserSelfie = async (imageUri: string): Promise<void> => {
	try {
		await setStorageItem(STORAGE_KEYS["@user-selfie"], imageUri);
		if (__DEV__) {
			console.log("📸 Selfie updated in storage successfully");
		}
	} catch (error) {
Logger.warn("Operation failed", { code: "operation_failed" });
		throw error;
	}
};

/**
 * Gets the current user's selfie from storage
 */
export const getUserSelfie = async (): Promise<string | null> => {
	try {
		return await getStorageItem(STORAGE_KEYS["@user-selfie"]);
	} catch (error) {
Logger.warn("Operation failed", { code: "operation_failed" });
		return null;
	}
};
