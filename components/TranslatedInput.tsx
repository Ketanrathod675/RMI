import { dark, white } from "@/constants/Colors";
import { type TranslationKey } from "@/constants/translations";
import { useTranslation } from "@/hooks/useTranslation";
import { font, height, width } from "@/utils/dimensions";
import React, { forwardRef, useState } from "react";
import { StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { TranslatedText } from "./TranslatedText";

interface TranslatedInputProps extends TextInputProps {
	/** Translation key for the label */
	labelKey?: TranslationKey;
	/** Translation key for the placeholder */
	placeholderKey?: TranslationKey;
	/** Translation key for the error message */
	errorKey?: TranslationKey;
	/** Raw label text (overrides labelKey) */
	label?: string;
	/** Raw placeholder text (overrides placeholderKey) */
	placeholder?: string;
	/** Raw error text (overrides errorKey) */
	error?: string;
	/** Custom styles for the container */
	containerStyle?: any;
	/** Whether to hide the label */
	hideLabel?: boolean;
	/** Whether the input is disabled */
	disabled?: boolean;
	/** to show an asterisk next to the label */
	required?: boolean;
}

export const TranslatedInput = forwardRef<TextInput, TranslatedInputProps>(
	(
		{
			labelKey,
			placeholderKey,
			errorKey,
			label,
			placeholder,
			error,
			style,
			containerStyle,
			hideLabel,
			disabled,
			required = false,
			...props
		},
		ref,
	) => {
		const { t } = useTranslation();
		const [isFocused, setIsFocused] = useState(false);

		// Determine label text (raw label takes priority over translation key)
		const labelText = label || (labelKey ? t(labelKey) : undefined);

		// Determine placeholder text (raw placeholder takes priority over translation key)
		const placeholderText = placeholder || (placeholderKey ? t(placeholderKey) : undefined);

		// Determine error text (raw error takes priority over translation key)
		const errorText = error || (errorKey ? t(errorKey) : undefined);

		const hasLabel = !hideLabel && labelText;

		return (
			<View
				style={[
					styles.container,
					containerStyle,
					hasLabel && { marginBottom: height(1) },
					!hasLabel && { marginBottom: 0 },
				]}>
				{hasLabel && (
					<Text>
						<TranslatedText
							style={styles.label}
							translationKey={labelKey!}
							fallback={labelText}>
							{!labelKey ? labelText : undefined}
						</TranslatedText>
						{required && <Text style={styles.requiredAsterisk}>*</Text>}
					</Text>
				)}
				<TextInput
					ref={ref}
					style={[
						styles.input,
						style,
						disabled && styles.disabledInput,
						isFocused && styles.focusedInput,
					]}
					placeholder={placeholderText}
					placeholderTextColor={dark + "99"}
					selectionColor={dark + "CC"} // Cursor and selection color
					cursorColor={dark} // Android cursor color
					editable={!disabled}
					onFocus={(e) => {
						setIsFocused(true);
						props.onFocus?.(e);
					}}
					onBlur={(e) => {
						setIsFocused(false);
						props.onBlur?.(e);
					}}
					{...props}
				/>
				{errorText && (
					<TranslatedText
						style={styles.error}
						translationKey={errorKey!}
						fallback={errorText}>
						{!errorKey ? errorText : undefined}
					</TranslatedText>
				)}
			</View>
		);
	},
);

TranslatedInput.displayName = "TranslatedInput";

const styles = StyleSheet.create({
	container: {
		marginVertical: height(1.5),
	},
	label: {
		color: dark,
		fontSize: font(1.5),
		marginBottom: height(1),
		marginLeft: width(1),
	},
	input: {
		backgroundColor: white,
		borderRadius: width(2),
		paddingVertical: height(1.5),
		paddingHorizontal: width(4),
		fontSize: font(1.8),
		color: dark,
		borderWidth: 1,
		borderColor: "#E5E5E5",
		minHeight: height(6), // Ensure consistent height for cursor visibility
		textAlignVertical: "center", // Android text alignment
	},
	disabledInput: {
		backgroundColor: "#f5f5f5",
		color: "#999",
	},
	focusedInput: {
		borderColor: dark + "80",
		borderWidth: 2,
		backgroundColor: "#FAFAFA", // Slightly different background when focused
	},
	error: {
		color: "#d32f2f",
		fontSize: font(1.2),
		marginLeft: width(1),
		marginTop: height(0.2),
	},
	requiredAsterisk: {
		color: "#d32f2f",
		fontSize: font(1.5),
	},
});

export default TranslatedInput;
