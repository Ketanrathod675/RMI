import { useCleanBackHandlers } from "@/hooks/useCleanBackHandlers";
import { useTranslation } from "@/hooks/useTranslation";
import { getCkycStatus } from "@/utils/api";
import {
	finishDigilocker,
	loadDigilockerSession,
	type DigilockerFinishResult,
} from "@/utils/digilocker";
import { dark, primary, white } from "@/constants/Colors";
import { font, height, width } from "@/utils/dimensions";
import Logger from "@/utils/logger";
import { useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
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

	const params = useLocalSearchParams<{
		status?: string;
		txn_id?: string;
		txnId?: string;
		transaction_id?: string;
	}>();

	const [isLoading, setIsLoading] = useState(true);
	const [isCheckingAgain, setIsCheckingAgain] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [activeTxnId, setActiveTxnId] = useState<string | null>(null);
	const isCompletingRef = useRef(false);

	const proceedToSelfie = () => {
		queryClient.invalidateQueries({ queryKey: ["user", "dashboard"] });
		router.replace({
			pathname: "/ckyc-instructions",
			params: { startSelfie: "true", fromDigilocker: "true" },
		});
	};

	const handleResult = (res: DigilockerFinishResult) => {
		if (res.status === "done") {
			proceedToSelfie();
			return;
		}

		if (res.status === "pending") {
			router.replace({
				pathname: "/digilocker-kyc",
				params: { showPending: "true" },
			} as any);
			return;
		}

		if (res.status === "restart") {
			router.replace({
				pathname: "/digilocker-kyc",
				params: { autoStart: "true" },
			} as any);
			return;
		}

		// "unavailable" | "retry" | "failed"
		setErrorMessage(res.message || "We couldn't confirm DigiLocker yet. You can try again.");
		setIsLoading(false);
	};

	useEffect(() => {
		const handleCompletion = async () => {
			if (isCompletingRef.current) return;
			isCompletingRef.current = true;

			// If deep link explicitly reports failed, show error card directly
			if (params.status === "failed") {
				setErrorMessage("We couldn't confirm DigiLocker yet. You can try again.");
				setIsLoading(false);
				return;
			}

			try {
				const session = await loadDigilockerSession();
				const incomingTxn = params.txn_id || params.txnId || params.transaction_id;

				if (session && incomingTxn && incomingTxn !== session.txnId) {
					Logger.warn(
						"AadhaarKycRedirect: incoming deep link txn differs from stored session; ignoring link txn",
						{ incomingTxn, storedTxn: session.txnId },
					);
				}

				const txnId = session?.txnId;

				if (!txnId) {
					Logger.warn("AadhaarKycRedirect: No valid stored DigiLocker session found for current user");
					try {
						const ckycRes = await getCkycStatus();
						const status = ckycRes?.data?.status;
						const nextAction = ckycRes?.data?.next_action;
						if (status === "completed" || nextAction === "selfie_match") {
							proceedToSelfie();
							return;
						}
					} catch (ckycErr) {
						Logger.warn("AadhaarKycRedirect: Failed to fetch ckyc status fallback", ckycErr);
					}
					router.replace("/digilocker-kyc" as any);
					return;
				}

				setActiveTxnId(txnId);
				Logger.info("AadhaarKycRedirect: Completing DigiLocker verification");
				const res = await finishDigilocker(txnId, { mode: "poll" });
				handleResult(res);
			} catch (err: any) {
				Logger.error("AadhaarKycRedirect: Failed to complete DigiLocker", err);
				setErrorMessage("We couldn't confirm DigiLocker yet. You can try again.");
				setIsLoading(false);
			}
		};

		handleCompletion();
	}, [params.status, params.txn_id]);

	const handleCheckStatusAgain = async () => {
		if (!activeTxnId) {
			router.replace("/digilocker-kyc" as any);
			return;
		}
		setIsCheckingAgain(true);
		try {
			const res = await finishDigilocker(activeTxnId, { mode: "single" });
			handleResult(res);
		} catch {
			setErrorMessage("We couldn't confirm DigiLocker yet. You can try again.");
		} finally {
			setIsCheckingAgain(false);
		}
	};

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
					{errorMessage || "We couldn't confirm DigiLocker yet. You can try again."}
				</Text>
				<View style={styles.btnRow}>
					<TouchableOpacity
						style={[styles.btn, styles.checkBtn]}
						onPress={handleCheckStatusAgain}
						disabled={isCheckingAgain}
					>
						{isCheckingAgain ? (
							<ActivityIndicator size="small" color={dark} />
						) : (
							<Text style={styles.checkBtnText}>Check status</Text>
						)}
					</TouchableOpacity>
					<TouchableOpacity
						style={[styles.btn, styles.retryBtn]}
						onPress={() => router.replace("/digilocker-kyc" as any)}
						disabled={isCheckingAgain}
					>
						<Text style={styles.retryBtnText}>
							{t("tryAgain", "Try Again")}
						</Text>
					</TouchableOpacity>
				</View>
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
	btnRow: {
		flexDirection: "row",
		gap: 12,
		width: "100%",
	},
	btn: {
		flex: 1,
		paddingVertical: 12,
		borderRadius: 10,
		alignItems: "center",
		justifyContent: "center",
	},
	checkBtn: {
		backgroundColor: primary,
	},
	checkBtnText: {
		color: dark,
		fontWeight: "700",
		fontSize: font(1.5),
	},
	retryBtn: {
		backgroundColor: "#F1F5F9",
		borderWidth: 1,
		borderColor: "#CBD5E1",
	},
	retryBtnText: {
		color: "#334155",
		fontWeight: "600",
		fontSize: font(1.5),
	},
});
