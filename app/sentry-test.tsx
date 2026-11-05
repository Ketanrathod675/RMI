import * as Sentry from "@sentry/react-native";
import { Button, StyleSheet, Text, View } from "react-native";

export default function SentryTestScreen() {
	return (
		<View style={styles.container}>
			<Text style={styles.title}>Sentry test</Text>
			<Button
				title="Try!"
				onPress={() => {
					Sentry.captureException(new Error("First error"));
				}}
			/>
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
});
