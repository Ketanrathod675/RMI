import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { dark, primary, white } from "@/constants/Colors";
import { font, width, height } from "@/utils/dimensions";
import { useJourneyTracker } from "@/hooks/useJourneyTracker";
import { useTranslation } from "@/hooks/useTranslation";

export default function SearchLoan() {
	const insets = useSafeAreaInsets();
	const router = useRouter();
	const params = useLocalSearchParams<{ is_repeat_user?: string; next_step?: string }>();
	const { t } = useTranslation();
	useJourneyTracker("/search-loan");

	const [stage, setStage] = useState(0);

	const stageTexts = [
		t("connectingToBureauServer", "Connecting to Bureau Server"),
		t("checkingYourCreditReport", "Checking your credit Report"),
		t("analysingCreditReport", "Analysing Credit Report"),
	];

	useEffect(() => {
		const timer1 = setTimeout(() => setStage(1), 2500);
		const timer2 = setTimeout(() => setStage(2), 5000);

		return () => {
			clearTimeout(timer1);
			clearTimeout(timer2);
		};
	}, []);

	return (
		<View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
			{/* Top Header */}
			<View style={styles.header}>
				<TouchableOpacity
					style={styles.backButton}
					onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)"))}
				>
					<MaterialIcons name="arrow-back" size={24} color={dark} />
				</TouchableOpacity>
				<Text style={styles.headerTitle}>{t("searchingForBestLoanOffers", "Finding Loan Offers")}</Text>
				<View style={styles.headerRight} />
			</View>

			<View style={styles.content}>
				<View style={styles.loaderContainer}>
					<ActivityIndicator size="large" color={primary} />
				</View>

				<Text style={styles.title}>{stageTexts[stage] || stageTexts[0]}</Text>
				<Text style={styles.subtitle}>
					{t("searchingForBestLoanOffers", "Searching for best loan offers for you based on your credit eligibility.")}
				</Text>

				<View style={styles.progressContainer}>
					<View style={[styles.progressBar, { width: `${(stage + 1) * 33}%` }]} />
				</View>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#FFFFFF",
	},
	header: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: 16,
		paddingVertical: 14,
		backgroundColor: white,
		borderBottomWidth: 1,
		borderBottomColor: "#F3F4F6",
	},
	backButton: {
		padding: 4,
	},
	headerTitle: {
		fontSize: 18,
		fontWeight: "600",
		color: dark,
	},
	headerRight: {
		width: 32,
	},
	content: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		paddingHorizontal: width(6),
	},
	loaderContainer: {
		width: 80,
		height: 80,
		borderRadius: 40,
		backgroundColor: "#F3F4F6",
		justifyContent: "center",
		alignItems: "center",
		marginBottom: 24,
	},
	title: {
		fontSize: font(2),
		fontWeight: "700",
		color: dark,
		marginBottom: 12,
		textAlign: "center",
	},
	subtitle: {
		fontSize: font(1.5),
		color: "#6B7280",
		textAlign: "center",
		lineHeight: 22,
		maxWidth: 320,
		marginBottom: 32,
	},
	progressContainer: {
		width: "80%",
		height: 6,
		backgroundColor: "#E5E7EB",
		borderRadius: 3,
		overflow: "hidden",
	},
	progressBar: {
		height: "100%",
		backgroundColor: primary,
		borderRadius: 3,
	},
});
