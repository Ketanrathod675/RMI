import AsyncStorage from "@react-native-async-storage/async-storage";
import type {
    Callback,
    CallbackWithResult,
    MultiCallback,
    MultiGetCallback,
} from "@react-native-async-storage/async-storage/src/types";

export const STORAGE_KEYS = {
	"@token": "@token",
	"@set-language": "@set-language",
	"@is-logged-in": "@is-logged-in",
	"@is-mpin-set": "@is-mpin-set",
	"@phone-number": "@phone-number",
	"@country-code": "@country-code",
	"@otp-verify-response": "@otp-verify-response",
	"@access-token": "@access-token",
	"@refresh-token": "@refresh-token",
	"@token-type": "@token-type",
	"@user-id": "@user-id",
	"@transaction-id": "@transaction-id",
	"@assessment-timer-id": "@assessment-timer-id",
	"@payment-timer-start": "@payment-timer-start",
	"@last-visited-screen": "@last-visited-screen",
	"@in-permission-flow": "@in-permission-flow",
	"@digilocker-uid": "@digilocker-uid",
	"@digilocker-timer": "@digilocker-timer",
	"@digilocker-transaction-id": "@digilocker-transaction-id",
	"@digilocker-status": "@digilocker-status",
	"@digilocker-timestamp": "@digilocker-timestamp",
	"@auto-debit-status": "@auto-debit-status",
	"@auto-debit-timestamp": "@auto-debit-timestamp",
	"@repayment-status": "@repayment-status",
	"@repayment-timestamp": "@repayment-timestamp",
	"@expo-push-token": "@expo-push-token",
	"@push-token-generated-at": "@push-token-generated-at",
	"@fcm-token-debug": "@fcm-token-debug",
	"@fcm-token-error": "@fcm-token-error",
	"@completion-date": "@completion-date",
	"@user-selfie": "@user-selfie",
	"@no-approved-amount-flag": "@no-approved-amount-flag",
	"@loan-rejected-flag": "@loan-rejected-flag",
	"@app-installed-flag": "@app-installed-flag",
	"@app-version": "@app-version",
	"@applicant-from": "@applicant-from",
} as const;

export const TempKeys = [
	"@otp-verify-response",
	"@transaction-id",
	"@assessment-timer-id",
	"@payment-timer-start",
	"@last-visited-screen",
	"@in-permission-flow",
	"@digilocker-uid",
	"@digilocker-timer",
	"@digilocker-transaction-id",
	"@digilocker-status",
	"@digilocker-timestamp",
	"@repayment-status",
	"@repayment-timestamp",
	"@auto-debit-timestamp",
	"@expo-push-token",
	"@push-token-generated-at",
	"@fcm-token-debug",
	"@fcm-token-error",
	"@user-selfie",
] as const;

export const AuthKeys = [
	"@token",
	"@is-logged-in",
	"@is-mpin-set",
	"@phone-number",
	"@country-code",
	"@access-token",
	"@refresh-token",
	"@token-type",
	"@user-id",
	"@applicant-from",
	"@completion-date",
] as const;

export const RemovableKeys = [...AuthKeys, ...TempKeys] as const;

export type StorageKeys = keyof typeof STORAGE_KEYS;

export const setStorageItem = async (key: StorageKeys, value: string, callback?: Callback) => {
	return await AsyncStorage.setItem(key, value, callback);
};

export const getStorageItem = async (key: StorageKeys, callback?: CallbackWithResult<string>) => {
	return await AsyncStorage.getItem(key, callback);
};

export const removeStorageItem = async (key: StorageKeys, callback?: Callback) => {
	return await AsyncStorage.removeItem(key, callback);
};

export const clearStorage = async (callback?: Callback) => {
	return await AsyncStorage.clear(callback);
};

export const setMultipleStorageItems = async (
	items: readonly (readonly [StorageKeys, string])[],
	callback?: MultiCallback,
) => {
	return await AsyncStorage.multiSet(items, callback);
};

export const getMultipleStorageItems = async (
	keys: readonly StorageKeys[],
	callback?: MultiGetCallback,
) => {
	return await AsyncStorage.multiGet(keys, callback);
};

export const removeMultipleStorageItems = async (
	keys: readonly StorageKeys[],
	callback?: MultiCallback,
) => {
	return await AsyncStorage.multiRemove(keys, callback);
};

export const getAllStorageKeys = async (callback?: CallbackWithResult<readonly string[]>) => {
	return await AsyncStorage.getAllKeys(callback);
};
