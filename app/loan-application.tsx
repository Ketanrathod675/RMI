import { DateInput, Select, type SelectOption } from "@/components";
import TranslatedInput from "@/components/TranslatedInput";
import { TranslatedText } from "@/components/TranslatedText";
import { dark, dark_primary, primary, white } from "@/constants/Colors";
import { useAuth } from "@/hooks/useAuth";
import { useJourneyTracker } from "@/hooks/useJourneyTracker";
import { useNetworkAwareMutation } from "@/hooks/useNetworkAwareMutation";
import { useNetworkAwareQuery } from "@/hooks/useNetworkAwareQuery";
import { useTranslation } from "@/hooks/useTranslation";
import {
	errorHandler,
	updateBasicDetails,
	type BasicDetailsPayload,
} from "@/utils/api";
import { font, height, width } from "@/utils/dimensions";
import { MaterialIcons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect, useNavigation } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
	ActivityIndicator,
	Alert,
	Animated,
	BackHandler,
	Keyboard,
	KeyboardAvoidingView,
	Modal,
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

const PAN_REGEX = /^[A-Za-z]{5}[0-9]{4}[A-Za-z]{1}$/;

// Only alphabets (upper/lower), spaces, and dot allowed for full name and father's name
const NAME_REGEX = /^[A-Za-z. ]*$/;

