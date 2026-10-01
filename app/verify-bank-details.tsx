import ExitIntentModal from "@/components/assessment-fee/ExitIntentModal";
import { Select, SelectOption } from "@/components";
import Input from "@/components/Input";
import { dark, primary, white } from "@/constants/Colors";
import { IconSymbol } from "@/components/ui/IconSymbol";
import { Images } from "@/constants/images";
import { useAuth } from "@/hooks/useAuth";
import { useJourneyTracker } from "@/hooks/useJourneyTracker";
import { useNetworkAwareMutation } from "@/hooks/useNetworkAwareMutation";
import { useNetworkAwareQuery } from "@/hooks/useNetworkAwareQuery";
import { useTranslation } from "@/hooks/useTranslation";
import { errorHandler } from "@/utils/api";
import {
    getBankAccounts,
    getBankDetailsHbPartner,
    lookupIFSC,
    submitBankDetails,
    type BankDetailsSubmitRequestType,
    type IFSCLookupResponseType,
} from "@/utils/api/bank";
import { font, height, width } from "@/utils/dimensions";
import { useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    BackHandler,
    Image,
    KeyboardAvoidingView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import Toast from "react-native-toast-message";
import { useSafeAreaInsets } from "react-native-safe-area-context";


export default function VerifyBankDetails() {
	const { t } = useTranslation();
	const navigation = useNavigation();
	const insets = useSafeAreaInsets();
	const [isExitModalVisible, setIsExitModalVisible] = useState(false);

	const queryClient = useQueryClient();
	const params = useLocalSearchParams();

	// Track this screen in the journey
	useJourneyTracker("/verify-bank-details");

	const accountTypeOptions: SelectOption[] = [
		{ label: t("savingsAccount"), value: "savings" },
		{ label: t("currentAccount"), value: "current" },
		// { label: t("salaryAccount"), value: "salary" },
	];

	const [formData, setFormData] = useState({
		bankAccountNumber: "",
		confirmBankAccountNumber: "",
		ifscCode: "",
		bankName: "",
		branchName: "",
		accountType: "",
	});

	const [isIFSCValid, setIsIFSCValid] = useState(false);

	const { applicantFrom } = useAuth();

	// HB Partner API
	const {
		data: hbBankData,
		isLoading: isLoadingHbBank,
		error: hbBankError,
	} = useNetworkAwareQuery({
		queryKey: ["bank-details-hb-partner"],
		queryFn: getBankDetailsHbPartner,
		enabled: applicantFrom === "HB",
		retry: (failureCount, error: any) => {
			if (error?.response?.status === 404) return false;
			return failureCount < 2;
		},
	});

	useEffect(() => {
		if (hbBankData) {
			console.log("📥 HB Bank Data Received:", JSON.stringify(hbBankData, null, 2));

			const ifsc = (hbBankData.ifsc_code || "").trim();
			const bName = (hbBankData.bank_name || "").trim();
			const brName = (hbBankData.branch_name || "").trim();

			setFormData((prev) => ({
				...prev,
				bankAccountNumber: hbBankData.account_number || prev.bankAccountNumber,
				confirmBankAccountNumber: hbBankData.account_number || prev.confirmBankAccountNumber,
				ifscCode: ifsc,
				bankName: bName,
				branchName: brName,
				accountType: (hbBankData.account_type || "").toLowerCase(),
			}));

			// Mark IFSC as valid if we have details
			if (bName && ifsc) {
				setIsIFSCValid(true);
			} else if (ifsc.length === 11 && (!bName || !brName)) {
				// Trigger lookup if IFSC is provided but bank/branch is missing
				console.log("🔍 HB Data missing bank/branch, triggering lookup for IFSC:", ifsc);
				lookupIFSCMutation(ifsc);
			}
		}
	}, [hbBankData]);

	const isAllBankDataLocked =
		applicantFrom === "HB" &&
		!!hbBankData?.account_number &&
		!!hbBankData?.ifsc_code &&
		!!hbBankData?.account_type;

	useEffect(() => {
		if (hbBankError) {
			console.log("❌ HB Bank Data Error:", hbBankError);
			const status = (hbBankError as any)?.response?.status;
			const message =
				(hbBankError as any)?.response?.data?.message || t("failedToFetchDetails");

			if (status === 404) {
				Toast.show({
					type: "error",
					text1: t("detailsNotFound"),
					text2: message,
				});
			}
		}
	}, [hbBankError, t]);

	useEffect(() => {
		console.log("🔄 Fetching existing bank accounts...");
		getBankAccounts()
			.then((accounts) => {
				console.log("fetched accounts", accounts);
				if (Array.isArray(accounts) && accounts.length > 0) {
					// Use the first account (or primary if available)
					const account = accounts.find((a) => a.is_primary) || accounts[0];

					setFormData({
						bankAccountNumber: String(account.account_number || "").trim(),
						confirmBankAccountNumber: String(account.account_number || "").trim(),
						ifscCode: (account.ifsc_code || "").trim(),
						bankName: (account.bank_name || "").trim(),
						branchName: (account.branch_name || "").trim(),
						accountType: (account.account_type || "").toLowerCase(),
					});

					// Mark IFSC as valid since we have details
					if (account.bank_name && account.ifsc_code) {
						setIsIFSCValid(true);
					}
				} else {
					console.log("No existing bank accounts found. User can enter manually.");
				}
			})
			.catch((err) => {
				console.error("Error fetching bank accounts:", err);
			});
	}, []);

	useEffect(() => {
		// Prevent swipe or navigation.goBack inside router
		const unsubscribe = navigation.addListener("beforeRemove", (e) => {
			if (["GO_BACK", "POP"].includes(e.data.action.type)) {
				e.preventDefault();
				setIsExitModalVisible(true);
			}
		});

		// Intercept Android hardware back button
		const backHandler = BackHandler.addEventListener("hardwareBackPress", () => {
			setIsExitModalVisible(true);
			return true; // prevent default app exit
		});

		return () => {
			unsubscribe();
			backHandler.remove();
		};
	}, [navigation]);

	// IFSC Lookup Mutation
	const { mutate: lookupIFSCMutation, isPending: isLookingUpIFSC } = useNetworkAwareMutation({
		mutationFn: lookupIFSC,
		onSuccess: (data: Partial<IFSCLookupResponseType>) => {
			console.log("IFSC Lookup API Response:", data);

			if (data?.success && data?.bank_details) {
				setFormData((prev) => ({
					...prev,
					bankName: data.bank_details?.bank_name || "",
					branchName: data.bank_details?.branch_name || "",
				}));
				setIsIFSCValid(true);

				Toast.show({
					type: "success",
					text1: t("ifscCodeValid"),
					text2: `${data.bank_details.bank_name} - ${data.bank_details.branch_name}`,
				});
			} else {
				setIsIFSCValid(false);
				setFormData((prev) => ({
					...prev,
					bankName: "",
					branchName: "",
				}));

				Toast.show({
					type: "error",
					text1: t("invalidIFSCCode"),
					text2: t("pleaseCheckAndEnterValidIFSC"),
				});
			}
		},
		onError: (err, variables, ctx) => {
			console.log("IFSC Lookup API Error:", err);
			const { error, errorType } = errorHandler(err, variables, ctx);

			setIsIFSCValid(false);
			setFormData((prev) => ({
				...prev,
				bankName: "",
				branchName: "",
			}));

			Toast.show({
				type: "error",
				text1: t("ifscLookupFailed"),
				text2: t("pleaseEnterValidIFSCCode"),
			});
		},
	});

	// Bank Details Submission Mutation
	const { mutate: submitBankDetailsMutation, isPending: isSubmitting } = useNetworkAwareMutation({
		mutationFn: submitBankDetails,
		onSuccess: (data) => {
			console.log("=== BANK DETAILS SUBMISSION SUCCESS ===");
			console.log("Bank Details Submission API Response:", JSON.stringify(data, null, 2));
			console.log("Response Success:", data?.success);
			console.log("Response Message:", data?.message);
			console.log("Response Verified:", data?.verified);
			console.log("Response Bank Details:", data?.bank_details);
			console.log("=====================================");

			// Invalidate bank accounts query to refetch fresh data
			queryClient.invalidateQueries({
				queryKey: ["bankAccounts"],
			});

			Toast.show({
				type: "success",
				text1: t("bankDetailsSubmittedSuccessfully"),
				text2: t("proceedingToNextStep"),
			});

			// Navigate to next screen
			router.push("/verifying-bank");
		},
		onError: (err, variables, ctx) => {
			console.log("Bank Details Submission API Error:", err);
			const { error, errorType } = errorHandler(err, variables, ctx);

			Toast.show({
				type: "error",
				text1: t("bankSubmissionFailed"),
				text2: error?.message ?? t("pleaseCheckYourBankDetails"),
			});
		},
	});

	const handleInputChange = (field: string, value: string) => {
		let processedValue = value;

		// Only allow numeric characters for bank account number fields
		if (field === "bankAccountNumber" || field === "confirmBankAccountNumber") {
			processedValue = value.replace(/[^0-9]/g, "");
		}

		// Auto-convert IFSC code to uppercase
		if (field === "ifscCode") {
			processedValue = value.toUpperCase();
		}

		setFormData((prev) => ({
			...prev,
			[field]: processedValue,
		}));

		// Auto-lookup IFSC when user enters 11 characters
		if (field === "ifscCode" && processedValue.length === 11) {
			console.log("🔍 Looking up IFSC:", processedValue);
			lookupIFSCMutation(processedValue);
		} else if (field === "ifscCode" && processedValue.length !== 11) {
			// Clear bank details if IFSC is not 11 characters
			setIsIFSCValid(false);
			setFormData((prev) => ({
				...prev,
				bankName: "",
				branchName: "",
			}));
		}
	};

	const validateForm = () => {
		if (!formData.bankAccountNumber.trim()) {
			Toast.show({
				type: "error",
				text1: t("bankAccountNumberRequired"),
			});
			return false;
		}

		if (formData.bankAccountNumber.length < 9 || formData.bankAccountNumber.length > 18) {
			Toast.show({
				type: "error",
				text1: t("invalidBankAccountNumber"),
				text2: t("accountNumberMustBeBetween9To18Digits"),
			});
			return false;
		}

		if (!formData.confirmBankAccountNumber.trim()) {
			Toast.show({
				type: "error",
				text1: t("pleaseConfirmYourBankAccountNumber"),
			});
			return false;
		}

		if (
			formData.confirmBankAccountNumber.length < 9 ||
			formData.confirmBankAccountNumber.length > 18
		) {
			Toast.show({
				type: "error",
				text1: t("invalidConfirmationAccountNumber"),
				text2: t("accountNumberMustBeBetween9To18Digits"),
			});
			return false;
		}

		if (formData.bankAccountNumber !== formData.confirmBankAccountNumber) {
			Toast.show({
				type: "error",
				text1: t("accountNumbersDontMatch"),
				text2: t("pleaseEnsureBothAccountNumbersAreIdentical"),
			});
			return false;
		}

		if (!formData.ifscCode.trim() || formData.ifscCode.length !== 11) {
			Toast.show({
				type: "error",
				text1: t("validIFSCCodeRequired"),
				text2: t("ifscCodeMustBe11CharactersLong"),
			});
			return false;
		}

		if (!isIFSCValid) {
			Toast.show({
				type: "error",
				text1: t("invalidIFSCCodeValidation"),
				text2: t("pleaseWaitForIFSCValidationOrEnterValidCode"),
			});
			return false;
		}

		if (!formData.accountType.trim()) {
			Toast.show({
				type: "error",
				text1: t("selectAccountType"),
				text2: t("pleaseSelectYourAccountType"),
			});
			return false;
		}

		return true;
	};

	const handleProceed = () => {
		if (!validateForm()) return;

		const apiData: BankDetailsSubmitRequestType = {
			account_number: formData.bankAccountNumber.trim(),
			confirm_account_number: formData.confirmBankAccountNumber.trim(),
			ifsc_code: formData.ifscCode.toUpperCase().trim(),
			bank_name: formData.bankName.trim(),
			branch_name: formData.branchName.trim(),
			account_type: formData.accountType.trim(),
		};

		console.log("📋 Submitting bank details:", apiData);
		submitBankDetailsMutation(apiData);
	};

	return (
		<>
			<KeyboardAvoidingView style={styles.container} behavior="padding">
			{/* Header */}
			{/* <View style={styles.header}>
				<TouchableOpacity
					style={styles.backButton}
					onPress={() => {
						if (router.canGoBack()) {
							router.back();
						} else {
							router.replace("/(tabs)");
						}
					}}>
					<Ionicons name="arrow-back" size={24} color={dark} />
				</TouchableOpacity>
				<Text style={styles.headerTitle}>Verify Bank Details</Text>
			</View> */}

			<ScrollView
				style={styles.scrollView}
				contentContainerStyle={styles.scrollContent}
				showsVerticalScrollIndicator={false}>
				{/* Header Section */}
				<View style={styles.headerSection}>
					{/* <View style={styles.cardIconContainer}> */}
						{/* <Image source={Images.CARD_FRAME} style={styles.cardFrame} /> */}
						{/* <Image source={Images.BANK_LOGO} style={styles.cardImage} /> */}
					{/* </View> */}
					{/* <Text style={styles.title}>{t("verifyYourBankDetailsForSmoother")}</Text> */}
				</View>

				{/* Form Section */}
				<View style={styles.formSection}>
				<Input
					label={t("bankAccountNumber")}
					placeholder={t("bankAccountNumberPlaceholder")}
					value={formData.bankAccountNumber}
					onChangeText={(value) => handleInputChange("bankAccountNumber", value)}
					containerStyle={styles.inputContainer}
					style={styles.inputStyle}
					keyboardType="numeric"
					maxLength={18}
					required={true}
					disabled={isSubmitting || isLookingUpIFSC || isAllBankDataLocked}
				/>

				<Input
					label={t("reEnterBankAccountNumber")}
					placeholder={t("reEnterBankAccountNumber")}
					value={formData.confirmBankAccountNumber}
					onChangeText={(value) =>
						handleInputChange("confirmBankAccountNumber", value)
					}
					containerStyle={styles.inputContainer}
					keyboardType="numeric"
					style={styles.inputStyle}
					maxLength={18}
					required={true}
					disabled={isSubmitting || isLookingUpIFSC || isAllBankDataLocked}
				/>

					{/* Account Type Field */}
					<View style={styles.inputContainer}>
						<Text style={styles.inputLabel}>
							{t("accountType")} <Text style={styles.requiredAsterisk}>*</Text>
						</Text>
					<Select
						options={accountTypeOptions}
						selectedValue={formData.accountType}
						onSelect={(value) => handleInputChange("accountType", value as string)}
						placeholder={t("selectAccountType")}
						containerStyle={styles.selectContainer}
						disabled={isSubmitting || isLookingUpIFSC || isAllBankDataLocked}
					/>
					</View>

				<Input
					label={t("ifscCode")}
					placeholder={t("ifscCodePlaceholder")}
					value={formData.ifscCode}
					onChangeText={(value) => handleInputChange("ifscCode", value)}
					containerStyle={styles.inputContainer}
					autoCapitalize="characters"
					style={styles.inputStyle}
					maxLength={11}
					required={true}
					disabled={isSubmitting || isLookingUpIFSC || isAllBankDataLocked}
				/>

					{/* Bank Name Field (Non-editable) */}
					<Input
						label={t("bankName")}
						placeholder={isLookingUpIFSC ? t("lookingUp") : t("autoFilledFromIFSC")}
						value={formData.bankName}
						onChangeText={() => {}} // Non-editable
						containerStyle={styles.inputContainer}
						editable={!isAllBankDataLocked}
						style={[styles.disabledInput, styles.inputStyle]}
					/>

				{/* Branch Name Field (Non-editable) */}
				<Input
					label={t("branchName")}
					placeholder={isLookingUpIFSC ? t("lookingUp") : t("autoFilledFromIFSC")}
					value={formData.branchName}
					onChangeText={() => {}} // Non-editable
					containerStyle={styles.inputContainer}
					editable={!isAllBankDataLocked}
					style={[styles.disabledInput, styles.inputStyle]}
				/>
			</View>
		</ScrollView>

		{/* Submit Button (sticky at the bottom, outside ScrollView) */}
		<View style={[styles.buttonContainer, { paddingBottom: Math.max(insets.bottom + height(2), height(4)) }]}>
			<TouchableOpacity
				style={[
					styles.proceedButton,
					(isSubmitting || isLookingUpIFSC) && styles.proceedButtonDisabled,
				]}
				onPress={handleProceed}
				disabled={isSubmitting || isLookingUpIFSC}>
				{isSubmitting ? (
					<ActivityIndicator size="small" color="#333" />
				) : (
					<>
						<Text style={styles.proceedButtonText}>{t("submit")}</Text>
						<IconSymbol name="arrow.right" size={20} color={dark} />
					</>
				)}
			</TouchableOpacity>
		</View>
		</KeyboardAvoidingView>

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
	container: {
		flex: 1,
		backgroundColor: white,
	},
	header: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: width(5),
		paddingTop: height(5),
		// paddingBottom: height(1),
		backgroundColor: white,
		borderBottomWidth: 1,
		borderBottomColor: "#E5E5E5",
	},
	backButton: {
		padding: width(2),
		marginRight: width(3),
	},
	headerTitle: {
		fontSize: font(2),
		fontWeight: "600",
		color: dark,
	},
	scrollView: {
		flex: 1,
	},
	scrollContent: {
		paddingHorizontal: width(5),
		paddingTop: height(4),
		paddingBottom: height(12), // Increased for better scrollability on smaller devices
	},
	headerSection: {
		alignItems: "center",
		marginBottom: height(1.5),
	},
	cardIconContainer: {
		position: "relative",
		marginBottom: height(2),
		width: width(12),
		height: width(12),
		alignItems: "center",
		justifyContent: "center",
	},
	cardFrame: {
		position: "absolute",
		width: width(25),
		height: width(25),
		resizeMode: "contain",
	},
	cardImage: {
		position: "absolute",
		width: width(17),
		height: width(17),
		resizeMode: "contain",
	},
	cornerBrackets: {
		position: "absolute",
		top: -width(1.5),
		left: -width(1.5),
		right: -width(1.5),
		bottom: -width(1.5),
	},
	bracket: {
		position: "absolute",
		width: width(3),
		height: width(3),
		borderColor: primary,
		borderWidth: 2,
	},
	topLeft: {
		top: 0,
		left: 0,
		borderRightWidth: 0,
		borderBottomWidth: 0,
	},
	topRight: {
		top: 0,
		right: 0,
		borderLeftWidth: 0,
		borderBottomWidth: 0,
	},
	bottomLeft: {
		bottom: 0,
		left: 0,
		borderRightWidth: 0,
		borderTopWidth: 0,
	},
	bottomRight: {
		bottom: 0,
		right: 0,
		borderLeftWidth: 0,
		borderTopWidth: 0,
	},
	title: {
		fontSize: font(1.6),
		color: dark,
		textAlign: "center",
		lineHeight: font(2.6),
		marginVertical: height(1.3),
	},
	formSection: {
		marginBottom: height(1),
	},
	inputContainer: {
		marginVertical: height(0.8),
	},
	inputLabel: {
		color: dark,
		fontSize: font(1.5),
		marginBottom: height(0.5),
		marginLeft: width(1),
	},
	inputStyle: { paddingVertical: height(1) },
	selectContainer: {
		marginTop: 0,
	},
	importantSection: {
		backgroundColor: "#F8FFF0",
		padding: width(4),
		borderRadius: width(2),
		borderLeftWidth: 4,
		borderLeftColor: primary,
		marginBottom: height(2),
	},
	importantTitle: {
		fontSize: font(1.4),
		fontWeight: "bold",
		color: primary,
		marginBottom: height(0.5),
	},
	importantText: {
		fontSize: font(1.3),
		color: "#666",
		lineHeight: font(1.8),
	},
	buttonContainer: {
		paddingHorizontal: width(5),
		paddingTop: height(2),
		backgroundColor: white,
		borderTopWidth: 1,
		borderTopColor: "#E5E5E5",
		width: "100%",
	},
	proceedButton: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: primary,
		paddingVertical: height(2),
		borderRadius: width(6),
		gap: width(2),
	},
	proceedButtonText: {
		fontSize: font(1.8),
		fontWeight: "600",
		color: dark,
	},
	proceedButtonDisabled: {
		opacity: 0.6,
	},
	disabledInput: {
		backgroundColor: "#F5F5F5",
		color: "#666",
	},
	requiredAsterisk: {
		color: "#d32f2f",
		fontSize: font(1.5),
	},
});
