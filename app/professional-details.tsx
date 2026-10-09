import ExitIntentModal from "@/components/assessment-fee/ExitIntentModal";
import { Select, StickyFormFooter, type SelectOption } from "@/components";
import { primary } from "@/constants/Colors";
import { useAuth } from "@/hooks/useAuth";
import { useJourneyTracker } from "@/hooks/useJourneyTracker";
import { useKeyboardVisible } from "@/hooks/useKeyboardVisible";
import { useFormScroll } from "@/hooks/useFormScroll";
import { useNetworkAwareMutation } from "@/hooks/useNetworkAwareMutation";
import { useNetworkAwareQuery } from "@/hooks/useNetworkAwareQuery";
import { useTranslation } from "@/hooks/useTranslation";
import { useColorScheme } from "@/hooks/useColorScheme";
import { useJourneyLoader } from "@/context/JourneyLoaderProvider";
import {
	getProfessionalDetailsWithMeta,
	submitProfessionalDetails,
	type ProfessionalDetailsPayload,
} from "@/utils/api";
import { getEmploymentDetailsHbPartner } from "@/utils/api/user";
import { useNavigation, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useState, useRef } from "react";
import {
	ActivityIndicator,
	Alert,
	Animated,
	BackHandler,
	Keyboard,
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

	const [isExitModalVisible, setIsExitModalVisible] = useState(false);

	const companyNameRef = useRef<TextInput>(null);
	const designationRef = useRef<TextInput>(null);

	const { visible: isKeyboardVisible, height: keyboardHeight } = useKeyboardVisible();
	const { scrollRef, scrollProps, registerField, scrollToField, scrollToFirstError } = useFormScroll();

	const dismissActiveInputs = () => {
		companyNameRef.current?.blur();
		designationRef.current?.blur();
		Keyboard.dismiss();
	};

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

	const LANGUAGE_TO_ISO: Record<string, string> = {
		english: "en",
		hindi: "hi",
		marathi: "mr",
		gujarati: "gu",
		bengali: "bn",
		tamil: "ta",
		telugu: "te",
		kannada: "kn",
		malayalam: "ml",
	};

	const ISO_TO_LANGUAGE: Record<string, string> = Object.entries(LANGUAGE_TO_ISO).reduce(
		(acc, [lang, code]) => {
			acc[code] = lang;
			return acc;
		},
		{} as Record<string, string>,
	);

	const defaultLoanPurposeOptions: SelectOption[] = [
		{ label: t("purposeMedicalEmergency", "Medical / Emergency"), value: "medical_emergency" },
		{ label: t("purposeEducation", "Education / Fees"), value: "education" },
		{ label: t("purposeHomeRepair", "Home repair / Renovation"), value: "home_repair" },
		{ label: t("purposeWeddingFunction", "Wedding / Family function"), value: "wedding_function" },
		{ label: t("purposeTravel", "Travel"), value: "travel" },
		{ label: t("purposeBusinessNeeds", "Business needs"), value: "business_needs" },
		{ label: t("purposeDebtRepayment", "Repay existing loans"), value: "debt_repayment" },
		{ label: t("purposeVehicle", "Vehicle purchase / repair"), value: "vehicle" },
		{ label: t("purposeHousehold", "Household expenses / purchases"), value: "household" },
		{ label: t("purposeOther", "Other"), value: "other" },
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
		reasonForLoan: "",
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
		reasonForLoan: "",
		preferredLanguage: "",
	});

	const [fetchingDetails, setFetchingDetails] = useState(false);
	const [backendLanguages, setBackendLanguages] = useState<string[]>([]);
	const [backendLoanPurposes, setBackendLoanPurposes] = useState<Array<{ value: string; label: string }>>([]);

	const languageOptions: SelectOption[] =
		backendLanguages.length > 0
			? backendLanguages.map((lang) => ({
				label: lang.charAt(0).toUpperCase() + lang.slice(1),
				value: lang.toLowerCase(),
			}))
			: defaultLanguages;

	const loanPurposeOptions: SelectOption[] =
		backendLoanPurposes.length > 0
			? backendLoanPurposes.map((p) => ({
				label: p.label || p.value,
				value: p.value,
			}))
			: defaultLoanPurposeOptions;

	const { applicantFrom } = useAuth();
	const { runStep } = useJourneyLoader();

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
		getProfessionalDetailsWithMeta()
			.then((response) => {
				const options = response?.options;
				if (options?.languages && Array.isArray(options.languages) && options.languages.length > 0) {
					setBackendLanguages(options.languages);
				}
				if (options?.reason_for_loan && Array.isArray(options.reason_for_loan)) {
					setBackendLoanPurposes(options.reason_for_loan);
				}
				const data = response?.data;
				if (data) {
					const normalize = (val: string | null | undefined) => (val ? val.replace(/-/g, "_") : "");
					const rawLang = data.kfs_language;
					const mappedLang = (rawLang && ISO_TO_LANGUAGE[rawLang.toLowerCase()])
						? ISO_TO_LANGUAGE[rawLang.toLowerCase()]
						: (rawLang ? rawLang.toLowerCase() : "");

					setFormData((prev) => ({
						...prev,
						employmentType: (normalize(data.employment_type) || prev.employmentType) as any,
						companyType: normalize(data.type_of_company) || prev.companyType,
						companyName: data.company_name || prev.companyName,
						designation: data.designation || prev.designation,
						incomeRange: normalize(data.salary_range) || prev.incomeRange,
						residenceStatus: normalize(data.residence_status) || prev.residenceStatus,
						natureOfBusiness: normalize(data.nature_of_business) || prev.natureOfBusiness,
						typeOfIndustry: normalize(data.type_of_industry) || prev.typeOfIndustry,
						modeOfSalary: normalize(data.mode_of_salary) || prev.modeOfSalary,
						reasonForLoan: normalize(data.reason_for_loan) || prev.reasonForLoan,
						preferredLanguage: mappedLang || prev.preferredLanguage,
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
		setIsExitModalVisible(true);
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
	const validateForm = () => {
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
			reasonForLoan: "",
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

		if (!formData.reasonForLoan) {
			newErrors.reasonForLoan = t("pleaseSelectPurposeOfLoan", "Please select the purpose of loan");
		}

		if (!formData.preferredLanguage) {
			newErrors.preferredLanguage = t("preferredLanguageRequired", "Preferred language is required");
		}

		setErrors(newErrors);
		const isValid = Object.values(newErrors).every((error) => error === "");
		return { isValid, errors: newErrors };
	};

	const { mutate: submitProfessionalDetailsMutation, isPending } = useNetworkAwareMutation({
		mutationFn: submitProfessionalDetails,
		onSuccess: async () => {
			await runStep("professional_details", async () => {
				Toast.show({
					type: "success",
					text1: t("employmentDetailsSubmittedSuccessfully", "Details submitted successfully"),
					text2: t("proceedingToNextStep", "Proceeding to next step"),
				});
			});

			router.replace("/professional-details-success");
		},
		onError: (err: any) => {
			const status = err?.status ?? err?.response?.status;
			const detail = err?.detail ?? err?.response?.data?.detail ?? err?.message ?? "";
			const detailStr = typeof detail === "string" ? detail : JSON.stringify(detail);

			if (status === 409) {
				if (detailStr.includes("No active loan workflow")) {
					Toast.show({
						type: "error",
						text1: detailStr,
					});
					router.replace("/(tabs)");
					return;
				}
				if (detailStr.includes("Eligibility checks not completed")) {
					router.replace({
						pathname: "/new-assessment-fee",
						params: { resumeChecks: "true" },
					});
					return;
				}
			}

			Toast.show({
				type: "error",
				text1: t("failedToSubmitEmploymentDetails", "Failed to submit details"),
				text2: detailStr || t("pleaseRetryPayment", "Please try again"),
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
		const { isValid, errors: validationErrors } = validateForm();
		if (!isValid) {
			const orderedKeys =
				formData.employmentType === "salaried"
					? [
							"residenceStatus",
							"employmentType",
							"companyType",
							"companyName",
							"designation",
							"incomeRange",
							"modeOfSalary",
							"reasonForLoan",
							"preferredLanguage",
					  ]
					: [
							"residenceStatus",
							"employmentType",
							"natureOfBusiness",
							"typeOfIndustry",
							"incomeRange",
							"reasonForLoan",
							"preferredLanguage",
					  ];

			scrollToFirstError(validationErrors, orderedKeys, {
				companyName: companyNameRef,
				designation: designationRef,
			});
			return;
		}

		const apiData: ProfessionalDetailsPayload = {
			employmentType: formData.employmentType,
			residenceStatus: formData.residenceStatus,
			typeOfCompany: formData.employmentType === "salaried" ? (formData.companyType || undefined) : undefined,
			companyName: formData.employmentType === "salaried" ? (formData.companyName || undefined) : undefined,
			designation: formData.employmentType === "salaried" ? (formData.designation || undefined) : undefined,
			salaryRange: formData.incomeRange,
			modeOfSalary: formData.employmentType === "salaried" ? (formData.modeOfSalary || undefined) : undefined,
			natureOfBusiness: formData.employmentType === "self_employed" ? (formData.natureOfBusiness || undefined) : undefined,
			// WORKAROUND (F7): Send full lowercase language name until backend F-B2 is deployed
			kfsLanguage: formData.preferredLanguage.toLowerCase() || "english",
			reasonForLoan: formData.reasonForLoan,
		};

		submitProfessionalDetailsMutation(apiData);
	};

	if (fetchingDetails) {
		return (
			<View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
				<ActivityIndicator size="large" color="#1F2937" />
			</View>
		);
	}

	return (
		<>
			<KeyboardAvoidingView
				style={styles.container}
				behavior={Platform.OS === "ios" ? "padding" : undefined}
				keyboardVerticalOffset={0}>
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
					ref={scrollRef}
					{...scrollProps}
					style={styles.scrollView}
					contentContainerStyle={[
						styles.scrollContent,
						{
							paddingBottom: isKeyboardVisible
								? (keyboardHeight > 0 ? keyboardHeight : 320) + 40
								: Math.max(insets.bottom + 14, 28) + 24,
						},
					]}
					showsVerticalScrollIndicator={false}>

					{/* 1. Residence Status */}
					<View {...registerField("residenceStatus")} style={styles.inputContainer}>
						<Text style={styles.inputLabel}>
							Residence Status<Text style={styles.requiredAsterisk}> *</Text>
						</Text>
						<Select
							options={residenceStatusOptions}
							selectedValue={formData.residenceStatus}
							onSelect={(val) => handleForm("residenceStatus", val as string)}
							placeholder="Select residence status"
							disabled={isPending}
							error={Boolean(errors.residenceStatus)}
						/>
						{errors.residenceStatus ? (
							<Text style={styles.errorText}>{errors.residenceStatus}</Text>
						) : null}
					</View>

					{/* 2. Employment Type */}
					<View {...registerField("employmentType")} style={styles.inputContainer}>
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
							error={Boolean(errors.employmentType)}
						/>
						{errors.employmentType ? (
							<Text style={styles.errorText}>{errors.employmentType}</Text>
						) : null}
					</View>

					{/* Salaried Specific Fields */}
					{formData.employmentType === "salaried" && (
						<>
							{/* 3. Type of Company */}
							<View {...registerField("companyType")} style={styles.inputContainer}>
								<Text style={styles.inputLabel}>
									Type of Company<Text style={styles.requiredAsterisk}> *</Text>
								</Text>
								<Select
									options={companyTypeOptions}
									selectedValue={formData.companyType}
									onSelect={(val) => handleForm("companyType", val as string)}
									placeholder="Select company type"
									disabled={isPending}
									error={Boolean(errors.companyType)}
								/>
								{errors.companyType ? (
									<Text style={styles.errorText}>{errors.companyType}</Text>
								) : null}
							</View>

							{/* 4. Company Name */}
							<View {...registerField("companyName", companyNameRef)} style={styles.inputContainer}>
								<Text style={styles.inputLabel}>
									Company Name<Text style={styles.requiredAsterisk}> *</Text>
								</Text>
								<TextInput
									ref={companyNameRef}
									style={[styles.textInput, Boolean(errors.companyName) && styles.textInputError]}
									value={formData.companyName}
									onChangeText={(val) => handleForm("companyName", val)}
									placeholder="Enter company name"
									placeholderTextColor="#A0A0A0"
									autoCapitalize="words"
									blurOnSubmit={false}
									returnKeyType="next"
									onSubmitEditing={() => designationRef.current?.focus()}
									onFocus={() => scrollToField("companyName", companyNameRef)}
								/>
								{errors.companyName ? (
									<Text style={styles.errorText}>{errors.companyName}</Text>
								) : null}
							</View>

							{/* 5. Designation */}
							<View {...registerField("designation", designationRef)} style={styles.inputContainer}>
								<Text style={styles.inputLabel}>
									Designation<Text style={styles.requiredAsterisk}> *</Text>
								</Text>
								<TextInput
									ref={designationRef}
									style={[styles.textInput, Boolean(errors.designation) && styles.textInputError]}
									value={formData.designation}
									onChangeText={(val) => handleForm("designation", val)}
									placeholder="Enter your designation"
									placeholderTextColor="#A0A0A0"
									autoCapitalize="words"
									blurOnSubmit={true}
									returnKeyType="done"
									onSubmitEditing={handleSubmit}
									onFocus={() => scrollToField("designation", designationRef)}
								/>
								{errors.designation ? (
									<Text style={styles.errorText}>{errors.designation}</Text>
								) : null}
							</View>

							{/* 6. Salary Range (Rs.) */}
							<View {...registerField("incomeRange")} style={styles.inputContainer}>
								<Text style={styles.inputLabel}>
									Salary Range  (Rs.)<Text style={styles.requiredAsterisk}> *</Text>
								</Text>
								<Select
									options={incomeRangeOptions}
									selectedValue={formData.incomeRange}
									onSelect={(val) => handleForm("incomeRange", val as string)}
									placeholder="Select income range"
									disabled={isPending}
									error={Boolean(errors.incomeRange)}
								/>
								{errors.incomeRange ? (
									<Text style={styles.errorText}>{errors.incomeRange}</Text>
								) : null}
							</View>

							{/* 7. Mode of Salary */}
							<View {...registerField("modeOfSalary")} style={styles.inputContainer}>
								<Text style={styles.inputLabel}>
									Mode of Salary<Text style={styles.requiredAsterisk}> *</Text>
								</Text>
								<Select
									options={modeOfSalaryOptions}
									selectedValue={formData.modeOfSalary}
									onSelect={(val) => handleForm("modeOfSalary", val as string)}
									placeholder="Select mode of salary"
									disabled={isPending}
									error={Boolean(errors.modeOfSalary)}
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
							<View {...registerField("natureOfBusiness")} style={styles.inputContainer}>
								<Text style={styles.inputLabel}>
									Nature of Business<Text style={styles.requiredAsterisk}> *</Text>
								</Text>
								<Select
									options={natureOfBusinessOptions}
									selectedValue={formData.natureOfBusiness}
									onSelect={(val) => handleForm("natureOfBusiness", val as string)}
									placeholder="Select nature of business"
									disabled={isPending}
									error={Boolean(errors.natureOfBusiness)}
								/>
								{errors.natureOfBusiness ? (
									<Text style={styles.errorText}>{errors.natureOfBusiness}</Text>
								) : null}
							</View>

							{/* 4. Type of Industry */}
							<View {...registerField("typeOfIndustry")} style={styles.inputContainer}>
								<Text style={styles.inputLabel}>
									Type of Industry<Text style={styles.requiredAsterisk}> *</Text>
								</Text>
								<Select
									options={typeOfIndustryOptions}
									selectedValue={formData.typeOfIndustry}
									onSelect={(val) => handleForm("typeOfIndustry", val as string)}
									placeholder="Select type of industry"
									disabled={isPending}
									error={Boolean(errors.typeOfIndustry)}
								/>
								{errors.typeOfIndustry ? (
									<Text style={styles.errorText}>{errors.typeOfIndustry}</Text>
								) : null}
							</View>

							{/* 5. Income (Rs.) */}
							<View {...registerField("incomeRange")} style={styles.inputContainer}>
								<Text style={styles.inputLabel}>
									Income (Rs.)<Text style={styles.requiredAsterisk}> *</Text>
								</Text>
								<Select
									options={incomeRangeOptions}
									selectedValue={formData.incomeRange}
									onSelect={(val) => handleForm("incomeRange", val as string)}
									placeholder="Select income range"
									disabled={isPending}
									error={Boolean(errors.incomeRange)}
								/>
								{errors.incomeRange ? (
									<Text style={styles.errorText}>{errors.incomeRange}</Text>
								) : null}
							</View>
						</>
					)}

					{/* Purpose of Loan (Common to both) */}
					<View {...registerField("reasonForLoan")} style={styles.inputContainer}>
						<Text style={styles.inputLabel}>
							{t("purposeOfLoan", "Purpose of loan")}<Text style={styles.requiredAsterisk}> *</Text>
						</Text>
						<Select
							options={loanPurposeOptions}
							selectedValue={formData.reasonForLoan}
							onSelect={(val) => handleForm("reasonForLoan", val as string)}
							placeholder={t("selectPurposeOfLoan", "Select purpose of loan")}
							title={t("purposeOfLoan", "Purpose of loan")}
							searchable={false}
							disabled={isPending}
							error={Boolean(errors.reasonForLoan)}
						/>
						{errors.reasonForLoan ? (
							<Text style={styles.errorText}>{errors.reasonForLoan}</Text>
						) : null}
					</View>

					{/* Preferred Language (Common to both) */}
					<View {...registerField("preferredLanguage")} style={styles.inputContainer}>
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
							error={Boolean(errors.preferredLanguage)}
						/>
						{errors.preferredLanguage ? (
							<Text style={styles.errorText}>{errors.preferredLanguage}</Text>
						) : null}
					</View>
				</ScrollView>

				{/* Sticky Bottom Pill Button with Shimmer */}
				<StickyFormFooter style={styles.bottomButtonContainer}>
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
				</StickyFormFooter>
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
	textInputError: {
		borderColor: "#d32f2f",
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
