import { primary, dark_primary, dark, white } from "@/constants/Colors";
import { Images } from "@/constants/images";
import { Image } from "expo-image";
import { router } from "expo-router";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function WelcomeScreen() {
	return (
		<SafeAreaView style={styles.container}>
			<View style={styles.content}>
				<Image source={Images.LOGO_R} style={styles.logo} contentFit="contain" />
				<Text style={styles.title}>Welcome to RapidMoney</Text>
				<Text style={styles.subtitle}>Fast, secure, transparent personal financing.</Text>

				<TouchableOpacity
					style={styles.button}
					onPress={() => router.replace("/login")}
					activeOpacity={0.85}>
					<Text style={styles.buttonText}>Continue</Text>
				</TouchableOpacity>
			</View>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#ffffff",
	},
	content: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		paddingHorizontal: 24,
	},
	logo: {
		width: 72,
		height: 72,
		marginBottom: 20,
	},
	title: {
		fontSize: 26,
		fontWeight: "800",
		color: dark,
	},
	subtitle: {
		fontSize: 14,
		color: "#666",
		marginTop: 8,
		marginBottom: 32,
		textAlign: "center",
	},
	button: {
		backgroundColor: dark_primary,
		paddingVertical: 14,
		paddingHorizontal: 40,
		borderRadius: 14,
	},
	buttonText: {
		color: white,
		fontSize: 16,
		fontWeight: "700",
	},
});
