import { TranslatedText } from "@/components/TranslatedText";
import { useTranslation } from "@/hooks/useTranslation";
import { font, height, width } from "@/utils/dimensions";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
	Animated,
	BackHandler,
	SafeAreaView,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from "react-native";

export default function NoLendersAvailable() {
	const router = useRouter();
	const { tWithValues } = useTranslation();
	const [timeLeft, setTimeLeft] = useState(10);
	const scaleAnim = useRef(new Animated.Value(0)).current;

	useEffect(() => {
		// Handle Android back button - redirect to dashboard
		const backHandler = BackHandler.addEventListener(
			"hardwareBackPress",
			() => {
				router.replace("/(tabs)");
				return true;
			},
		);

		return () => backHandler.remove();
	}, [router]);

	useEffect(() => {
		// Timer logic
		if (timeLeft === 0) {
			router.replace("/(tabs)");
			return;
		}

		const timer = setInterval(() => {
			setTimeLeft((prev) => prev - 1);
		}, 1000);

		return () => clearInterval(timer);
	}, [timeLeft, router]);

	useEffect(() => {
		// Start animations
		Animated.spring(scaleAnim, {
			toValue: 1,
			friction: 5,
			tension: 40,
			useNativeDriver: true,
		}).start();
	}, [scaleAnim]);

	return (
		<SafeAreaView style={styles.container}>
			<View style={styles.content}>
				<Animated.View
					style={[
						styles.card,
						{
							opacity: scaleAnim,
							transform: [{ scale: scaleAnim }],
						},
					]}>
					{/* Icon Container (Timer) */}
					<Animated.View
						style={[
							styles.iconContainer,
							{
								transform: [
									{
										scale: scaleAnim.interpolate({
											inputRange: [0, 1],
											outputRange: [0, 1],
										}),
									},
								],
							},
						]}>
						<MaterialCommunityIcons name="timer-outline" size={48} color="#FF3B30" />
					</Animated.View>

					{/* Text Content */}
					<View style={styles.textContainer}>
						<TranslatedText
							style={styles.title}
							translationKey="noLendersAvailable"
						/>

						<TranslatedText
							style={styles.message}
							translationKey="noEligibleLendersAtMoment"
						/>

						<TranslatedText
							style={styles.note}
							translationKey="lenderAvailabilityChangeNote"
						/>
					</View>

					{/* Action Button */}
					<TouchableOpacity
						style={styles.button}
						onPress={() => router.replace("/(tabs)")}
						activeOpacity={0.8}>
						<TranslatedText
							style={styles.buttonText}
							translationKey="backToDashboard"
						/>
					</TouchableOpacity>

					<Text style={styles.redirectText}>
						{tWithValues("redirectingToDashboardIn", { seconds: timeLeft })}
					</Text>
				</Animated.View>
			</View>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#F9FAFB",
	},
	content: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		padding: width(4),
	},
	card: {
		backgroundColor: "#FFFFFF",
		borderRadius: 24,
		padding: width(8),
		width: "100%",
		maxWidth: 400,
		alignItems: "center",
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 10 },
		shadowOpacity: 0.1,
		shadowRadius: 20,
		elevation: 5,
		borderWidth: 1,
		borderColor: "#F3F4F6",
	},
	iconContainer: {
		width: 96,
		height: 96,
		backgroundColor: "#FFEBEB",
		borderRadius: 48,
		alignItems: "center",
		justifyContent: "center",
		marginBottom: height(3),
	},
	textContainer: {
		alignItems: "center",
		marginBottom: height(4),
		gap: height(2),
	},
	title: {
		fontSize: font(2.4),
		fontWeight: "700",
		color: "#1F2937",
		textAlign: "center",
		marginBottom: height(1),
	},
	message: {
		fontSize: font(1.8),
		color: "#4B5563",
		textAlign: "center",
		lineHeight: font(2.6),
		fontWeight: "500",
	},
	note: {
		fontSize: font(1.4),
		color: "#6B7280",
		textAlign: "center",
		lineHeight: font(2),
		marginTop: height(1),
	},
	button: {
		width: "100%",
		backgroundColor: "#B7FB52",
		paddingVertical: height(2),
		borderRadius: 12,
		alignItems: "center",
		justifyContent: "center",
		shadowColor: "#B7FB52",
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.2,
		shadowRadius: 8,
		elevation: 2,
		marginTop: height(2),
	},
	buttonText: {
		fontSize: font(1.8),
		fontWeight: "700",
		color: "#000000",
	},
	redirectText: {
		fontSize: font(1.4),
		color: "#6B7280",
		textAlign: "center",
		marginTop: height(2),
		fontWeight: "500",
	},
});
