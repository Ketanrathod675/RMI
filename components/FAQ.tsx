import { MaterialIcons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
	Platform,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from "react-native";

export interface FAQItem {
	id: string | number;
	question: string;
	answer: string;
}

interface FAQProps {
	data: FAQItem[];
	onViewAll?: () => void;
}

const FAQ: React.FC<FAQProps> = ({ data }) => {
	const [expandedId, setExpandedId] = useState<string | number | null>(null);

	const toggleItem = (id: string | number) => {
		setExpandedId((prev) => (prev === id ? null : id));
	};

	if (!data || data.length === 0) {
		return null;
	}

	return (
		<View style={styles.container}>
			{data.map((item, index) => {
				const isExpanded = expandedId === item.id;
				const isLast = index === data.length - 1;

				return (
					<View
						key={item.id.toString()}
						style={[
							styles.itemContainer,
							!isLast && styles.itemBorderBottom,
						]}>
						<TouchableOpacity
							activeOpacity={0.7}
							style={styles.questionRow}
							onPress={() => toggleItem(item.id)}>
							<Text
								style={[
									styles.question,
									isExpanded && styles.questionActive,
								]}>
								{item.question}
							</Text>

							<MaterialIcons
								name={isExpanded ? "keyboard-arrow-up" : "keyboard-arrow-down"}
								size={26}
								color={isExpanded ? "#4CAE38" : "#2E3A59"}
							/>
						</TouchableOpacity>

						{isExpanded && item.answer ? (
							<View style={styles.answerContainer}>
								<Text style={styles.answer}>{item.answer}</Text>
							</View>
						) : null}
					</View>
				);
			})}
		</View>
	);
};

export default FAQ;

const styles = StyleSheet.create({
	container: {
		backgroundColor: "#FFFFFF",
		borderWidth: 1,
		borderColor: "#E2E8F0",
		borderRadius: 8,
		overflow: "hidden",
		marginTop: 8,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.03,
		shadowRadius: 3,
		elevation: 1,
	},
	itemContainer: {
		backgroundColor: "#FFFFFF",
	},
	itemBorderBottom: {
		borderBottomWidth: 1,
		borderBottomColor: "#EEF2ED",
	},
	questionRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingHorizontal: 16,
		paddingVertical: 15,
	},
	question: {
		flex: 1,
		fontSize: 15,
		fontWeight: "400",
		color: "#2D3748",
		marginRight: 12,
		lineHeight: 20,
		fontFamily: Platform.select({ ios: "System", android: "sans-serif" }),
	},
	questionActive: {
		fontWeight: "700",
		color: "#14201A",
	},
	answerContainer: {
		paddingHorizontal: 16,
		paddingBottom: 16,
		paddingTop: 0,
		backgroundColor: "#FFFFFF",
	},
	answer: {
		fontSize: 13.5,
		color: "#475569",
		lineHeight: 20,
		fontFamily: Platform.select({ ios: "System", android: "sans-serif" }),
	},
});
