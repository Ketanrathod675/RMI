import { useTranslation } from "@/hooks/useTranslation";
import { height } from "@/utils/dimensions";
import { MaterialIcons } from "@expo/vector-icons";
import React, { useRef, useState, type FC } from "react";
import {
	Animated,
	Dimensions,
	FlatList,
	Modal,
	Pressable,
	StyleSheet,
	Text,
	TextInput,
	TextStyle,
	TouchableOpacity,
	View,
	ViewStyle,
} from "react-native";

const { height: screenHeight } = Dimensions.get("window");

export type SelectOption = {
	label: string;
	value: string | number;
};

type SelectProps = {
	options: SelectOption[];
	selectedValue?: string | number;
	onSelect: (value: string | number) => void;
	placeholder?: string;
	title?: string;
	disabled?: boolean;
	containerStyle?: ViewStyle;
	buttonStyle?: ViewStyle;
	buttonTextStyle?: TextStyle;
	modalStyle?: ViewStyle;
	optionStyle?: ViewStyle;
	optionTextStyle?: TextStyle;
	selectedOptionStyle?: ViewStyle;
	selectedOptionTextStyle?: TextStyle;
	titleStyle?: TextStyle;
	showCheckmark?: boolean;
	searchable?: boolean;
	searchPlaceholder?: string;
};

