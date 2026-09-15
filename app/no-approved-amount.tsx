import { TranslatedText } from "@/components/TranslatedText";
import { dark, primary, white } from "@/constants/Colors";
import { Images } from "@/constants/images";
import { useJourneyTracker } from "@/hooks/useJourneyTracker";
import { height, width } from "@/utils/dimensions";
import { setStorageItem, STORAGE_KEYS } from "@/utils/storage";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import React, { useEffect } from "react";
import { SafeAreaView, StyleSheet, TouchableOpacity, View } from "react-native";

export default function NoApprovedAmount() {
	const router = useRouter();

	// Track this screen in the journey
	useJourneyTracker("/no-approved-amount");

	const handleBackToDashboard = async () => {
		// Set flag to indicate user came from no approved amount screen
		await setStorageItem(STORAGE_KEYS["@no-approved-amount-flag"], "true");
		router.replace("/(tabs)");
	};

	useEffect(() => {
		const timer = setTimeout(() => {
			handleBackToDashboard();
		}, 5000); // 5 seconds delay

		return () => clearTimeout(timer);
	}, []);

	return (
		<SafeAreaView style={styles.container}>
			<Image
				source={Images.ASSESSMENT_BANNER2}
				style={styles.backgroundImage}
				contentFit="cover"
			/>
			<View style={styles.overlay} />
			<View style={styles.content}>
				<Ionicons
					name="warning"
					size={width(20)}
					color="#FFD700"
					style={styles.warningIcon}
				/>
				<TranslatedText
					style={styles.title}
					translationKey="noApprovedAmountAvailable"
				/>
				<TranslatedText
					style={styles.message}
					translationKey="noApprovedAmountMessage"
				/>
				<TouchableOpacity style={styles.button} onPress={handleBackToDashboard}>
					<TranslatedText
						style={styles.buttonText}
						translationKey="backToDashboard"
					/>
				</TouchableOpacity>
			</View>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		position: "relative",
	},
	backgroundImage: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		width: "100%",
		height: "100%",
	},
	overlay: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		backgroundColor: "rgba(0, 0, 0, 0.5)",
	},
	content: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		paddingHorizontal: width(6),
		zIndex: 1,
	},
	warningIcon: {
		marginBottom: height(3),
	},
	title: {
		fontSize: width(6),
		fontWeight: "bold",
		color: white,
		textAlign: "center",
		marginBottom: height(2),
	},
	message: {
		fontSize: width(4),
		color: white,
		textAlign: "center",
		marginBottom: height(6),
		lineHeight: width(6),
	},
	button: {
		backgroundColor: primary,
		paddingVertical: height(2),
		paddingHorizontal: width(8),
		borderRadius: 100,
		minWidth: width(50),
		alignItems: "center",
		justifyContent: "center",
	},
	buttonText: {
		color: dark,
		fontSize: width(4.5),
		fontWeight: "bold",
	},
});
