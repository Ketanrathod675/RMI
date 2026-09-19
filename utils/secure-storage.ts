import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import { decode } from "@/utils/encode_decode";

export const SENSITIVE_STORAGE_KEYS = ["@access-token", "@refresh-token", "@token", "@otp-verify-response"] as const;
const isNative = Platform.OS !== "web";

/**
 * Expo SecureStore only allows alphanumeric characters, '.', '-', and '_'.
 * Strip leading '@' and replace any other invalid characters with '_'.
 */
export const toSecureStoreKey = (key: string): string => {
	const sanitized = key.replace(/^@+/, "").replace(/[^a-zA-Z0-9._-]/g, "_");
	return sanitized || "secure_key";
};

export const SecureStorage = {
	async setSensitive(key: string, value: string): Promise<void> {
		if (!isNative) {
			console.warn(`[SecureStorage] ${key} is stored without encryption on web.`);
			await AsyncStorage.setItem(key, value);
			return;
		}
		const secureKey = toSecureStoreKey(key);
		await SecureStore.setItemAsync(secureKey, value);
	},

	async getSensitive(key: string): Promise<string | null> {
		if (!isNative) {
			return AsyncStorage.getItem(key);
		}
		const secureKey = toSecureStoreKey(key);
		return SecureStore.getItemAsync(secureKey);
	},

	async removeSensitive(key: string): Promise<void> {
		if (!isNative) {
			await AsyncStorage.removeItem(key);
			return;
		}
		const secureKey = toSecureStoreKey(key);
		await SecureStore.deleteItemAsync(secureKey);
	},

	/** Moves a Base64 legacy value to encrypted storage the first time it is read. */
	async getSensitiveWithLegacyMigration(key: string): Promise<string | null> {
		try {
			const stored = await this.getSensitive(key);
			if (stored !== null) return stored;
		} catch (error) {
			console.warn(`[SecureStorage] Error reading sensitive key ${key}:`, error);
		}

		const legacy = await AsyncStorage.getItem(key);
		if (!legacy) return null;

		try {
			const value = decode(legacy);
			await this.setSensitive(key, value);
			await AsyncStorage.removeItem(key);
			return value;
		} catch {
			await AsyncStorage.removeItem(key);
			return null;
		}
	},

	async clearAllTokens(): Promise<void> {
		await Promise.all(
			SENSITIVE_STORAGE_KEYS.flatMap((key) => [
				this.removeSensitive(key),
				AsyncStorage.removeItem(key),
			])
		);
	},
};

export default SecureStorage;