export const Select: FC<SelectProps> = ({
	options,
	selectedValue,
	onSelect,
	placeholder,
	title,
	disabled = false,
	containerStyle,
	buttonStyle,
	buttonTextStyle,
	modalStyle,
	optionStyle,
	optionTextStyle,
	selectedOptionStyle,
	selectedOptionTextStyle,
	titleStyle,
	showCheckmark = true,
	searchable = false,
	searchPlaceholder,
}) => {
	const { t } = useTranslation();
	const [isVisible, setIsVisible] = useState(false);
	const [searchText, setSearchText] = useState("");
	const slideAnim = useRef(new Animated.Value(screenHeight)).current;

	const selectedOption = options.find((option) => option.value === selectedValue);

	// Use translation with fallbacks
	const displayPlaceholder = placeholder || t("selectAnOption", "Select an option");
	const displayTitle = title || t("selectAnOption", "Select an option");
	const displaySearchPlaceholder = searchPlaceholder || t("searchPlaceholder", "Search...");

	// Filter options based on search text
	const filteredOptions = searchable
		? options.filter((option) => option.label.toLowerCase().includes(searchText.toLowerCase()))
		: options;

	const showModal = () => {
		setIsVisible(true);
		Animated.timing(slideAnim, {
			toValue: 0,
			duration: 300,
			useNativeDriver: true,
		}).start();
	};

	const hideModal = () => {
		Animated.timing(slideAnim, {
			toValue: screenHeight,
			duration: 250,
			useNativeDriver: true,
		}).start(() => {
			setIsVisible(false);
			setSearchText("");
		});
	};

	const handleSelect = (value: string | number) => {
		onSelect(value);
		hideModal();
	};

	const handleOutsidePress = () => {
		hideModal();
	};

	const handleButtonPress = () => {
		if (!disabled) {
			showModal();
		}
	};

	const renderOption = ({ item }: { item: SelectOption }) => {
		const isSelected = item.value === selectedValue;

		return (
			<TouchableOpacity
				style={[
					styles.option,
					optionStyle,
					isSelected && styles.selectedOption,
					isSelected && selectedOptionStyle,
				]}
				onPress={() => handleSelect(item.value)}
				activeOpacity={0.7}>
				<Text
					style={[
						styles.optionText,
						optionTextStyle,
						isSelected && styles.selectedOptionText,
						isSelected && selectedOptionTextStyle,
					]}>
					{item.label}
				</Text>
				{showCheckmark && isSelected && (
					<MaterialIcons name="check" size={20} color="#B7FB52" />
				)}
			</TouchableOpacity>
		);
	};

	return (
		<View style={[styles.container, containerStyle]}>
			<TouchableOpacity
				style={[styles.button, buttonStyle, disabled && styles.buttonDisabled]}
				onPress={handleButtonPress}
				activeOpacity={0.7}
				disabled={disabled}>
				<Text
					style={[
						styles.buttonText,
						buttonTextStyle,
						disabled && styles.buttonTextDisabled,
						!selectedOption && styles.placeholderText,
					]}>
					{selectedOption?.label || displayPlaceholder}
				</Text>
				<Text style={styles.chevron}>▼</Text>
			</TouchableOpacity>

			<Modal visible={isVisible} transparent animationType="none" onRequestClose={hideModal}>
				<Pressable style={styles.overlay} onPress={handleOutsidePress}>
					<Animated.View
						style={[
							styles.modalContainer,
							{
								transform: [{ translateY: slideAnim }],
							},
						]}>
						<Pressable style={[styles.modal, modalStyle]}>
							{/* Horizontal Marker */}
							<View style={styles.horizontalMarker} />

							<Text style={[styles.title, titleStyle]}>{displayTitle}</Text>

							{/* Search Box */}
							{searchable && (
								<View style={styles.searchContainer}>
									<MaterialIcons
										name="search"
										size={20}
										color="#999"
										style={styles.searchIcon}
									/>
									<TextInput
										style={styles.searchInput}
										placeholder={displaySearchPlaceholder}
										value={searchText}
										onChangeText={setSearchText}
										placeholderTextColor="#999"
									/>
								</View>
							)}

							{/* Options List */}
							{filteredOptions.length > 0 ? (
								<FlatList
									data={filteredOptions}
									renderItem={renderOption}
									keyExtractor={(item) => item.value.toString()}
									style={styles.optionsList}
									showsVerticalScrollIndicator={false}
									bounces={false}
								/>
							) : (
								<View style={styles.noResultsContainer}>
									<Text style={styles.noResultsText}>{t("noResultsFound", "No results found")}</Text>
								</View>
							)}
						</Pressable>
					</Animated.View>
				</Pressable>
			</Modal>
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		width: "100%",
		marginVertical: 0,
	},
	button: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: 16,
		paddingVertical: 14,
		borderWidth: 1,
		borderColor: "#D1D5DB",
		borderRadius: 10,
		backgroundColor: "#FFFFFF",
		minHeight: 52,
	},
	buttonDisabled: {
		backgroundColor: "#F9FAFB",
		borderColor: "#E5E7EB",
	},
	buttonText: {
		fontSize: 15,
		color: "#374151",
		flex: 1,
	},
	buttonTextDisabled: {
		color: "#999999",
	},
	placeholderText: {
		color: "#999999",
	},
	chevron: {
		fontSize: 12,
		color: "#666666",
		marginLeft: 8,
	},
	overlay: {
		flex: 1,
		backgroundColor: "rgba(0, 0, 0, 0.5)",
		justifyContent: "flex-end",
	},
	modalContainer: {
		width: "100%",
		maxHeight: "80%",
	},
	modal: {
		backgroundColor: "#FFFFFF",
		borderTopLeftRadius: 20,
		borderTopRightRadius: 20,
		paddingHorizontal: 0,
		paddingBottom: 20,
		shadowColor: "#000",
		shadowOffset: {
			width: 0,
			height: -2,
		},
		shadowOpacity: 0.25,
		shadowRadius: 4,
		elevation: 5,
	},
	horizontalMarker: {
		width: 40,
		height: 4,
		backgroundColor: "#E0E0E0",
		borderRadius: 2,
		alignSelf: "center",
		marginTop: 8,
		marginBottom: 16,
	},
	title: {
		fontSize: 18,
		fontWeight: "600",
		color: "#333333",
		textAlign: "center",
		marginBottom: 20,
		paddingHorizontal: 24,
	},
	searchContainer: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: "#F5F5F5",
		borderRadius: 12,
		marginHorizontal: 24,
		marginBottom: 16,
		paddingHorizontal: 16,
		paddingVertical: height(0.5),
	},
	searchIcon: {
		marginRight: 8,
	},
	searchInput: {
		flex: 1,
		fontSize: 16,
		color: "#333",
	},
	optionsList: {
		maxHeight: 300,
	},
	option: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingVertical: 16,
		paddingHorizontal: 24,
	},
	selectedOption: {
		backgroundColor: "transparent",
	},
	optionText: {
		fontSize: 16,
		color: "#333333",
		flex: 1,
	},
	selectedOptionText: {
		color: "#333333",
		fontWeight: "500",
	},
	noResultsContainer: {
		paddingVertical: 32,
		paddingHorizontal: 24,
		alignItems: "center",
		justifyContent: "center",
	},
	noResultsText: {
		fontSize: 16,
		color: "#999999",
		textAlign: "center",
	},
});
