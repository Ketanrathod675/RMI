import { translations } from "@/constants/translations";
import { getStorageItem, STORAGE_KEYS } from "@/utils/storage";

/**
 * Get translation for a key based on the stored language preference
 * This is used in contexts where the useTranslation hook is not available (like axios interceptors)
 */
export const getTranslationForKey = async (
	key: keyof typeof translations.english,
): Promise<string> => {
	try {
		const storedLanguage = await getStorageItem(STORAGE_KEYS["@set-language"]);
		const language = storedLanguage === "hindi" ? "hindi" : "english";

		return translations[language][key] || translations.english[key] || key;
	} catch (error) {
		console.warn("Failed to get translation for key:", key, error);
		// Fallback to English if there's any error
		return translations.english[key] || key;
	}
};

/**
 * Show a localized toast message
 * This function gets the language from storage and shows the appropriate translation
 */
export const showLocalizedToast = async (
	toastFunction: (config: {
		type: string;
		text1: string;
		text2?: string;
		visibilityTime?: number;
	}) => void,
	config: {
		type: "success" | "error" | "info";
		text1Key: keyof typeof translations.english;
		text2Key?: keyof typeof translations.english;
		text2Fallback?: string;
		visibilityTime?: number;
	},
) => {
	try {
		const text1 = await getTranslationForKey(config.text1Key);
		const text2 = config.text2Key
			? await getTranslationForKey(config.text2Key)
			: config.text2Fallback;

		toastFunction({
			type: config.type,
			text1,
			text2,
			visibilityTime: config.visibilityTime,
		});
	} catch (error) {
		console.warn("Failed to show localized toast:", error);
		// Fallback to English
		toastFunction({
			type: config.type,
			text1: translations.english[config.text1Key] || config.text1Key,
			text2: config.text2Key
				? translations.english[config.text2Key] || config.text2Key
				: config.text2Fallback,
			visibilityTime: config.visibilityTime,
		});
	}
};
