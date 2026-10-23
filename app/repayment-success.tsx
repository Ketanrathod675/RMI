import { dark, primary, white } from "@/constants/Colors";
import { useTranslation } from "@/hooks/useTranslation";
import { checkPaymentStatus } from "@/utils/api";
import { font, height, width } from "@/utils/dimensions";
import { STORAGE_KEYS, removeStorageItem } from "@/utils/storage";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";

type Result = "loading" | "success" | "failure" | "pending";
const terminal = (status: string): Result | null => {
	const value = status.toLowerCase();
	if (["completed", "success", "successful", "paid"].includes(value)) return "success";
	if (["failed", "failure", "cancelled", "canceled", "expired", "rejected"].includes(value)) return "failure";
	return null;
};

export default function RepaymentSuccess() {
	const { t } = useTranslation();
	const params = useLocalSearchParams<{ loanNumber?: string; status?: string; txnid?: string }>();
	const [result, setResult] = useState<Result>("loading");
	const [checking, setChecking] = useState(false);

	const verify = useCallback(async () => {
		setChecking(true);
		try {
			if (!params.txnid) { setResult("pending"); return; }
			const response = await checkPaymentStatus(params.txnid);
			const verifiedResult = response?.data?.reason === "not_started"
				? "failure"
				: terminal(String(response?.data?.status || ""));
			if (!verifiedResult) { setResult("pending"); return; }
			setResult(verifiedResult);
			await removeStorageItem(STORAGE_KEYS["@repayment-status"]);
			await removeStorageItem(STORAGE_KEYS["@repayment-timestamp"]);
			await removeStorageItem(STORAGE_KEYS["@repayment-txnid"]);
		} catch {
			setResult("pending");
		} finally { setChecking(false); }
	}, [params.txnid]);

	useEffect(() => { void verify(); }, [verify]);

	const goHome = () => router.replace("/(tabs)");
	const retry = () => params.loanNumber
		? router.replace({ pathname: "/repayment-options", params: { loanNumber: params.loanNumber } })
		: goHome();

	if (result === "loading") return <View style={styles.container}><ActivityIndicator size="large" color={primary} /><Text style={styles.subtitle}>{t("confirmingPayment" as any, "We are confirming your payment")}</Text></View>;
	if (result === "success") return <View style={styles.container}><View style={styles.successCircle}><Text style={styles.successTick}>✓</Text></View><Text style={styles.title}>{t("paymentSuccessful" as any, "Payment successful")}</Text><Text style={styles.subtitle}>{t("repaymentReceived" as any, "Your repayment has been confirmed.")}</Text><TouchableOpacity style={styles.button} onPress={goHome}><Text style={styles.buttonText}>{t("backToDashboard" as any, "Go to Home")}</Text></TouchableOpacity></View>;
	if (result === "failure") return <View style={styles.container}><View style={styles.failureCircle}><Text style={styles.failureCross}>×</Text></View><Text style={styles.title}>{t("repaymentFailed" as any, "Payment not completed")}</Text><Text style={styles.subtitle}>{t("couldntProcessRepayment" as any, "Your repayment was not completed.")}</Text><TouchableOpacity style={styles.button} onPress={retry}><Text style={styles.buttonText}>{t("retryPayment" as any, "Try again")}</Text></TouchableOpacity><TouchableOpacity style={styles.secondaryButton} onPress={goHome}><Text style={styles.secondaryButtonText}>{t("goToHome" as any, "Go to Home")}</Text></TouchableOpacity></View>;
	return <View style={styles.container}><Text style={styles.title}>{t("confirmingPayment" as any, "We are confirming your payment")}</Text><Text style={styles.subtitle}>{t("repaymentPendingMessage" as any, "Your payment is being confirmed. We will update your loan shortly")}</Text><TouchableOpacity style={styles.button} onPress={() => void verify()} disabled={checking}>{checking ? <ActivityIndicator color={dark} /> : <Text style={styles.buttonText}>{t("checkStatus" as any, "Check status")}</Text>}</TouchableOpacity><TouchableOpacity style={styles.secondaryButton} onPress={goHome}><Text style={styles.secondaryButtonText}>{t("goToHome" as any, "Go to Home")}</Text></TouchableOpacity></View>;
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: white, justifyContent: "center", alignItems: "center", paddingHorizontal: width(6) },
	title: { fontSize: font(2.2), fontWeight: "700", color: dark, textAlign: "center", marginBottom: height(1) },
	subtitle: { fontSize: font(1.8), color: "#6B7280", textAlign: "center", marginVertical: height(2) },
	button: { backgroundColor: primary, paddingVertical: height(2), paddingHorizontal: width(8), borderRadius: width(3), width: "100%", alignItems: "center", justifyContent: "center", marginTop: height(1) },
	buttonText: { color: dark, fontSize: font(1.9), fontWeight: "600" },
	secondaryButton: { paddingVertical: height(2), paddingHorizontal: width(8), borderRadius: width(3), width: "100%", alignItems: "center", marginTop: height(1) },
	secondaryButtonText: { color: dark, fontSize: font(1.9), fontWeight: "600" },
	successCircle: { width: width(20), height: width(20), borderRadius: width(10), backgroundColor: "#E6F6EA", alignItems: "center", justifyContent: "center", marginBottom: height(2) },
	successTick: { color: primary, fontSize: width(10) },
	failureCircle: { width: width(20), height: width(20), borderRadius: width(10), backgroundColor: "#FEE2E2", alignItems: "center", justifyContent: "center", marginBottom: height(3) },
	failureCross: { color: "#EF4444", fontSize: width(10), fontWeight: "bold" },
});
