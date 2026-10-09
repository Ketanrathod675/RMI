import { useCleanBackHandlers } from "@/hooks/useCleanBackHandlers";
import { useTranslation } from "@/hooks/useTranslation";
import { completeDigilocker } from "@/utils/api";
import { dark, primary, white } from "@/constants/Colors";
import { font, height, width } from "@/utils/dimensions";
import Logger from "@/utils/logger";
import { getStorageItem, removeStorageItem, STORAGE_KEYS } from "@/utils/storage";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
	ActivityIndicator,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function AadhaarKycRedirect() {
	const { t } = useTranslation();
	const queryClient = useQueryClient();
	useCleanBackHandlers();

	const [isLoading, setIsLoading] = useState(true);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const isCompletingRef = useRef(false);

	useEffect(() => {
		const handleCompletion = async () => {
			if (isCompletingRef.current) return;
			isCompletingRef.current = true;

			try {
				const txnId = await getStorageItem(STORAGE_KEYS["@digilocker-txn-id"]);
				if (!txnId) {
					Logger.warn("AadhaarKycRedirect: No stored @digilocker-txn-id found");
					router.replace("/digilocker-kyc" as any);
					return;
				}

				Logger.info("AadhaarKycRedirect: Completing DigiLocker verification");
				const res = await completeDigilocker({ txn_id: txnId });
				await removeStorageItem(STORAGE_KEYS["@digilocker-txn-id"]);

				if (res.success) {
					queryClient.invalidateQueries({ queryKey: ["user", "dashboard"] });
					router.replace({
						pathname: "/ckyc-instructions",
						params: { startSelfie: "true", fromDigilocker: "true" },
					});
				} else {
					setErrorMessage(res.message || t("digilockerFailed", "DigiLocker verification failed"));
					setIsLoading(false);
				}
			} catch (err: any) {
				Logger.error("AadhaarKycRedirect: Failed to complete DigiLocker", err);
				setErrorMessage(err?.detail || err?.message || t("digilockerFailed", "DigiLocker verification failed"));
				setIsLoading(false);
			}
		};

		handleCompletion();
	}, [queryClient, t]);

	if (isLoading) {
		return (
			<SafeAreaView style={styles.container}>
				<ActivityIndicator size="large" color={primary} />
				<Text style={styles.loadingText}>
					{t("verifyingDetails", "Verifying your details...")}
				</Text>
			</SafeAreaView>
		);
	}

	return (
		<SafeAreaView style={styles.container}>
			<View style={styles.card}>
				<Text style={styles.errorTitle}>
					{t("alert", "Alert")}
				</Text>
				<Text style={styles.errorDesc}>
					{errorMessage || t("digilockerFailed", "DigiLocker verification failed")}
				</Text>
				<TouchableOpacity
					style={styles.retryBtn}
					onPress={() => router.replace("/digilocker-kyc" as any)}
				>
					<Text style={styles.retryBtnText}>
						{t("tryAgain", "Try Again")}
					</Text>
				</TouchableOpacity>
			</View>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: white,
		justifyContent: "center",
		alignItems: "center",
		paddingHorizontal: width(6),
	},
	loadingText: {
		marginTop: 16,
		fontSize: font(1.6),
		color: "#64748B",
		fontWeight: "500",
	},
	card: {
		backgroundColor: "#FFFBEB",
		borderRadius: 16,
		padding: 24,
		width: "100%",
		alignItems: "center",
		borderWidth: 1,
		borderColor: "#FDE68A",
	},
	errorTitle: {
		fontSize: font(2),
		fontWeight: "700",
		color: dark,
		marginBottom: 8,
	},
	errorDesc: {
		fontSize: font(1.5),
		color: "#475569",
		textAlign: "center",
		lineHeight: 22,
		marginBottom: 20,
	},
	retryBtn: {
		backgroundColor: primary,
		paddingVertical: 12,
		paddingHorizontal: 24,
		borderRadius: 10,
	},
	retryBtnText: {
		color: dark,
		fontWeight: "700",
		fontSize: font(1.5),
	},
});
