import { TranslatedText } from "@/components/TranslatedText";
import { dark, primary, white } from "@/constants/Colors";
import { useTranslation } from "@/hooks/useTranslation";
import { font, height, width } from "@/utils/dimensions";
import { useNavigation, useRouter } from "expo-router";
import React, { useEffect, useRef } from "react";
import { ActivityIndicator, BackHandler, StyleSheet, Text, View } from "react-native";

export default function ProfessionalDetailsSuccess() {
	const { t } = useTranslation();
	const router = useRouter();
	const navigation = useNavigation();
	const allowNavigationRef = useRef(false);

	// Prevent all back navigation (gesture back, hardware back button) during 3 seconds
	useEffect(() => {
		// Disable gesture navigation natively
		navigation.setOptions({
			gestureEnabled: false,
			headerLeft: () => null, // Hide back button if present
		});

		// Prevent ALL back navigation attempts - block everything
		const unsubscribe = navigation.addListener("beforeRemove", (e) => {
			// Only allow navigation if it's our programmatic navigation after 3 seconds
			if (!allowNavigationRef.current) {
				// Block ALL navigation attempts (user back, gesture, etc.) silently
				e.preventDefault();
			}
		});

		// Prevent Android hardware back button - block completely
		const backHandler = BackHandler.addEventListener("hardwareBackPress", () => {
			// Return true to completely block hardware back button (no alert)
			return true;
		});

		// Set flag when we navigate programmatically after 3 seconds
		const timer = setTimeout(() => {
			console.log("⏰ 3 seconds passed, navigating to ckyc-instructions...");
			allowNavigationRef.current = true;
			router.replace("/ckyc-instructions");
		}, 3000);

		return () => {
			clearTimeout(timer);
			unsubscribe();
			backHandler.remove();
		};
	}, [navigation, router]);

	return (
		<View style={styles.container}>
			<View style={styles.card}>
				{/* Green Tick */}
				<View style={styles.tickContainer}>
					<Text style={styles.tick}>✓</Text>
				</View>

				{/* Success Title */}
				<TranslatedText
					style={styles.title}
					translationKey="detailsSubmittedSuccessfully"
				/>

				{/* Sub Text */}
				<TranslatedText
					style={styles.subtitle}
					translationKey="pleaseWaitWhileWeProcessYourInformation"
				/>

				{/* Loader */}
				<ActivityIndicator
					size="large"
					color={primary}
					style={styles.loader}
				/>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: white,
		justifyContent: "center",
		alignItems: "center",
		paddingHorizontal: width(6),
	},
	card: {
		backgroundColor: white,
		borderRadius: width(4),
		paddingVertical: height(6),
		paddingHorizontal: width(8),
		alignItems: "center",
		shadowColor: "#000",
		shadowOffset: {
			width: 0,
			height: 2,
		},
		shadowOpacity: 0.25,
		shadowRadius: 3.84,
		elevation: 5,
		width: "100%",
		maxWidth: width(90),
	},
	tickContainer: {
		width: width(20),
		height: width(20),
		borderRadius: width(10),
		backgroundColor: "#E6F6EA",
		justifyContent: "center",
		alignItems: "center",
		marginBottom: height(3),
	},
	tick: {
		fontSize: width(12),
		color: primary,
		fontWeight: "bold",
	},
	title: {
		fontSize: font(2.4),
		fontWeight: "700",
		color: dark,
		textAlign: "center",
		marginBottom: height(2),
	},
	subtitle: {
		fontSize: font(1.8),
		color: "#666",
		textAlign: "center",
		marginBottom: height(4),
		lineHeight: font(2.6),
	},
	loader: {
		marginTop: height(2),
	},
});