// Strict email validation regex
const EMAIL_REGEX = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export default function LoanApplication() {
	const { t } = useTranslation();
	const insets = useSafeAreaInsets();

	// Track this screen in the journey
	useJourneyTracker("/loan-application");

	// Language options
	const languageOptions: SelectOption[] = [
		{ label: t("english", "English"), value: "english" },
		{ label: t("hindi", "Hindi"), value: "hindi" },
		{ label: t("marathi", "Marathi"), value: "marathi" },
		{ label: t("tamil", "Tamil"), value: "tamil" },
		{ label: t("telugu", "Telugu"), value: "telugu" },
		{ label: t("odia", "Odia"), value: "odia" },
		{ label: t("bengali", "Bengali"), value: "bengali" },
		{ label: t("gujarati", "Gujarati"), value: "gujarati" },
		{ label: t("malayalam", "Malayalam"), value: "malayalam" },
		{ label: t("punjabi", "Punjabi"), value: "punjabi" },
		{ label: t("assamese", "Assamese"), value: "assamese" },
	];

	const [formData, setFormData] = useState({
		fullName: "",
		email: "",
		panNumber: "",
		fatherName: "",
		dateOfBirth: undefined as Date | undefined,
		gender: "",
		pincode: "",
		preferredLanguage: "",
	});

	const [fieldErrors, setFieldErrors] = useState({
		fullName: "",
		email: "",
		panNumber: "",
		fatherName: "",
		dateOfBirth: "",
		gender: "",
		pincode: "",
		preferredLanguage: "",
	});

	// OTP Modal States
	const [showOtpModal, setShowOtpModal] = useState(false);
	const [otp, setOtp] = useState(["", "", "", ""]);
	const [resendTimer, setResendTimer] = useState(0);
	const [isEmailVerified, setIsEmailVerified] = useState(false);
	const otpInputRefs = useRef<(TextInput | null)[]>([]);
	const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const modalAnimValue = useRef(new Animated.Value(0)).current;

	const [isPanVerified, setIsPanVerified] = useState(false);

	const navigation = useNavigation();
	const { userId, logout, applicantFrom } = useAuth();

	// LEGACY — old backend, disabled during in-house rebuild
	// HB Partner pre-fill query disabled as endpoint does not exist on RMI_Backend
	/*
	const {
		data: hbPartnerData,
		error: hbDataError,
	} = useNetworkAwareQuery({
		queryKey: ["personal-details-hb-partner"],
		queryFn: getPersonalDetailsHbPartner,
		enabled: applicantFrom === "HB",
		retry: (failureCount: number, error: any) => {
			if (error?.response?.status === 404) return false;
			return failureCount < 2;
		},
	});

	useEffect(() => {
		if (hbPartnerData) {
			setFormData((prev) => ({
				...prev,
				fullName: hbPartnerData.full_name || "",
				fatherName: hbPartnerData.father_name || "",
				email: hbPartnerData.email || "",
				panNumber: hbPartnerData.pan_number || "",
				dateOfBirth: hbPartnerData.date_of_birth ? new Date(hbPartnerData.date_of_birth) : undefined,
				pincode: hbPartnerData.pin_code || "",
				preferredLanguage: hbPartnerData.preferred_language?.toLowerCase() || "",
				gender: hbPartnerData.gender || "",
			}));
		}
	}, [hbPartnerData]);
	*/

	useFocusEffect(
		useCallback(() => {
			// Prevent swipe or navigation.goBack inside router
			const unsubscribe = navigation.addListener("beforeRemove", (e) => {
				if (["GO_BACK", "POP"].includes(e.data.action.type)) {
					e.preventDefault();

					Alert.alert(
						t("areYouSureGoBackLoseProgress", "Are you sure you want to go back?"),
						t("youWillLoseYourProgress", "You will lose your progress."),
						[
							{
								text: t("cancel", "Cancel"),
								style: "cancel",
							},
							{
								text: t("goBack", "Go Back"),
								onPress: () => router.replace("/(tabs)"),
							},
						]
					);
				}
			});

			// Intercept Android hardware back button
			const backHandler = BackHandler.addEventListener("hardwareBackPress", () => {
				Alert.alert(
					t("areYouSureGoBackLoseProgress", "Are you sure you want to go back?"),
					t("youWillLoseYourProgress", "You will lose your progress."),
					[
						{
							text: t("cancel", "Cancel"),
							style: "cancel",
						},
						{
							text: t("goBack", "Go Back"),
							onPress: () => router.replace("/(tabs)"),
						},
					]
				);
				return true; // prevent default app exit
			});

			return () => {
				unsubscribe();
				backHandler.remove();
			};
		}, [navigation, t])
	);

	// Cleanup timer on unmount
	useEffect(() => {
		return () => {
			if (timerRef.current) {
				clearInterval(timerRef.current);
			}
		};
	}, []);

	// Resend timer effect
	useEffect(() => {
		if (resendTimer > 0) {
			timerRef.current = setInterval(() => {
				setResendTimer((prev) => prev - 1);
			}, 1000);
		}
		return () => {
			if (timerRef.current) {
				clearInterval(timerRef.current);
			}
		};
	}, [resendTimer]);

	// LEGACY — old backend, disabled during in-house rebuild
	// Send Email OTP, Verify Email OTP, and Verify PAN mutations are disabled until in-house backend builds them
	const isSendingOtp = false;
	const isVerifyingOtp = false;
	const isPanVerifying = false;

	const queryClient = useQueryClient();

	const { mutate: submitPersonalDetailsMutation, isPending } = useNetworkAwareMutation({
		mutationFn: updateBasicDetails,
		onSuccess: async (_data) => {
			if (__DEV__) {
				console.log("✅ [Basic Details] Submitted successfully to FastAPI backend");
			}

			Toast.show({
				type: "success",
				text1: t("personalDetailsSubmittedSuccessfully", "Personal Details Submitted"),
				text2: t("proceedingToNextStep", "Proceeding to next step..."),
			});

			queryClient.invalidateQueries({
				queryKey: ["user", "dashboard"],
			});

			// TODO: replace once backend exposes an assessment-fee endpoint
			// For now, pass safe placeholder params without reading them off the response
			router.replace({
				pathname: "/new-assessment-fee",
				params: {
					amount: "0",
					currency: "INR",
					description: "Processing fee for loan application",
					kyc_id: "",
					next_step: "",
					status: "",
					pre_qualified_amount: "25000",
				},
			});
		},
		onError: (err, variables, ctx) => {
			const { error } = errorHandler(err, variables, ctx);
			// Surface backend 400 validation / duplicate conflicts (e.g. duplicate PAN or email)
			const backendErrorDetail =
				(err as any)?.response?.data?.detail ||
				(err as any)?.response?.data?.message ||
				error?.message ||
				t("pleaseRetryPayment", "Please try again");

			Toast.show({
				type: "error",
				text1: t("errorSubmittingPersonalDetails", "Submission Error"),
				text2: typeof backendErrorDetail === "string" ? backendErrorDetail : JSON.stringify(backendErrorDetail),
			});
		},
	});

	const shimmerAnim = useRef(new Animated.Value(0)).current;

	useEffect(() => {
		let loop: Animated.CompositeAnimation;
		if (!isPending && !isSendingOtp) {
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
	}, [isPending, isSendingOtp, shimmerAnim]);

	const handleVerifyPan = (fullName: string, panNumber: string) => {
		if (!fullName.trim()) {
			Toast.show({
				type: "error",
				text1: t("fullNameRequired", "Full name required"),
				text2: t("enterFullNameBeforeVerifyingPAN", "Please enter your full name before verifying PAN"),
			});
			return;
		}

		if (!panNumber.trim()) {
			Toast.show({
				type: "error",
				text1: t("panNumberRequired", "PAN number required"),
				text2: t("enterPANNumberBeforeVerifying", "Please enter PAN number before verifying"),
			});
			return;
		}

		if (!PAN_REGEX.test(panNumber.toUpperCase())) {
			Toast.show({
				type: "error",
				text1: t("invalidPANFormat", "Invalid PAN format"),
				text2: t("enterValidPANNumber", "Please enter a valid PAN number"),
			});
			return;
		}

		// LEGACY — old backend, disabled during in-house rebuild
		// PAN verification will be validated server-side upon basic-details submission
		setIsPanVerified(true);
		Toast.show({
			type: "success",
			text1: t("panValid" as any, "Valid PAN Format"),
			text2: t("panFormatValid" as any, "PAN format verified"),
		});
	};

	const handleInputChange = (field: keyof typeof formData, value: string) => {
		let sanitizedValue = value;

		if (field === "fullName" || field === "fatherName") {
			sanitizedValue = value.replace(/[^A-Za-z. ]/g, "");
		} else if (field === "panNumber") {
			sanitizedValue = value
				.replace(/[^A-Za-z0-9]/g, "")
				.slice(0, 10)
				.toUpperCase();
		} else if (field === "pincode") {
			sanitizedValue = value.replace(/[^0-9]/g, "").slice(0, 6);
		}

		setFormData((prev) => ({
			...prev,
			[field]: sanitizedValue,
		}));

		if (field === "panNumber" && isPanVerified) {
			setIsPanVerified(false);
		}

		if (field === "email" && isEmailVerified) {
			setIsEmailVerified(false);
		}

		if (fieldErrors[field]) {
			setFieldErrors((prev) => ({
				...prev,
				[field]: "",
			}));
		}
	};

	const handleDateChange = (date: Date) => {
		setFormData((prev) => ({
			...prev,
			dateOfBirth: date,
		}));

		if (fieldErrors.dateOfBirth) {
			setFieldErrors((prev) => ({
				...prev,
				dateOfBirth: "",
			}));
		}
	};

	const handleGenderChange = (value: string | number) => {
		setFormData((prev) => ({
			...prev,
			gender: value as string,
		}));

		if (fieldErrors.gender) {
			setFieldErrors((prev) => ({
				...prev,
				gender: "",
			}));
		}
	};

	const handleLanguageChange = (value: string | number) => {
		setFormData((prev) => ({
			...prev,
			preferredLanguage: value as string,
		}));

		if (fieldErrors.preferredLanguage) {
			setFieldErrors((prev) => ({
				...prev,
				preferredLanguage: "",
			}));
		}
	};

	const validateForm = () => {
		const errors = {
			fullName: "",
			email: "",
			panNumber: "",
			fatherName: "",
			dateOfBirth: "",
			gender: "",
			pincode: "",
			preferredLanguage: "",
		};

		let hasErrors = false;

		// Full Name validation
		if (!formData.fullName.trim()) {
			errors.fullName = t("fullNameRequired", "Full name is required");
			hasErrors = true;
		} else if (!NAME_REGEX.test(formData.fullName.trim())) {
			errors.fullName = t("fullNameOnlyAlphabets", "Full name should only contain letters");
			hasErrors = true;
		}

		// Email validation
		if (!formData.email.trim()) {
			errors.email = t("emailRequired", "Email is required");
			hasErrors = true;
		} else {
			const email = formData.email.trim().toLowerCase();

			if (!EMAIL_REGEX.test(email)) {
				errors.email = t("invalidEmail", "Please enter a valid email address");
				hasErrors = true;
			} else if (email.includes("..")) {
				errors.email = t("invalidEmail", "Please enter a valid email address");
				hasErrors = true;
			} else if ((email.match(/@/g) || []).length !== 1) {
				errors.email = t("invalidEmail", "Please enter a valid email address");
				hasErrors = true;
			} else if (/\.(com|org|net|edu|gov|mil|co|io|in)\.\1$/.test(email)) {
				errors.email = t("invalidEmail", "Please enter a valid email address");
				hasErrors = true;
			} else if (!/\.[a-zA-Z]{2,}$/.test(email)) {
				errors.email = t("invalidEmail", "Please enter a valid email address");
				hasErrors = true;
			} else if (email.includes(" ")) {
				errors.email = t("invalidEmail", "Please enter a valid email address");
				hasErrors = true;
			}
		}

		// PAN Number validation
		if (!formData.panNumber.trim()) {
			errors.panNumber = t("panNumberRequired", "PAN number is required");
			hasErrors = true;
		} else if (!PAN_REGEX.test(formData.panNumber.toUpperCase())) {
			errors.panNumber = t("enterValidPANNumber", "Please enter a valid PAN number");
			hasErrors = true;
		}

		// Father's Name validation
		if (!formData.fatherName.trim()) {
			errors.fatherName = t("fatherNameRequired", "Father's name is required");
			hasErrors = true;
		} else if (!NAME_REGEX.test(formData.fatherName.trim())) {
			errors.fatherName = t("fatherNameOnlyAlphabets", "Father's name should only contain letters");
			hasErrors = true;
		}

		// Date of Birth validation
		if (!formData.dateOfBirth) {
			errors.dateOfBirth = t("dateOfBirthRequired", "Date of birth is required");
			hasErrors = true;
		}

		// Gender validation
		if (!formData.gender) {
			errors.gender = t("genderRequired", "Gender is required");
			hasErrors = true;
		}

		// Pincode validation
		if (!formData.pincode.trim()) {
			errors.pincode = t("pincodeRequired", "Pincode is required");
			hasErrors = true;
		} else if (!/^\d{6}$/.test(formData.pincode)) {
			errors.pincode = t("validSixDigitPincode", "Please enter a valid 6-digit pincode");
			hasErrors = true;
		}

		setFieldErrors(errors);
		return !hasErrors;
	};

	const formatDateForAPI = (date: Date): string => {
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, "0");
		const day = String(date.getDate()).padStart(2, "0");
		return `${day}-${month}-${year}`;
	};

	const proceedWithSubmission = () => {
		const apiData: BasicDetailsPayload = {
			full_name: formData.fullName.trim(),
			fathers_name: formData.fatherName.trim(),
			pan_card: formData.panNumber.toUpperCase().trim(),
			date_of_birth: formatDateForAPI(formData.dateOfBirth!),
			gender: formData.gender
				? formData.gender.charAt(0).toUpperCase() + formData.gender.slice(1).toLowerCase()
				: undefined,
			pincode: formData.pincode.trim(),
			email: formData.email.trim(),
			preferred_language: formData.preferredLanguage
				? formData.preferredLanguage.charAt(0).toUpperCase() + formData.preferredLanguage.slice(1).toLowerCase()
				: undefined,
		};

		if (__DEV__) {
			console.log("🚀 [Basic Details] Initiating submission to FastAPI backend...", apiData);
		}

		submitPersonalDetailsMutation(apiData);
	};

	const handleProceed = () => {
		if (!userId) {
			Toast.show({
				type: "error",
				text1: t("authenticationRequired", "Authentication Required"),
				text2: t("pleaseLoginToContinueApplication", "Please login to continue"),
			});
			logout();
			router.replace("/login");
			return;
		}

		const isValid = validateForm();
		if (!isValid) {
			return;
		}

		proceedWithSubmission();
	};

	const handleOtpChange = (text: string, index: number) => {
		const numericText = text.replace(/[^0-9]/g, "");
		const newOtp = [...otp];
		newOtp[index] = numericText;
		setOtp(newOtp);

		if (numericText && index < 3) {
			otpInputRefs.current[index + 1]?.focus();
		} else if (numericText && index === 3) {
			Keyboard.dismiss();
		}
	};

	const handleKeyPress = (e: any, index: number) => {
		if (e.nativeEvent.key === "Backspace") {
			if (otp[index] !== "") {
				const newOtp = [...otp];
				newOtp[index] = "";
				setOtp(newOtp);
			} else if (index > 0) {
				const newOtp = [...otp];
				newOtp[index - 1] = "";
				setOtp(newOtp);

				setTimeout(() => {
					otpInputRefs.current[index - 1]?.focus();
				}, 0);
			}
		}
	};

	const handleVerifyOtp = () => {
		// LEGACY — old backend, disabled during in-house rebuild
		// Email OTP verification is disabled until in-house backend implements email verification
		closeOtpModal();
		proceedWithSubmission();
	};

	const handleResendOtp = () => {
		// LEGACY — old backend, disabled during in-house rebuild
	};

	const closeOtpModal = () => {
		Animated.timing(modalAnimValue, {
			toValue: 0,
			duration: 300,
			useNativeDriver: true,
		}).start(() => {
			setShowOtpModal(false);
			setOtp(["", "", "", ""]);
			setResendTimer(0);
		});
	};

	return (
		<KeyboardAvoidingView
			style={styles.container}
			behavior={Platform.OS === "ios" ? "padding" : "height"}
			keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}>
			<ScrollView
				style={styles.scrollView}
				contentContainerStyle={[
					styles.scrollContent,
					{
						paddingTop: insets.top + height(2),
						paddingBottom: height(14),
					},
				]}
				showsVerticalScrollIndicator={false}
				keyboardShouldPersistTaps="handled">
				{/* Header Section */}
				<View style={styles.headerSection}>
					<TranslatedText style={styles.title} translationKey="loanApplication" />
				</View>

				{/* Form Section */}
				<View style={styles.formSection}>
					<TranslatedInput
						labelKey="fullName"
						placeholderKey="enterFullName"
						value={formData.fullName}
						onChangeText={(value) => handleInputChange("fullName", value)}
						containerStyle={styles.inputContainer}
						required={true}
						disabled={isPending || isSendingOtp || (applicantFrom === "HB" && !!formData.fullName)}
					/>
					{fieldErrors.fullName ? (
						<Text style={styles.errorText}>{fieldErrors.fullName}</Text>
					) : null}

					<View style={styles.panInputContainer}>
						<TranslatedInput
							labelKey="panNumber"
							placeholderKey="enterPANNumber"
							value={formData.panNumber}
							onFocus={(e) => {
								if (formData.fullName.length < 3) {
									e.preventDefault();
									Toast.show({
										type: "info",
										text1: t("enterFullName", "Full name required"),
										text2: t("required", "Please enter your full name first"),
									});
								}
							}}
							onChangeText={(value) => handleInputChange("panNumber", value)}
							containerStyle={styles.inputContainer}
							autoCapitalize="characters"
							disabled={
								formData.fullName.length < 3 ||
								isPanVerifying ||
								isPending ||
								isSendingOtp ||
								(applicantFrom === "HB" && !!formData.panNumber)
							}
							required={true}
						/>
						<TouchableOpacity
							style={styles.verifyPanButton}
							onPress={() => handleVerifyPan(formData.fullName, formData.panNumber)}
							disabled={isPanVerifying || formData.fullName.length < 3}>
							{isPanVerifying ? (
								<ActivityIndicator size="small" color="#666" />
							) : isPanVerified ? (
								<MaterialIcons name="check-circle" size={22} color="#4CAF50" />
							) : (
								<MaterialIcons name="verified" size={22} color="#666" />
							)}
						</TouchableOpacity>
						{fieldErrors.panNumber ? (
							<Text style={styles.errorText}>{fieldErrors.panNumber}</Text>
						) : null}
					</View>

					<TranslatedInput
						labelKey="fatherName"
						placeholderKey="enterYourFatherName"
						value={formData.fatherName}
						onChangeText={(value) => handleInputChange("fatherName", value)}
						containerStyle={styles.inputContainer}
						required={true}
						disabled={isPending || isSendingOtp || (applicantFrom === "HB" && !!formData.fatherName)}
					/>
					{fieldErrors.fatherName ? (
						<Text style={styles.errorText}>{fieldErrors.fatherName}</Text>
					) : null}

					<DateInput
						label={t("dateOfBirthPAN", "Date of Birth (as per PAN)")}
						placeholder={t("ddmmyyyy", "DD-MM-YYYY")}
						value={formData.dateOfBirth}
						onChange={handleDateChange}
						maximumDate={new Date()}
						minimumDate={new Date(1900, 0, 1)}
						containerStyle={styles.inputContainer}
						disabled={isPending || isSendingOtp || (applicantFrom === "HB" && !!formData.dateOfBirth)}
						required={true}
					/>
					{fieldErrors.dateOfBirth ? (
						<Text style={styles.errorText}>{fieldErrors.dateOfBirth}</Text>
					) : null}

					<View style={styles.inputContainer}>
						<TranslatedText
							style={styles.inputLabel}
							translationKey="gender"
							required={true}
						/>
						<Select
							options={[
								{ label: t("male", "Male"), value: "male" },
								{ label: t("female", "Female"), value: "female" },
								{ label: t("other", "Other"), value: "other" },
							]}
							selectedValue={formData.gender}
							onSelect={handleGenderChange}
							placeholder={t("selectGender", "Select Gender")}
							containerStyle={styles.selectContainer}
							disabled={isPending || isSendingOtp || (applicantFrom === "HB" && !!formData.gender)}
						/>
						{fieldErrors.gender ? (
							<Text style={styles.errorText}>{fieldErrors.gender}</Text>
						) : null}
					</View>

					<TranslatedInput
						labelKey="emailAddress"
						placeholderKey="enterEmailAddress"
						value={formData.email}
						onChangeText={(value) => handleInputChange("email", value)}
						containerStyle={styles.inputContainer}
						keyboardType="email-address"
						required={true}
						disabled={isPending || isSendingOtp || (applicantFrom === "HB" && !!formData.email)}
					/>
					{fieldErrors.email ? (
						<Text style={styles.errorText}>{fieldErrors.email}</Text>
					) : null}

					<View style={styles.inputContainer}>
						<TranslatedInput
							labelKey="pincode"
							placeholderKey="enterPincode"
							value={formData.pincode}
							onChangeText={(value) => handleInputChange("pincode", value)}
							containerStyle={styles.inputContainer}
							keyboardType="numeric"
							maxLength={6}
							required={true}
							disabled={isPending || isSendingOtp || (applicantFrom === "HB" && !!formData.pincode)}
						/>
						{fieldErrors.pincode ? (
							<Text style={styles.errorText}>{fieldErrors.pincode}</Text>
						) : null}
					</View>
				</View>

				{/* Important Notice */}
				<View style={styles.importantSection}>
					<TranslatedText style={styles.importantTitle} translationKey="important" />
					<TranslatedText
						style={styles.importantText}
						translationKey="panVerificationMessage"
					/>
				</View>
			</ScrollView>

			{/* Sticky Submit Button Container */}
			<View style={[styles.bottomButtonContainer, { paddingBottom: Math.max(insets.bottom + height(1.5), height(3)) }]}>
				<TouchableOpacity
					style={[styles.proceedButton, (isPending || isSendingOtp) && styles.proceedButtonDisabled]}
					onPress={handleProceed}
					disabled={isPending || isSendingOtp}
					activeOpacity={0.8}>
					{!(isPending || isSendingOtp) && (
						<Animated.View
							style={[
								StyleSheet.absoluteFill,
								{
									width: "60%",
									transform: [
										{
											translateX: shimmerAnim.interpolate({
												inputRange: [0, 1],
												outputRange: [-width(60), width(100)],
											}),
										},
									],
								},
							]}>
							<LinearGradient
								colors={[
									"transparent",
									"transparent",
									"rgba(255,255,255,0.2)",
									"rgba(255,255,255,0.3)",
									"rgba(255,255,255,0.5)",
									"transparent",
								]}
								locations={[0, 0.25, 0.45, 0.55, 0.75, 1]}
								start={{ x: 0, y: 0 }}
								end={{ x: 1, y: 0 }}
								style={StyleSheet.absoluteFill}
							/>
						</Animated.View>
					)}

					{isPending || isSendingOtp ? (
						<ActivityIndicator size="small" color="#333" />
					) : (
						<View style={styles.proceedRow}>
							<TranslatedText
								style={styles.proceedButtonText}
								translationKey="proceed"
							/>
							<MaterialIcons name="arrow-forward" size={width(5)} color={dark} />
						</View>
					)}
				</TouchableOpacity>
			</View>

			{/* OTP Modal */}
			<Modal
				visible={showOtpModal}
				transparent={true}
				animationType="none"
				onRequestClose={closeOtpModal}>
				<View style={styles.modalOverlay}>
					<Animated.View
						style={[
							styles.modalContent,
							{
								transform: [
									{
										scale: modalAnimValue.interpolate({
											inputRange: [0, 1],
											outputRange: [0.8, 1],
										}),
									},
								],
								opacity: modalAnimValue,
							},
						]}>
						<View style={styles.modalHeader}>
							<TranslatedText
								style={styles.modalTitle}
								translationKey="verifyEmail"
							/>
							<TouchableOpacity onPress={closeOtpModal} style={styles.closeButton}>
								<MaterialIcons name="close" size={24} color={dark} />
							</TouchableOpacity>
						</View>

						<TranslatedText
							style={styles.modalSubtitle}
							translationKey="enterOTPSent"
						/>
						<Text style={styles.emailText}>{formData.email}</Text>

						<View style={styles.otpContainer}>
							{otp.map((digit, index) => (
								<TextInput
									key={index}
									ref={(ref) => {
										if (ref) otpInputRefs.current[index] = ref;
									}}
									style={styles.otpInput}
									value={digit}
									onChangeText={(text) => handleOtpChange(text, index)}
									onKeyPress={(e) => handleKeyPress(e, index)}
									keyboardType="numeric"
									maxLength={1}
									textAlign="center"
									placeholder=""
									placeholderTextColor="#999"
									autoFocus={index === 0 && showOtpModal}
								/>
							))}
						</View>

						<TouchableOpacity
							style={[styles.verifyButton, isVerifyingOtp && { opacity: 0.7 }]}
							onPress={handleVerifyOtp}
							disabled={isVerifyingOtp}>
							{isVerifyingOtp ? (
								<ActivityIndicator size="small" color="#333" />
							) : (
								<TranslatedText
									style={styles.verifyButtonText}
									translationKey="verifyOTP"
								/>
							)}
						</TouchableOpacity>

						<View style={styles.resendContainer}>
							<TranslatedText
								style={styles.resendText}
								translationKey="didntReceiveOTP"
							/>
							<TouchableOpacity
								onPress={handleResendOtp}
								disabled={resendTimer > 0 || isSendingOtp}>
								<Text
									style={[
										styles.resendLink,
										(resendTimer > 0 || isSendingOtp) && { opacity: 0.5 },
									]}>
									{resendTimer > 0
										? `${t("resend", "Resend")} in ${resendTimer}s`
										: t("resendOTP", "Resend OTP")}
								</Text>
							</TouchableOpacity>
						</View>
					</Animated.View>
				</View>
			</Modal>
		</KeyboardAvoidingView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: white,
	},
	scrollView: {
		flex: 1,
	},
	scrollContent: {
		paddingHorizontal: width(5),
	},
	headerSection: {
		alignItems: "center",
		marginBottom: height(2),
	},
	title: {
		fontSize: font(2.4),
		color: dark,
		fontWeight: "bold",
		textAlign: "center",
		lineHeight: font(3.2),
		marginVertical: height(1),
	},
	formSection: {
		marginBottom: height(3),
	},
	inputContainer: {
		marginVertical: height(0.5),
	},
	inputLabel: {
		color: dark,
		fontSize: font(1.5),
		marginBottom: height(0.5),
		marginLeft: width(1),
	},
	selectContainer: {
		marginBottom: height(1),
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
	proceedButton: {
		backgroundColor: primary,
		borderRadius: width(6),
		paddingVertical: height(2),
		width: "100%",
		alignItems: "center",
		justifyContent: "center",
		overflow: "hidden",
		position: "relative",
		elevation: 3,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.22,
		shadowRadius: 2.22,
	},
	proceedButtonDisabled: {
		opacity: 0.65,
	},
	proceedRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: width(2),
	},
	proceedButtonText: {
		fontSize: font(1.8),
		fontWeight: "bold",
		color: dark,
	},
	bottomButtonContainer: {
		paddingHorizontal: width(5),
		paddingVertical: height(2),
		backgroundColor: white,
		borderTopWidth: 1,
		borderTopColor: "#E5E5E5",
		width: "100%",
	},
	errorText: {
		color: "#d32f2f",
		fontSize: font(1.2),
		marginLeft: width(1),
		marginBottom: height(1),
	},
	panInputContainer: {
		position: "relative",
		marginVertical: height(0.5),
	},
	verifyPanButton: {
		position: "absolute",
		right: width(3),
		top: height(4.2),
		padding: width(1),
		zIndex: 1,
	},
	modalOverlay: {
		flex: 1,
		backgroundColor: "rgba(0, 0, 0, 0.5)",
		justifyContent: "center",
		alignItems: "center",
		padding: width(5),
	},
	modalContent: {
		backgroundColor: white,
		borderRadius: width(4),
		padding: width(6),
		width: "100%",
		maxWidth: width(85),
	},
	modalHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		marginBottom: height(2),
	},
	modalTitle: {
		fontSize: font(2),
		fontWeight: "700",
		color: dark,
	},
	closeButton: {
		padding: width(1),
	},
	modalSubtitle: {
		fontSize: font(1.4),
		color: "#666",
		textAlign: "center",
		marginBottom: height(0.5),
		lineHeight: font(2),
	},
	emailText: {
		fontWeight: "600",
		color: dark_primary,
		textAlign: "center",
		marginVertical: height(0.5),
	},
	otpContainer: {
		flexDirection: "row",
		justifyContent: "center",
		alignItems: "center",
		marginBottom: height(3),
		gap: width(4),
	},
	otpInput: {
		width: width(14),
		height: width(14),
		borderWidth: 2,
		borderColor: primary,
		borderRadius: width(2),
		fontSize: font(2.5),
		fontWeight: "700",
		textAlign: "center",
		color: dark,
		backgroundColor: white,
	},
	verifyButton: {
		backgroundColor: primary,
		borderRadius: width(3),
		paddingVertical: height(1.8),
		alignItems: "center",
		marginBottom: height(2),
	},
	verifyButtonText: {
		fontSize: font(1.6),
		fontWeight: "600",
		color: dark,
	},
	resendContainer: {
		flexDirection: "row",
		justifyContent: "center",
		alignItems: "center",
		gap: width(1),
	},
	resendText: {
		fontSize: font(1.3),
		color: "#666",
	},
	resendLink: {
		fontSize: font(1.3),
		color: dark_primary,
		fontWeight: "600",
	},
});
