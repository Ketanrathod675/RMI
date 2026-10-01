import { TermsAndPolicy } from "@/components";
import { dark, dark_primary, primary, white } from "@/constants/Colors";
import { useNotifications } from "@/hooks/useNotifications";
import { usePermissions } from "@/hooks/usePermissions";
import { useSignin } from "@/hooks/useSignin";
import { useTranslation } from "@/hooks/useTranslation";
import { axios, getUserDashboardData, StepHref, URLS } from "@/utils/api";
import { font, height, width } from "@/utils/dimensions";
import { removeStorageItem, setStorageItem, STORAGE_KEYS } from "@/utils/storage";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { router, useNavigation } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
	ActivityIndicator,
	Alert,
	AppState,
	BackHandler,
	ScrollView,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

const PERMISSION_ITEMS = [
	{
		key: "camera",
		icon: <MaterialIcons name="camera-alt" size={24} color="#1E293B" />,
		title: "Camera Permissions",
		desc: "We use your camera to capture KYC documents, selfies, and other verification photos needed for your credit profile.",
	},
	{
		key: "media",
		icon: <MaterialIcons name="image" size={24} color="#1E293B" />,
		title: "Media Storage Permissions",
		desc: "This allows us to save uploaded documents and photos securely so your application stays complete and ready for review.",
	},
	{
		key: "location",
		icon: <MaterialIcons name="location-on" size={24} color="#1E293B" />,
		title: "Location Permissions",
		desc: "Location helps us verify your presence and improve fraud checks while keeping your credit assessment accurate.",
	},
];

