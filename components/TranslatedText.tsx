import { type TranslationKey } from "@/constants/translations";
import { useTranslation } from "@/hooks/useTranslation";
import { font } from "@/utils/dimensions";
import React from "react";
import { Text, type TextProps } from "react-native";

export interface TranslatedTextProps extends Omit<TextProps, "children"> {
	/** Translation key to look up */
	translationKey: TranslationKey;
	/** Fallback text if translation not found */
	fallback?: string;
	/** Values to interpolate in the translation */
	values?: Record<string, string | number>;
	/** Raw text to display instead of translation (for dynamic content) */
	children?: string | React.ReactNode;
	required?: boolean;
}

/**
 * Text component that automatically translates based on current language
 * Can be used with translationKey for static translations or children for dynamic content
 */
export const TranslatedText: React.FC<TranslatedTextProps> = ({
	translationKey,
	fallback,
	values,
	children,
	required = false,
	...textProps
}) => {
	const { t, tWithValues } = useTranslation();

	// If children are provided, use them directly (for dynamic content)
	if (children !== undefined) {
		return <Text {...textProps}>{children}</Text>;
	}

	// Get translated text
	const translatedText = values
		? tWithValues(translationKey, values, fallback)
		: t(translationKey, fallback);

	return (
		<Text {...textProps}>
			{translatedText}{" "}
			{required && <Text style={{ color: "#d32f2f", fontSize: font(1.5) }}>*</Text>}
		</Text>
	);
};
