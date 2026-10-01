import { dark, primary, white } from "@/constants/Colors";
import { useNetworkAwareQuery } from "@/hooks/useNetworkAwareQuery";
import { IconSymbol } from "@/components/ui/IconSymbol";
import { useTranslation } from "@/hooks/useTranslation";
import { axios } from "@/utils/api";
import { font, height, width } from "@/utils/dimensions";
import { STORAGE_KEYS, setStorageItem, getStorageItem } from "@/utils/storage";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { useLocalSearchParams, useRouter } from "expo-router";
import { decode } from "@/utils/encode_decode";
import { useEffect, useState } from "react";
import {
	ActivityIndicator,
	DeviceEventEmitter,
	Platform,
	SafeAreaView,
	ScrollView,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from "react-native";

interface RepaymentOption {
	type: string;
	display_name: string;
	amount: number;
	description: string;
	due_date?: string;
	is_recommended?: boolean;
	processing_fee?: number;
	discount?: number;
	savings?: number;
}

interface RepaymentOptionsResponse {
	loan_id: string;
	loan_number: string;
	repayment_options: RepaymentOption[];
	current_outstanding: number;
	next_due_date: string;
	due_date: string;
	total_repaid: number;
	loan_amount: number;
	is_overdue: boolean;
}

// API function to get repayment options
const getRepaymentOptions = async (loanNumber: string) => {
	const response = await axios.get(`loans/${loanNumber}/repayment-options`);
	console.log("=== REPAYMENT OPTIONS API RESPONSE ===");
	console.log("Loan Number:", loanNumber);
	console.log("Status:", response.status);
	console.log("Full Response:", JSON.stringify(response.data, null, 2));
	console.log(
		"All Options:",
		response.data?.repayment_options?.map((o: any) => o.type),
	);
	console.log("======================================");
	return response.data;
};

const formatIndianRupees = (amount: number): string => {
	return new Intl.NumberFormat("en-IN", {
		style: "currency",
		currency: "INR",
		minimumFractionDigits: 0,
		maximumFractionDigits: 2,
	}).format(amount);
};

const formatDate = (dateString: string): string => {
	try {
		const date = new Date(dateString);
		return date.toLocaleDateString("en-IN", {
			day: "2-digit",
			month: "short",
			year: "numeric",
		});
	} catch {
		return dateString;
	}
};

const formatDueDate = (dateString: string): string => {
	try {
		const dueDate = new Date(dateString);
		const today = new Date();

		// Set time to midnight for accurate date comparison
		today.setHours(0, 0, 0, 0);
		dueDate.setHours(0, 0, 0, 0);

		console.log("=== DUE DATE COMPARISON ===");
		console.log("Due Date String:", dateString);
		console.log("Due Date (parsed):", dueDate.toDateString());
		console.log("Today:", today.toDateString());
		console.log("Is Overdue:", dueDate <= today);
		console.log("===========================");

		// If due date is in the past or today, show "Immediate"
		if (dueDate <= today) {
			return "Immediate";
		}

		// Otherwise, show formatted date
		return formatDate(dateString);
	} catch {
		return dateString;
	}
};

const formatType = (type: string): string => {
	// Replace underscores with spaces and capitalize each word
	return type
		.split("_")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
		.join(" ");
};

// Function to translate description based on language
const translateDescription = (description: string, isHindi: boolean): string => {
	if (!isHindi || !description) {
		return description;
	}

	// Normalize the description for matching (remove extra spaces, normalize case, remove punctuation variations)
	const normalize = (str: string) =>
		str
			.toLowerCase()
			.trim()
			.replace(/\s+/g, " ")
			.replace(/[.,;:!?]/g, "");

	// Hindi translation for the specific description
	const hindiTranslation =
		"पूरी बकाया राशि (मूलधन + ब्याज + शुल्क) का भुगतान करें और लोन बंद करें।";

	// Normalize the input description
	const normalizedDescription = normalize(description);

	// Check if description contains key phrases
	const hasPayComplete =
		normalizedDescription.includes("pay complete outstanding amount") ||
		normalizedDescription.includes("pay complete outstanding");
	const hasCloseLoan =
		normalizedDescription.includes("close the loan") ||
		normalizedDescription.includes("close loan");
	const hasPrincipleInterest =
		normalizedDescription.includes("principle") &&
		(normalizedDescription.includes("interest") || normalizedDescription.includes("intrest"));

	// If it matches the pattern, return Hindi translation
	if (hasPayComplete && hasCloseLoan) {
		return hindiTranslation;
	}

	// Fallback: if description contains "outstanding" and "close", translate it
	if (normalizedDescription.includes("outstanding") && normalizedDescription.includes("close")) {
		return hindiTranslation;
	}

	// If no translation found, return original
	return description;
};

export default function RepaymentOptions() {
	const router = useRouter();
	const { t, isHindi } = useTranslation();
	const { loanNumber } = useLocalSearchParams<{ loanNumber: string }>();
	const [isPaymentLoading, setIsPaymentLoading] = useState(false);
	const [paymentInitiated, setPaymentInitiated] = useState(false);
	const [isHBPartner, setIsHBPartner] = useState(false);
	const [isLoadingHbCondition, setIsLoadingHbCondition] = useState(false);
	const [enableRepayment, setEnableRepayment] = useState(true);

	const { data: apiData, isLoading } = useNetworkAwareQuery<RepaymentOptionsResponse>({
		queryKey: ["repaymentOptions", loanNumber],
		queryFn: () => getRepaymentOptions(loanNumber || ""),
		enabled: !!loanNumber,
	});

	// Filter options to only show full_payment
	const filteredOptions =
		apiData?.repayment_options?.filter((option) => option.type === "full_payment") || [];

	// Map display names
	const displayOptions = filteredOptions.map((option) => ({
		...option,
		display_name: option.type === "full_payment" ? t("closeYourLoan") : option.display_name,
	}));

	console.log("=== FILTERED REPAYMENT OPTIONS ===");
	console.log("Original options count:", apiData?.repayment_options?.length || 0);
	console.log("Filtered options count:", displayOptions.length);
	console.log(
		"Display options:",
		displayOptions.map((o) => ({ type: o.type, display_name: o.display_name })),
	);
	console.log("===================================");

	useEffect(() => {
		const checkHBRepaymentCondition = async () => {
			try {
				const rawApplicantFrom = await getStorageItem(STORAGE_KEYS["@applicant-from"]);
				const applicantFrom = rawApplicantFrom ? decode(rawApplicantFrom) : null;

				console.log(
					`🔍 [HB Condition Debug] rawApplicantFrom: ${rawApplicantFrom}, decoded: ${applicantFrom}, apiData?.loan_id: ${apiData?.loan_id}`,
				);

				if (applicantFrom === "HB" && apiData?.loan_id) {
					setIsHBPartner(true);
					setIsLoadingHbCondition(true);

					console.log(
						`🚀 [HB Condition] Calling API: GET loans/${apiData.loan_id}/hb-repayment-condition`,
					);
					const response = await axios.get(
						`loans/${apiData.loan_id}/hb-repayment-condition`,
					);
					console.log(
						`✅ [HB Condition] API Response for loan_id ${apiData.loan_id}:`,
						JSON.stringify(response.data, null, 2),
					);

					if (response.data) {
						setEnableRepayment(response.data.enable_repayment);
					}
				}
			} catch (error: any) {
				console.error("❌ [HB Condition] API Error:", error);
				if (error?.response) {
					console.error(
						"📋 [HB Condition] API Error Details:",
						JSON.stringify(error.response.data, null, 2),
					);
				}
			} finally {
				setIsLoadingHbCondition(false);
			}
		};

		if (apiData?.loan_id) {
			checkHBRepaymentCondition();
		}
	}, [apiData?.loan_id]);

	const handlePayNow = async (option: RepaymentOption) => {
		console.log("Pay Now clicked for:", option.type);
		console.log("Payment amount:", option.amount);

		setIsPaymentLoading(true);

		try {
			console.log("=== INITIATE REPAYMENT API START ===");
			console.log("Loan Number:", loanNumber);
			console.log("Repayment Type:", "full_payment");
			console.log("Amount:", option.amount);

			const requestBody = {
				repayment_type: "full_payment",
				amount: option.amount,
			};

			console.log("Request Body:", JSON.stringify(requestBody, null, 2));

			const response = await axios.post(
				`loans/${loanNumber}/initiate-repayment`,
				requestBody,
			);

			console.log("=== INITIATE REPAYMENT API RESPONSE ===");
			console.log("Status:", response.status);
			console.log("Response Data:", JSON.stringify(response.data, null, 2));
			console.log("========================================");

			// Navigate to payment URL
			if (response.data?.payment_url) {
				console.log("🌐 Opening payment URL:", response.data.payment_url);
				const canOpen = await Linking.canOpenURL(response.data.payment_url);

				if (canOpen) {
					// Mark that payment was initiated - this allows the redirect handler to process the response
					setPaymentInitiated(true);

					// Proactively show global loader
					await setStorageItem(STORAGE_KEYS["@repayment-status"], "open");
					await setStorageItem(
						STORAGE_KEYS["@repayment-timestamp"],
						Date.now().toString(),
					);
					DeviceEventEmitter.emit("SHOW_GLOBAL_LOADER");

					if (Platform.OS === "ios") {
						const result = await WebBrowser.openAuthSessionAsync(response.data.payment_url, "rapid-money://");
						if (result.type === "success" && result.url) {
							await Linking.openURL(result.url);
						}
					} else {
						await Linking.openURL(response.data.payment_url);
					}
				} else {
					console.error("❌ Cannot open payment URL");
				}
			} else {
				console.error("❌ No payment URL in response");
			}
		} catch (error: any) {
			console.log("=== INITIATE REPAYMENT API ERROR ===");
			console.error("Error:", error);
			console.error("Error response:", error.response);
			console.error("Error response data:", error.response?.data);
			console.log("====================================");
		} finally {
			setIsPaymentLoading(false);
		}
	};

	if (isLoading) {
		return (
			<SafeAreaView style={styles.container}>
				<View style={styles.loadingContainer}>
					<ActivityIndicator size="large" color={primary} />
					<Text style={styles.loadingText}>{t("loadingRepaymentOptions")}</Text>
				</View>
			</SafeAreaView>
		);
	}

	if (!apiData || displayOptions.length === 0) {
		return (
			<SafeAreaView style={styles.container}>
				<View style={styles.errorContainer}>
					<Text style={styles.errorText}>
						{!apiData
							? t("unableToLoadRepaymentOptions")
							: t("noRepaymentOptionsAvailable")}
					</Text>
					<TouchableOpacity style={styles.retryButton} onPress={() => router.back()}>
						<Text style={styles.retryButtonText}>{t("goBack")}</Text>
					</TouchableOpacity>
				</View>
			</SafeAreaView>
		);
	}

	return (
		<>
			<SafeAreaView style={styles.container}>
				<ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
					{/* Loan Info */}
					<View style={styles.loanInfoCard}>
						<Text style={styles.loanInfoLabel}>{t("loanNumber")}</Text>
						<Text style={styles.loanInfoValue}>{apiData.loan_number}</Text>
						<View style={styles.divider} />
						<View style={styles.loanInfoRow}>
							<View>
								<Text style={styles.loanInfoLabel}>{t("currentOutstanding")}</Text>
								<Text style={styles.loanInfoAmount}>
									{formatIndianRupees(apiData.current_outstanding)}
								</Text>
							</View>
							<View>
								<Text style={styles.loanInfoLabel}>{t("nextDueDate")}</Text>
								<Text style={styles.loanInfoDate}>
									{apiData.due_date ? formatDueDate(apiData.due_date) : "-"}
								</Text>
							</View>
						</View>
					</View>

					{/* Repayment Options */}
					<Text style={styles.sectionTitle}>{t("selectRepaymentOption")}</Text>

					{displayOptions.map((option, index) => {
						const disableButton =
							isPaymentLoading ||
							(isHBPartner && (isLoadingHbCondition || !enableRepayment));

						return (
							<View
								key={index}
								style={[
									styles.optionCard,
									option.is_recommended && styles.recommendedCard,
								]}>
								{option.is_recommended && (
									<View style={styles.recommendedBadge}>
										<Text style={styles.recommendedText}>
											{t("recommended")}
										</Text>
									</View>
								)}

								{/* Header */}
								<View style={styles.optionHeader}>
									<Text style={styles.optionType}>{option.display_name}</Text>
									<Text style={styles.optionAmount}>
										{formatIndianRupees(
											option.amount || apiData.current_outstanding,
										)}
									</Text>
								</View>

								{/* Description */}
								<Text style={styles.optionDescription}>
									{translateDescription(option.description || "", isHindi)}
								</Text>

								{/* Due Date */}
								{option.due_date && (
									<View style={styles.optionDetailRow}>
										<Text style={styles.optionDetailLabel}>{t("dueDate")}</Text>
										<Text style={styles.optionDetailValue}>
											{formatDate(option.due_date)}
										</Text>
									</View>
								)}

								{/* Processing Fee */}
								{Boolean(option.processing_fee && option.processing_fee > 0) && (
									<View style={styles.optionDetailRow}>
										<Text style={styles.optionDetailLabel}>
											{t("processingFee")}
										</Text>
										<Text style={styles.optionDetailValue}>
											{formatIndianRupees(option.processing_fee || 0)}
										</Text>
									</View>
								)}

								{/* Discount */}
								{Boolean(option.discount && option.discount > 0) && (
									<View style={styles.optionDetailRow}>
										<Text style={styles.optionDetailLabel}>
											{t("discount")}
										</Text>
										<Text
											style={[styles.optionDetailValue, styles.discountText]}>
											-{formatIndianRupees(option.discount || 0)}
										</Text>
									</View>
								)}

								{/* Savings */}
								{Boolean(option.savings && option.savings > 0) && (
									<View style={styles.savingsBadge}>
										<Text style={styles.savingsText}>
											{t("youSave")} {formatIndianRupees(option.savings || 0)}!
										</Text>
									</View>
								)}

								{/* PAY NOW BUTTON */}
								<TouchableOpacity
									style={[
										styles.payButton,
										disableButton && styles.payButtonDisabled,
									]}
									onPress={() => !disableButton && handlePayNow(option)}
									disabled={disableButton}>
									{isPaymentLoading ? (
										<ActivityIndicator size="small" color={dark} />
									) : (
										<View style={{ flexDirection: "row", alignItems: "center" }}>
											<Text style={styles.payButtonText}>{t("payNow")}</Text>
											<IconSymbol name="arrow.right" size={20} color={dark} />
										</View>
									)}
								</TouchableOpacity>
							</View>
						);
					})}

					<View style={{ height: height(3) }} />
				</ScrollView>
			</SafeAreaView>
		</>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: white,
	},
	content: {
		flex: 1,
		paddingHorizontal: width(4),
	},
	loadingContainer: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
	},
	loadingText: {
		marginTop: height(2),
		fontSize: font(2),
		color: "#666",
	},
	errorContainer: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		paddingHorizontal: width(8),
	},
	errorText: {
		fontSize: font(2.2),
		color: "#EF4444",
		textAlign: "center",
		marginBottom: height(2),
	},
	retryButton: {
		backgroundColor: primary,
		paddingHorizontal: width(8),
		paddingVertical: height(1.5),
		borderRadius: width(2),
	},
	retryButtonText: {
		color: dark,
		fontSize: font(2),
		fontWeight: "600",
	},
	loanInfoCard: {
		backgroundColor: "#F9FAFB",
		borderRadius: width(3),
		padding: width(4),
		marginTop: height(2),
		marginBottom: height(2),
	},
	loanInfoLabel: {
		fontSize: font(1.6),
		color: "#6B7280",
		marginBottom: height(0.5),
	},
	loanInfoValue: {
		fontSize: font(2),
		color: dark,
		fontWeight: "600",
		marginBottom: height(1.5),
	},
	divider: {
		height: 1,
		backgroundColor: "#E5E7EB",
		marginVertical: height(1.5),
	},
	loanInfoRow: {
		flexDirection: "row",
		justifyContent: "space-between",
	},
	loanInfoAmount: {
		fontSize: font(2.2),
		color: dark,
		fontWeight: "700",
	},
	loanInfoDate: {
		fontSize: font(2),
		color: dark,
		fontWeight: "600",
	},
	sectionTitle: {
		fontSize: font(2.2),
		fontWeight: "700",
		color: dark,
		marginBottom: height(2),
	},
	optionCard: {
		backgroundColor: white,
		borderRadius: width(3),
		padding: width(4),
		marginBottom: height(2),
		borderWidth: 1,
		borderColor: "#E5E7EB",
		position: "relative",
	},
	recommendedCard: {
		borderColor: primary,
		borderWidth: 2,
	},
	recommendedBadge: {
		position: "absolute",
		top: -height(1),
		right: width(4),
		backgroundColor: primary,
		paddingHorizontal: width(3),
		paddingVertical: height(0.5),
		borderRadius: width(2),
	},
	recommendedText: {
		fontSize: font(1.4),
		fontWeight: "700",
		color: dark,
	},
	optionHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		marginBottom: height(1),
	},
	optionType: {
		fontSize: font(2.2),
		fontWeight: "700",
		color: dark,
		flex: 1,
	},
	optionAmount: {
		fontSize: font(2.6),
		fontWeight: "700",
		color: dark,
	},
	optionSecondRow: {
		flexDirection: "row",
		alignItems: "center",
		marginTop: -height(4),
		marginBottom: height(1),
		paddingLeft: 0,
	},
	optionTypeValue: {
		fontSize: font(2.6),
		fontWeight: "700",
		color: dark,
	},
	optionDescription: {
		fontSize: font(1.8),
		color: "#6B7280",
		marginBottom: height(1.5),
		lineHeight: font(2.6),
	},
	optionDetailRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		marginBottom: height(0.8),
	},
	optionDetailLabel: {
		fontSize: font(1.7),
		color: "#6B7280",
	},
	optionDetailValue: {
		fontSize: font(1.7),
		color: dark,
		fontWeight: "600",
	},
	discountText: {
		color: "#10B981",
	},
	savingsBadge: {
		backgroundColor: "#D1FAE5",
		paddingHorizontal: width(3),
		paddingVertical: height(0.8),
		borderRadius: width(2),
		marginTop: height(1),
		marginBottom: height(1),
	},
	savingsText: {
		fontSize: font(1.6),
		color: "#059669",
		fontWeight: "600",
		textAlign: "center",
	},
	payButton: {
		backgroundColor: primary,
		borderRadius: width(2),
		paddingVertical: height(1.5),
		alignItems: "center",
		marginTop: height(1.5),
	},
	payButtonDisabled: {
		opacity: 0.5,
	},
	payButtonText: {
		fontSize: font(2),
		fontWeight: "700",
		color: dark,
	},
});
