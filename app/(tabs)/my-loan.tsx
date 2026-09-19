import { TranslatedText } from "@/components/TranslatedText";
import { IconSymbol } from "@/components/ui/IconSymbol";
import { dark, primary, white } from "@/constants/Colors";
import { useNetworkAwareQuery } from "@/hooks/useNetworkAwareQuery";
import { useTranslation } from "@/hooks/useTranslation";
import Logger from "@/utils/logger";
import { axios, getUserDashboardData, URLS } from "@/utils/api";
import { font, height, width } from "@/utils/dimensions";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useRef, useState } from "react";
import {
	ActivityIndicator,
	Animated,
	Linking,
	Modal,
	Platform,
	Pressable,
	SafeAreaView,
	ScrollView,
	StatusBar as RNStatusBar,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from "react-native";
import Toast from "react-native-toast-message";

interface LoanDetailsAPIResponse {
	success: boolean;
	loan_details: {
		loan_id: string;
		loan_number: string;
		loan_type: string;
		loan_sub_type: string;
		amount_financed: number;
		approved_amount: number;
		disbursed_amount: number;
		net_disbursed_amount: number;
		interest_rate: string | number; // Can be string like "3.0% p.a" or number
		emi_amount: number;
		amount_to_repay: number;
		outstanding_balance: number;
		processing_fee: number;
		tenure_months: number;
		disbursement_date: string;
		status: string;
	};
}

// API function to get loan details
const getLoanDetails = async (loanNumber: string) => {
	const response = await axios.get(`loans/${loanNumber}`);
	console.log("=== MY LOAN API RESPONSE ===");
	console.log("API Endpoint:", `loans/${loanNumber}`);
	console.log("Loan Number:", loanNumber);
	console.log("Status:", response.status);
	Logger.debug("My loan response", response.data);
	console.log("============================");
	return response.data;
};

// API function to download loan agreement
const downloadLoanAgreement = async (loanId: string) => {
	try {
		console.log("📄 Calling loan agreement download API for:", loanId);
		const response = await axios.get(URLS.loan_agreement.download(loanId));
		Logger.debug("Loan agreement response", response.data);
		return response.data;
	} catch (error) {
		console.error("❌ Loan Agreement Download Error:", error);
		throw error;
	}
};

// API function to download insurance policy
const downloadInsurancePolicy = async () => {
	try {
		console.log("📄 Calling insurance policy download API");
		const response = await axios.post("insurance/download-my-policy", {});
		Logger.debug("Insurance policy response", response.data);
		return response.data;
	} catch (error) {
		console.error("❌ Insurance Policy Download Error:", error);
		throw error;
	}
};

// API function to download NOC
const downloadNOC = async (loanId: string) => {
	try {
		console.log("📄 Calling NOC download API for loanId:", loanId);
		const response = await axios.get(URLS.loans.noc(loanId));
		Logger.debug("NOC response", response.data);
		return response.data;
	} catch (error) {
		console.error("❌ NOC Download Error:", error);
		throw error;
	}
};

interface DocumentItem {
	id: string;
	name: string;
}

const DocumentRow = ({
	item,
	t,
	loanId,
	loanNumber,
}: {
	item: DocumentItem;
	t: any;
	loanId?: string;
	loanNumber?: string;
}) => {
	const [isDownloading, setIsDownloading] = useState(false);

	const handleDownload = async () => {
		// Handle loan agreement download
		if (item.name === t("loanAgreement") || item.id === "4") {
			if (!loanId) {
				Toast.show({
					type: "error",
					text1: "Error",
					text2: "Loan ID is missing",
				});
				return;
			}
			try {
				setIsDownloading(true);
				console.log("📄 Starting loan agreement download for loanId:", loanId);

				const response = await downloadLoanAgreement(loanId);

				if (response.download_url) {
					console.log("📄 Opening download URL:", response.download_url);

					// Open the URL directly - mobile browsers will handle PDF downloads
					const canOpen = await Linking.canOpenURL(response.download_url);

					if (canOpen) {
						await Linking.openURL(response.download_url);

						Toast.show({
							type: "success",
							text1: "Download Started",
							text2: "The PDF will download to your device",
						});
					} else {
						throw new Error("Cannot open download URL");
					}
				} else {
					throw new Error("No download URL received");
				}
			} catch (error: any) {
				console.error("❌ Download failed:", error);
				Toast.show({
					type: "error",
					text1: "Download Failed",
					text2:
						error?.response?.data?.message ||
						error?.message ||
						"Unable to download loan agreement",
				});
			} finally {
				setIsDownloading(false);
			}
		}
		// Handle NOC Download
		else if (item.name === t("nocDocument") || item.id === "6") {
			if (!loanId) {
				Toast.show({
					type: "error",
					text1: "Error",
					text2: "Loan ID is missing",
				});
				return;
			}
			try {
				setIsDownloading(true);
				console.log("📄 Starting NOC download...");

				const response = await downloadNOC(loanId);

				const downloadUrl = response.download_url || response.url || response.file_url;

				if (downloadUrl) {
					console.log("📄 Opening NOC URL:", downloadUrl);
					const canOpen = await Linking.canOpenURL(downloadUrl);

					if (canOpen) {
						await Linking.openURL(downloadUrl);
						Toast.show({
							type: "success",
							text1: "Download Started",
							text2: "NOC document will download to your device",
						});
					} else {
						throw new Error("Cannot open download URL");
					}
				} else {
					throw new Error("No download URL received");
				}
			} catch (error: any) {
				console.error("❌ NOC Download failed:", error);
				Toast.show({
					type: "error",
					text1: "Download Failed",
					text2: error?.response?.data?.message || error?.message || "Unable to download NOC",
				});
			} finally {
				setIsDownloading(false);
			}
		}
		// Handle insurance policy download
		else if (item.name === "Insurance Policy" || item.id === "5") {
			try {
				setIsDownloading(true);
				console.log("📄 Starting insurance policy download...");

				const response = await downloadInsurancePolicy();

				// Check if document is still being generated (pending status)
				if (response.status === "pending") {
					Toast.show({
						type: "info",
						text1: response.message || "Document Pending",
						text2: response.note || "Please try again in 2-3 minutes",
						visibilityTime: 5000,
					});
					return;
				}

				// Check if document is ready (has symbo_message URL)
				if (response.symbo_message) {
					console.log("📄 Opening insurance policy URL:", response.symbo_message);

					const canOpen = await Linking.canOpenURL(response.symbo_message);

					if (canOpen) {
						await Linking.openURL(response.symbo_message);

						Toast.show({
							type: "success",
							text1: "Download Started",
							text2: "The insurance policy PDF will download to your device",
						});
					} else {
						throw new Error("Cannot open download URL");
					}
				} else {
					// If no symbo_message but also not pending, show error from response
					const errorMsg =
						response.error || response.message || "No download URL received";
					throw new Error(errorMsg);
				}
			} catch (error: any) {
				console.error("❌ Insurance Policy Download failed:", error);

				let errorMessage = "Unable to download insurance policy";

				if (error?.response?.data) {
					const data = error.response.data;
					if (data.status === "pending") {
						Toast.show({
							type: "info",
							text1: data.message || "Document Pending",
							text2: data.note || "Please try again in 2-3 minutes",
							visibilityTime: 5000,
						});
						return;
					}
					errorMessage = data.message || data.error || errorMessage;
				} else if (
					error?.message &&
					!error.message.includes("status") &&
					!error.message.includes("code")
				) {
					errorMessage = error.message;
				}

				Toast.show({
					type: "error",
					text1: "Download Failed",
					text2: errorMessage,
				});
			} finally {
				setIsDownloading(false);
			}
		} else {
			Toast.show({
				type: "info",
				text1: "Coming Soon",
				text2: "This document will be available soon",
			});
		}
	};

	return (
		<View style={styles.documentRow}>
			<Text style={styles.documentText}>{item.name}</Text>
			<TouchableOpacity onPress={handleDownload} disabled={isDownloading}>
				{isDownloading ? (
					<ActivityIndicator size="small" color={dark} />
				) : (
					<IconSymbol name="download" size={26} color={dark} />
				)}
			</TouchableOpacity>
		</View>
	);
};

// Function to format amount using Intl formatter
const formatAmount = (amount: number): string => {
	return new Intl.NumberFormat("en-IN", {
		style: "currency",
		currency: "INR",
		minimumFractionDigits: 0,
		maximumFractionDigits: 0,
	}).format(amount);
};

// Function to extract interest rate number from string like "3.0% p.a"
const formatInterestRate = (rate: string | number): string => {
	if (typeof rate === "number") {
		return `${rate}% per month`;
	}
	const match = rate.match(/[\d.]+/);
	return match ? `${match[0]}% per month` : rate;
};

export default function MyLoan() {
	const router = useRouter();
	const { t, currentLanguage, isHindi } = useTranslation();
	const [showDownloadModal, setShowDownloadModal] = useState(false);
	const slideAnim = useRef(new Animated.Value(height(100))).current;

	useFocusEffect(
		React.useCallback(() => {
			RNStatusBar.setBarStyle("light-content");
			if (Platform.OS === "android") {
				RNStatusBar.setBackgroundColor("transparent");
				RNStatusBar.setTranslucent(true);
			}
		}, [])
	);

	// Fetch dashboard data to get loan number and progress
	const { data: dashboardData } = useNetworkAwareQuery({
		queryKey: ["userDashboard"],
		queryFn: getUserDashboardData,
	});

	const loanNumber = (dashboardData as any)?.primary_loan?.loan_number;

	// Fetch loan details if loan number exists in dashboard
	const { data: apiData, isLoading } = useNetworkAwareQuery<LoanDetailsAPIResponse>({
		queryKey: ["myLoanDetails", loanNumber],
		queryFn: () => getLoanDetails(loanNumber || ""),
		enabled: !!loanNumber,
	});

	if (!loanNumber) {
		return (
			<SafeAreaView style={styles.container}>
				<StatusBar style="light" />
				<View style={styles.header}>
					<TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
						<Ionicons name="arrow-back" size={24} color={white} />
					</TouchableOpacity>
					<TranslatedText style={styles.headerTitle} translationKey="myLoan" />
				</View>
				<View style={styles.loadingContainer}>
					<TranslatedText
						style={styles.professionalText}
						translationKey="loanDetailsNotFound"
					/>
				</View>
			</SafeAreaView>
		);
	}

	if (isLoading) {
		return (
			<SafeAreaView style={styles.container}>
				<StatusBar style="light" />
				<View style={styles.header}>
					<TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
						<Ionicons name="arrow-back" size={24} color={white} />
					</TouchableOpacity>
					<TranslatedText style={styles.headerTitle} translationKey="myLoan" />
				</View>
				<View style={styles.loadingContainer}>
					<ActivityIndicator size="large" color={primary} />
					<Text style={styles.loadingText}>Loading loan details...</Text>
				</View>
			</SafeAreaView>
		);
	}

	if (!apiData?.loan_details) {
		return (
			<SafeAreaView style={styles.container}>
				<StatusBar style="light" />
				<View style={styles.header}>
					<TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
						<Ionicons name="arrow-back" size={24} color={white} />
					</TouchableOpacity>
					<TranslatedText style={styles.headerTitle} translationKey="myLoan" />
				</View>
				<View style={styles.loadingContainer}>
					<Text style={styles.errorText}>Unable to load loan details</Text>
				</View>
			</SafeAreaView>
		);
	}

	const loanDetails = apiData.loan_details;

	const documentsData: DocumentItem[] = [
		{
			id: "4",
			name: t("loanAgreement"),
		},
	];

	const handleDownloadDocuments = () => {
		setShowDownloadModal(true);
		Animated.timing(slideAnim, {
			toValue: 0,
			duration: 300,
			useNativeDriver: true,
		}).start();
	};

	const handleCloseModal = () => {
		Animated.timing(slideAnim, {
			toValue: height(100),
			duration: 300,
			useNativeDriver: true,
		}).start(() => {
			setShowDownloadModal(false);
		});
	};

	return (
		<SafeAreaView style={styles.container}>
			<StatusBar style="light" />
			{/* Header */}
			<View style={styles.header}>
				<TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
					<Ionicons name="arrow-back" size={24} color={white} />
				</TouchableOpacity>
				<TranslatedText style={styles.headerTitle} translationKey="myLoan" />
			</View>

			<ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
				{/* Loan Details Container */}
				<View style={styles.detailsContainer}>
					{/* Loan Amount */}
					<View style={styles.detailRow}>
						<TranslatedText
							style={styles.detailLabel}
							translationKey="loanAmount"
						/>
						<Text style={styles.detailValue}>
							{formatAmount(
								loanDetails.approved_amount || loanDetails.amount_financed,
							)}
						</Text>
					</View>

					<View style={styles.separator} />

					{/* Interest Rate */}
					<View style={styles.detailRow}>
						<TranslatedText
							style={styles.detailLabel}
							translationKey="interestRate"
						/>
						<Text style={styles.detailValue}>
							{formatInterestRate(loanDetails.interest_rate)}
						</Text>
					</View>

					<View style={styles.separator} />

					{/* Net Disbursal Amount */}
					<View style={styles.detailRow}>
						<TranslatedText
							style={styles.detailLabel}
							translationKey="netDisbursalAmount"
						/>
						<Text style={styles.detailValue}>
							{formatAmount(loanDetails.net_disbursed_amount)}
						</Text>
					</View>

					<View style={styles.separator} />

					{/* Amount to Repay */}
					<View style={styles.detailRow}>
						<TranslatedText
							style={styles.detailLabel}
							translationKey="amountToRepay"
						/>
						<Text style={styles.detailValue}>
							{formatAmount(loanDetails.amount_to_repay)}
						</Text>
					</View>
				</View>

				{/* Download Documents Button */}
				<TouchableOpacity
					style={styles.downloadButton}
					onPress={handleDownloadDocuments}>
					<TranslatedText
						style={styles.downloadText}
						translationKey="downloadDocuments"
					/>
					<IconSymbol name="download" size={20} color={dark} />
				</TouchableOpacity>
			</ScrollView>

			{/* Download Modal */}
			<Modal
				visible={showDownloadModal}
				transparent={true}
				animationType="none"
				onRequestClose={handleCloseModal}>
				<Pressable style={styles.modalOverlay} onPress={handleCloseModal}>
					<Animated.View
						style={[
							styles.modalContainer,
							{ transform: [{ translateY: slideAnim }] },
						]}>
						<View style={styles.modalHandle} />
						<TranslatedText
							style={styles.modalTitle}
							translationKey="downloadLoanDocuments"
						/>
						<View style={styles.documentsContainer}>
							{documentsData.map((item) => (
								<DocumentRow
									key={item.id}
									item={item}
									t={t}
									loanId={loanDetails?.loan_id}
									loanNumber={loanDetails?.loan_number}
								/>
							))}
						</View>
					</Animated.View>
				</Pressable>
			</Modal>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: white,
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
		marginRight: width(4),
		padding: 8,
	},
	headerTitle: {
		fontSize: font(2.2),
		fontWeight: "600",
		color: white,
		lineHeight: 24,
	},
	content: {
		flex: 1,
	},
	detailsContainer: {
		marginTop: height(2),
		marginHorizontal: width(4),
		backgroundColor: white,
		borderRadius: 12,
		borderWidth: 1,
		borderColor: "#E5E5E5",
		overflow: "hidden",
	},
	detailRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingVertical: height(2.5),
		paddingHorizontal: width(5),
	},
	detailLabel: {
		fontSize: 16,
		color: "#666",
		fontWeight: "500",
		flex: 1,
	},
	detailValue: {
		fontSize: 16,
		color: "#333",
		fontWeight: "600",
		textAlign: "right",
	},
	separator: {
		height: 1,
		backgroundColor: "#E5E5E5",
		marginHorizontal: width(5),
	},
	loadingContainer: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		paddingHorizontal: width(8),
	},
	loadingText: {
		marginTop: height(2),
		fontSize: font(2),
		color: "#666",
	},
	errorText: {
		fontSize: font(2.2),
		color: "#EF4444",
		textAlign: "center",
	},
	professionalText: {
		fontSize: font(2),
		color: "#666",
		textAlign: "center",
		lineHeight: font(2.6),
		paddingHorizontal: width(4),
	},
	downloadButton: {
		backgroundColor: white,
		marginHorizontal: width(4),
		marginTop: height(2),
		marginBottom: height(4),
		borderRadius: 16,
		borderWidth: 1,
		borderColor: "#E5E7EB",
		paddingVertical: height(2.5),
		paddingHorizontal: width(4),
		flexDirection: "row",
		justifyContent: "center",
		alignItems: "center",
	},
	downloadText: {
		fontSize: font(1.9),
		color: dark,
		fontWeight: "500",
		marginRight: width(2),
	},
	modalOverlay: {
		flex: 1,
		backgroundColor: "rgba(0, 0, 0, 0.5)",
		justifyContent: "flex-end",
	},
	modalContainer: {
		backgroundColor: white,
		borderTopLeftRadius: 24,
		borderTopRightRadius: 24,
		paddingTop: height(2),
		paddingBottom: height(4),
		paddingHorizontal: width(5),
		maxHeight: "70%",
	},
	modalHandle: {
		width: width(12),
		height: height(0.5),
		backgroundColor: "#D1D5DB",
		borderRadius: 2,
		alignSelf: "center",
		marginBottom: height(3),
	},
	modalTitle: {
		fontSize: font(2.2),
		fontWeight: "600",
		color: dark,
		textAlign: "center",
		marginBottom: height(3),
	},
	documentsContainer: {
		gap: height(1),
	},
	documentRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingVertical: height(2),
		paddingHorizontal: width(4),
		borderBottomWidth: 1,
		borderBottomColor: "#E5E7EB",
	},
	documentText: {
		fontSize: font(1.9),
		color: dark,
		fontWeight: "500",
	},
});
