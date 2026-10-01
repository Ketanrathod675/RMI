import { dark, primary, white } from "@/constants/Colors";
import { font, height, width } from "@/utils/dimensions";
import { MaterialIcons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
	Keyboard,
	StyleSheet,
	Text,
	TextInput,
	TextStyle,
	TouchableOpacity,
	View,
	ViewStyle,
} from "react-native";

export type DropdownOption = {
	label: string;
	value: string | number;
};

export interface DropdownProps {
	options: DropdownOption[];
	selectedValue?: string | number;
	onSelect: (value: string | number) => void;
	placeholder?: string;
	disabled?: boolean;
	containerStyle?: ViewStyle;
	triggerStyle?: ViewStyle;
	menuStyle?: ViewStyle;
	optionStyle?: ViewStyle;
	optionTextStyle?: TextStyle;
	error?: boolean;
}

export const Dropdown: React.FC<DropdownProps> = ({
	options,
	selectedValue,
	onSelect,
	placeholder = "Select an option",
	disabled = false,
	containerStyle,
	triggerStyle,
	menuStyle,
	optionStyle,
	optionTextStyle,
	error = false,
}) => {
	const [isOpen, setIsOpen] = useState(false);

	const selectedOption = options.find((opt) => opt.value === selectedValue);

	const dismissActiveInput = () => {
		Keyboard.dismiss();
		try {
			const currentlyFocused = (TextInput as any).State?.currentlyFocusedInput?.();
			if (currentlyFocused) {
				(TextInput as any).State?.blurTextInput?.(currentlyFocused);
				(currentlyFocused as any)?.blur?.();
			}
		} catch {
			// ignore fallback
		}
	};

	const handleToggle = () => {
		if (!disabled) {
			dismissActiveInput();
			setIsOpen((prev) => !prev);
		}
	};

	const handleSelect = (value: string | number) => {
		dismissActiveInput();
		onSelect(value);
		setIsOpen(false);
	};

	return (
		<View style={[styles.container, containerStyle]}>
			<TouchableOpacity
				style={[
					styles.trigger,
					isOpen && styles.triggerOpen,
					error && styles.triggerError,
					disabled && styles.triggerDisabled,
					triggerStyle,
				]}
				onPress={handleToggle}
				activeOpacity={0.8}
				disabled={disabled}>
				<Text
					style={[
						styles.selectedText,
						!selectedOption && styles.placeholderText,
						disabled && styles.disabledText,
					]}
					numberOfLines={1}>
					{selectedOption ? selectedOption.label : placeholder}
				</Text>
				<MaterialIcons
					name={isOpen ? "keyboard-arrow-up" : "keyboard-arrow-down"}
					size={24}
					color={disabled ? "#999" : dark}
				/>
			</TouchableOpacity>

			{isOpen && (
				<View style={[styles.dropdownMenu, menuStyle]}>
					{options.map((option, index) => {
						const isSelected = option.value === selectedValue;
						const isLast = index === options.length - 1;

						return (
							<TouchableOpacity
								key={String(option.value)}
								style={[
									styles.optionItem,
									isSelected && styles.optionItemSelected,
									isLast && styles.noBorderBottom,
									optionStyle,
								]}
								onPress={() => handleSelect(option.value)}
								activeOpacity={0.7}>
								<Text
									style={[
										styles.optionText,
										isSelected && styles.optionTextSelected,
										optionTextStyle,
									]}>
									{option.label}
								</Text>
								{isSelected && (
									<MaterialIcons name="check" size={20} color={dark} />
								)}
							</TouchableOpacity>
						);
					})}
				</View>
			)}
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		width: "100%",
	},
	trigger: {
		backgroundColor: white,
		borderRadius: width(2),
		paddingVertical: height(1.5),
		paddingHorizontal: width(4),
		minHeight: height(6),
		borderWidth: 1,
		borderColor: "#E5E5E5",
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},
	triggerOpen: {
		borderColor: dark + "80",
		borderWidth: 1.5,
	},
	triggerError: {
		borderColor: "#d32f2f",
	},
	triggerDisabled: {
		backgroundColor: "#F5F5F5",
		opacity: 0.7,
	},
	selectedText: {
		fontSize: font(1.8),
		color: dark,
		flex: 1,
		fontWeight: "500",
	},
	placeholderText: {
		color: "#999",
		fontWeight: "normal",
	},
	disabledText: {
		color: "#999",
	},
	dropdownMenu: {
		marginTop: height(0.6),
		backgroundColor: white,
		borderRadius: width(2),
		borderWidth: 1,
		borderColor: "#E5E5E5",
		overflow: "hidden",
		elevation: 3,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.1,
		shadowRadius: 3,
	},
	optionItem: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingVertical: height(1.6),
		paddingHorizontal: width(4),
		borderBottomWidth: 1,
		borderBottomColor: "#F1F5F9",
	},
	optionItemSelected: {
		backgroundColor: "#F8FAFC",
	},
	noBorderBottom: {
		borderBottomWidth: 0,
	},
	optionText: {
		fontSize: font(1.7),
		color: "#475569",
	},
	optionTextSelected: {
		color: dark,
		fontWeight: "600",
	},
});
