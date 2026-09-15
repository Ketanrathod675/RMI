import { Select, type SelectOption } from "@/components";
import { primary } from "@/constants/Colors";
import { useAuth } from "@/hooks/useAuth";
import { useJourneyTracker } from "@/hooks/useJourneyTracker";
import { useNetworkAwareMutation } from "@/hooks/useNetworkAwareMutation";
import { useNetworkAwareQuery } from "@/hooks/useNetworkAwareQuery";
import { useTranslation } from "@/hooks/useTranslation";
import { useColorScheme } from "@/hooks/useColorScheme";
import { errorHandler } from "@/utils/api";
import { getEmploymentDetailsHbPartner } from "@/utils/api/user";
import {
	getProfessionalDetails,
	submitEmploymentDetails,
	type EmploymentDetailsRequestType,
} from "@/utils/api/kyc";
import { useNavigation, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useState, useRef } from "react";
import {
	ActivityIndicator,
	Alert,
	Animated,
	BackHandler,
	KeyboardAvoidingView,
	Platform,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

export default function ProfessionalDetails() {
	const { t } = useTranslation();
	const insets = useSafeAreaInsets();
	const router = useRouter();
	const navigation = useNavigation();

	// Track this screen in the journey
	useJourneyTracker("/professional-details");

	const colorScheme = useColorScheme();
	const isDark = colorScheme === "dark";

	const headerBg = isDark ? "#121212" : "#FFFFFF";
	const headerTextColor = isDark ? "#FFFFFF" : "#1F2937";
	const headerBorderColor = isDark ? "#222D38" : "#F3F4F6";
	const iconColor = isDark ? "#FFFFFF" : "#1F2937";

	const residenceStatusOptions: SelectOption[] = [
		{ label: "Rented", value: "rented" },
		{ label: "Self-Owned", value: "self_owned" },
		{ label: "Owned by Parents", value: "parents_owned" },
		{ label: "PG", value: "pg" },
	];

	const employmentTypeOptions: SelectOption[] = [
		{ label: "Salaried", value: "salaried" },
		{ label: "Self Employed", value: "self_employed" },
	];

	const companyTypeOptions: SelectOption[] = [
		{ label: "Trader", value: "trader" },
		{ label: "Manufacturing", value: "manufacturing" },
		{ label: "IT & Services", value: "it_services" },
		{ label: "Dairy", value: "dairy" },
		{ label: "Pharmacy", value: "pharmacy" },
		{ label: "Other", value: "other" },
	];

	const typeOfIndustryOptions: SelectOption[] = [
		{ label: "Trader", value: "trading" },
		{ label: "Manufacturing", value: "manufacturing" },
		{ label: "Services", value: "services" },
	];

	const natureOfBusinessOptions: SelectOption[] = [
		{ label: "Agriculture Products", value: "agriculture_products" },
		{ label: "Carpenters", value: "carpenters" },
		{ label: "Fishermen", value: "fishermen" },
		{ label: "Automobiles", value: "automobiles" },
		{ label: "Cab Drivers", value: "cab_drivers" },
		{ label: "Garments & Textiles", value: "garments_textiles" },
		{ label: "Cement", value: "cement" },
		{ label: "Chemicals", value: "chemicals" },
		{ label: "Household Maids", value: "household_maids" },
		{ label: "Computers", value: "computers" },
		{ label: "Construction", value: "construction" },
		{ label: "Containers & Packaging", value: "containers_packaging" },
		{ label: "Energy", value: "energy" },
		{ label: "Entertainment & Leisure", value: "entertainment_leisure" },
		{ label: "Finance", value: "finance" },
		{ label: "FMCG", value: "fmcg" },
		{ label: "Food & Beverages", value: "food_beverages" },
		{ label: "Food Processing", value: "food_processing" },
		{ label: "Healthcare Products & Services", value: "healthcare_products_services" },
		{ label: "Kirana Store", value: "kirana_store" },
		{ label: "Electronic Devices", value: "electronic_devices" },
		{ label: "Media & Broadcasting", value: "media_broadcasting" },
		{ label: "Paints", value: "paints" },
		{ label: "Petroleum Products", value: "petroleum_products" },
		{ label: "Plastics & Paper", value: "plastics_paper" },
		{ label: "Professional Services", value: "professional_services" },
		{ label: "Software Services", value: "software_services" },
		{ label: "Transportation & Logistics", value: "transportation_logistics" },
		{ label: "Delivery Boys", value: "delivery_boys" },
		{ label: "Industrial Equipments", value: "industrial_equipments" },
		{ label: "Dairy", value: "diary" },
		{ label: "Kabadiwala", value: "kabdiwala" },
		{ label: "Fruits & Vegetable Vendor", value: "fruits_vegetable_vendor" },
	];

	const incomeRangeOptions: SelectOption[] = [
		{ label: "Upto 10,000", value: "upto_10000" },
		{ label: "10,001 - 25,000", value: "10001_25000" },
		{ label: "25,001 - 50,000", value: "25001_50000" },
		{ label: "50,001 - 1,00,000", value: "50001_100000" },
		{ label: "Above 1,00,000", value: "above_100000" },
	];

	const modeOfSalaryOptions: SelectOption[] = [
		{ label: "Bank Transfer", value: "bank_transfer" },
		{ label: "Cheque", value: "cheque" },
		{ label: "Cash", value: "cash" },
	];

	const defaultLanguages: SelectOption[] = [
		{ label: "English", value: "english" },
		{ label: "Hindi", value: "hindi" },
		{ label: "Marathi", value: "marathi" },
		{ label: "Gujarati", value: "gujarati" },
		{ label: "Bengali", value: "bengali" },
		{ label: "Tamil", value: "tamil" },
		{ label: "Telugu", value: "telugu" },
		{ label: "Kannada", value: "kannada" },
		{ label: "Malayalam", value: "malayalam" },
	];

	// Initialized to match the exact defaults in the screenshot
	const [formData, setFormData] = useState({
		employmentType: "salaried" as "salaried" | "self_employed",
		companyType: "",
		companyName: "",
		designation: "",
		incomeRange: "",
		residenceStatus: "",
		natureOfBusiness: "",
		typeOfIndustry: "",
		modeOfSalary: "",
		preferredLanguage: "",
	});

	const [errors, setErrors] = useState({
		employmentType: "",
		companyType: "",
		companyName: "",
		designation: "",
		incomeRange: "",
		residenceStatus: "",
		natureOfBusiness: "",
		typeOfIndustry: "",
		modeOfSalary: "",
		preferredLanguage: "",
	});

	const [fetchingDetails, setFetchingDetails] = useState(false);
	const [backendLanguages, setBackendLanguages] = useState<string[]>([]);

	const languageOptions: SelectOption[] =
		backendLanguages.length > 0
			? backendLanguages.map((lang) => ({
				label: lang.charAt(0).toUpperCase() + lang.slice(1),
				value: lang.toLowerCase(),
			}))
			: defaultLanguages;

	const { applicantFrom } = useAuth();

	// HB Partner API prefill
	const { data: hbEmploymentData } = useNetworkAwareQuery({
		queryKey: ["employment-details-hb-partner"],
		queryFn: getEmploymentDetailsHbPartner,
		enabled: applicantFrom === "HB",
		retry: (failureCount, error: any) => {
			if (error?.response?.status === 404) return false;
			return failureCount < 2;
		},
	});

	useEffect(() => {
		if (hbEmploymentData) {
			const normalize = (val: string | null) => (val ? val.replace(/-/g, "_") : "");
			setFormData((prev) => ({
				...prev,
				employmentType: (normalize(hbEmploymentData.employment_type) || prev.employmentType) as any,
				companyName: hbEmploymentData.company_name || prev.companyName,
				designation: hbEmploymentData.designation || prev.designation,
				incomeRange: normalize(hbEmploymentData.income_range) || prev.incomeRange,
				residenceStatus: normalize(hbEmploymentData.residence_status) || prev.residenceStatus,
			}));
		}
	}, [hbEmploymentData]);

	useEffect(() => {
		getProfessionalDetails()
			.then((response) => {
				if (response?.languages && Array.isArray(response.languages) && response.languages.length > 0) {
					setBackendLanguages(response.languages);
				}
				if (response?.status && response?.data) {
					const data = response.data;
					const normalize = (val: string | null) => (val ? val.replace(/-/g, "_") : "");

					setFormData((prev) => ({
						...prev,
						employmentType: (normalize(data.employment_type) || prev.employmentType) as any,
						companyType: normalize(data.type_of_company) || prev.companyType,
						companyName: data.company_name || prev.companyName,
						designation: data.designation || prev.designation,
						incomeRange: normalize(data.income_range) || prev.incomeRange,
						residenceStatus: normalize(data.residence_status) || prev.residenceStatus,
						natureOfBusiness: normalize(data.nature_of_business) || prev.natureOfBusiness,
						typeOfIndustry: normalize(data.industry_type) || prev.typeOfIndustry,
						modeOfSalary: normalize(data.mode_of_salary) || prev.modeOfSalary,
						preferredLanguage: data.preferred_language?.toLowerCase() || prev.preferredLanguage,
					}));
				}
			})
			.catch((err) => {
				console.log("Error fetching professional details:", err);
			})
			.finally(() => {
				setFetchingDetails(false);
			});
	}, []);

	// Back button handling
	const handleBack = () => {
		Alert.alert(
			t("areYouSureGoBack", "Are you sure you want to go back?"),
			t("youWillLoseProgress", "You will lose your progress."),
			[
				{ text: t("cancel", "Cancel"), style: "cancel" },
				{ text: t("goBack", "Go Back"), onPress: () => router.replace("/(tabs)") },
			]
		);
	};

	useEffect(() => {
		const unsubscribe = navigation.addListener("beforeRemove", (e) => {
			if (["GO_BACK", "POP"].includes(e.data.action.type)) {
				e.preventDefault();
				handleBack();
			}
		});

		const backHandler = BackHandler.addEventListener("hardwareBackPress", () => {
			handleBack();
			return true;
		});

		return () => {
			unsubscribe();
			backHandler.remove();
		};
	}, [navigation, router]);

	const handleForm = <T extends keyof typeof formData>(field: T, value: (typeof formData)[T]) => {
		if (field === "employmentType" && formData.employmentType === value) {
			return;
		}

		setFormData((prev) => ({
			...prev,
			[field]: value,
			...(field === "employmentType"
				? {
					companyType: "",
					companyName: "",
					designation: "",
					natureOfBusiness: "",
					typeOfIndustry: value === "self_employed" ? "trading" : "",
					modeOfSalary: "",
					incomeRange: "",
				}
				: {}),
		}));

		setErrors((prev) => ({
			...prev,
			[field]: "",
		}));
	};

	// Validation
	const validateForm = (): boolean => {
		const newErrors = {
			employmentType: "",
			companyType: "",
			companyName: "",
			designation: "",
			incomeRange: "",
			residenceStatus: "",
			natureOfBusiness: "",
			typeOfIndustry: "",
			modeOfSalary: "",
			preferredLanguage: "",
		};

		if (!formData.residenceStatus) {
			newErrors.residenceStatus = t("residenceStatusRequired", "Residence status is required");
		}
		if (!formData.employmentType) {
			newErrors.employmentType = t("employmentTypeRequired", "Employment type is required");
		}

		if (formData.employmentType === "salaried") {
			if (!formData.companyType) {
				newErrors.companyType = t("companyTypeRequired", "Company type is required");
			}
			if (!formData.companyName.trim()) {
				newErrors.companyName = t("companyNameRequired", "Company name is required");
			}
			if (!formData.designation.trim()) {
				newErrors.designation = t("designationRequired", "Designation is required");
			}
			if (!formData.incomeRange) {
				newErrors.incomeRange = t("incomeRangeRequired", "Income range is required");
			}
			if (!formData.modeOfSalary) {
				newErrors.modeOfSalary = t("modeOfSalaryRequired", "Mode of salary is required");
			}
		}

		if (formData.employmentType === "self_employed") {
			if (!formData.natureOfBusiness) {
				newErrors.natureOfBusiness = t("natureOfBusinessRequired", "Nature of business is required");
			}
			if (!formData.typeOfIndustry) {
				newErrors.typeOfIndustry = t("typeOfIndustryRequired", "Type of industry is required");
			}
			if (!formData.incomeRange) {
				newErrors.incomeRange = t("incomeRangeRequired", "Income range is required");
			}
		}

		if (!formData.preferredLanguage) {
			newErrors.preferredLanguage = t("preferredLanguageRequired", "Preferred language is required");
		}

		setErrors(newErrors);
		return Object.values(newErrors).every((error) => error === "");
	};

	const { mutate: submitEmploymentDetailsMutation, isPending } = useNetworkAwareMutation({
		mutationFn: submitEmploymentDetails,
		onSuccess: () => {
			Toast.show({
				type: "success",
				text1: t("employmentDetailsSubmittedSuccessfully", "Details submitted successfully"),
				text2: t("proceedingToNextStep", "Proceeding to next step"),
			});

			router.replace("/professional-details-success");
		},
		onError: (err, variables, ctx) => {
			const { error } = errorHandler(err, variables, ctx);
			Toast.show({
				type: "error",
				text1: t("failedToSubmitEmploymentDetails", "Failed to submit details"),
				text2: error?.message ?? t("pleaseRetryPayment", "Please try again"),
			});
		},
	});

	// Shimmer animation for submit button
	const shimmerAnim = useRef(new Animated.Value(0)).current;

	useEffect(() => {
		let loop: Animated.CompositeAnimation;
		if (!isPending) {
			loop = Animated.loop(
				Animated.timing(shimmerAnim, {
					toValue: 1,
					duration: 1800,
					useNativeDriver: true,
				})
			);
			loop.start();
		} else {
			shimmerAnim.setValue(0);
		}

		return () => {
			if (loop) loop.stop();
		};
	}, [isPending, shimmerAnim]);

	const handleSubmit = () => {
		if (!validateForm()) {
			return;
		}

		const apiData: EmploymentDetailsRequestType = {
			employment_type: formData.employmentType,
			verification_type: "automatic",
			income_range: formData.incomeRange,
			residence_status: formData.residenceStatus,
			type_of_company: formData.companyType || undefined,
			company_name: formData.companyName || undefined,
			designation: formData.designation || undefined,
			nature_of_business: formData.natureOfBusiness || undefined,
			industry_type: formData.typeOfIndustry || undefined,
			mode_of_salary: formData.modeOfSalary || undefined,
			preferred_language: formData.preferredLanguage || "english",
		};

		submitEmploymentDetailsMutation(apiData);
	};

	if (fetchingDetails) {
		return (
			<View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
				<ActivityIndicator size="large" color="#1F2937" />
			</View>
		);
	}

	return (
		<KeyboardAvoidingView
			style={styles.container}
			behavior={Platform.OS === "ios" ? "padding" : "height"}
			keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}>
			<StatusBar style={isDark ? "light" : "dark"} />

			{/* Upper Header following system theme */}
			<View
				style={[
					styles.header,
					{
						paddingTop: Math.max(insets.top, 14),
						backgroundColor: headerBg,
						borderBottomColor: headerBorderColor,
					},
				]}>
				<TouchableOpacity
					onPress={handleBack}
					style={styles.backButton}
					hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
					activeOpacity={0.7}>
					<MaterialIcons name="arrow-back" size={24} color={iconColor} />
				</TouchableOpacity>
				<Text style={[styles.headerTitle, { color: headerTextColor }]}>Professional Details</Text>
			</View>

			<ScrollView
				style={styles.scrollView}
				contentContainerStyle={styles.scrollContent}
				showsVerticalScrollIndicator={false}
				keyboardShouldPersistTaps="handled">

				{/* 1. Residence Status */}
				<View style={styles.inputContainer}>
					<Text style={styles.inputLabel}>
						Residence Status<Text style={styles.requiredAsterisk}> *</Text>
					</Text>
					<Select
						options={residenceStatusOptions}
						selectedValue={formData.residenceStatus}
						onSelect={(val) => handleForm("residenceStatus", val as string)}
						placeholder="Select residence status"
						disabled={isPending}
					/>
					{errors.residenceStatus ? (
						<Text style={styles.errorText}>{errors.residenceStatus}</Text>
					) : null}
				</View>

				{/* 2. Employment Type */}
				<View style={styles.inputContainer}>
					<Text style={styles.inputLabel}>
						Employment Type<Text style={styles.requiredAsterisk}> *</Text>
					</Text>
					<Select
						options={employmentTypeOptions}
						selectedValue={formData.employmentType}
						onSelect={(val) =>
							handleForm("employmentType", val as "salaried" | "self_employed")
						}
						placeholder="Select employment type"
						disabled={isPending}
					/>
					{errors.employmentType ? (
						<Text style={styles.errorText}>{errors.employmentType}</Text>
					) : null}
				</View>

				{/* Salaried Specific Fields */}
				{formData.employmentType === "salaried" && (
					<>
						{/* 3. Type of Company */}
						<View style={styles.inputContainer}>
							<Text style={styles.inputLabel}>
								Type of Company<Text style={styles.requiredAsterisk}> *</Text>
							</Text>
							<Select
								options={companyTypeOptions}
								selectedValue={formData.companyType}
								onSelect={(val) => handleForm("companyType", val as string)}
								placeholder="Select company type"
								disabled={isPending}
							/>
							{errors.companyType ? (
								<Text style={styles.errorText}>{errors.companyType}</Text>
							) : null}
						</View>

						{/* 4. Company Name */}
						<View style={styles.inputContainer}>
							<Text style={styles.inputLabel}>
								Company Name<Text style={styles.requiredAsterisk}> *</Text>
							</Text>
							<TextInput
								style={styles.textInput}
								value={formData.companyName}
								onChangeText={(val) => handleForm("companyName", val)}
								placeholder="Enter company name"
								placeholderTextColor="#A0A0A0"
							/>
							{errors.companyName ? (
								<Text style={styles.errorText}>{errors.companyName}</Text>
							) : null}
						</View>

						{/* 5. Designation */}
						<View style={styles.inputContainer}>
							<Text style={styles.inputLabel}>
								Designation<Text style={styles.requiredAsterisk}> *</Text>
							</Text>
							<TextInput
								style={styles.textInput}
								value={formData.designation}
								onChangeText={(val) => handleForm("designation", val)}
								placeholder="Enter your designation"
								placeholderTextColor="#A0A0A0"
							/>
							{errors.designation ? (
								<Text style={styles.errorText}>{errors.designation}</Text>
							) : null}
						</View>

						{/* 6. Salary Range (Rs.) */}
						<View style={styles.inputContainer}>
							<Text style={styles.inputLabel}>
								Salary Range  (Rs.)<Text style={styles.requiredAsterisk}> *</Text>
							</Text>
							<Select
								options={incomeRangeOptions}
								selectedValue={formData.incomeRange}
								onSelect={(val) => handleForm("incomeRange", val as string)}
								placeholder="Select income range"
								disabled={isPending}
							/>
							{errors.incomeRange ? (
								<Text style={styles.errorText}>{errors.incomeRange}</Text>
							) : null}
						</View>

						{/* 7. Mode of Salary */}
						<View style={styles.inputContainer}>
							<Text style={styles.inputLabel}>
								Mode of Salary<Text style={styles.requiredAsterisk}> *</Text>
							</Text>
							<Select
								options={modeOfSalaryOptions}
								selectedValue={formData.modeOfSalary}
								onSelect={(val) => handleForm("modeOfSalary", val as string)}
								placeholder="Select mode of salary"
								disabled={isPending}
							/>
							{errors.modeOfSalary ? (
								<Text style={styles.errorText}>{errors.modeOfSalary}</Text>
							) : null}
						</View>
					</>
				)}

				{/* Self Employed Specific Fields */}
				{formData.employmentType === "self_employed" && (
					<>
						{/* 3. Nature of Business */}
						<View style={styles.inputContainer}>
							<Text style={styles.inputLabel}>
								Nature of Business<Text style={styles.requiredAsterisk}> *</Text>
							</Text>
							<Select
								options={natureOfBusinessOptions}
								selectedValue={formData.natureOfBusiness}
								onSelect={(val) => handleForm("natureOfBusiness", val as string)}
								placeholder="Select nature of business"
								disabled={isPending}
							/>
							{errors.natureOfBusiness ? (
								<Text style={styles.errorText}>{errors.natureOfBusiness}</Text>
							) : null}
						</View>

						{/* 4. Type of Industry */}
						<View style={styles.inputContainer}>
							<Text style={styles.inputLabel}>
								Type of Industry<Text style={styles.requiredAsterisk}> *</Text>
							</Text>
							<Select
								options={typeOfIndustryOptions}
								selectedValue={formData.typeOfIndustry}
								onSelect={(val) => handleForm("typeOfIndustry", val as string)}
								placeholder="Select type of industry"
								disabled={isPending}
							/>
							{errors.typeOfIndustry ? (
								<Text style={styles.errorText}>{errors.typeOfIndustry}</Text>
							) : null}
						</View>

						{/* 5. Income (Rs.) */}
						<View style={styles.inputContainer}>
							<Text style={styles.inputLabel}>
								Income (Rs.)<Text style={styles.requiredAsterisk}> *</Text>
							</Text>
							<Select
								options={incomeRangeOptions}
								selectedValue={formData.incomeRange}
								onSelect={(val) => handleForm("incomeRange", val as string)}
								placeholder="Select income range"
								disabled={isPending}
							/>
							{errors.incomeRange ? (
								<Text style={styles.errorText}>{errors.incomeRange}</Text>
							) : null}
						</View>
					</>
				)}

				{/* Preferred Language (Common to both) */}
				<View style={styles.inputContainer}>
					<Text style={styles.inputLabel}>
						Preferred Language<Text style={styles.requiredAsterisk}> *</Text>
					</Text>
					<Select
						options={languageOptions}
						selectedValue={formData.preferredLanguage}
						onSelect={(val) => handleForm("preferredLanguage", val as string)}
						placeholder="Select your preferred language"
						title="Select Language"
						searchable={true}
						searchPlaceholder="Search language..."
						disabled={isPending}
					/>
					{errors.preferredLanguage ? (
						<Text style={styles.errorText}>{errors.preferredLanguage}</Text>
					) : null}
				</View>
			</ScrollView>

			{/* Sticky Bottom Pill Button with Shimmer */}
			<View style={[styles.bottomButtonContainer, { paddingBottom: Math.max(insets.bottom + 14, 28) }]}>
				<TouchableOpacity
					style={[styles.submitButton, isPending && styles.submitButtonDisabled]}
					onPress={handleSubmit}
					disabled={isPending}
					activeOpacity={0.85}>
					{/* Shimmer animation */}
					{!isPending && (
						<Animated.View
							style={[
								StyleSheet.absoluteFill,
								{
									width: "50%",
									transform: [
										{
											translateX: shimmerAnim.interpolate({
												inputRange: [0, 1],
												outputRange: [-180, 420],
											}),
										},
									],
								},
							]}>
							<LinearGradient
								colors={["transparent", "rgba(255, 255, 255, 0.7)", "transparent"]}
								start={{ x: 0, y: 0 }}
								end={{ x: 1, y: 0 }}
								style={StyleSheet.absoluteFill}
							/>
						</Animated.View>
					)}

					{isPending ? (
						<ActivityIndicator size="small" color="#000000" />
					) : (
						<View style={styles.submitButtonContent}>
							<Text style={styles.submitButtonText}>Submit & Check Eligibility</Text>
							<MaterialIcons name="arrow-forward" size={20} color="#000000" style={{ marginLeft: 8 }} />
						</View>
					)}
				</TouchableOpacity>
			</View>
		</KeyboardAvoidingView>
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
		paddingHorizontal: 16,
		paddingBottom: 16,
		borderBottomWidth: 1,
	},
	backButton: {
		padding: 4,
		marginRight: 16,
	},
	headerTitle: {
		fontSize: 20,
		fontWeight: "700",
	},
	scrollView: {
		flex: 1,
		backgroundColor: "#FFFFFF",
	},
	scrollContent: {
		paddingHorizontal: 18,
		paddingTop: 18,
		paddingBottom: 24,
	},
	inputContainer: {
		marginBottom: 16,
	},
	inputLabel: {
		color: "#1F2937",
		fontSize: 15,
		fontWeight: "600",
		marginBottom: 8,
	},
	requiredAsterisk: {
		color: "#d32f2f",
		fontSize: 15,
		fontWeight: "600",
	},
	textInput: {
		backgroundColor: "#FFFFFF",
		borderRadius: 10,
		paddingVertical: 14,
		paddingHorizontal: 16,
		fontSize: 15,
		color: "#1F2937",
		borderWidth: 1,
		borderColor: "#D1D5DB",
		minHeight: 52,
	},
	bottomButtonContainer: {
		paddingHorizontal: 18,
		paddingTop: 12,
		backgroundColor: "#FFFFFF",
		width: "100%",
	},
	submitButton: {
		backgroundColor: primary,
		borderRadius: 30,
		paddingVertical: 16,
		width: "100%",
		alignItems: "center",
		justifyContent: "center",
		overflow: "hidden",
		position: "relative",
		elevation: 2,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.15,
		shadowRadius: 2,
	},
	submitButtonDisabled: {
		opacity: 0.65,
	},
	submitButtonContent: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
	},
	submitButtonText: {
		fontSize: 16,
		fontWeight: "700",
		color: "#000000",
	},
	errorText: {
		color: "#d32f2f",
		fontSize: 13,
		marginTop: 4,
		marginLeft: 2,
	},
});
