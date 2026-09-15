import { TranslatedText } from "@/components/TranslatedText";
import { dark, white } from "@/constants/Colors";
import { useNetworkAwareQuery } from "@/hooks/useNetworkAwareQuery";
import { useTranslation } from "@/hooks/useTranslation";
import { axios, getUserDashboardData } from "@/utils/api";
import { font, height, width } from "@/utils/dimensions";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React from "react";
import { ActivityIndicator, FlatList, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

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
	console.log("📞 HISTORY TAB: Calling GET /v1/loans API with query params...");
	console.log("📞 HISTORY TAB: API URL:", apiUrl);
	console.log("📞 HISTORY TAB: Query Params: skip=0, limit=50, loan_status=active");
	try {
		const response = await axios.get(apiUrl);
		console.log("✅ HISTORY TAB: API Success Response");
		console.log("📊 HISTORY TAB: Status:", response.status);
		console.log("📊 HISTORY TAB: Full Response:", JSON.stringify(response.data, null, 2));
		console.log("📊 HISTORY TAB: Loans Array:", response.data?.loans);
		console.log("📊 HISTORY TAB: Loans Count:", response.data?.loans?.length || 0);
		if (response.data?.loans && Array.isArray(response.data.loans)) {
			response.data.loans.forEach((loan: any, index: number) => {
				console.log(`📋 HISTORY TAB: Loan ${index + 1}:`, {
					loan_id: loan.loan_id,
					loan_number: loan.loan_number,
					status: loan.status,
					loan_status: loan.loan_status,
					amount: loan.amount,
				});
			});
		}
		console.log("=================================");
		return response.data;
	} catch (error: any) {
		console.error("❌ HISTORY TAB: API Error:", error);
		console.error("❌ HISTORY TAB: Error Response:", error?.response?.data);
		console.error("❌ HISTORY TAB: Error URL:", error?.config?.url);
		throw error;
	}
};

const formatIndianCurrency = (amount: number): string => {
	return `₹${amount.toLocaleString("en-IN")}`;
};

const formatDate = (dateString: string): string => {
	try {
		const date = new Date(dateString);
		return date.toLocaleDateString("en-IN", {
			year: "numeric",
			month: "short",
			day: "numeric",
		});
	} catch {
		return dateString;
	}
};

const LoanHistoryItemComponent = ({ item, t }: { item: LoanHistoryItem; t: any }) => {
	return (
		<View style={styles.itemContainer}>
			<View style={styles.leftSection}>
				<Text style={styles.loanNumberText}>{item.loan_number}</Text>
				<Text style={styles.amountText}>{formatIndianCurrency(item.amount)}</Text>
				<Text style={styles.dateTimeText}>
					{t("due")}: {formatDate(item.due_date)}
				</Text>
			</View>
			<View style={styles.rightSection}>
				<View style={styles.statusContainer}>
					<Text style={styles.statusText}>{item.status}</Text>
				</View>
			</View>
		</View>
	);
};

export default function History() {
	const router = useRouter();
	const { t, currentLanguage, isHindi } = useTranslation();

	console.log("🏠 HISTORY TAB: Component rendered");

	// Fetch dashboard data to get loan number
	const { data: dashboardData, isLoading: isLoadingDashboard } = useNetworkAwareQuery({
		queryKey: ["userDashboard"],
		queryFn: getUserDashboardData,
	});

	const loanNumber = (dashboardData as any)?.primary_loan?.loan_number;

	console.log("📊 HISTORY TAB: Dashboard Data:", {
		hasDashboardData: !!dashboardData,
		isLoadingDashboard,
		loanNumber,
		primary_loan: (dashboardData as any)?.primary_loan,
	});

	// Fetch loan history - API doesn't require loan number (it's a list endpoint)
	const { data: apiData, isLoading, error, isError } = useNetworkAwareQuery({
		queryKey: ["loanHistory", "active"],
		queryFn: getLoanHistory,
		enabled: true,
	});

	// Extract loans from API response
	const loanHistoryData: LoanHistoryItem[] = apiData?.loans || [];

	const handleLoanPress = (item: LoanHistoryItem) => {
		console.log("👆 HISTORY TAB: Loan clicked:", item);
		router.push({
			pathname: "/loan-details" as any,
			params: { loanNumber: item.loan_number },
		});
	};

	return (
		<SafeAreaView style={styles.container}>
			<StatusBar style="light" />
			<View style={styles.header}>
				<TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
					<Ionicons name="arrow-back" size={24} color={white} />
				</TouchableOpacity>
				<TranslatedText style={styles.headerTitle} translationKey="history" />
			</View>

			{isLoading ? (
				<View style={styles.loadingContainer}>
					<ActivityIndicator size="large" color={dark} />
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
						<TouchableOpacity onPress={() => handleLoanPress(item)} activeOpacity={0.7}>
							<LoanHistoryItemComponent item={item} t={t} />
						</TouchableOpacity>
					)}
					showsVerticalScrollIndicator={false}
					contentContainerStyle={styles.listContainer}
				/>
			)}
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#fff",
	},
	header: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: width(4),
		paddingTop: height(6),
		paddingBottom: height(2),
		backgroundColor: "#1a1a1a",
		borderBottomWidth: 1,
		borderBottomColor: "#333",
	},
	backButton: {
		padding: width(2),
		marginRight: width(3),
	},
	headerTitle: {
		fontSize: font(2.4),
		fontWeight: "700",
		color: white,
		flex: 1,
	},
	content: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		paddingHorizontal: width(6),
	},
	professionalText: {
		fontSize: font(2),
		color: "#666",
		textAlign: "center",
		lineHeight: font(2.6),
		paddingHorizontal: width(4),
	},
	listContainer: {
		paddingTop: height(3),
		paddingBottom: height(5),
	},
	itemContainer: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingVertical: height(3),
		paddingHorizontal: width(5),
		backgroundColor: "#F6F7FF",
		marginHorizontal: width(4),
		marginVertical: height(1),
		borderRadius: 12,
	},
	leftSection: {
		flex: 1,
	},
	loanNumberText: {
		fontSize: font(2.2),
		fontWeight: "700",
		color: dark,
		marginBottom: height(0.5),
	},
	amountText: {
		fontSize: font(2),
		fontWeight: "600",
		color: dark,
		marginBottom: height(0.5),
	},
	dateTimeText: {
		fontSize: font(1.8),
		color: "#64748B",
		fontWeight: "400",
	},
	rightSection: {
		alignItems: "flex-end",
	},
	statusContainer: {
		backgroundColor: white,
		borderRadius: 16,
		paddingHorizontal: width(3),
		paddingVertical: height(0.8),
	},
	statusText: {
		fontSize: font(1.8),
		fontWeight: "500",
		color: dark,
	},
	loadingContainer: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
	},
	loadingText: {
		fontSize: font(1.8),
		color: dark,
		marginTop: height(2),
	},
	emptyContainer: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		paddingHorizontal: width(8),
	},
	emptyTitle: {
		fontSize: font(2.4),
		fontWeight: "700",
		color: dark,
		marginBottom: height(2),
		textAlign: "center",
	},
	emptyText: {
		fontSize: font(1.8),
		color: "#64748B",
		textAlign: "center",
		lineHeight: font(2.6),
	},
});
