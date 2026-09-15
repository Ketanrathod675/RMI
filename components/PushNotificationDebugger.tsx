import { getStorageItem, setStorageItem } from "@/utils/storage";
import { isRunningInExpoGo } from "expo";
import React, { useEffect, useState } from "react";
import {
	Alert,
	Platform,
	ScrollView,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from "react-native";
import Toast from "react-native-toast-message";

const Device = {
	brand: Platform.OS,
	modelName: Platform.OS,
	osVersion: String(Platform.Version),
	isDevice: true,
};

const getNotificationsModule = (): any => {
	// Expo removed Android push notification support from Expo Go in SDK 53+.
	// Requiring expo-notifications in Expo Go on Android throws an immediate fatal error.
	if (Platform.OS === "android" && isRunningInExpoGo()) {
		return null;
	}
	try {
		return require("expo-notifications");
	} catch {
		return null;
	}
};

interface DebugInfo {
	// Device Info
	deviceBrand: string | null;
	deviceModel: string | null;
	osVersion: string | null;
	isDevice: boolean;

	// Token Info
	currentToken: string | null;
	tokenGeneratedAt: string | null;
	tokenType: "FCM" | "Expo" | "Unknown";
	tokenLength: number;

	// Firebase Info
	firebaseConfigured: boolean;
	googleServicesExists: boolean;

	// Permission Info
	notificationPermission: string;

	// Error Info
	lastError: string | null;
	errorTimestamp: string | null;

	// Backend Info
	lastRegistrationAttempt: string | null;
	registrationSuccess: boolean;

	// Build Info
	isDevelopment: boolean;
	buildType: string;
}

export function PushNotificationDebugger() {
	const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [isExpanded, setIsExpanded] = useState(false);

	const collectDebugInfo = async () => {
		try {
			setIsLoading(true);

			// Get stored token using centralized storage
			const storedToken = await getStorageItem("@expo-push-token");
			const tokenGeneratedAt = await getStorageItem("@push-token-generated-at");
			const fcmDebugInfo = await getStorageItem("@fcm-token-debug");
			const fcmError = await getStorageItem("@fcm-token-error");

			// Get permission status
			let status = "undetermined";
			try {
				const Notifications = getNotificationsModule();
				if (Notifications?.getPermissionsAsync) {
					const perm = await Notifications.getPermissionsAsync();
					status = perm?.status || "undetermined";
				} else if (Platform.OS === "android" && isRunningInExpoGo()) {
					status = "Unsupported in Expo Go";
				}
			} catch (e) {
				console.warn("Could not get notification permissions", e);
			}

			// Determine token type
			let tokenType: "FCM" | "Expo" | "Unknown" = "Unknown";
			if (storedToken) {
				tokenType = storedToken.startsWith("ExponentPushToken") ? "Expo" : "FCM";
			}

			// Parse debug data
			const fcmDebug = fcmDebugInfo ? JSON.parse(fcmDebugInfo) : null;
			const errorData = fcmError ? JSON.parse(fcmError) : null;

			const info: DebugInfo = {
				// Device Info
				deviceBrand: Device.brand,
				deviceModel: Device.modelName,
				osVersion: Device.osVersion,
				isDevice: Device.isDevice,

				// Token Info
				currentToken: storedToken,
				tokenGeneratedAt: tokenGeneratedAt || fcmDebug?.obtainedAt || null,
				tokenType,
				tokenLength: storedToken?.length || 0,

				// Firebase Info
				firebaseConfigured: !errorData?.error?.includes("Firebase"),
				googleServicesExists: !errorData?.error?.includes("google-services"),

				// Permission Info
				notificationPermission: status,

				// Error Info
				lastError: errorData?.error || null,
				errorTimestamp: errorData?.timestamp || null,

				// Backend Info
				lastRegistrationAttempt: null, // Will be updated when we track this
				registrationSuccess: false,

				// Build Info
				isDevelopment: __DEV__,
				buildType: __DEV__ ? "Development" : "Production",
			};

			setDebugInfo(info);
		} catch (error) {
			console.error("Error collecting debug info:", error);
		} finally {
			setIsLoading(false);
		}
	};

	useEffect(() => {
		collectDebugInfo();
	}, []);

	const copyToClipboard = (text: string, label: string) => {
		Toast.show({
			type: "success",
			text1: "Copied!",
			text2: `${label}: ${text.substring(0, 20)}...`,
			visibilityTime: 2000,
		});
	};

	const testTokenGeneration = async () => {
		Alert.alert(
			"Test Token Generation",
			"This will attempt to generate a new push token. Continue?",
			[
				{ text: "Cancel", style: "cancel" },
				{
					text: "Continue",
					onPress: async () => {
						try {
							setIsLoading(true);

							// Clear old data using centralized storage
							await setStorageItem("@fcm-token-error", "");

							// Try to get FCM token
							const Notifications = getNotificationsModule();
							if (!Notifications?.getDevicePushTokenAsync) {
								Alert.alert(
									"Expo Go Limitation",
									Platform.OS === "android" && isRunningInExpoGo()
										? "Android Push notifications are not supported in Expo Go (SDK 53+). Please use a development build (`npx expo run:android`) to test push notifications."
										: "Push notifications not supported in current environment"
								);
								return;
							}
							const fcmToken = await Notifications.getDevicePushTokenAsync();

							if (fcmToken?.data) {
								Alert.alert(
									"Success!",
									`Token generated: ${fcmToken.data.substring(0, 50)}...`,
									[{ text: "OK" }],
								);

								// Store new token using centralized storage
								await setStorageItem("@expo-push-token", fcmToken.data);
								await setStorageItem(
									"@push-token-generated-at",
									new Date().toISOString(),
								);

								// Refresh debug info
								await collectDebugInfo();
							} else {
								Alert.alert("Failed", "Could not generate token", [{ text: "OK" }]);
							}
						} catch (error: any) {
							Alert.alert("Error", error.message, [{ text: "OK" }]);

							// Store error for debugging using centralized storage
							await setStorageItem(
								"@fcm-token-error",
								JSON.stringify({
									error: error.message,
									timestamp: new Date().toISOString(),
								}),
							);

							await collectDebugInfo();
						} finally {
							setIsLoading(false);
						}
					},
				},
			],
		);
	};

	const clearDebugData = async () => {
		Alert.alert("Clear Debug Data", "This will clear all stored debug information. Continue?", [
			{ text: "Cancel", style: "cancel" },
			{
				text: "Clear",
				style: "destructive",
				onPress: async () => {
					// Clear debug data using centralized storage
					await setStorageItem("@fcm-token-debug", "");
					await setStorageItem("@fcm-token-error", "");
					await setStorageItem("@push-token-generated-at", "");
					Toast.show({
						type: "success",
						text1: "Debug data cleared",
						visibilityTime: 2000,
					});
					await collectDebugInfo();
				},
			},
		]);
	};

	const exportDebugReport = async () => {
		if (!debugInfo) return;

		Toast.show({
			type: "success",
			text1: "Debug Report Ready",
			text2: `Token length: ${debugInfo.tokenLength}`,
			visibilityTime: 3000,
		});
	};

	if (isLoading) {
		return (
			<View style={styles.container}>
				<Text style={styles.loadingText}>Loading debug info...</Text>
			</View>
		);
	}

	if (!debugInfo) {
		return (
			<View style={styles.container}>
				<Text style={styles.errorText}>Failed to load debug info</Text>
			</View>
		);
	}

	return (
		<View style={styles.container}>
			<TouchableOpacity
				style={styles.header}
				onPress={() => setIsExpanded(!isExpanded)}
				activeOpacity={0.7}>
				<Text style={styles.headerText}>🔧 Push Notification Debug</Text>
				<Text style={styles.expandIcon}>{isExpanded ? "▼" : "▶"}</Text>
			</TouchableOpacity>

			{isExpanded && (
				<ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
					{/* Status Overview */}
					<View style={styles.statusCard}>
						<Text style={styles.sectionTitle}>📊 Status Overview</Text>
						<View style={styles.statusRow}>
							<Text style={styles.label}>Token Status:</Text>
							<Text
								style={[
									styles.value,
									debugInfo.currentToken ? styles.successText : styles.errorText,
								]}>
								{debugInfo.currentToken ? "✅ Generated" : "❌ Missing"}
							</Text>
						</View>
						<View style={styles.statusRow}>
							<Text style={styles.label}>Token Type:</Text>
							<Text
								style={[
									styles.value,
									debugInfo.tokenType === "FCM"
										? styles.successText
										: styles.warningText,
								]}>
								{debugInfo.tokenType}
							</Text>
						</View>
						<View style={styles.statusRow}>
							<Text style={styles.label}>Permissions:</Text>
							<Text
								style={[
									styles.value,
									debugInfo.notificationPermission === "granted"
										? styles.successText
										: styles.errorText,
								]}>
								{debugInfo.notificationPermission}
							</Text>
						</View>
						<View style={styles.statusRow}>
							<Text style={styles.label}>Build Type:</Text>
							<Text style={styles.value}>{debugInfo.buildType}</Text>
						</View>
					</View>

					{/* Token Details */}
					{debugInfo.currentToken && (
						<View style={styles.section}>
							<Text style={styles.sectionTitle}>🔑 Token Details</Text>
							<TouchableOpacity
								style={styles.tokenBox}
								onPress={() =>
									copyToClipboard(debugInfo.currentToken!, "Push Token")
								}>
								<Text style={styles.tokenText}>
									{debugInfo.currentToken.substring(0, 40)}...
								</Text>
								<Text style={styles.copyHint}>Tap to copy full token</Text>
							</TouchableOpacity>
							<Text style={styles.infoText}>
								Length: {debugInfo.tokenLength} characters
							</Text>
							{debugInfo.tokenGeneratedAt && (
								<Text style={styles.infoText}>
									Generated:{" "}
									{new Date(debugInfo.tokenGeneratedAt).toLocaleString()}
								</Text>
							)}
						</View>
					)}

					{/* Firebase Status */}
					<View style={styles.section}>
						<Text style={styles.sectionTitle}>🔥 Firebase Status</Text>
						<View style={styles.statusRow}>
							<Text style={styles.label}>Configuration:</Text>
							<Text
								style={[
									styles.value,
									debugInfo.firebaseConfigured
										? styles.successText
										: styles.errorText,
								]}>
								{debugInfo.firebaseConfigured
									? "✅ Configured"
									: "❌ Not Configured"}
							</Text>
						</View>
						{!debugInfo.firebaseConfigured && (
							<Text style={styles.warningBox}>
								⚠️ Firebase is not properly configured. Check google-services.json
							</Text>
						)}
					</View>

					{/* Errors */}
					{debugInfo.lastError && (
						<View style={styles.section}>
							<Text style={styles.sectionTitle}>⚠️ Last Error</Text>
							<View style={styles.errorBox}>
								<Text style={styles.errorMessage}>{debugInfo.lastError}</Text>
								{debugInfo.errorTimestamp && (
									<Text style={styles.errorTime}>
										{new Date(debugInfo.errorTimestamp).toLocaleString()}
									</Text>
								)}
							</View>
						</View>
					)}

					{/* Device Info */}
					<View style={styles.section}>
						<Text style={styles.sectionTitle}>📱 Device Info</Text>
						<Text style={styles.infoText}>
							{debugInfo.deviceBrand} {debugInfo.deviceModel}
						</Text>
						<Text style={styles.infoText}>
							{Platform.OS} {debugInfo.osVersion}
						</Text>
						<Text style={styles.infoText}>
							{debugInfo.isDevice ? "Physical Device" : "Emulator/Simulator"}
						</Text>
					</View>

					{/* Actions */}
					<View style={styles.actions}>
						<TouchableOpacity
							style={[styles.button, styles.primaryButton]}
							onPress={testTokenGeneration}>
							<Text style={styles.buttonText}>🔄 Test Token Generation</Text>
						</TouchableOpacity>

						<TouchableOpacity
							style={[styles.button, styles.secondaryButton]}
							onPress={exportDebugReport}>
							<Text style={styles.buttonText}>📋 Export Debug Report</Text>
						</TouchableOpacity>

						<TouchableOpacity
							style={[styles.button, styles.secondaryButton]}
							onPress={() => collectDebugInfo()}>
							<Text style={styles.buttonText}>🔄 Refresh Info</Text>
						</TouchableOpacity>

						<TouchableOpacity
							style={[styles.button, styles.dangerButton]}
							onPress={clearDebugData}>
							<Text style={styles.buttonText}>🗑️ Clear Debug Data</Text>
						</TouchableOpacity>
					</View>
				</ScrollView>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		backgroundColor: "#f8f9fa",
		marginVertical: 10,
		marginHorizontal: 15,
		borderRadius: 12,
		overflow: "hidden",
		elevation: 2,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.1,
		shadowRadius: 4,
	},
	header: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		padding: 15,
		backgroundColor: "#fff",
		borderBottomWidth: 1,
		borderBottomColor: "#e9ecef",
	},
	headerText: {
		fontSize: 16,
		fontWeight: "600",
		color: "#212529",
	},
	expandIcon: {
		fontSize: 14,
		color: "#6c757d",
	},
	content: {
		maxHeight: 500,
		backgroundColor: "#fff",
	},
	statusCard: {
		backgroundColor: "#f8f9fa",
		margin: 15,
		padding: 15,
		borderRadius: 8,
	},
	section: {
		paddingHorizontal: 15,
		paddingVertical: 10,
		borderBottomWidth: 1,
		borderBottomColor: "#e9ecef",
	},
	sectionTitle: {
		fontSize: 14,
		fontWeight: "600",
		color: "#495057",
		marginBottom: 10,
	},
	statusRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		marginVertical: 5,
	},
	label: {
		fontSize: 13,
		color: "#6c757d",
	},
	value: {
		fontSize: 13,
		fontWeight: "500",
		color: "#212529",
	},
	successText: {
		color: "#28a745",
		fontWeight: "600",
	},
	errorText: {
		color: "#dc3545",
		fontWeight: "600",
	},
	warningText: {
		color: "#ffc107",
		fontWeight: "600",
	},
	tokenBox: {
		backgroundColor: "#f8f9fa",
		padding: 12,
		borderRadius: 6,
		marginBottom: 10,
	},
	tokenText: {
		fontSize: 12,
		fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
		color: "#495057",
	},
	copyHint: {
		fontSize: 11,
		color: "#6c757d",
		marginTop: 5,
		fontStyle: "italic",
	},
	infoText: {
		fontSize: 12,
		color: "#6c757d",
		marginVertical: 2,
	},
	warningBox: {
		backgroundColor: "#fff3cd",
		borderColor: "#ffc107",
		borderWidth: 1,
		borderRadius: 6,
		padding: 10,
		marginTop: 10,
	},
	errorBox: {
		backgroundColor: "#f8d7da",
		borderColor: "#dc3545",
		borderWidth: 1,
		borderRadius: 6,
		padding: 10,
	},
	errorMessage: {
		fontSize: 12,
		color: "#721c24",
	},
	errorTime: {
		fontSize: 11,
		color: "#721c24",
		marginTop: 5,
		fontStyle: "italic",
	},
	actions: {
		padding: 15,
	},
	button: {
		padding: 12,
		borderRadius: 8,
		marginVertical: 5,
		alignItems: "center",
	},
	primaryButton: {
		backgroundColor: "#007bff",
	},
	secondaryButton: {
		backgroundColor: "#6c757d",
	},
	dangerButton: {
		backgroundColor: "#dc3545",
	},
	buttonText: {
		color: "#fff",
		fontSize: 14,
		fontWeight: "500",
	},
	loadingText: {
		padding: 20,
		textAlign: "center",
		color: "#6c757d",
	},
});
