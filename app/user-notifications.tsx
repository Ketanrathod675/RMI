import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { dark, white, primary } from "@/constants/Colors";
import { font, width, height } from "@/utils/dimensions";
import { useJourneyTracker } from "@/hooks/useJourneyTracker";

export default function UserNotifications() {
	const insets = useSafeAreaInsets();
	const router = useRouter();
	useJourneyTracker("/user-notifications");

	return (
		<View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
			{/* Top Header */}
			<View style={styles.header}>
				<TouchableOpacity
					style={styles.backButton}
					onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)"))}
					accessibilityLabel="Go back"
				>
					<MaterialIcons name="arrow-back" size={24} color={dark} />
				</TouchableOpacity>
				<Text style={styles.headerTitle}>Notifications</Text>
				<View style={styles.headerRight} />
			</View>

			{/* Placeholder Body */}
			<View style={styles.content}>
				<View style={styles.iconCircle}>
					<MaterialIcons name="notifications-active" size={40} color={primary} />
				</View>
				<Text style={styles.title}>Notifications</Text>
				<Text style={styles.subtitle}>
					You have no new notifications right now. Important updates, offers, and loan payment alerts will appear here.
				</Text>
			</View>
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
