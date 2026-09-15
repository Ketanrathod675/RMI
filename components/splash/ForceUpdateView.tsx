import { primary, dark_primary, dark, white } from "@/constants/Colors";
import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

interface ForceUpdateViewProps {
	playStoreUrl: string;
}

export const ForceUpdateView = ({ playStoreUrl }: ForceUpdateViewProps) => {
	const handleUpdate = () => {
		if (playStoreUrl) {
			Linking.openURL(playStoreUrl);
		}
	};

	return (
		<View style={styles.container}>
			<View style={styles.card}>
				<View style={styles.iconCircle}>
					<Ionicons name="cloud-download-outline" size={54} color={dark_primary} />
				</View>
				<Text style={styles.title}>Update Required</Text>
				<Text style={styles.message}>
					A critical new version of RapidMoney is available with important security enhancements and performance upgrades.
					Please update to continue.
				</Text>
				<TouchableOpacity style={styles.updateButton} onPress={handleUpdate} activeOpacity={0.85}>
					<Text style={styles.updateButtonText}>Update Now</Text>
				</TouchableOpacity>
			</View>
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		backgroundColor: white,
		alignItems: "center",
		justifyContent: "center",
		paddingHorizontal: 28,
		zIndex: 999999,
	},
	card: {
		width: "100%",
		alignItems: "center",
		backgroundColor: "#F6FBF7",
		paddingVertical: 32,
		paddingHorizontal: 24,
		borderRadius: 24,
		borderWidth: 1,
		borderColor: "#E3F3E8",
	},
	iconCircle: {
		width: 90,
		height: 90,
		borderRadius: 45,
		backgroundColor: "rgba(183, 251, 82, 0.25)",
		alignItems: "center",
		justifyContent: "center",
		marginBottom: 20,
	},
	title: {
		fontSize: 22,
		fontWeight: "800",
		color: dark,
		marginBottom: 12,
		textAlign: "center",
	},
	message: {
		fontSize: 15,
		color: "#555555",
		textAlign: "center",
		lineHeight: 22,
		marginBottom: 24,
	},
	updateButton: {
		backgroundColor: dark_primary,
		paddingVertical: 14,
		paddingHorizontal: 36,
		borderRadius: 14,
		width: "100%",
		alignItems: "center",
	},
	updateButtonText: {
		color: white,
		fontSize: 16,
		fontWeight: "700",
	},
});

export default ForceUpdateView;
