import { TranslatedText } from "@/components/TranslatedText";
import { dark } from "@/constants/Colors";
import { useNetworkAwareQuery } from "@/hooks/useNetworkAwareQuery";
import { useTranslation } from "@/hooks/useTranslation";
import { axios, getUserDashboardData } from "@/utils/api";
import { Images } from "@/constants/images";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React from "react";
import {
	ActivityIndicator,
	FlatList,
	Platform,
	StatusBar as RNStatusBar,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface LoanHistoryItem {
	loan_id: string;
	loan_number: string;
	application_id: string;
	amount: number;
	due_date: string;
	status: string;
}

// API function to get loan history
const getLoanHistory = async () => {
	const apiUrl = "loans?skip=0&limit=50&loan_status=active";
	try {
		const response = await axios.get(apiUrl);
		return response.data;
	} catch (error: any) {
		console.error("❌ Failed to fetch loan history:", error?.message || error);
		throw error;
	}
};

const formatLoanAmount = (amount?: number): string => {
	if (typeof amount !== "number" || isNaN(amount)) return "₹0.00";
	return `₹${amount.toFixed(2)}`;
};

const formatDateTime = (dateString?: string): string => {
	if (!dateString) return "Jan 22, 2025 • 09:41 AM";
	try {
		const date = new Date(dateString);
		if (isNaN(date.getTime())) return dateString;

		const months = [
			"Jan", "Feb", "Mar", "Apr", "May", "Jun",
			"Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
		];
		const month = months[date.getMonth()];
		const day = String(date.getDate()).padStart(2, "0");
		const year = date.getFullYear();

		let hours = date.getHours();
		const minutes = String(date.getMinutes()).padStart(2, "0");
		const ampm = hours >= 12 ? "PM" : "AM";
		hours = hours % 12;
		hours = hours ? hours : 12;
		const formattedHours = String(hours).padStart(2, "0");

		return `${month} ${day}, ${year} • ${formattedHours}:${minutes} ${ampm}`;
	} catch {
		return dateString;
	}
};

const getStatusColor = (status: string): string => {
	const normalized = (status || "").toLowerCase().trim();
	if (normalized === "paid off" || normalized === "paid" || normalized === "closed") {
		return "#16A34A"; // Green
	}
	if (normalized === "pending") {
		return "#334155"; // Slate Dark Grey
	}
	if (normalized === "due soon") {
		return "#F97316"; // Orange
	}
	if (normalized === "overdue") {
		return "#EF4444"; // Red
	}
	if (normalized === "active") {
		return "#16A34A";
	}
	return "#64748B";
};

const LoanHistoryItemComponent = ({ item }: { item: LoanHistoryItem }) => {
	const statusColor = getStatusColor(item.status);

	return (
		<View style={styles.itemContainer}>
			<View style={styles.topRow}>
				<Text style={styles.amountText}>{formatLoanAmount(item.amount)}</Text>
				<Text style={[styles.statusText, { color: statusColor }]}>{item.status}</Text>
			</View>
			<Text style={styles.dateTimeText}>{formatDateTime(item.due_date)}</Text>
		</View>
	);
};

export default function History() {
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const { t } = useTranslation();

	useFocusEffect(
		React.useCallback(() => {
			RNStatusBar.setBarStyle("dark-content");
			if (Platform.OS === "android") {
				RNStatusBar.setBackgroundColor("transparent");
				RNStatusBar.setTranslucent(true);
			}
		}, [])
	);

	// Fetch dashboard data to get loan number
	useNetworkAwareQuery({
		queryKey: ["userDashboard"],
		queryFn: getUserDashboardData,
	});

	// Fetch loan history
	const { data: apiData, isLoading } = useNetworkAwareQuery({
		queryKey: ["loanHistory", "active"],
		queryFn: getLoanHistory,
		enabled: true,
	});

	// Extract loans from API response
	const loanHistoryData: LoanHistoryItem[] = apiData?.loans || [];

	const handleLoanPress = (item: LoanHistoryItem) => {
		router.push({
			pathname: "/loan-details" as any,
			params: { loanNumber: item.loan_number },
		});
	};

	return (
		<View style={styles.container}>
			<StatusBar style="dark" />

			{/* Clean White Top Header */}
			<View style={[styles.header, { paddingTop: insets.top + (Platform.OS === "android" ? 14 : 10) }]}>
				<TouchableOpacity
					style={styles.backButton}
					onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)"))}
					hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
					<Ionicons name="arrow-back" size={24} color="#1E293B" />
				</TouchableOpacity>
				<Text style={styles.headerTitle}>{t("loanHistory") || "Loan History"}</Text>
			</View>

			{isLoading ? (
				<View style={styles.loadingContainer}>
					<Image
						source={Images.BOUNCING_BALL}
						style={styles.loaderGif}
						contentFit="contain"
					/>
					<TranslatedText style={styles.loadingText} translationKey="loading" />
				</View>
			) : loanHistoryData.length === 0 ? (
				<View style={styles.emptyContainer}>
					<TranslatedText style={styles.emptyTitle} translationKey="loanHistory" />
					<TranslatedText style={styles.emptyText} translationKey="noLoanHistoryAvailable" />
				</View>
			) : (
				<FlatList
					data={loanHistoryData}
					keyExtractor={(item) => item.loan_id}
					renderItem={({ item }) => (
						<TouchableOpacity onPress={() => handleLoanPress(item)} activeOpacity={0.8}>
							<LoanHistoryItemComponent item={item} />
						</TouchableOpacity>
					)}
					showsVerticalScrollIndicator={false}
					contentContainerStyle={styles.listContainer}
				/>
			)}
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
		paddingHorizontal: 20,
		paddingBottom: 16,
		backgroundColor: "#FFFFFF",
	},
	backButton: {
		marginRight: 16,
	},
	headerTitle: {
		fontSize: 22,
		fontWeight: "700",
		color: "#1E293B",
		letterSpacing: -0.3,
	},
	listContainer: {
		paddingTop: 10,
		paddingBottom: 40,
	},
	itemContainer: {
		backgroundColor: "#F8F9FE",
		marginHorizontal: 20,
		marginBottom: 14,
		paddingHorizontal: 20,
		paddingVertical: 18,
		borderRadius: 18,
		borderWidth: 1,
		borderColor: "#EAEFF8",
	},
	topRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
	},
	amountText: {
		fontSize: 24,
		fontWeight: "800",
		color: "#1E293B",
		letterSpacing: -0.5,
	},
	statusText: {
		fontSize: 14,
		fontWeight: "700",
		letterSpacing: 0.2,
	},
	dateTimeText: {
		fontSize: 13,
		color: "#94A3B8",
		fontWeight: "400",
		marginTop: 6,
	},
	loadingContainer: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
	},
	loaderGif: {
		width: 280,
		height: 210,
	},
	loadingText: {
		fontSize: 16,
		fontWeight: "500",
		color: "#64748B",
		marginTop: 8,
	},
	emptyContainer: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		paddingHorizontal: 32,
	},
	emptyTitle: {
		fontSize: 20,
		fontWeight: "700",
		color: "#1E293B",
		marginBottom: 8,
		textAlign: "center",
	},
	emptyText: {
		fontSize: 14,
		color: "#64748B",
		textAlign: "center",
		lineHeight: 20,
	},
});
