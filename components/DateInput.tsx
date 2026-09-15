import { dark, white } from "@/constants/Colors";
import { font, height, width } from "@/utils/dimensions";
import { MaterialIcons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import React, { useCallback, useEffect, useState } from "react";
import {
	Platform,
	StyleSheet,
	Text,
	TextInput,
	TextStyle,
	TouchableOpacity,
	View,
	ViewStyle,
} from "react-native";

interface DateInputProps {
	value?: Date;
	onChange: (date: Date) => void;
	placeholder?: string;
	label?: string;
	disabled?: boolean;
	required?: boolean;
	minimumDate?: Date;
	maximumDate?: Date;
	dateFormat?: "DD-MM-YYYY" | "MM-DD-YYYY" | "YYYY-MM-DD";
	containerStyle?: ViewStyle;
	inputStyle?: ViewStyle;
	inputTextStyle?: TextStyle;
	buttonStyle?: ViewStyle;
	labelStyle?: TextStyle;
	iconColor?: string;
	iconSize?: number;
	mode?: "date" | "time" | "datetime";
}

export const DateInput: React.FC<DateInputProps> = ({
	value,
	onChange,
	placeholder = "DD-MM-YYYY",
	label,
	disabled = false,
	required = false,
	minimumDate,
	maximumDate,
	dateFormat = "DD-MM-YYYY",
	containerStyle,
	inputStyle,
	inputTextStyle,
	labelStyle,
	iconColor = dark + "99",
	iconSize = 22,
	mode = "date",
}) => {
	const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

	const formatDate = useCallback(
		(date?: Date): string => {
			if (!date || !(date instanceof Date) || isNaN(date.getTime())) return "";

			const day = date.getDate().toString().padStart(2, "0");
			const month = (date.getMonth() + 1).toString().padStart(2, "0");
			const year = date.getFullYear();

			switch (dateFormat) {
				case "MM-DD-YYYY":
					return `${month}-${day}-${year}`;
				case "YYYY-MM-DD":
					return `${year}-${month}-${day}`;
				case "DD-MM-YYYY":
				default:
					return `${day}-${month}-${year}`;
			}
		},
		[dateFormat],
	);

	const [textValue, setTextValue] = useState<string>(formatDate(value));

	// Sync external value changes into text field
	useEffect(() => {
		if (value && value instanceof Date && !isNaN(value.getTime())) {
			setTextValue(formatDate(value));
		} else if (!value) {
			setTextValue("");
		}
	}, [value, formatDate]);

	const parseTypedDate = (digits: string): Date | null => {
		if (digits.length !== 8) return null;

		let day: number, month: number, year: number;

		if (dateFormat === "YYYY-MM-DD") {
			year = parseInt(digits.substring(0, 4), 10);
			month = parseInt(digits.substring(4, 6), 10);
			day = parseInt(digits.substring(6, 8), 10);
		} else if (dateFormat === "MM-DD-YYYY") {
			month = parseInt(digits.substring(0, 2), 10);
			day = parseInt(digits.substring(2, 4), 10);
			year = parseInt(digits.substring(4, 8), 10);
		} else {
			// DD-MM-YYYY
			day = parseInt(digits.substring(0, 2), 10);
			month = parseInt(digits.substring(2, 4), 10);
			year = parseInt(digits.substring(4, 8), 10);
		}

		if (month < 1 || month > 12) return null;
		if (day < 1 || day > 31) return null;
		if (year < 1900 || year > 2100) return null;

		const d = new Date(year, month - 1, day);
		if (
			d.getFullYear() === year &&
			d.getMonth() === month - 1 &&
			d.getDate() === day
		) {
			if (minimumDate && d < minimumDate) return null;
			if (maximumDate && d > maximumDate) return null;
			return d;
		}

		return null;
	};

	const formatInputString = (raw: string): string => {
		const digits = raw.replace(/[^0-9]/g, "");

		if (dateFormat === "YYYY-MM-DD") {
			let res = digits.substring(0, 4);
			if (digits.length > 4) res += "-" + digits.substring(4, 6);
			if (digits.length > 6) res += "-" + digits.substring(6, 8);
			return res;
		}

		// DD-MM-YYYY or MM-DD-YYYY
		let res = digits.substring(0, 2);
		if (digits.length > 2) res += "-" + digits.substring(2, 4);
		if (digits.length > 4) res += "-" + digits.substring(4, 8);
		return res;
	};

	const handleTextChange = (text: string) => {
		// Allow free backspacing / deleting
		if (text.length < textValue.length) {
			setTextValue(text);
			return;
		}

		const formatted = formatInputString(text);
		setTextValue(formatted);

		const digitsOnly = text.replace(/[^0-9]/g, "");
		if (digitsOnly.length === 8) {
			const parsed = parseTypedDate(digitsOnly);
			if (parsed) {
				onChange(parsed);
			}
		}
	};

	const handleBlur = () => {
		const digitsOnly = textValue.replace(/[^0-9]/g, "");
		if (digitsOnly.length === 8) {
			const parsed = parseTypedDate(digitsOnly);
			if (parsed) {
				onChange(parsed);
				setTextValue(formatDate(parsed));
				return;
			}
		}

		// If user typed an invalid/incomplete date, reset back to valid committed date
		if (value && value instanceof Date && !isNaN(value.getTime())) {
			setTextValue(formatDate(value));
		}
	};

	const handleDateChange = (event: any, selectedDate?: Date) => {
		if (Platform.OS === "android") {
			setIsDatePickerOpen(false);
		}
		if (event?.type === "dismissed") {
			setIsDatePickerOpen(false);
			return;
		}
		if (selectedDate) {
			onChange(selectedDate);
			setTextValue(formatDate(selectedDate));
			if (Platform.OS === "ios") {
				setIsDatePickerOpen(false);
			}
		}
	};

	const openDatePicker = () => {
		if (!disabled) {
			setIsDatePickerOpen(true);
		}
	};

	return (
		<View style={[styles.container, containerStyle]}>
			{label && (
				<Text style={[styles.label, labelStyle]}>
					{label}
					{required && <Text style={styles.requiredAsterisk}> *</Text>}
				</Text>
			)}

			<View
				style={[
					styles.inputContainer,
					inputStyle,
					disabled && styles.disabledInput,
				]}>
				<TextInput
					style={[
						styles.inputText,
						disabled && styles.disabledText,
						inputTextStyle,
					]}
					value={textValue}
					onChangeText={handleTextChange}
					onBlur={handleBlur}
					placeholder={placeholder}
					placeholderTextColor={dark + "80"}
					editable={!disabled}
					keyboardType="numeric"
					maxLength={10}
				/>

				<TouchableOpacity
					style={styles.calendarButton}
					onPress={openDatePicker}
					disabled={disabled}
					hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
					activeOpacity={0.7}>
					<MaterialIcons
						name="calendar-today"
						size={iconSize}
						color={disabled ? "#BBB" : iconColor}
					/>
				</TouchableOpacity>
			</View>

			{isDatePickerOpen && (
				<DateTimePicker
					value={
						value instanceof Date && !isNaN(value.getTime())
							? value
							: new Date(2000, 0, 1)
					}
					mode={mode}
					display={Platform.OS === "ios" ? "spinner" : "default"}
					minimumDate={minimumDate}
					maximumDate={maximumDate}
					onChange={handleDateChange}
				/>
			)}
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		marginVertical: height(1),
	},
	label: {
		color: dark,
		fontSize: font(1.5),
		marginBottom: height(1),
		marginLeft: width(1),
	},
	inputContainer: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		backgroundColor: white,
		borderRadius: width(2),
		paddingVertical: height(1),
		paddingHorizontal: width(4),
		borderWidth: 1,
		borderColor: "#E5E5E5",
		minHeight: height(6),
	},
	disabledInput: {
		backgroundColor: "#F5F5F5",
		borderColor: "#EAEAEA",
	},
	inputText: {
		fontSize: font(1.8),
		color: dark,
		flex: 1,
		paddingVertical: Platform.OS === "android" ? 4 : 0,
	},
	calendarButton: {
		paddingLeft: width(2),
		justifyContent: "center",
		alignItems: "center",
	},
	disabledText: {
		color: "#999",
	},
	requiredAsterisk: {
		color: "#d32f2f",
		fontSize: font(1.5),
	},
});

export default DateInput;
