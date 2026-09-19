import { TranslatedText } from "@/components/TranslatedText";
import { dark } from "@/constants/Colors";
import { useJourneyTracker } from "@/hooks/useJourneyTracker";
import { useNetworkAwareQuery } from "@/hooks/useNetworkAwareQuery";
import { useTranslation } from "@/hooks/useTranslation";
import { axios, URLS } from "@/utils/api";
import { Images } from "@/constants/images";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useRef, useState } from "react";
import {
	ActivityIndicator,
	Animated,
	BackHandler,
	Dimensions,
	Linking,
	Modal,
	Platform,
	Pressable,
	ScrollView,
	StatusBar as RNStatusBar,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

const { height: screenHeight } = Dimensions.get("window");

// API function to download loan agreement
const downloadLoanAgreement = async (loanId: string) => {
	const response = await axios.get(URLS.loan_agreement.download(loanId));
	return response.data;
};

// API function to download insurance policy
const downloadInsurancePolicy = async () => {
	const response = await axios.post("insurance/download-my-policy", {});
	return response.data;
};

// API function to download NOC / NDC
const downloadNOC = async (loanId: string) => {
	const response = await axios.get(URLS.loans.noc(loanId));
	return response.data;
};

interface DocumentItem {
	id: string;
	name: string;
}

interface LoanDetailsAPIResponse {
	success: boolean;
	loan_details: {
		lender_loan_account_number: string;
		loan_id: string;
		lender_name?: string;
		loan_type: string;
		loan_sub_type: string;
		amount_financed: number;
		interest_rate: string;
		disbursement_date: string;
		emi_start_date: string;
		emi_end_date?: string;
		principal_outstanding: number;
		overdue_amount: number;
		loan_status: string;
	};
}

interface LoanBookTransaction {
	date: string;
	particulars: string;
	amount: number;
	type: "credit" | "debit";
	category?: string;
}

interface LoanBookAPIResponse {
	success: boolean;
	loan_info: {
		lender_loan_account_number: string;
		loan_id: string;
		loan_type: string;
		status: string;
		customer_id: string;
	};
	loan_book: LoanBookTransaction[];
	summary: {
		principal_outstanding: number;
		interest_outstanding: number;
		charges_outstanding: number;
		total_outstanding: number;
		total_repaid: number;
	};
}

const formatNumber = (amount?: number): string => {
	if (typeof amount !== "number" || isNaN(amount)) return "0";
	return amount.toLocaleString("en-IN");
};

// API functions
const getLoanDetails = async (loanNumber: string) => {
	const response = await axios.get(`loans/${loanNumber}`);
	return response.data;
};

const getAllLoans = async () => {
	const response = await axios.get("loans");
	return response.data;
};

const getLoanBook = async (loanNumber: string) => {
	const response = await axios.get(`loans/${loanNumber}/loan-book`);
	return response.data;
};

export default function LoanDetails() {
	useJourneyTracker("/loan-details");
	const insets = useSafeAreaInsets();
	const { t } = useTranslation();
	const { loanNumber } = useLocalSearchParams<{ loanNumber: string }>();

	const [showDetails, setShowDetails] = useState(false);
	const [showDownloadModal, setShowDownloadModal] = useState(false);
	const [downloadingId, setDownloadingId] = useState<string | null>(null);
	const slideAnim = useRef(new Animated.Value(screenHeight)).current;

	// Handle hardware back press & status bar style
	useFocusEffect(
		React.useCallback(() => {
			RNStatusBar.setBarStyle("dark-content");
			if (Platform.OS === "android") {
				RNStatusBar.setBackgroundColor("transparent");
				RNStatusBar.setTranslucent(true);
			}

			const onBackPress = () => {
				if (showDetails) {
					setShowDetails(false);
					return true;
				}
				router.back();
				return true;
			};

			const subscription = BackHandler.addEventListener(
				"hardwareBackPress",
				onBackPress
			);

			return () => subscription.remove();
		}, [showDetails])
	);

	// If no loanNumber provided (from profile), fetch all loans first
	const { data: allLoansData, isLoading: isLoadingAllLoans } = useNetworkAwareQuery({
		queryKey: ["allLoans"],
		queryFn: getAllLoans,
		enabled: !loanNumber,
	});

	const effectiveLoanNumber = loanNumber || allLoansData?.loans?.[0]?.loan_number;

	// Fetch specific loan details
	const { data: apiData, isLoading: isLoadingDetails } =
		useNetworkAwareQuery<LoanDetailsAPIResponse>({
			queryKey: ["loanDetails", effectiveLoanNumber],
			queryFn: () => getLoanDetails(effectiveLoanNumber || ""),
			enabled: !!effectiveLoanNumber,
		});

	React.useEffect(() => {
		if (apiData && effectiveLoanNumber) {
			console.log("📄 Loan details loaded for:", effectiveLoanNumber);
		}
	}, [apiData, effectiveLoanNumber]);

	// Fetch loan book when showDetails is active
	const { data: loanBookData, isLoading: isLoadingLoanBook } =
		useNetworkAwareQuery<LoanBookAPIResponse>({
			queryKey: ["loanBook", effectiveLoanNumber],
			queryFn: () => getLoanBook(effectiveLoanNumber || ""),
			enabled: !!effectiveLoanNumber && showDetails,
		});

	const handleBack = () => {
		if (showDetails) {
			setShowDetails(false);
		} else {
			router.back();
		}
	};

	const handleToggleDetails = () => {
		setShowDetails((prev) => !prev);
	};

	const handleDownloadDocuments = () => {
		setShowDownloadModal(true);
		Animated.timing(slideAnim, {
			toValue: 0,
			duration: 280,
			useNativeDriver: true,
		}).start();
	};

	const handleCloseModal = () => {
		Animated.timing(slideAnim, {
			toValue: screenHeight,
			duration: 250,
			useNativeDriver: true,
		}).start(() => {
			setShowDownloadModal(false);
		});
	};

	// 6 Documents matching Screenshot 3
	const documentsData: DocumentItem[] = [
		{ id: "1", name: "Product Details" },
		{ id: "2", name: "Privacy Policy" },
		{ id: "3", name: "Key Facts Statement" },
		{ id: "4", name: "Loan Agreement" },
		{ id: "5", name: "NDC" },
		{ id: "6", name: "Sanction Letter" },
	];

	const handleDocumentDownload = async (item: DocumentItem) => {
		console.log("📄 Starting document download:", item.name);
		const loanId = apiData?.loan_details?.loan_id || effectiveLoanNumber;

		try {
			setDownloadingId(item.id);

			let downloadUrl: string | null = null;

			if (item.name === "Loan Agreement" || item.id === "4") {
				const response = await downloadLoanAgreement(loanId || "default");
				downloadUrl = response?.download_url || response?.url;
			} else if (item.name === "NDC" || item.id === "5") {
				const response = await downloadNOC(loanId || "default");
				downloadUrl = response?.download_url || response?.url;
			} else if (item.id === "2" || item.name === "Privacy Policy") {
				downloadUrl = "https://rapidmoney.in/privacy-policy";
			} else {
				// Mock / fallback document placeholder
				downloadUrl = "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf";
			}

			if (downloadUrl) {
				const canOpen = await Linking.canOpenURL(downloadUrl);
				if (canOpen) {
					await Linking.openURL(downloadUrl);
					Toast.show({
						type: "success",
						text1: "Download Started",
						text2: `${item.name} is downloading to your device`,
					});
				} else {
					throw new Error("Cannot open download URL");
				}
			} else {
				throw new Error("No download URL received");
			}
		} catch (error: any) {
			console.error("❌ Document download failed:", error?.message);
			Toast.show({
				type: "error",
				text1: "Download Failed",
				text2: error?.message || `Unable to download ${item.name}`,
			});
		} finally {
			setDownloadingId(null);
		}
	};

	// Loading state
	if (isLoadingAllLoans || isLoadingDetails) {
		return (
			<View style={styles.loadingContainer}>
				<StatusBar style="dark" />
				<Image
					source={Images.BOUNCING_BALL}
					style={styles.loaderGif}
					contentFit="contain"
				/>
				<TranslatedText style={styles.loadingText} translationKey="loadingLoanDetails" />
			</View>
		);
	}

	// Error state
	if (!apiData || !effectiveLoanNumber) {
		return (
			<View style={styles.loadingContainer}>
				<TranslatedText style={styles.professionalText} translationKey="loanDetailsNotFound" />
			</View>
		);
	}

	const loanDetails = apiData.loan_details;

	// Render dynamic details list matching Screenshot 2
	const detailsRows = [
		{
			label: "Loan type",
			value:
				loanDetails.lender_name ||
				"ESPL (20%) & Kisetsu Saison Finance ( india ) Private Limited (80%)",
			isMultiLine: true,
		},
		{
			label: "Loan type",
			value: loanDetails.loan_sub_type || "Cash loan",
		},
		{
			label: "Loan ID",
			value: loanDetails.loan_id || loanDetails.lender_loan_account_number,
		},
		{
			label: "Amount financed",
			value: `₹${formatNumber(loanDetails.amount_financed)} Cr`,
			isAmountWithCr: true,
		},
		{
			label: "Interest rate",
			value: loanDetails.interest_rate?.includes("p.a")
				? loanDetails.interest_rate
				: `${loanDetails.interest_rate || "27.0%"} p.a`,
		},
		{
			label: "Disbursement date",
			value: loanDetails.disbursement_date || "15/12/2024",
		},
		{
			label: "EMI start date",
			value: loanDetails.emi_start_date || "02/01/2025",
		},
		{
			label: "EMI end date",
			value: loanDetails.emi_end_date || "02/12/2025",
		},
		{
			label: "Principal outstanding",
			value:
				loanDetails.principal_outstanding === 0
					? "₹00"
					: `₹${formatNumber(loanDetails.principal_outstanding)}`,
		},
		{
			label: "Overdue amount",
			value:
				loanDetails.overdue_amount === 0
					? "₹00"
					: `₹${formatNumber(loanDetails.overdue_amount)}`,
		},
		{
			label: "Loan status",
			value: loanDetails.loan_status || "Closed",
			isStatus: true,
		},
	];

	return (
		<View style={styles.container}>
			<StatusBar style="dark" />

			{/* Clean White Top Header */}
			<View style={[styles.header, { paddingTop: insets.top + (Platform.OS === "android" ? 14 : 10) }]}>
				<TouchableOpacity
					style={styles.backButton}
					onPress={handleBack}
					hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
					<Ionicons name="arrow-back" size={24} color="#1E293B" />
				</TouchableOpacity>
				<Text style={styles.headerTitle}>Loan details</Text>
			</View>

			<ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
				{/* Top Loan Header Card (Screenshot 1 & Screenshot 2) */}
				<TouchableOpacity
					style={styles.loanHeaderCard}
					activeOpacity={0.85}
					onPress={handleToggleDetails}>
					<View style={styles.loanHeaderLeft}>
						<View style={styles.loanIconCircle}>
							<Ionicons name="document-text-outline" size={24} color="#059669" />
						</View>
						<View>
							<Text style={styles.loanTypeTitle}>
								{loanDetails.loan_type || "Cash Loan"}
							</Text>
							{showDetails ? (
								<>
									<Text style={styles.loanIdSubLabel}>Loan ID</Text>
									<Text style={styles.loanIdText}>
										{loanDetails.loan_id || loanDetails.lender_loan_account_number}
									</Text>
								</>
							) : (
								<Text style={styles.loanIdText}>
									{loanDetails.loan_id || loanDetails.lender_loan_account_number}
								</Text>
							)}
						</View>
					</View>

					<View style={styles.loanHeaderRight}>
						{showDetails ? (
							<Text style={styles.moreDetailsLink}>More Details</Text>
						) : (
							<View style={styles.statusPill}>
								<Text style={styles.statusPillText}>
									{loanDetails.loan_status || "Closed"}
								</Text>
							</View>
						)}
					</View>
				</TouchableOpacity>

				{/* View 1: More Details / Transactions Table View (Screenshot 1) */}
				{showDetails ? (
					isLoadingLoanBook ? (
						<View style={styles.loadingBookContainer}>
							<Image
								source={Images.BOUNCING_BALL}
								style={styles.bookLoaderGif}
								contentFit="contain"
							/>
							<TranslatedText
								style={styles.loadingText}
								translationKey="loadingTransactionHistory"
							/>
						</View>
					) : (
						<View style={styles.tableCard}>
							{/* Table Header */}
							<View style={styles.tableHeaderRow}>
								<Text style={styles.columnHeaderText}>Particulars</Text>
								<Text style={styles.columnHeaderText}>Amount</Text>
							</View>

							{/* Transaction Rows */}
							{loanBookData?.loan_book && loanBookData.loan_book.length > 0 ? (
								loanBookData.loan_book.map((txn, index) => {
									const isCredit = txn.type === "credit";
									const isLast = index === loanBookData.loan_book.length - 1;

									return (
										<View
											key={index}
											style={[styles.transactionRow, isLast && styles.noBorderBottom]}>
											<View style={styles.txnLeft}>
												<Text style={styles.txnDateText}>{txn.date}</Text>
												<Text style={styles.txnParticularsText}>{txn.particulars}</Text>
											</View>
											<View style={styles.txnRight}>
												<Text style={styles.txnAmountText}>
													{isCredit
														? `₹${formatNumber(txn.amount)} `
														: `${formatNumber(txn.amount)} `}
													<Text
														style={[
															styles.txnTagText,
															{ color: isCredit ? "#16A34A" : "#EF4444" },
														]}>
														{isCredit ? "Cr" : "Dr"}
													</Text>
												</Text>
											</View>
										</View>
									);
								})
							) : (
								<View style={styles.emptyTransactions}>
									<Text style={styles.emptyTransactionsText}>No transactions found</Text>
								</View>
							)}
						</View>
					)
				) : (
					/* View 2: Default Details View (Screenshot 2) */
					<>
						<View style={styles.tableCard}>
							{detailsRows.map((row, index) => {
								const isLast = index === detailsRows.length - 1;

								return (
									<View
										key={index}
										style={[styles.detailRow, isLast && styles.noBorderBottom]}>
										<Text style={styles.detailLabel}>{row.label}</Text>
										{row.isAmountWithCr ? (
											<Text style={styles.detailValue}>
												{row.value.replace(" Cr", "")}{" "}
												<Text style={{ color: "#16A34A", fontWeight: "700" }}>Cr</Text>
											</Text>
										) : (
											<Text
												style={[
													styles.detailValue,
													row.isMultiLine && styles.multiLineValue,
													row.isStatus && styles.statusValueText,
												]}>
												{row.value}
											</Text>
										)}
									</View>
								);
							})}
						</View>

						{/* Download Documents Button */}
						<TouchableOpacity
							style={styles.downloadButton}
							activeOpacity={0.8}
							onPress={handleDownloadDocuments}>
							<Text style={styles.downloadText}>Download documents</Text>
							<MaterialCommunityIcons name="tray-arrow-down" size={19} color="#1E293B" />
						</TouchableOpacity>
					</>
				)}
			</ScrollView>

			{/* Slide-Up Download Documents Modal (Screenshot 3) */}
			<Modal
				visible={showDownloadModal}
				transparent={true}
				animationType="none"
				onRequestClose={handleCloseModal}>
				<Pressable style={styles.modalOverlay} onPress={handleCloseModal}>
					<Animated.View
						style={[
							styles.modalContainer,
							{
								paddingBottom: insets.bottom + 20,
								transform: [{ translateY: slideAnim }],
							},
						]}>
						<View style={styles.modalHandle} />
						<Text style={styles.modalTitle}>Download loan documents</Text>

						<View style={styles.documentsList}>
							{documentsData.map((item) => {
								const isDownloading = downloadingId === item.id;

								return (
									<View key={item.id} style={styles.documentCard}>
										<Text style={styles.documentName}>{item.name}</Text>
										<TouchableOpacity
											style={styles.downloadCircleButton}
											disabled={isDownloading}
											onPress={() => handleDocumentDownload(item)}>
											{isDownloading ? (
												<ActivityIndicator size="small" color="#1E293B" />
											) : (
												<MaterialCommunityIcons
													name="tray-arrow-down"
													size={18}
													color="#334155"
												/>
											)}
										</TouchableOpacity>
									</View>
								);
							})}
						</View>
					</Animated.View>
				</Pressable>
			</Modal>
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
	scrollContent: {
		flex: 1,
	},
	loanHeaderCard: {
		backgroundColor: "#F8F9FE",
		marginHorizontal: 18,
		marginBottom: 16,
		paddingHorizontal: 16,
		paddingVertical: 16,
		borderRadius: 20,
		borderWidth: 1,
		borderColor: "#EAEFF8",
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
	},
	loanHeaderLeft: {
		flexDirection: "row",
		alignItems: "center",
		flex: 1,
	},
	loanIconCircle: {
		width: 48,
		height: 48,
		borderRadius: 24,
		backgroundColor: "#FFFFFF",
		justifyContent: "center",
		alignItems: "center",
		marginRight: 14,
		borderWidth: 1,
		borderColor: "#EEF2F6",
	},
	loanTypeTitle: {
		fontSize: 17,
		fontWeight: "700",
		color: "#1E293B",
		marginBottom: 2,
	},
	loanIdSubLabel: {
		fontSize: 12,
		color: "#94A3B8",
		fontWeight: "500",
	},
	loanIdText: {
		fontSize: 14,
		fontWeight: "700",
		color: "#1E293B",
	},
	loanHeaderRight: {
		justifyContent: "center",
		alignItems: "flex-end",
	},
	statusPill: {
		borderRadius: 20,
		borderWidth: 1.5,
		borderColor: "#F43F5E",
		paddingHorizontal: 14,
		paddingVertical: 4,
		backgroundColor: "#FFFFFF",
	},
	statusPillText: {
		fontSize: 13,
		fontWeight: "700",
		color: "#F43F5E",
	},
	moreDetailsLink: {
		fontSize: 14,
		fontWeight: "600",
		color: "#1E293B",
		paddingVertical: 4,
	},
	tableCard: {
		backgroundColor: "#FFFFFF",
		borderRadius: 18,
		borderWidth: 1,
		borderColor: "#EAEFF8",
		marginHorizontal: 18,
		paddingHorizontal: 16,
		paddingVertical: 8,
		marginBottom: 16,
	},
	detailRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingVertical: 13,
		borderBottomWidth: 1,
		borderBottomColor: "#F1F5F9",
	},
	noBorderBottom: {
		borderBottomWidth: 0,
	},
	detailLabel: {
		fontSize: 14,
		color: "#94A3B8",
		fontWeight: "400",
		flex: 1,
	},
	detailValue: {
		fontSize: 14,
		fontWeight: "700",
		color: "#1E293B",
		textAlign: "right",
	},
	multiLineValue: {
		flex: 1.5,
		fontSize: 13,
		lineHeight: 18,
		marginLeft: 12,
	},
	statusValueText: {
		color: "#F43F5E",
		fontWeight: "700",
	},
	downloadButton: {
		backgroundColor: "#FFFFFF",
		borderRadius: 25,
		borderWidth: 1,
		borderColor: "#E2E8F0",
		height: 50,
		flexDirection: "row",
		justifyContent: "center",
		alignItems: "center",
		marginHorizontal: 18,
		marginTop: 8,
		marginBottom: 36,
	},
	downloadText: {
		fontSize: 15,
		fontWeight: "600",
		color: "#1E293B",
		marginRight: 6,
	},
	tableHeaderRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingVertical: 12,
		borderBottomWidth: 1,
		borderBottomColor: "#F1F5F9",
	},
	columnHeaderText: {
		fontSize: 15,
		fontWeight: "700",
		color: "#1E293B",
	},
	transactionRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingVertical: 12,
		borderBottomWidth: 1,
		borderBottomColor: "#F8FAFC",
	},
	txnLeft: {
		flex: 1,
		paddingRight: 10,
	},
	txnDateText: {
		fontSize: 14,
		fontWeight: "600",
		color: "#1E293B",
	},
	txnParticularsText: {
		fontSize: 13,
		color: "#94A3B8",
		marginTop: 2,
	},
	txnRight: {
		alignItems: "flex-end",
	},
	txnAmountText: {
		fontSize: 15,
		fontWeight: "700",
		color: "#1E293B",
	},
	txnTagText: {
		fontSize: 14,
		fontWeight: "700",
	},
	emptyTransactions: {
		paddingVertical: 32,
		alignItems: "center",
	},
	emptyTransactionsText: {
		fontSize: 14,
		color: "#94A3B8",
	},
	loadingContainer: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		backgroundColor: "#FFFFFF",
	},
	loaderGif: {
		width: 280,
		height: 210,
	},
	loadingBookContainer: {
		paddingVertical: 40,
		alignItems: "center",
		justifyContent: "center",
	},
	bookLoaderGif: {
		width: 200,
		height: 150,
	},
	loadingText: {
		fontSize: 16,
		fontWeight: "500",
		color: "#64748B",
		marginTop: 8,
	},
	professionalText: {
		fontSize: 15,
		color: "#64748B",
		textAlign: "center",
		paddingHorizontal: 32,
	},
	modalOverlay: {
		flex: 1,
		backgroundColor: "rgba(0, 0, 0, 0.45)",
		justifyContent: "flex-end",
	},
	modalContainer: {
		backgroundColor: "#FFFFFF",
		borderTopLeftRadius: 28,
		borderTopRightRadius: 28,
		paddingHorizontal: 20,
		paddingTop: 12,
	},
	modalHandle: {
		width: 48,
		height: 4,
		borderRadius: 2,
		backgroundColor: "#E2E8F0",
		alignSelf: "center",
		marginBottom: 16,
	},
	modalTitle: {
		fontSize: 18,
		fontWeight: "700",
		color: "#1E293B",
		textAlign: "center",
		marginBottom: 18,
	},
	documentsList: {
		gap: 10,
	},
	documentCard: {
		backgroundColor: "#F8F9FE",
		borderRadius: 16,
		borderWidth: 1,
		borderColor: "#EEF2F6",
		paddingHorizontal: 16,
		paddingVertical: 14,
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
	},
	documentName: {
		fontSize: 14,
		fontWeight: "600",
		color: "#1E293B",
	},
	downloadCircleButton: {
		width: 34,
		height: 34,
		borderRadius: 17,
		borderWidth: 1,
		borderColor: "#CBD5E1",
		backgroundColor: "#FFFFFF",
		justifyContent: "center",
		alignItems: "center",
	},
});

export { RouteErrorBoundary as ErrorBoundary } from "@/components/ErrorBoundary";
