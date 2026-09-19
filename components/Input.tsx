import { dark, white } from "@/constants/Colors";
import { font, height, width } from "@/utils/dimensions";
import React, { forwardRef } from "react";
import { StyleSheet, Text, TextInput, TextInputProps, View } from "react-native";

interface InputProps extends TextInputProps {
	label?: string;
	error?: string;
	containerStyle?: any;
	hideLabel?: boolean;
	disabled?: boolean;
	required?: boolean;
}

const Input = forwardRef<TextInput, InputProps>(
	({ label, error, style, containerStyle, hideLabel, required = false, disabled = false, ...props }, ref) => {
		const hasLabel = !hideLabel && label;
		return (
			<View
				style={[
					styles.container,
					containerStyle,
					hasLabel && { marginBottom: height(1) },
					!hasLabel && { marginBottom: 0 },
				]}>
				{hasLabel && (
					<Text style={styles.label}>
						{label} {required && <Text style={styles.requiredAsterisk}>*</Text>}
					</Text>
				)}
				<TextInput
					ref={ref}
					style={[styles.input, style, disabled && styles.disabledInput]}
					placeholderTextColor={dark + "99"}
					editable={!disabled}
					selectTextOnFocus={!disabled}
					{...props}
				/>
				{error && <Text style={styles.error}>{error}</Text>}
			</View>
		);
	},
);

Input.displayName = "Input";

const styles = StyleSheet.create({
	container: {
		marginVertical: height(1.5),
	},
	label: {
		color: dark,
		fontSize: font(1.5),
		marginBottom: height(0.5),
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
	disabledInput: {
		backgroundColor: "#F5F5F5",
		color: "#666",
	},
});

export default Input;
