import { white, dark } from "@/constants/Colors";
import { SecurityBlockReason } from "@/utils/securityCheck";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

interface SecurityAlertViewProps {
	reason: SecurityBlockReason;
}

export const SecurityAlertView = ({ reason }: SecurityAlertViewProps) => {
	const getMessage = () => {
		switch (reason) {
			case "developer_mode":
				return "Developer mode is enabled on this device. For security and compliance, please disable Developer Options in Settings to continue.";
			case "rooted":
				return "This device appears to be rooted/jailbroken. To protect your financial security, RapidMoney cannot operate on modified operating systems.";
			case "emulator":
				return "This application cannot run within an emulator or simulated environment. Please install RapidMoney on a physical Android device.";
			default:
				return "Security verification failed. Please ensure your device is running unmodified software.";
		}
	};

	return (
		<View style={styles.container}>
			<View style={styles.card}>
				<View style={styles.iconCircle}>
					<Ionicons name="shield-half" size={54} color="#FF3B30" />
				</View>
				<Text style={styles.title}>Security Notice</Text>
				<Text style={styles.message}>{getMessage()}</Text>
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
		backgroundColor: "#FFF5F5",
		paddingVertical: 32,
		paddingHorizontal: 24,
		borderRadius: 24,
		borderWidth: 1,
		borderColor: "#FFE2E2",
	},
	iconCircle: {
		width: 90,
		height: 90,
		borderRadius: 45,
		backgroundColor: "#FFF0F0",
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
	},
});

export default SecurityAlertView;
