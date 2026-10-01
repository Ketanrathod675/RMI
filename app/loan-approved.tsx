import ExitIntentModal from "@/components/assessment-fee/ExitIntentModal";
import { Select, SelectOption } from "@/components/select";
import { TranslatedText } from "@/components/TranslatedText";
import { dark, white } from "@/constants/Colors";
import { IconSymbol } from "@/components/ui/IconSymbol";
import { Images } from "@/constants/images";
import { useJourneyTracker } from "@/hooks/useJourneyTracker";
import { useNetworkAwareMutation } from "@/hooks/useNetworkAwareMutation";
import { useNetworkAwareQuery } from "@/hooks/useNetworkAwareQuery";
import { useTranslation } from "@/hooks/useTranslation";
import { axios, errorHandler, URLS } from "@/utils/api";
import {
	submitLoanApplication,
	type SubmitLoanApplicationRequestType,
} from "@/utils/api/kyc";
import { font, height, width } from "@/utils/dimensions";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useNavigation, useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
	ActivityIndicator,
	Alert,
	Animated,
	BackHandler,
	Linking,
	Modal,
	SafeAreaView,
	ScrollView,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from "react-native";
import Toast from "react-native-toast-message";

const ASSESSMENT_BANNER = Images.CONGRATULATIONS_BANNER;
const RUPEE_COIN = Images.RUPEE_COIN;

export type TermsResponseType = {
	success: boolean;
	loan_terms: Partial<LoanTerms>;
	product_details: Partial<ProductDetails>;
	data_source: string;
	message: string;
};

export type LoanTerms = {
	amount_approved: number;
	processing_fee: number;
	gst_amount: number;
	gst_amount_percentage?: number;
	total_processing_fee: number;
	interest_rate: number;
	monthly_rate: number;
	tenure_days: number;
	due_date_options: DueDateOption[];
	fee_breakdown: FeeBreakdown[];
	net_disbursal_amount?: number;
	amount_to_repay?: number;
};

export type DueDateOption = {
	date: string;
	display_date: string;
	day: string;
	recommended: boolean;
	monthly_interest_rate: number;
	annual_interest_rate: number;
	interest_description: string;
	days_from_now: number;
	tenure_days: number;
};

export type FeeBreakdown = {
	fee_type: string;
	amount: number;
	gst: number;
	total: number;
	calculation: string;
	value: string;
};

