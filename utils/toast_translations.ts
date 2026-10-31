import { translations } from "@/constants/translations";
import { getStorageItem, STORAGE_KEYS } from "@/utils/storage";
import { store } from "@/store";

let currentLanguage: "english" | "hindi" = "english";
getStorageItem(STORAGE_KEYS["@set-language"]).then((stored) => {
	if (stored === "hindi" || stored === "english") currentLanguage = stored;
}).catch(() => {});

export const getActiveLanguage = (): "english" | "hindi" => {
	try {
		const lang = store.getState()?.global?.language;
		if (lang === "hindi" || lang === "english") return lang;
	} catch {}
	return currentLanguage;
};

export const getSyncTranslation = (
	key: keyof typeof translations.english,
	fallback?: string,
): string => {
	const lang = getActiveLanguage();
	return translations[lang]?.[key] || translations.english[key] || fallback || (key as string);
};

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
		currentLanguage = language;

		return translations[language][key] || translations.english[key] || key;
	} catch (error) {
		console.warn("Failed to load toast translation", { key });
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
		console.warn("Failed to show localized toast");
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
