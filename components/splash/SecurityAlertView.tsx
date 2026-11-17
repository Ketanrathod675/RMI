import { white, dark } from "@/constants/Colors";
import { openDeveloperSettings, SecurityBlockReason } from "@/utils/securityCheck";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { BackHandler, StyleSheet, Text, TouchableOpacity, View } from "react-native";

interface SecurityAlertViewProps {
	reason: SecurityBlockReason;
	onRetry?: () => void;
}

export const SecurityAlertView = ({ reason, onRetry }: SecurityAlertViewProps) => {
	const getMessage = () => {
		switch (reason) {
			case "developer_mode":
				return "Developer Options or USB Debugging is enabled on this device. For financial security and regulatory compliance, please disable Developer Options in Settings to continue.";
			case "rooted":
				return "This device appears to be rooted or modified. To protect your financial security, RapidMoney cannot operate on modified operating systems.";
			case "emulator":
				return "This application cannot run within an emulator or simulated environment. Please install RapidMoney on a physical Android device.";
			default:
				return "Security verification failed. Please ensure your device is running unmodified software.";
		}
	};

	const handleExitApp = () => {
		BackHandler.exitApp();
	};

	return (
		<View style={styles.container}>
			<View style={styles.card}>
				<View style={styles.iconCircle}>
					<Ionicons name="shield-half" size={54} color="#FF3B30" />
				</View>
				<Text style={styles.title}>Security Notice</Text>
				<Text style={styles.message}>{getMessage()}</Text>

				<View style={styles.buttonContainer}>
					{reason === "developer_mode" && (
						<TouchableOpacity
							style={styles.primaryButton}
							onPress={() => openDeveloperSettings()}
							activeOpacity={0.85}
						>
							<Ionicons name="settings-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
							<Text style={styles.primaryButtonText}>Open Settings</Text>
						</TouchableOpacity>
					)}

					{onRetry && (
						<TouchableOpacity
							style={[styles.retryButton, reason !== "developer_mode" && styles.primaryButton]}
							onPress={onRetry}
							activeOpacity={0.85}
						>
							<Text style={reason !== "developer_mode" ? styles.primaryButtonText : styles.retryButtonText}>
								Re-check
							</Text>
						</TouchableOpacity>
					)}

					<TouchableOpacity
						style={styles.secondaryButton}
						onPress={handleExitApp}
						activeOpacity={0.85}
					>
						<Text style={styles.secondaryButtonText}>Exit App</Text>
					</TouchableOpacity>
				</View>
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
		marginBottom: 24,
	},
	buttonContainer: {
		width: "100%",
		gap: 10,
	},
	primaryButton: {
		width: "100%",
		backgroundColor: "#1B1F5E",
		paddingVertical: 14,
		borderRadius: 14,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
	},
	primaryButtonText: {
		color: "#FFFFFF",
		fontSize: 15,
		fontWeight: "700",
	},
	retryButton: {
		width: "100%",
		backgroundColor: "#FFFFFF",
		borderWidth: 1.5,
		borderColor: "#1B1F5E",
		paddingVertical: 13,
		borderRadius: 14,
		alignItems: "center",
		justifyContent: "center",
	},
	retryButtonText: {
		color: "#1B1F5E",
		fontSize: 15,
		fontWeight: "700",
	},
	secondaryButton: {
		width: "100%",
		paddingVertical: 12,
		alignItems: "center",
		justifyContent: "center",
	},
	secondaryButtonText: {
		color: "#888888",
		fontSize: 14,
		fontWeight: "600",
	},
});

export default SecurityAlertView;
