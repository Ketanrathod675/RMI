import { translations, type Language, type TranslationKey } from "@/constants/translations";
import { type RootState } from "@/store";
import { useSelector } from "react-redux";

/**
 * Custom hook for accessing translations based on current language
 * @returns Object with translation function and current language
 */
export const useTranslation = () => {
	// Get current language from Redux store
	const currentLanguage = useSelector((state: RootState) => state.global.language) || "english";

	/**
	 * Get translation for a given key
	 * @param key - Translation key
	 * @param fallback - Optional fallback text if translation not found
	 * @returns Translated text
	 */
	const t = (key: TranslationKey, fallback?: string): string => {
		try {
			const translation = translations[currentLanguage as Language]?.[key];

			if (translation !== undefined) {
				return translation;
			}

			// Fallback to English if translation not found in current language
			const englishTranslation = translations.english[key];
			if (englishTranslation !== undefined) {
				return englishTranslation;
			}

			// Return fallback or key if no translation found
			return fallback || key;
		} catch (error) {
			console.warn(`Translation error for key "${key}":`, error);
			return fallback || key;
		}
	};

	/**
	 * Get translation with interpolation support
	 * @param key - Translation key
	 * @param values - Object with values to interpolate
	 * @param fallback - Optional fallback text
	 * @returns Translated text with interpolated values
	 */
	const tWithValues = (
		key: TranslationKey,
		values: Record<string, string | number>,
		fallback?: string,
	): string => {
		let translation = t(key, fallback);

		// Replace placeholders like {{name}} with actual values
		Object.entries(values).forEach(([placeholder, value]) => {
			const regex = new RegExp(`{{${placeholder}}}`, "g");
			translation = translation.replace(regex, String(value));
		});

		return translation;
	};

	/**
	 * Check if current language is RTL (Right-to-Left)
	 * Currently only supporting LTR languages, but can be extended
	 */
	const isRTL = (currentLanguage as string) === "arabic" || (currentLanguage as string) === "urdu"; // Future support

	/**
	 * Get current language code
	 */
	const getCurrentLanguage = (): Language => {
		return (currentLanguage as Language) || "english";
	};

	/**
	 * Check if a specific language is currently active
	 */
	const isLanguage = (lang: Language): boolean => {
		return getCurrentLanguage() === lang;
	};

	return {
		t,
		tWithValues,
		currentLanguage: getCurrentLanguage(),
		isRTL,
		isLanguage,
		isEnglish: isLanguage("english"),
		isHindi: isLanguage("hindi"),
	};
};
