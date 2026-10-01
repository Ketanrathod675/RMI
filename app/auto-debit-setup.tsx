import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, BackHandler } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRouter } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import ExitIntentModal from "@/components/assessment-fee/ExitIntentModal";
import { dark, white, primary } from "@/constants/Colors";
import { font, width, height } from "@/utils/dimensions";
import { useJourneyTracker } from "@/hooks/useJourneyTracker";

export default function AutoDebitSetup() {
	const insets = useSafeAreaInsets();
	const router = useRouter();
	const navigation = useNavigation();
	const [isExitModalVisible, setIsExitModalVisible] = useState(false);
	useJourneyTracker("/auto-debit-setup");

	useEffect(() => {
		const unsubscribe = navigation.addListener("beforeRemove", (e) => {
			if (["GO_BACK", "POP"].includes(e.data.action.type)) {
				e.preventDefault();
				setIsExitModalVisible(true);
			}
		});

		const backHandler = BackHandler.addEventListener("hardwareBackPress", () => {
			setIsExitModalVisible(true);
			return true;
		});

		return () => {
			unsubscribe();
			backHandler.remove();
		};
	}, [navigation]);

	return (
		<View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
			{/* Top Header */}
			<View style={styles.header}>
				<TouchableOpacity
					style={styles.backButton}
					onPress={() => setIsExitModalVisible(true)}
					accessibilityLabel="Go back"
				>
					<MaterialIcons name="arrow-back" size={24} color={dark} />
				</TouchableOpacity>
				<Text style={styles.headerTitle}>Auto-Debit Setup</Text>
				<View style={styles.headerRight} />
			</View>

			{/* Placeholder Body */}
			<View style={styles.content}>
				<View style={styles.iconCircle}>
					<MaterialIcons name="account-balance" size={40} color={primary} />
				</View>
				<Text style={styles.title}>Auto-Debit Setup</Text>
				<Text style={styles.subtitle}>
					Set up automated EMI repayments securely via eNACH / NetBanking. This feature is coming soon.
				</Text>
			</View>

			<ExitIntentModal
				visible={isExitModalVisible}
				onClose={() => setIsExitModalVisible(false)}
				onConfirmExit={() => {
					setIsExitModalVisible(false);
					router.replace("/(tabs)");
				}}
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#F9FAFB",
	},
	header: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: 16,
		paddingVertical: 12,
		backgroundColor: white,
		borderBottomWidth: 1,
		borderBottomColor: "#F3F4F6",
	},
	backButton: {
		padding: 6,
		borderRadius: 8,
	},
	headerTitle: {
		fontSize: 18,
		fontWeight: "600",
		color: dark,
	},
	headerRight: {
		width: 36,
	},
	content: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		paddingHorizontal: width(6),
	},
	iconCircle: {
		width: 80,
		height: 80,
		borderRadius: 40,
		backgroundColor: "#EEF2FF",
		justifyContent: "center",
		alignItems: "center",
		marginBottom: 20,
	},
	title: {
		fontSize: font(2.2),
		fontWeight: "700",
		color: dark,
		marginBottom: height(1.5),
		textAlign: "center",
	},
	subtitle: {
		fontSize: font(1.6),
		color: "#666",
		textAlign: "center",
		lineHeight: font(2.4),
		maxWidth: 320,
	},
});
