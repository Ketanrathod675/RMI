import { TranslatedText } from "@/components/TranslatedText";
import { IconSymbol } from "@/components/ui/IconSymbol";
import { white } from "@/constants/Colors";
import { useJourneyTracker } from "@/hooks/useJourneyTracker";
import { useTranslation } from "@/hooks/useTranslation";
import { height, width } from "@/utils/dimensions";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect } from "react";
import { BackHandler, SafeAreaView, StyleSheet, TouchableOpacity, View } from "react-native";

export default function ApplicationApproved() {
	useJourneyTracker("/application-approved");
	const router = useRouter();
	const { t } = useTranslation();

	useEffect(() => {
		const backHandler = BackHandler.addEventListener("hardwareBackPress", () => {
			router.replace("/(tabs)");
			return true;
		});
		return () => backHandler.remove();
	}, [router]);

	const handleContinue = () => {
		router.replace({
			pathname: "/professional-details",
			params: { disableBack: "true" },
		});
	};

	return (
		<SafeAreaView style={styles.container}>
			<View style={styles.content}>
				<View style={styles.iconContainer}>
					<MaterialIcons name="check" size={80} color="#4CAF50" />
				</View>

				<TranslatedText style={styles.title} translationKey="applicationApproved" />
				<TranslatedText style={styles.description} translationKey="applicationApprovedDesc" />

				<View style={styles.buttonContainer}>
					<TouchableOpacity style={styles.button} onPress={handleContinue}>
						<View style={{ flexDirection: "row", alignItems: "center" }}>
							<TranslatedText
								style={styles.buttonText}
								translationKey="continueToProfessionalDetails"
							/>
							<IconSymbol name="arrow.right" size={20} color={white} />
						</View>
					</TouchableOpacity>
				</View>
			</View>
		</SafeAreaView>
	);
}

export { RouteErrorBoundary as ErrorBoundary } from "@/components/ErrorBoundary";

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: white,
	},
	content: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		paddingHorizontal: width(5),
	},
	iconContainer: {
		width: width(30),
		height: width(30),
		borderRadius: width(15),
		backgroundColor: "#E8F5E9",
		alignItems: "center",
		justifyContent: "center",
		marginBottom: height(4),
	},
	title: {
		fontSize: 24,
		fontWeight: "bold",
		textAlign: "center",
		marginBottom: height(2),
		color: "#000",
	},
	description: {
		fontSize: 16,
		color: "#666",
		textAlign: "center",
		marginBottom: height(5),
		lineHeight: 24,
	},
	buttonContainer: {
		width: "100%",
		paddingBottom: height(5),
	},
	button: {
		backgroundColor: "#00C853",
		paddingVertical: 16,
		borderRadius: 12,
		width: "100%",
		alignItems: "center",
	},
	buttonText: {
		color: "white",
		fontWeight: "bold",
		fontSize: 18,
	},
});
