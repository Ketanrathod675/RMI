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
		key: "security",
		icon: <Ionicons name="shield-checkmark-outline" size={22} color="#888888" />,
		title: "Your data is 100 % safe and Secure",
		desc: "To build your comprehensive credit risk assessment and credit profile and facilitate quicker loan disbursal, we require the following permissions from you.",
	},
	{
		key: "camera",
		icon: <Ionicons name="camera-outline" size={22} color="#888888" />,
		title: "Camera Permissions",
		desc: "Required for KYC verification, uploading loan documents and capturing identity verification selfie.",
	},
	{
		key: "media",
		icon: <MaterialIcons name="perm-media" size={22} color="#888888" />,
		title: "Media Storage Permissions",
		desc: "Required to securely upload required KYC documents, bank statements and identity proofs.",
	},
	{
		key: "location",
		icon: <Ionicons name="location-outline" size={22} color="#888888" />,
		title: "Location permissions",
		desc: "Required to verify service availability in your area and prevent fraudulent loan applications.",
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
	const { loginResponse } = useSignin();

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

		try {
			// Step 1: Call mark-consent-permission API
			if (__DEV__) {
				console.log("🚀 Calling POST /workflow/mark-consent-permission");
			}
			const response = await axios.post(URLS.workflow.start_consent_permission);
			if (__DEV__) {
				console.log("✅ Consent API Response status:", response.status);
			}

			// Step 2: Call mark_permissions API
			if (__DEV__) {
				console.log("🚀 Calling POST /users/permissions");
			}
			const permResponse = await axios.post(URLS.user.mark_permissions);
			if (__DEV__) {
				console.log("✅ Permissions API Response status:", permResponse.status);
			}
		} catch (error: any) {
			if (__DEV__) {
				console.error("❌ API Error:", error?.response?.data || error);
			}
			Toast.show({
				type: "error",
				text1: t("error"),
				text2: error?.response?.data?.message || t("somethingWentWrong"),
			});
			setIsLoading(false);
			return;
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

		// Step 5: Determine next screen dynamically from Dashboard data
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
				// [FOWS-DIAGNOSTIC] Log full loginResponse and user_exists at exact moment of check
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
				console.error("❌ [FOWS-DIAG][request-permissions] CATCH BLOCK HIT: Error fetching dashboard data:", dashError, "-> router.replace('/loan-application')");
			}
			setIsLoading(false);
			router.replace("/loan-application" as any);
		}
	};

	return (
		<View style={styles.container}>
			{/* Top Header Bar */}
			<View style={[styles.header, { paddingTop: insets.top + height(1.5) }]}>
				<Text style={styles.headerTitle}>Permissions</Text>
			</View>

			<ScrollView
				style={styles.scrollContainer}
				contentContainerStyle={[
					styles.scrollContent,
					{ paddingBottom: insets.bottom + height(3) },
				]}
				showsVerticalScrollIndicator={false}>
				{/* Permission & Security List */}
				{PERMISSION_ITEMS.map((item) => (
					<View style={styles.itemSection} key={item.key}>
						<View style={styles.itemHeader}>
							<View style={styles.itemIconWrap}>{item.icon}</View>
							<Text style={styles.itemTitle}>{item.title}</Text>
						</View>
						<Text style={styles.itemDesc}>{item.desc}</Text>
						<View style={styles.divider} />
					</View>
				))}

				{/* Agreement Consent Section */}
				<View style={styles.agreementSection}>
					<TouchableOpacity
						style={styles.checkboxContainer}
						onPress={() => setIsAgreed(!isAgreed)}
						activeOpacity={0.8}>
						<View style={[styles.checkbox, isAgreed && styles.checkboxChecked]}>
							{isAgreed && <Text style={styles.checkmark}>✓</Text>}
						</View>
					</TouchableOpacity>
					<View style={styles.agreementTextContainer}>
						<Text style={styles.agreementText}>
							By Continuing, you agree to our{" "}
							<Text
								style={styles.linkText}
								onPress={() => setShowPrivacyPolicy(true)}>
								Privacy Policy
							</Text>{" "}
							, T&C's and authorize us to retrieve your{" "}
							<Text
								style={styles.linkText}
								onPress={() => setShowTermsAndConditions(true)}>
								Credit report and communication
							</Text>{" "}
							with you via phone , Emails, SMS,{" "}
							<Text style={styles.linkText}>WhatsApp</Text> etc.
						</Text>
					</View>
				</View>

				{/* Action Button: I agree */}
				<TouchableOpacity
					style={[styles.button, (!isAgreed || isLoading) && styles.buttonDisabled]}
					onPress={handleProceed}
					disabled={!isAgreed || isLoading}>
					{isLoading ? (
						<ActivityIndicator size="small" color={dark} />
					) : (
						<Text style={styles.buttonText}>I agree</Text>
					)}
				</TouchableOpacity>
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
	header: {
		paddingHorizontal: width(6),
		paddingBottom: height(1.5),
		backgroundColor: white,
		borderBottomWidth: 1,
		borderBottomColor: "#F0F0F0",
	},
	headerTitle: {
		fontSize: font(2.6),
		fontWeight: "700",
		color: dark,
	},
	scrollContainer: {
		flex: 1,
		backgroundColor: white,
	},
	scrollContent: {
		paddingHorizontal: width(6),
		paddingTop: height(2.5),
	},
	itemSection: {
		marginBottom: height(2.5),
	},
	itemHeader: {
		flexDirection: "row",
		alignItems: "center",
		marginBottom: height(0.8),
	},
	itemIconWrap: {
		width: width(8),
		alignItems: "flex-start",
	},
	itemTitle: {
		fontSize: font(1.9),
		fontWeight: "700",
		color: dark,
		flex: 1,
	},
	itemDesc: {
		fontSize: font(1.45),
		color: "#4B5563",
		lineHeight: font(2.1),
		marginTop: height(0.2),
	},
	divider: {
		height: 1,
		backgroundColor: "#F0F0F0",
		marginTop: height(2.5),
	},
	agreementSection: {
		marginTop: height(2),
		marginBottom: height(3.5),
		flexDirection: "row",
		alignItems: "flex-start",
	},
	checkboxContainer: {
		marginRight: width(3),
		marginTop: 2,
	},
	checkbox: {
		width: 20,
		height: 20,
		borderWidth: 1.5,
		borderColor: "#D1D5DB",
		borderRadius: 3,
		backgroundColor: white,
		alignItems: "center",
		justifyContent: "center",
	},
	checkboxChecked: {
		backgroundColor: dark_primary,
		borderColor: dark_primary,
	},
	checkmark: {
		color: white,
		fontSize: font(1.4),
		fontWeight: "bold",
	},
	agreementTextContainer: {
		flex: 1,
	},
	agreementText: {
		fontSize: font(1.35),
		color: "#4B5563",
		lineHeight: font(1.9),
	},
	linkText: {
		color: dark,
		textDecorationLine: "underline",
		fontWeight: "500",
	},
	button: {
		backgroundColor: primary,
		borderRadius: width(7),
		paddingVertical: height(2.1),
		alignItems: "center",
		justifyContent: "center",
		width: "100%",
		shadowColor: primary,
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.3,
		shadowRadius: 6,
		elevation: 3,
	},
	buttonDisabled: {
		backgroundColor: "#E5E7EB",
	},
	buttonText: {
		color: dark,
		fontSize: font(2.1),
		fontWeight: "700",
	},
});