export default function RequestPermissions() {
	const { t } = useTranslation();
	const insets = useSafeAreaInsets();
	const [isAgreed, setIsAgreed] = useState(true);
	const [isLoading, setIsLoading] = useState(false);
	const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
	const [showTermsAndConditions, setShowTermsAndConditions] = useState(false);
	const { requestCameraPermission } = usePermissions();
	const {
		requestPermissions: requestNotificationPermissions,
		permissions: notificationPermissions,
	} = useNotifications();
	const { loginResponse, otpVerifyResponse } = useSignin(true);

	const navigation = useNavigation();
	const appState = useRef(AppState.currentState);

	// AppState tracking: detect backgrounding during permission flow
	useEffect(() => {
		const subscription = AppState.addEventListener("change", (nextAppState) => {
			if (appState.current.match(/active/) && nextAppState.match(/inactive|background/)) {
				if (__DEV__) {
					console.log("App backgrounded from permission screen, setting flag");
				}
				const flagData = JSON.stringify({
					active: true,
					timestamp: Date.now(),
				});
				setStorageItem(STORAGE_KEYS["@in-permission-flow"], flagData);
			} else if (appState.current.match(/inactive|background/) && nextAppState === "active") {
				if (__DEV__) {
					console.log("App foregrounded on permission screen");
				}
			}

			appState.current = nextAppState;
		});

		return () => {
			if (__DEV__) {
				console.log("Leaving permission screen, clearing flag");
			}
			removeStorageItem(STORAGE_KEYS["@in-permission-flow"]);
			subscription.remove();
		};
	}, []);

	// Intercept router navigation and hardware back button
	useEffect(() => {
		const unsubscribe = navigation.addListener("beforeRemove", (e: any) => {
			if (["GO_BACK", "POP"].includes(e.data?.action?.type)) {
				e.preventDefault();

				Alert.alert(t("areYouSureGoBack"), t("youWillLoseProgress"), [
					{
						text: t("cancel"),
						style: "cancel",
					},
					{
						text: t("goBack"),
						onPress: () => router.replace("/(tabs)"),
					},
				]);
			}
		});

		const backHandler = BackHandler.addEventListener("hardwareBackPress", () => {
			Alert.alert(t("areYouSureGoBack"), t("youWillLoseProgress"), [
				{
					text: t("cancel"),
					style: "cancel",
				},
				{
					text: t("goBack"),
					onPress: () => router.replace("/(tabs)"),
				},
			]);
			return true;
		});

		return () => {
			unsubscribe();
			backHandler.remove();
		};
	}, [navigation, t]);

	const showSettingsAlert = (permissionName: string) => {
		Alert.alert(
			t("permissionRequired"),
			`${permissionName} ${t("permissionIsRequiredToContinue")}`,
			[
				{
					text: t("cancel"),
					style: "cancel",
				},
				{
					text: t("openSettings"),
					onPress: () => Linking.openSettings(),
				},
			],
		);
	};

	const handleProceed = async () => {
		if (!isAgreed) {
			Toast.show({ type: "error", text1: t("pleaseAgreeToContinue") });
			return;
		}

		setIsLoading(true);

		// Step 1: Call mark-consent-permission API
		try {
			if (__DEV__) {
				console.log("🚀 Calling POST /workflow/mark-consent-permission");
			}
			const response = await axios.post(URLS.workflow.start_consent_permission);
			if (__DEV__) {
				console.log("✅ Consent API Response status:", response.status);
			}
		} catch (error: any) {
			if (__DEV__) {
				console.warn("⚠️ [Consent] mark-consent-permission not available on backend (non-fatal):", error?.message);
			}
		}

		// Step 2: Call mark_permissions API
		try {
			if (__DEV__) {
				console.log("🚀 Calling POST /users/permissions");
			}
			const permResponse = await axios.post(URLS.user.mark_permissions);
			if (__DEV__) {
				console.log("✅ Permissions API Response status:", permResponse.status);
			}
		} catch (error: any) {
			if (__DEV__) {
				console.warn("⚠️ [Permissions] mark_permissions not available on backend (non-fatal):", error?.message);
			}
		}

		// Step 3: Request Camera Permission
		const grantedCamera = await requestCameraPermission();
		if (!grantedCamera) {
			setIsLoading(false);
			showSettingsAlert(t("cameraPermissions"));
			return;
		}

		// Step 4: Request Notification Permission
		const grantedNotifications = await requestNotificationPermissions();
		if (!grantedNotifications) {
			if (notificationPermissions?.canAskAgain === false) {
				setIsLoading(false);
				showSettingsAlert(t("notifications"));
				return;
			}
		}

		// Step 5: Determine next screen dynamically from login signal or Dashboard data
		const verifyOtpData = (otpVerifyResponse as any) || (loginResponse as any);
		if (verifyOtpData?.next_step === "dashboard" || verifyOtpData?.is_profile_completed === true) {
			if (__DEV__) {
				console.log("🎯 [request-permissions] Verified user profile completed -> routing to /(tabs)");
			}
			setIsLoading(false);
			router.replace("/(tabs)");
			return;
		}

		if (verifyOtpData?.next_step === "basic_details" || verifyOtpData?.is_profile_completed === false) {
			if (__DEV__) {
				console.log("🎯 [request-permissions] New user / profile incomplete -> routing to /loan-application");
			}
			setIsLoading(false);
			router.replace("/loan-application" as any);
			return;
		}

		try {
			if (__DEV__) {
				console.log("🔄 Fetching dashboard data to determine next step...");
			}
			const dashboardData = await getUserDashboardData();
			const currentStep = dashboardData?.workflow_progress?.current_step;
			const dashboardType = dashboardData?.dashboard_type;

			if (__DEV__) {
				console.log("📊 Dashboard State:", {
					currentStep,
					dashboardType,
				});
				console.log("🔍 [FOWS-DIAG][request-permissions] Full loginResponse at check time:", JSON.stringify(loginResponse));
				console.log("🔍 [FOWS-DIAG][request-permissions] loginResponse?.user_exists:", loginResponse?.user_exists);
			}

			setIsLoading(false);

			// 1. If user has active loan dashboard
			if (dashboardType === "loan_dashboard") {
				if (__DEV__) {
					console.log("🎯 [FOWS-DIAG][request-permissions] BRANCH 1 HIT: dashboardType === 'loan_dashboard' -> router.replace('/(tabs)')");
				}
				router.replace("/(tabs)");
				return;
			}

			// 2. If user is an existing user
			if (loginResponse?.user_exists) {
				if (__DEV__) {
					console.log("🎯 [FOWS-DIAG][request-permissions] BRANCH 2 HIT: loginResponse?.user_exists is TRUE -> router.replace('/(tabs)')");
				}
				router.replace("/(tabs)");
				return;
			}

			// 3. If user is in workflow, navigate to specific step
			if (currentStep && StepHref[currentStep as keyof typeof StepHref]) {
				const targetPath = StepHref[currentStep as keyof typeof StepHref];
				if (__DEV__) {
					console.log(`🎯 [FOWS-DIAG][request-permissions] BRANCH 3 HIT: currentStep '${currentStep}' -> targetPath '${targetPath}'`);
				}
				if (currentStep === "digilocker") {
					router.replace({
						pathname: "/aadhaar-kyc",
						params: { nextStep: "digilocker" },
					} as any);
				} else {
					router.replace(targetPath as any);
				}
				return;
			}

			// Fallback: Default to loan-application (Personal Details)
			if (__DEV__) {
				console.log("🎯 [FOWS-DIAG][request-permissions] BRANCH 4 (FALLBACK) HIT: router.replace('/loan-application')");
			}
			router.replace("/loan-application" as any);
		} catch (dashError) {
			if (__DEV__) {
				console.warn("⚠️ [FOWS-DIAG][request-permissions] CATCH BLOCK HIT: Error fetching dashboard data:", dashError, "-> router.replace('/loan-application')");
			}
			setIsLoading(false);
			router.replace("/loan-application" as any);
		}
	};

	return (
		<View style={styles.container}>
			{/* Top Header Section */}
			<View style={[styles.headerSection, { paddingTop: insets.top + height(1.5) }]}>
				<View style={styles.headerTitleRow}>
					<View style={styles.shieldIconContainer}>
						<Ionicons name="shield-outline" size={24} color="#059669" />
					</View>
					<Text style={styles.headerTitle}>Permissions</Text>
				</View>
				<Text style={styles.headerSubtitle}>
					We need a few permissions to build your credit profile and speed up loan disbursal. Your data stays safe and secure.
				</Text>
			</View>

			<View style={styles.headerDivider} />

			<ScrollView
				style={styles.scrollContainer}
				contentContainerStyle={[
					styles.scrollContent,
					{ paddingBottom: Math.max(insets.bottom + height(1), height(2.5)) },
				]}
				showsVerticalScrollIndicator={false}>
				{/* 3 Permission Cards */}
				<View style={styles.cardsContainer}>
					{PERMISSION_ITEMS.map((item) => (
						<View style={styles.card} key={item.key}>
							<View style={styles.cardHeader}>
								<View style={styles.cardIconBox}>{item.icon}</View>
								<Text style={styles.cardTitle}>{item.title}</Text>
							</View>
							<Text style={styles.cardDesc}>{item.desc}</Text>
						</View>
					))}
				</View>

				{/* Bottom Actions Section anchored to the bottom */}
				<View style={styles.bottomSection}>
					{/* Agreement Consent Section */}
					<View style={styles.agreementSection}>
						<TouchableOpacity
							style={styles.checkboxContainer}
							onPress={() => setIsAgreed(!isAgreed)}
							activeOpacity={0.8}>
							<View style={[styles.checkbox, isAgreed && styles.checkboxChecked]}>
								{isAgreed && <MaterialIcons name="check" size={16} color={white} />}
							</View>
						</TouchableOpacity>
						<View style={styles.agreementTextContainer}>
							<Text style={styles.agreementText}>
								By continuing, you agree to our{" "}
								<Text
									style={styles.linkText}
									onPress={() => setShowPrivacyPolicy(true)}>
									Privacy Policy
								</Text>{" "}
								and{" "}
								<Text
									style={styles.linkText}
									onPress={() => setShowTermsAndConditions(true)}>
									Terms & Conditions
								</Text>
								. You also authorize us to retrieve your{" "}
								<Text style={styles.boldText}>credit report</Text> and communicate with you via phone, Emails, SMS, WhatsApp etc.
							</Text>
						</View>
					</View>

					{/* Action Button: I agree */}
					<TouchableOpacity
						style={[styles.button, (!isAgreed || isLoading) && styles.buttonDisabled]}
						onPress={handleProceed}
						disabled={!isAgreed || isLoading}>
						{isLoading ? (
							<ActivityIndicator size="small" color="#1E293B" />
						) : (
							<Text style={styles.buttonText}>I agree</Text>
						)}
					</TouchableOpacity>
				</View>
			</ScrollView>

			{/* Privacy Policy Modal */}
			<TermsAndPolicy
				displayType="policy"
				showModal={showPrivacyPolicy}
				setShowModal={setShowPrivacyPolicy}
			/>

			{/* Terms and Conditions Modal */}
			<TermsAndPolicy
				displayType="terms"
				showModal={showTermsAndConditions}
				setShowModal={setShowTermsAndConditions}
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: white,
	},
	headerSection: {
		paddingHorizontal: width(6),
		paddingBottom: height(2),
		backgroundColor: white,
	},
	headerTitleRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 14,
	},
	shieldIconContainer: {
		width: 44,
		height: 44,
		borderRadius: 12,
		backgroundColor: "#ECFDF5",
		alignItems: "center",
		justifyContent: "center",
	},
	headerTitle: {
		fontSize: font(2.8),
		fontWeight: "700",
		color: "#1E293B",
	},
	headerSubtitle: {
		fontSize: font(1.45),
		color: "#64748B",
		lineHeight: font(2.1),
		marginTop: height(1.5),
	},
	headerDivider: {
		height: 1,
		backgroundColor: "#F1F5F9",
	},
	scrollContainer: {
		flex: 1,
		backgroundColor: "#F8FAFC",
	},
	scrollContent: {
		flexGrow: 1,
		justifyContent: "space-between",
		paddingHorizontal: width(5),
		paddingTop: height(2),
	},
	cardsContainer: {
		gap: height(2.0),
	},
	card: {
		backgroundColor: white,
		borderRadius: 18,
		paddingHorizontal: width(5),
		paddingVertical: height(2.6),
		borderWidth: 1,
		borderColor: "#E2E8F0",
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.04,
		shadowRadius: 6,
		elevation: 1.5,
	},
	cardHeader: {
		flexDirection: "row",
		alignItems: "center",
		gap: 14,
		marginBottom: height(1.2),
	},
	cardIconBox: {
		width: 48,
		height: 48,
		borderRadius: 14,
		backgroundColor: "#B2FA3F",
		alignItems: "center",
		justifyContent: "center",
	},
	cardTitle: {
		fontSize: font(1.95),
		fontWeight: "700",
		color: "#1E293B",
		flex: 1,
	},
	cardDesc: {
		fontSize: font(1.4),
		color: "#64748B",
		lineHeight: font(2.1),
	},
	bottomSection: {
		width: "100%",
		paddingTop: height(2),
	},
	agreementSection: {
		marginBottom: height(2),
		flexDirection: "row",
		alignItems: "flex-start",
		paddingHorizontal: width(1),
	},
	checkboxContainer: {
		marginRight: width(3),
		marginTop: 2,
	},
	checkbox: {
		width: 22,
		height: 22,
		borderWidth: 1.5,
		borderColor: "#CBD5E1",
		borderRadius: 5,
		backgroundColor: white,
		alignItems: "center",
		justifyContent: "center",
	},
	checkboxChecked: {
		backgroundColor: "#059669",
		borderColor: "#059669",
	},
	agreementTextContainer: {
		flex: 1,
	},
	agreementText: {
		fontSize: font(1.35),
		color: "#64748B",
		lineHeight: font(1.95),
	},
	linkText: {
		color: "#1E293B",
		textDecorationLine: "underline",
		fontWeight: "600",
	},
	boldText: {
		color: "#1E293B",
		fontWeight: "700",
	},
	button: {
		backgroundColor: "#B2FA3F",
		borderRadius: 16,
		height: 54,
		alignItems: "center",
		justifyContent: "center",
		width: "100%",
		shadowColor: "#B2FA3F",
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.25,
		shadowRadius: 8,
		elevation: 2,
	},
	buttonDisabled: {
		backgroundColor: "#E2E8F0",
		shadowOpacity: 0,
	},
	buttonText: {
		color: "#1E293B",
		fontSize: font(1.9),
		fontWeight: "700",
	},
});
