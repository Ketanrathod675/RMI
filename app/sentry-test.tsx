import * as Sentry from "@sentry/react-native";
import { useState } from "react";
import { Alert, Button, StyleSheet, Text, View } from "react-native";
import { Redirect } from "expo-router";

export default function SentryTestScreen() {
	if (!__DEV__) {
		return <Redirect href="/(tabs)" />;
	}

	const [status, setStatus] = useState<string | null>(null);

	const handlePress = async () => {
		try {
			setStatus("Sending event to Sentry...");
			const eventId = Sentry.captureException(new Error("First error"));
			await Sentry.flush();
			setStatus(`Event sent! ID: ${eventId}`);
			Alert.alert("Sentry Event Captured", `Event ID: ${eventId}\n\nCheck your Sentry dashboard.`);
		} catch (err: any) {
			setStatus(`Error: ${err?.message || "Failed to send"}`);
			Alert.alert("Error sending to Sentry", err?.message || "Unknown error");
		}
	};

	return (
		<View style={styles.container}>
			<Text style={styles.title}>Sentry Test</Text>
			<Button title="Try!" onPress={handlePress} />
			{status && <Text style={styles.status}>{status}</Text>}
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		padding: 24,
	},
	title: {
		fontSize: 18,
		fontWeight: "600",
		marginBottom: 16,
	},
	status: {
		marginTop: 16,
		fontSize: 14,
		color: "#333",
		textAlign: "center",
	},
});
