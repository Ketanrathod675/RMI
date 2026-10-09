import { TranslatedText } from "@/components/TranslatedText";
import { dark, primary, white } from "@/constants/Colors";
import { Images } from "@/constants/images";
import { useJourneyTracker } from "@/hooks/useJourneyTracker";
import { useTranslation } from "@/hooks/useTranslation";
import { completeDigilocker, initDigilocker } from "@/utils/api";
import { font, height, width } from "@/utils/dimensions";
import Logger from "@/utils/logger";
import { getStorageItem, removeStorageItem, setStorageItem, STORAGE_KEYS } from "@/utils/storage";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useEffect, useState } from "react";
import {
	ActivityIndicator,
	Alert,
	BackHandler,
	Image,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

export default function DigilockerKyc() {
	const { t } = useTranslation();
	const router = useRouter();
	const queryClient = useQueryClient();
	useJourneyTracker("/digilocker-kyc");

	const [isLoading, setIsLoading] = useState(false);
	const [devTxnId, setDevTxnId] = useState<string | null>(null);

	useEffect(() => {
		const backHandler = BackHandler.addEventListener("hardwareBackPress", () => {
			router.replace("/(tabs)");
			return true;
		});
		return () => backHandler.remove();
	}, [router]);

	const handleStartDigilocker = async () => {
		setIsLoading(true);
		try {
			const redirectUrl = Linking.createURL("aadhaar-kyc-redirect");
			Logger.info("Initiating DigiLocker KYC flow");

			const res = await initDigilocker({ redirect_url: redirectUrl });

			if (!res.success || !res.data?.txn_id) {
				Toast.show({
					type: "error",
					text1: t("alert", "Alert"),
					text2: res.message || t("digilockerFailed", "DigiLocker verification failed"),
				});
				setIsLoading(false);
				return;
			}

			const txnId = res.data.txn_id;
			await setStorageItem(STORAGE_KEYS["@digilocker-txn-id"], txnId);
			if (__DEV__) {
				setDevTxnId(txnId);
			}

			const authUrl = res.data.authorize_url;
			if (!authUrl) {
				Toast.show({
					type: "error",
					text1: t("alert", "Alert"),
					text2: "Authorization URL not provided",
				});
				setIsLoading(false);
				return;
			}

			// Open web authentication session
			const authResult = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
			Logger.debug("DigiLocker auth session finished", { type: authResult.type });

			// If user cancelled / dismissed, stay on screen cleanly
			if (authResult.type === "cancel" || authResult.type === "dismiss") {
				setIsLoading(false);
				return;
			}

			if (authResult.type === "success" && authResult.url) {
				// Complete flow directly if URL returned to browser session
				handleCompleteWithTxnId(txnId);
			}
		} catch (error: any) {
			Logger.error("Failed to initialize DigiLocker:", error);
			Toast.show({
				type: "error",
				text1: t("alert", "Alert"),
				text2: error?.detail || error?.message || t("digilockerFailed", "DigiLocker verification failed"),
			});
		} finally {
			setIsLoading(false);
		}
	};

	const handleCompleteWithTxnId = async (txnId: string) => {
		setIsLoading(true);
		try {
			const completeRes = await completeDigilocker({ txn_id: txnId });
			await removeStorageItem(STORAGE_KEYS["@digilocker-txn-id"]);

			if (completeRes.success) {
				queryClient.invalidateQueries({ queryKey: ["user", "dashboard"] });
				router.replace({
					pathname: "/ckyc-instructions",
					params: { startSelfie: "true", fromDigilocker: "true" },
				});
			} else {
				Alert.alert(
					t("alert", "Alert"),
					completeRes.message || t("digilockerFailed", "DigiLocker verification failed"),
					[{ text: t("tryAgain", "Try Again") }]
				);
			}
		} catch (err: any) {
			Alert.alert(
				t("alert", "Alert"),
				err?.detail || err?.message || t("digilockerFailed", "DigiLocker verification failed"),
				[{ text: t("tryAgain", "Try Again") }]
			);
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<SafeAreaView style={styles.safeContainer}>
			{/* Top Bar */}
			<View style={styles.header}>
				<TouchableOpacity
					onPress={() => router.replace("/(tabs)")}
					style={styles.backButton}
					hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
				>
					<Feather name="arrow-left" size={24} color={dark} />
				</TouchableOpacity>
				<TranslatedText style={styles.headerTitle} translationKey="digilockerKycTitle" />
			</View>

			<View style={styles.contentContainer}>
				<View style={styles.iconCircle}>
					<Ionicons name="shield-checkmark" size={60} color={primary} />
				</View>

				<TranslatedText style={styles.title} translationKey="digilockerKycTitle" />
				<TranslatedText style={styles.subtitle} translationKey="digilockerKycSubtitle" />

				<View style={styles.infoCard}>
					<Feather name="info" size={20} color={primary} style={{ marginTop: 2 }} />
					<TranslatedText style={styles.infoText} translationKey="digilockerWhyText" />
				</View>

				<View style={styles.spacer} />

				{__DEV__ && devTxnId ? (
					<TouchableOpacity
						style={styles.devSimulateBtn}
						onPress={() => handleCompleteWithTxnId(devTxnId)}
						disabled={isLoading}
					>
						<Text style={styles.devSimulateText}>🛠️ [DEV] Simulate DigiLocker success</Text>
					</TouchableOpacity>
				) : null}

				<TouchableOpacity
					style={[styles.continueButton, isLoading && styles.buttonDisabled]}
					onPress={handleStartDigilocker}
					disabled={isLoading}
					activeOpacity={0.85}
				>
					{isLoading ? (
						<ActivityIndicator size="small" color={dark} />
					) : (
						<TranslatedText style={styles.buttonText} translationKey="digilockerContinueBtn" />
					)}
				</TouchableOpacity>
			</View>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	safeContainer: {
		flex: 1,
		backgroundColor: white,
	},
	header: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: width(5),
		paddingVertical: height(2),
		borderBottomWidth: 1,
		borderBottomColor: "#F1F5F9",
	},
	backButton: {
		padding: 4,
		marginRight: 12,
	},
	headerTitle: {
		fontSize: font(2),
		fontWeight: "600",
		color: dark,
	},
	contentContainer: {
		flex: 1,
		paddingHorizontal: width(6),
		paddingTop: height(4),
		paddingBottom: height(4),
		alignItems: "center",
	},
	iconCircle: {
		width: 100,
		height: 100,
		borderRadius: 50,
		backgroundColor: "#FFFBEB",
		justifyContent: "center",
		alignItems: "center",
		marginBottom: height(3),
	},
	title: {
		fontSize: font(2.4),
		fontWeight: "700",
		color: dark,
		textAlign: "center",
		marginBottom: height(1),
	},
	subtitle: {
		fontSize: font(1.6),
		color: "#64748B",
		textAlign: "center",
		lineHeight: 22,
		marginBottom: height(3),
	},
	infoCard: {
		flexDirection: "row",
		backgroundColor: "#F8FAFC",
		borderRadius: 12,
		padding: 16,
		gap: 12,
		borderWidth: 1,
		borderColor: "#E2E8F0",
		width: "100%",
	},
	infoText: {
		flex: 1,
		fontSize: font(1.4),
		color: "#475569",
		lineHeight: 20,
	},
	spacer: {
		flex: 1,
	},
	devSimulateBtn: {
		width: "100%",
		paddingVertical: 12,
		backgroundColor: "#FEF3C7",
		borderRadius: 10,
		borderWidth: 1,
		borderColor: "#F59E0B",
		alignItems: "center",
		marginBottom: 12,
	},
	devSimulateText: {
		color: "#B45309",
		fontSize: font(1.4),
		fontWeight: "600",
	},
	continueButton: {
		width: "100%",
		backgroundColor: primary,
		paddingVertical: height(2),
		borderRadius: 14,
		alignItems: "center",
		justifyContent: "center",
		elevation: 2,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.1,
		shadowRadius: 4,
	},
	buttonDisabled: {
		opacity: 0.6,
	},
	buttonText: {
		fontSize: font(1.8),
		fontWeight: "700",
		color: dark,
	},
});