export type ProductDetails = {
	product_id: string;
	product_name: string;
	product_category: string;
	repayment_type: string;
	lender_id: string;
	min_loan_amount?: number;
	amount_increment?: number;
	max_loan_amount?: number;
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

// Function to calculate days between today and selected due date
const calculateTenureInDays = (dueDateString: string): number => {
	if (!dueDateString) return 0;

	const today = new Date();
	const dueDate = new Date(dueDateString);

	// Reset time to start of day for accurate day calculation
	today.setHours(0, 0, 0, 0);
	dueDate.setHours(0, 0, 0, 0);

	// Calculate difference in milliseconds and convert to days
	const timeDifference = dueDate.getTime() - today.getTime();
	const dayDifference = Math.ceil(timeDifference / (1000 * 3600 * 24));

	return Math.max(0, dayDifference); // Ensure non-negative result
};

// Function to get interest rate for selected due date
const getInterestRateForDate = (
	selectedDate: string,
	dueDateOptions: DueDateOption[],
): { monthlyRate: number; description: string } => {
	if (!selectedDate || !dueDateOptions || dueDateOptions.length === 0) {
		return { monthlyRate: 0, description: "N/A" };
	}

	const selectedOption = dueDateOptions.find(
		(option) => option.date === selectedDate,
	);
	if (selectedOption) {
		return {
			monthlyRate: selectedOption.monthly_interest_rate,
			description: selectedOption.interest_description,
		};
	}

	// Fallback to first option if selected date not found
	return {
		monthlyRate: dueDateOptions[0]?.monthly_interest_rate || 0,
		description: dueDateOptions[0]?.interest_description || "N/A",
	};
};

export default function LoanApproved() {
	const { t } = useTranslation();

	// Track this screen in the journey
	useJourneyTracker("/loan-approved");

	const router = useRouter();
	const navigation = useNavigation();
	const [modalVisible] = useState(false);
	const [rejectionModalVisible, setRejectionModalVisible] = useState(false);
	const [rejectionMessage, setRejectionMessage] = useState<string>("");
	const [rejectionCountdown, setRejectionCountdown] = useState(15);
	const [selectedDueDate, setSelectedDueDate] = useState<string>("");
	const [error, setError] = useState<string | null>(null);
	const [isExitModalVisible, setIsExitModalVisible] = useState(false);
	const scaleAnim = useRef(new Animated.Value(0)).current;
	const rejectionScaleAnim = useRef(new Animated.Value(0)).current;

	// Handle back navigation prevention
	useEffect(() => {
		// If rejection modal is visible, prevent all navigation
		if (rejectionModalVisible) {
			const unsubscribe = navigation.addListener("beforeRemove", (e) => {
				e.preventDefault();
			});

			const backHandler = BackHandler.addEventListener(
				"hardwareBackPress",
				() => {
					return true; // prevent default app exit
				},
			);

			return () => {
				unsubscribe();
				backHandler.remove();
			};
		}

		// Normal navigation prevention when not in rejection modal
		const unsubscribe = navigation.addListener("beforeRemove", (e) => {
			if (["GO_BACK", "POP"].includes(e.data.action.type)) {
				e.preventDefault();
				setIsExitModalVisible(true);
			}
		});

		// Intercept Android hardware back button
		const backHandler = BackHandler.addEventListener(
			"hardwareBackPress",
			() => {
				setIsExitModalVisible(true);
				return true; // prevent default app exit
			},
		);

		return () => {
			unsubscribe();
			backHandler.remove();
		};
	}, [navigation, router, rejectionModalVisible]);

	// Fetch loan terms using React Query
	const {
		data,
		error: queryError,
		isPending: isLoading,
		refetch: refetchLoanTerms,
	} = useNetworkAwareQuery({
		queryKey: ["loan", "terms"],
		queryFn: async () => {
			console.log("🚀 Calling GET /api/v1/loans/loan-terms");
			const response = await axios.get<Partial<TermsResponseType>>(
				URLS.loans.loan_terms,
			);
			console.log(
				"📥 Loan Terms API Response:",
				JSON.stringify(response.data, null, 2),
			);
			console.log("✅ Loan terms loaded successfully");
			return response?.data;
		},
		staleTime: 30000,
	});

	// Handle query error for "Approved amount not found."
	useEffect(() => {
		if (queryError) {
			const error: any = queryError;
			const errorMessage =
				error?.response?.data?.message || error?.message || "";
			if (errorMessage === "Approved amount not found.") {
				console.log(
					"⚠️ Approved amount not found - navigating to no-approved-amount screen",
				);
				router.replace("/no-approved-amount");
				return;
			}
			// Set error for other types of errors
			setError(t("failedToLoadLoanTerms"));
		} else {
			setError(null);
		}
	}, [queryError, router, t]);

	// Extract loan terms and product details flexibly supporting multiple API envelope shapes
	const loanTermsData = useMemo(() => {
		return (
			(data as any)?.loan_terms ||
			(data as any)?.data?.loan_terms ||
			(data as any)?.data ||
			data ||
			{}
		);
	}, [data]);

	const productDetailsData = useMemo(() => {
		return (
			(data as any)?.product_details ||
			(data as any)?.data?.product_details ||
			{}
		);
	}, [data]);

	// Extract loan amount with full fallback support
	const loanAmount = useMemo(() => {
		const raw =
			loanTermsData?.amount_approved ??
			loanTermsData?.approved_amount ??
			loanTermsData?.loan_amount ??
			loanTermsData?.principal_amount ??
			(data as any)?.amount_approved ??
			(data as any)?.approved_amount ??
			(data as any)?.loan_amount ??
			(data as any)?.data?.amount_approved ??
			(data as any)?.data?.approved_amount ??
			(data as any)?.data?.loan_amount ??
			productDetailsData?.max_loan_amount ??
			productDetailsData?.min_loan_amount ??
			0;

		const num =
			typeof raw === "string"
				? parseFloat(raw.replace(/[^0-9.]/g, ""))
				: Number(raw);
		return isNaN(num) || num <= 0 ? 0 : num;
	}, [loanTermsData, productDetailsData, data]);

	const processingFee = useMemo(() => {
		const fee =
			loanTermsData?.processing_fee ??
			(data as any)?.processing_fee ??
			0;
		return Number(fee) || 0;
	}, [loanTermsData, data]);

	const gstAmount = useMemo(() => {
		const gst =
			loanTermsData?.gst_amount_percentage ??
			loanTermsData?.gst_amount ??
			18;
		return Number(gst) || 18;
	}, [loanTermsData]);

	const totalProcessingFee = useMemo(() => {
		const total =
			loanTermsData?.total_processing_fee ??
			(data as any)?.total_processing_fee ??
			0;
		return Number(total) || 0;
	}, [loanTermsData, data]);

	const monthlyInterest = useMemo(() => {
		const rate =
			loanTermsData?.monthly_rate ??
			(loanTermsData?.interest_rate
				? Number(loanTermsData.interest_rate) / 12
				: 0);
		return Number(rate) || 0;
	}, [loanTermsData]);

	// Log interest rate data when it's extracted from the response
	useEffect(() => {
		if (loanTermsData && Object.keys(loanTermsData).length > 0) {
			console.log("📊 Interest Rate Data Extracted in loan-approved.tsx:");
			console.log(
				`   - Interest Rate: ${loanTermsData.interest_rate || "N/A"}%`,
			);
			console.log(
				`   - Monthly Rate: ${loanTermsData.monthly_rate || "N/A"}%`,
			);
			console.log(
				`   - Monthly Interest (used in calculations): ${monthlyInterest}%`,
			);
			console.log(`   - Loan Amount: ${loanAmount || "N/A"}`);
			console.log(`   - Processing Fee: ${processingFee || "N/A"}`);
			console.log(`   - GST Amount: ${gstAmount || "N/A"}`);
			console.log(`   - Total Processing Fee: ${totalProcessingFee || "N/A"}`);
			console.log(
				"📋 Full loan_terms object:",
				JSON.stringify(loanTermsData, null, 2),
			);
		}
	}, [loanTermsData, loanAmount, processingFee, gstAmount, totalProcessingFee, monthlyInterest]);

	// Calculate tenure dynamically based on selected due date
	const calculatedTenureDays = calculateTenureInDays(selectedDueDate);
	const backendTenureDays = useMemo(() => {
		const options = loanTermsData?.due_date_options;
		if (Array.isArray(options) && selectedDueDate) {
			const opt = options.find(
				(o: any) => o?.date === selectedDueDate || o?.display_date === selectedDueDate,
			);
			return opt?.tenure_days || opt?.days_from_now || 0;
		}
		return loanTermsData?.tenure_days || 0;
	}, [loanTermsData, selectedDueDate]);

	const tenure = useMemo(() => {
		const days = backendTenureDays || calculatedTenureDays;
		if (!selectedDueDate || !days || days <= 0) {
			return t("selectDueDatePlaceholder");
		}
		return `${days} day${days !== 1 ? "s" : ""}`;
	}, [selectedDueDate, backendTenureDays, calculatedTenureDays, t]);

	// Debug logging for tenure calculation
	console.log("🔍 Tenure Calculation Debug:");
	console.log("- selectedDueDate:", selectedDueDate);
	console.log("- calculatedTenureDays:", calculatedTenureDays);
	console.log("- final tenure:", tenure);

	// Get dynamic interest rate based on selected due date
	const dynamicInterestRate = useMemo(() => {
		const options = loanTermsData?.due_date_options;
		if (Array.isArray(options) && selectedDueDate) {
			return getInterestRateForDate(selectedDueDate, options);
		}
		// Fallback to static rate if no dynamic data available
		return {
			monthlyRate: monthlyInterest,
			description: `${monthlyInterest}% ${t("perMonth")}`,
		};
	}, [selectedDueDate, loanTermsData, monthlyInterest, t]);

	const interestRate =
		dynamicInterestRate.description ||
		`${dynamicInterestRate.monthlyRate}% ${t("perMonth")}`;

	// Debug log the due_date_options from API
	console.log("🔍 Raw due_date_options from API:", loanTermsData?.due_date_options);
	console.log("🔍 Selected due date:", selectedDueDate);
	console.log("🔍 Dynamic interest rate:", dynamicInterestRate);
	console.log("🔍 Final interest rate display:", interestRate);

	const handleDueDateSelect = (value: string | number) => {
		console.log("🎯 Due date selected:", value, "Type:", typeof value);
		const stringValue = value ? String(value) : "";
		setSelectedDueDate(stringValue);
	};

	// Use due date options from API response with fallback
	const dueDateOptions: SelectOption[] = useMemo(() => {
		try {
			const optionsList =
				loanTermsData?.due_date_options ||
				(data as any)?.due_date_options ||
				(data as any)?.data?.due_date_options;

			if (Array.isArray(optionsList) && optionsList.length > 0) {
				const options = optionsList
					.filter(
						(option: any) =>
							option &&
							typeof option === "object" &&
							(option.display_date || option.date),
					)
					.map((option: any) => ({
						label: String(option.display_date || option.date),
						value: String(option.date || option.display_date),
					}));

				if (options.length > 0) {
					return options;
				}
			}
		} catch (error) {
			console.error("Error processing due_date_options:", error);
		}

		// Fallback to default options with valid ISO date format (YYYY-MM-DD)
		console.log("📋 Using fallback due date options");
		const now = new Date();
		const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
		const monthNames = [
			"Jan", "Feb", "Mar", "Apr", "May", "Jun",
			"Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
		];

		const monthName = monthNames[nextMonth.getMonth()];
		const year = nextMonth.getFullYear();
		const pad = (n: number) => String(n).padStart(2, "0");
		const m = pad(nextMonth.getMonth() + 1);

		return [
			{
				label: `1st of ${monthName} ${year}`,
				value: `${year}-${m}-01`,
			},
			{
				label: `10th of ${monthName} ${year}`,
				value: `${year}-${m}-10`,
			},
		];
	}, [loanTermsData, data]);

	// Auto-select first due date option when available
	useEffect(() => {
		if (dueDateOptions.length > 0 && !selectedDueDate) {
			setSelectedDueDate(String(dueDateOptions[0].value));
		}
	}, [dueDateOptions, selectedDueDate]);

	console.log("✅ Final dueDateOptions:", dueDateOptions);

	// Calculate Net Disbursal Amount
	// Formula: Net Disbursal = Loan Amount - (Processing Fee + GST on Processing Fee)
	const calculatedNetDisbursalAmount = useMemo(() => {
		if (!loanAmount || loanAmount <= 0) return 0;
		if (data?.loan_terms?.net_disbursal_amount) {
			return data.loan_terms.net_disbursal_amount;
		}

		const calculatedProcessingFee = processingFee;
		const calculatedGst =
			data?.loan_terms?.gst_amount ??
			calculatedProcessingFee * (gstAmount / 100);
		const totalFee =
			totalProcessingFee || (calculatedProcessingFee + calculatedGst);
		const netDisbursal = loanAmount - totalFee;

		console.log("💰 Net Disbursal Calculation:");
		console.log(`   - Loan Amount: ₹${loanAmount}`);
		console.log(`   - Processing Fee: ₹${calculatedProcessingFee}`);
		console.log(`   - GST: ₹${calculatedGst}`);
		console.log(`   - Total Fee: ₹${totalFee}`);
		console.log(`   - Net Disbursal: ₹${netDisbursal}`);

		return Math.round(netDisbursal);
	}, [
		loanAmount,
		data?.loan_terms?.net_disbursal_amount,
		data?.loan_terms?.gst_amount,
		processingFee,
		gstAmount,
		totalProcessingFee,
	]);

	// Dynamic processing fee values for display and API
	const dynamicProcessingFeeValues = useMemo(() => {
		if (!loanAmount || loanAmount <= 0)
			return { processingFee: 0, gstAmount: 0, totalProcessingFee: 0 };

		const fee = processingFee;
		const gst =
			data?.loan_terms?.gst_amount ??
			Math.round(fee * (gstAmount / 100));
		const total = totalProcessingFee || (fee + gst);

		return {
			processingFee: Math.round(fee),
			gstAmount: Math.round(gst),
			totalProcessingFee: Math.round(total),
		};
	}, [
		loanAmount,
		processingFee,
		gstAmount,
		totalProcessingFee,
		data?.loan_terms?.gst_amount,
	]);

	// Calculate Amount to Repay dynamically based on selected due date
	// Formula:
	// interest_amount = loan_amount * 12 * interest_rate(monthly) * tenure_days / (365 * 100)
	// amount_to_repay = loan_amount + interest_amount
	const calculatedAmountToRepay = useMemo(() => {
		if (!loanAmount || loanAmount <= 0) return 0;

		// Monthly interest rate for the selected due date
		const monthlyRate =
			dynamicInterestRate.monthlyRate || monthlyInterest || 0;
		// Prefer backend tenure days; fallback to calculated days
		const days = backendTenureDays || calculatedTenureDays || 0;
		// Apply simple interest formula
		const interestAmount =
			(loanAmount * 12 * monthlyRate * days) / (365 * 100);
		const totalRepayment = loanAmount + interestAmount;

		console.log("💸 Amount to Repay Calculation:");
		console.log(`   - Loan Amount: ₹${loanAmount}`);
		console.log(`   - Monthly Rate: ${monthlyRate}%`);
		console.log(`   - Tenure Days: ${days}`);
		console.log(`   - Interest Amount: ₹${interestAmount.toFixed(2)}`);
		console.log(`   - Total Repayment: ₹${totalRepayment.toFixed(2)}`);

		return Math.round(totalRepayment);
	}, [
		loanAmount,
		dynamicInterestRate.monthlyRate,
		monthlyInterest,
		backendTenureDays,
		calculatedTenureDays,
	]);

	const { mutate: submitLoanApplicationMutation, isPending: isSubmitting } =
		useNetworkAwareMutation({
			mutationFn: submitLoanApplication,
			onSuccess: (data) => {
				console.log("Submit Loan Application API Response:", data);
				console.log(
					"Loan Application Success:",
					JSON.stringify(data, null, 2),
				);

				Toast.show({
					type: "success",
					text1: t("loanApplicationSubmittedSuccessfully"),
					text2: data?.message || t("yourLoanHasBeenApproved"),
				});

				// Navigate to combined documents (sanction letter, KFS, loan agreement)
				router.replace("/verify-bank-details");
			},
			onError: (err: any, variables, ctx) => {
				console.log("❌ Submit Loan Application API Error:", err);
				console.log(
					"📤 Request payload that failed:",
					JSON.stringify(variables, null, 2),
				);

				// Log detailed error information
				if (err?.response) {
					console.log("🔍 Error Response Status:", err.response.status);
					console.log(
						"🔍 Error Response Data:",
						JSON.stringify(err.response.data, null, 2),
					);
					console.log("🔍 Error Response Headers:", err.response.headers);
				} else if (err?.request) {
					console.log("🔍 No response received:", err.request);
				} else {
					console.log("🔍 Error setting up request:", err.message);
				}

				const { error, errorType } = errorHandler(err, variables, ctx);

				console.log("🔥 Processed Error:", error);
				console.log("🔥 Error Type:", errorType);

				// Handle specific lender credit policy rejection (400)
				if (
					err?.response?.status === 400 &&
					(err?.response?.data?.message as string)
						?.toLowerCase()
						.includes("lender's credit policy")
				) {
					setRejectionMessage(t("standardRejectionMessage"));
					setRejectionModalVisible(true);
					return;
				}

				// Show detailed error message for non-400 errors
				let errorMessage = "Please try again";
				if (err?.response?.data?.message) {
					errorMessage = err.response.data.message;
				} else if (err?.response?.data?.detail) {
					errorMessage =
						typeof err.response.data.detail === "string"
							? err.response.data.detail
							: JSON.stringify(err.response.data.detail);
				} else if (error?.message) {
					errorMessage = error.message;
				}

				Toast.show({
					type: "error",
					text1: `API Error (${err?.response?.status || "Unknown"})`,
					text2: errorMessage,
				});
			},
		});

	const handleAccept = () => {
		// Validate that due date is selected
		if (!selectedDueDate) {
			Toast.show({
				type: "error",
				text1: t("pleaseSelectDueDate"),
				text2: t("dueDateSelectionRequired"),
			});
			return;
		}

		// Validate all required fields have valid values
		if (loanAmount <= 0) {
			console.error("❌ loanAmount is invalid (<= 0):", {
				loanAmount,
				data,
				loanTermsData,
			});
			Toast.show({
				type: "error",
				text1: t("invalidLoanAmount"),
				text2: t("pleaseRefreshAndTryAgain"),
			});
			return;
		}

		// Debug: Log all current values
		console.log("🔍 Debug - Current form state:");
		console.log("- selectedDueDate (date value):", selectedDueDate);
		console.log("- loanAmount:", loanAmount);

		const selectedOption = dueDateOptions.find(
			(option) => option.value === selectedDueDate,
		);
		if (selectedOption) {
			console.log(
				"- selectedOption.label (display_date):",
				selectedOption.label,
			);
			console.log("- selectedOption.value (date):", selectedOption.value);
		}

		console.log("- processingFee:", processingFee);
		console.log("- gstAmount:", gstAmount);
		console.log("- totalProcessingFee:", totalProcessingFee);
		console.log("- Full loan terms data:", JSON.stringify(loanTermsData, null, 2));

		// Get the dynamic interest rate for the selected date
		const selectedDateInterestRate = loanTermsData?.due_date_options
			? getInterestRateForDate(
					selectedDueDate,
					loanTermsData.due_date_options,
				)
			: {
					monthlyRate: monthlyInterest,
					description: `${monthlyInterest}% ${t("perMonth")}`,
				};

		console.log(
			"🔍 Selected date interest rate for API:",
			selectedDateInterestRate,
		);

		// Prepare API payload with proper validation
		const apiData: SubmitLoanApplicationRequestType = {
			selected_due_date: selectedDueDate,
			agreed_to_terms: true,
			loan_terms: {
				amount_approved: loanAmount,
				processing_fee: dynamicProcessingFeeValues.processingFee,
				gst_amount: dynamicProcessingFeeValues.gstAmount,
				total_processing_fee: dynamicProcessingFeeValues.totalProcessingFee,
				interest_rate: Number(selectedDateInterestRate.monthlyRate) || 12,
				monthly_rate: Number(selectedDateInterestRate.monthlyRate) || 12,
			},
		};

		console.log("📋 Final API payload:", JSON.stringify(apiData, null, 2));

		// Submit to API
		submitLoanApplicationMutation(apiData);
	};

	useEffect(() => {
		if (modalVisible) {
			const timeout = setTimeout(() => {
				Animated.timing(scaleAnim, {
					toValue: 1,
					duration: 50,
					useNativeDriver: true,
				}).start();
			}, 1500);
			return () => clearTimeout(timeout);
		}
	}, [modalVisible, scaleAnim]);

	// Handle rejection modal animation and auto-redirect
	useEffect(() => {
		if (rejectionModalVisible) {
			// Reset countdown to 15 when modal opens
			setRejectionCountdown(15);

			// Start animation
			const animationTimeout = setTimeout(() => {
				Animated.timing(rejectionScaleAnim, {
					toValue: 1,
					duration: 300,
					useNativeDriver: true,
				}).start();
			}, 100);

			// Countdown timer - update every second
			const countdownInterval = setInterval(() => {
				setRejectionCountdown((prev) => {
					if (prev <= 1) {
						clearInterval(countdownInterval);
						// Defer navigation to avoid React warning
						setTimeout(() => {
							setRejectionModalVisible(false);
							router.replace("/(tabs)");
						}, 0);
						return 0;
					}
					return prev - 1;
				});
			}, 1000);

			return () => {
				clearTimeout(animationTimeout);
				clearInterval(countdownInterval);
			};
		}
	}, [rejectionModalVisible, rejectionScaleAnim, router]);

	// Show loading state while fetching loan terms
	if (isLoading) {
		return (
			<SafeAreaView style={{ flex: 1, backgroundColor: white }}>
				<View
					style={[
						styles.container,
						{ justifyContent: "center", alignItems: "center" },
					]}>
					<TranslatedText
						style={{ fontSize: 18, fontWeight: "600", color: "#333" }}
						translationKey="loadingLoanTerms"
					/>
				</View>
			</SafeAreaView>
		);
	}

	// Show error state if API fails
	if (error) {
		return (
			<SafeAreaView style={{ flex: 1, backgroundColor: white }}>
				<View
					style={[
						styles.container,
						{
							justifyContent: "center",
							alignItems: "center",
							padding: 20,
						},
					]}>
					<Text
						style={{
							fontSize: 18,
							fontWeight: "600",
							color: "#FF6B6B",
							textAlign: "center",
							marginBottom: 20,
						}}>
						{error}
					</Text>
					<TouchableOpacity
						style={{
							backgroundColor: "#4F6EF7",
							paddingHorizontal: 20,
							paddingVertical: 12,
							borderRadius: 8,
						}}
						onPress={() => {
							setError(null);
							// Retry the API call using React Query refetch
							refetchLoanTerms();
						}}>
						<TranslatedText
							style={{ color: "white", fontWeight: "600" }}
							translationKey="retry"
						/>
					</TouchableOpacity>
				</View>
			</SafeAreaView>
		);
	}

	return (
		<>
			<SafeAreaView style={{ flex: 1, backgroundColor: white }}>
				<ScrollView
					style={styles.scrollContainer}
					contentContainerStyle={styles.scrollContentContainer}
					showsVerticalScrollIndicator={false}>
					<View style={styles.bannerContainer}>
						<Image
							source={ASSESSMENT_BANNER}
							style={styles.banner}
							contentFit="cover"
						/>
						<Image
							source={RUPEE_COIN}
							style={[styles.coin, styles.rupeeCoin1]}
							contentFit="contain"
						/>
						<Image
							source={RUPEE_COIN}
							style={[styles.coin, styles.rupeeCoin2]}
							contentFit="contain"
						/>
						<Image
							source={RUPEE_COIN}
							style={[styles.coin, styles.rupeeCoin3]}
							contentFit="contain"
						/>
						<Image
							source={RUPEE_COIN}
							style={[styles.coin, styles.rupeeCoin4]}
							contentFit="contain"
						/>
						<Image
							source={RUPEE_COIN}
							style={[styles.coin, styles.rupeeCoin5]}
							contentFit="contain"
						/>
						<Image
							source={RUPEE_COIN}
							style={[styles.coin, styles.rupeeCoin6]}
							contentFit="contain"
						/>

						{/* Back button */}
						<TouchableOpacity
							style={styles.backButton}
							onPress={() => setIsExitModalVisible(true)}>
							<Ionicons name="arrow-back" size={24} color="white" />
						</TouchableOpacity>

						{/* Congratulations text */}
						<View style={styles.textContainer}>
							<TranslatedText
								style={styles.congratsText}
								translationKey="congratulations"
							/>
							<TranslatedText
								style={styles.subText}
								translationKey="yourLoanIsApprovedFor"
							/>
							<Text style={styles.amountText}>
								{formatAmount(loanAmount)}/-
							</Text>
						</View>
					</View>

					{/* Loan Details Table */}
					<View style={styles.detailsContainer}>
						<View style={styles.detailRow}>
							<TranslatedText
								style={styles.detailLabel}
								translationKey="amountApproved"
							/>
							<Text style={styles.detailValue}>
								₹ {loanAmount.toLocaleString()}
							</Text>
						</View>

						<View style={styles.separator} />

						<View style={styles.detailRow}>
							<TranslatedText
								style={styles.detailLabel}
								translationKey="processingFee"
							/>
							<Text style={styles.detailValue}>
								₹ {dynamicProcessingFeeValues.processingFee.toLocaleString()} +{" "}
								{gstAmount}% ( GST )
							</Text>
						</View>

						<View style={styles.separator} />

						{/* Due Date Selection */}
						<View style={styles.detailRow}>
							<TranslatedText
								style={styles.detailLabel}
								translationKey="selectDueDate"
							/>
							<View style={styles.selectContainer}>
								<Select
									options={dueDateOptions}
									selectedValue={selectedDueDate || ""}
									onSelect={handleDueDateSelect}
									placeholder={t("select")}
									title={t("selectDueDate")}
									containerStyle={styles.selectWrapper}
									buttonStyle={styles.selectButton}
									buttonTextStyle={styles.selectButtonText}
								/>
							</View>
						</View>

						<View style={styles.separator} />

						<View style={styles.detailRow}>
							<TranslatedText
								style={styles.detailLabel}
								translationKey="tenure"
							/>
							<Text style={styles.detailValue}>{tenure}</Text>
						</View>

						<View style={styles.separator} />

						<View style={styles.detailRow}>
							<TranslatedText
								style={styles.detailLabel}
								translationKey="interestRate"
							/>
							<Text style={styles.detailValue}>{interestRate}</Text>
						</View>

						<View style={styles.separator} />

						<View style={styles.detailRow}>
							<TranslatedText
								style={styles.detailLabel}
								translationKey="netDisbursalAmount"
							/>
							<Text style={styles.detailValue}>
								{calculatedNetDisbursalAmount > 0
									? formatAmount(calculatedNetDisbursalAmount)
									: "-"}
							</Text>
						</View>

						<View style={styles.separator} />

						<View style={styles.detailRow}>
							<TranslatedText
								style={styles.detailLabel}
								translationKey="amountToRepay"
							/>
							<Text style={styles.detailValue}>
								{calculatedAmountToRepay > 0
									? formatAmount(calculatedAmountToRepay)
									: "-"}
							</Text>
						</View>

						<TouchableOpacity
							style={[
								styles.proceedButton,
								isSubmitting && styles.proceedButtonDisabled,
							]}
							onPress={handleAccept}
							disabled={isSubmitting}>
							{isSubmitting ? (
								<ActivityIndicator size="small" color="#333" />
							) : (
								<View
									style={{
										flexDirection: "row",
										alignItems: "center",
										gap: 8,
									}}>
									<Text style={styles.proceedButtonText}>
										{t("accept")}
									</Text>
									<IconSymbol
										name="arrow.right"
										size={20}
										color={dark}
									/>
								</View>
							)}
						</TouchableOpacity>
					</View>
				</ScrollView>
			</SafeAreaView>

			{/* Rejection Modal */}
			<Modal
				visible={rejectionModalVisible}
				transparent={true}
				animationType="fade">
				<View style={styles.modalOverlay}>
					<View style={styles.rejectionModalContent}>
						<TranslatedText
							style={styles.rejectionTitle}
							translationKey="sorryCouldntApproveLoan"
						/>
						<TranslatedText
							style={styles.rejectionSubtitle}
							translationKey="applicationDidntMeetCriteria"
						/>

						<View style={styles.tipsCard}>
							<View style={styles.tipsHeader}>
								<TranslatedText
									style={styles.tipsHeaderText}
									translationKey="heresHowToBoostChances"
								/>
							</View>

							<View style={styles.tipsList}>
								{/* Tip 1 - Credit Score */}
								<View style={styles.tipItem}>
									<Image
										source={require("@/assets/images/creditscore.png")}
										style={styles.tipIcon}
									/>
									<View style={styles.tipTextContainer}>
										<TranslatedText
											style={styles.tipTitle}
											translationKey="improveCreditScore"
										/>
										<TranslatedText
											style={styles.tipDescription}
											translationKey="buildStrongerCreditScore"
										/>
									</View>
								</View>

								{/* Tip 2 - Reduce Debts */}
								<View style={styles.tipItem}>
									<Image
										source={require("@/assets/images/reducedebts.png")}
										style={styles.tipIcon}
									/>
									<View style={styles.tipTextContainer}>
										<TranslatedText
											style={styles.tipTitle}
											translationKey="reduceExistingDebts"
										/>
										<TranslatedText
											style={styles.tipDescription}
											translationKey="lowerCurrentLiabilities"
										/>
									</View>
								</View>

								{/* Tip 3 - KYC Details */}
								<View style={styles.tipItem}>
									<Image
										source={require("@/assets/images/kycdetails.png")}
										style={styles.tipIcon}
									/>
									<View style={styles.tipTextContainer}>
										<TranslatedText
											style={styles.tipTitle}
											translationKey="updateKycDetails"
										/>
										<TranslatedText
											style={styles.tipDescription}
											translationKey="keepKycUpdated"
										/>
									</View>
								</View>
							</View>
						</View>

						<TranslatedText
							style={styles.tryAgainText}
							translationKey="tryAgainIn30Days"
						/>

						<View style={styles.supportTextContainer}>
							<TranslatedText
								style={styles.supportText}
								translationKey="forAssistanceContact"
							/>
							<TouchableOpacity
								onPress={() =>
									Linking.openURL("mailto:support@rapidmoney.in")
								}>
								<Text
									style={[
										styles.supportText,
										{
											fontWeight: "bold",
											color: "#007AFF",
											textDecorationLine: "underline",
											marginTop: -height(2),
										},
									]}>
									support@rapidmoney.in
								</Text>
							</TouchableOpacity>
						</View>

						<View style={styles.redirectTextContainer}>
							<TranslatedText
								style={styles.redirectText}
								translationKey="redirectingToDashboardNew"
							/>
							<Text style={styles.redirectText}>
								{" "}
								{rejectionCountdown}{" "}
							</Text>
							<TranslatedText
								style={styles.redirectText}
								translationKey="seconds"
							/>
							<Text style={styles.redirectText}>...</Text>
						</View>
					</View>
				</View>
			</Modal>

			<ExitIntentModal
				visible={isExitModalVisible}
				onClose={() => setIsExitModalVisible(false)}
				onConfirmExit={() => {
					setIsExitModalVisible(false);
					router.replace("/(tabs)");
				}}
			/>
		</>
	);
}

const styles = StyleSheet.create({
	scrollContainer: {
		flex: 1,
		backgroundColor: white,
	},
	scrollContentContainer: {
		flexGrow: 1,
		paddingBottom: height(8),
	},
	container: {
		flex: 1,
		backgroundColor: white,
		alignItems: "center",
	},
	bannerContainer: {
		width: "100%",
		alignItems: "center",
		position: "relative",
		zIndex: 10,
	},
	banner: {
		width: width(100),
		height: height(43),
		overflow: "hidden",
		borderBottomLeftRadius: width(10),
		borderBottomRightRadius: width(10),
		backgroundColor: white,
	},
	coin: {
		position: "absolute",
		zIndex: 2,
	},
	rupeeCoin1: {
		top: -height(5),
		left: width(50),
		width: width(15),
		height: height(15),
	},
	rupeeCoin2: {
		top: height(10),
		left: width(3),
		width: width(15),
		height: height(15),
		transform: [{ rotate: "-40deg" }],
	},
	rupeeCoin3: {
		bottom: height(3),
		left: width(3),
		width: width(10),
		height: height(10),
	},
	rupeeCoin4: {
		top: height(20),
		left: width(50),
		width: width(10),
		height: height(10),
		transform: [{ rotate: "40deg" }],
	},
	rupeeCoin5: {
		bottom: height(2),
		right: width(10),
		width: width(10),
		height: height(10),
		transform: [{ rotate: "20deg" }],
	},
	rupeeCoin6: {
		right: width(1),
		top: height(5),
		width: width(30),
		height: height(30),
	},
	backButton: {
		position: "absolute",
		top: height(6),
		left: width(6),
		zIndex: 20,
		padding: 10,
	},
	textContainer: {
		position: "absolute",
		top: height(6),
		alignItems: "center",
		zIndex: 20,
		width: "70%",
	},
	congratsText: {
		fontSize: 28,
		fontWeight: "bold",
		color: "white",
		textAlign: "center",
		marginBottom: height(1.3),
	},
	subText: {
		fontSize: 16,
		color: "white",
		textAlign: "center",
		marginBottom: height(1),
	},
	amountText: {
		fontSize: 24,
		fontWeight: "900",
		color: "white",
		textAlign: "center",
	},
	logo: {
		position: "absolute",
		top: height(6),
		alignSelf: "center",
		width: width(55),
		height: height(7),
		zIndex: 2,
	},
	content: {
		flex: 1,
		width: "100%",
		backgroundColor: white,
	},
	contentContainer: {
		flexGrow: 1,
		paddingBottom: height(3),
	},
	detailsContainer: {
		width: "100%",
		marginBottom: height(2),
	},
	detailRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		minHeight: height(7),
		paddingVertical: height(0.6),
		paddingHorizontal: width(6),
	},
	detailLabel: {
		fontSize: 16,
		color: "#333",
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
		width: "100%",
	},
	selectContainer: {
		width: width(35),
	},
	selectWrapper: {
		marginVertical: 0,
	},
	selectButton: {
		paddingHorizontal: 12,
		paddingVertical: 8,
		borderWidth: 1,
		borderColor: "#E5E5E5",
		borderRadius: 6,
		backgroundColor: "#FFFFFF",
		minHeight: 40,
	},
	selectButtonText: {
		fontSize: 14,
		color: "#666",
	},
	mainHeading: {
		fontSize: 20,
		fontWeight: "600",
		color: "#333",
		textAlign: "center",
		marginBottom: height(4),
		paddingHorizontal: width(4),
		lineHeight: 28,
	},
	feeContainer: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		width: "100%",
		borderWidth: 2,
		borderColor: "#18CA53",
		borderStyle: "dashed",
		borderRadius: 8,
		padding: width(4),
		marginBottom: height(6),
		backgroundColor: "#F0FFF5",
	},
	feeLabel: {
		fontSize: 14,
		fontWeight: "500",
		color: "#333",
	},
	priceContainer: {
		flexDirection: "row",
		alignItems: "center",
		gap: width(2),
	},
	originalPrice: {
		fontSize: 16,
		color: "#999",
		textDecorationLine: "line-through",
	},
	discountedPrice: {
		fontSize: 16,
		fontWeight: "600",
		color: "#4CAF50",
	},
	proceedButton: {
		backgroundColor: "#A4E65E",
		borderRadius: 25,
		paddingVertical: height(2),
		paddingHorizontal: width(8),
		width: "90%",
		alignItems: "center",
		marginHorizontal: width(6),
		marginTop: height(3),
		marginBottom: height(2),
	},
	proceedButtonDisabled: {
		opacity: 0.6,
	},
	proceedButtonText: {
		fontSize: 18,
		fontWeight: "600",
		color: "#333",
	},
	remindLaterButton: {
		backgroundColor: "white",
		borderRadius: 25,
		paddingVertical: height(2),
		paddingHorizontal: width(8),
		width: "90%",
		marginHorizontal: width(6),
		alignItems: "center",
		marginBottom: height(2),
		borderWidth: 1,
		borderColor: "#333",
	},
	remindLaterButtonText: {
		fontSize: 18,
		fontWeight: "600",
		color: "#333",
	},
	modalOverlay: {
		position: "absolute",
		top: -height(10),
		left: 0,
		right: 0,
		bottom: 0,
		width: "100%",
		height: height(110),
		backgroundColor: "rgba(0,0,0,0.08)",
		justifyContent: "center",
		alignItems: "center",
	},
	rejectionModalContent: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		width: "100%",
		height: "100%",
		backgroundColor: "white",
		paddingHorizontal: width(6),
		paddingVertical: height(4),
		alignItems: "center",
		justifyContent: "center",
	},
	rejectionTitle: {
		fontSize: font(2.4),
		fontWeight: "700",
		color: "#333",
		textAlign: "center",
		marginBottom: height(1),
	},
	rejectionSubtitle: {
		fontSize: font(1.6),
		color: "#666",
		textAlign: "center",
		marginBottom: height(3),
		lineHeight: font(2.2),
	},
	tipsCard: {
		backgroundColor: "#ECEBFF", // Light purple bg
		borderRadius: width(4),
		width: "100%",
		overflow: "hidden",
		marginBottom: height(3),
	},
	tipsHeader: {
		backgroundColor: "#B7FB52",
		paddingVertical: height(1.2),
		paddingHorizontal: width(4),
		alignItems: "center",
		justifyContent: "center",
		borderRadius: width(5),
		marginHorizontal: width(4),
		marginTop: height(2),
		marginBottom: height(1),
	},
	tipsHeaderText: {
		fontWeight: "600",
		color: "#333",
		fontSize: font(1.5),
	},
	tipsList: {
		padding: width(4),
		gap: height(2.5),
	},
	tipItem: {
		flexDirection: "row",
		alignItems: "flex-start",
		gap: width(3),
	},
	tipIcon: {
		width: width(6),
		height: width(6),
	},
	tipTextContainer: {
		flex: 1,
	},
	tipTitle: {
		fontSize: font(1.6),
		fontWeight: "600",
		color: "#333",
		marginBottom: height(0.5),
	},
	tipDescription: {
		fontSize: font(1.4),
		color: "#666",
		lineHeight: font(1.8),
	},
	tryAgainText: {
		fontSize: font(1.8),
		fontWeight: "700",
		color: "#333",
		textAlign: "center",
		marginBottom: height(2),
	},
	supportText: {
		fontSize: font(1.4),
		color: "#666",
		textAlign: "center",
		marginBottom: height(3),
		lineHeight: font(2),
	},
	redirectText: {
		fontSize: font(1.4),
		color: "#999",
		textAlign: "center",
		fontStyle: "italic",
	},
	supportTextContainer: {
		flexDirection: "column",
		alignItems: "center",
	},
	redirectTextContainer: {
		flexDirection: "row",
		justifyContent: "center",
		alignItems: "center",
		flexWrap: "wrap",
	},
});
