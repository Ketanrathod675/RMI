import React, { useCallback, useEffect, useState } from "react";
import {
	ActivityIndicator,
	BackHandler,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Logger from "@/utils/logger";
import { font, height, width } from "@/utils/dimensions";
import { formatRupees } from "@/utils/repaymentFormatting";
import {
	useRepaymentVerification,
	type RepaymentOutcome,
} from "@/hooks/useRepaymentVerification";
import type { VerifySource } from "@/utils/paymentVerification";
import { executeLoanReapply } from "@/utils/reapply";
import { useTranslation } from "@/hooks/useTranslation";
import { getUserDashboardData } from "@/utils/api/services/user.service";

export default function RepaymentStatusScreen() {
	const router = useRouter();
	const queryClient = useQueryClient();
	const { t } = useTranslation();
	const params = useLocalSearchParams<{
		txnid?: string;
		status?: string;
		source?: string;
	}>();

	const txnid = params.txnid ? String(params.txnid) : "";
	const rawSource = params.source as VerifySource | undefined;
	const initialSource: VerifySource =
		rawSource && ["deeplink_success", "deeplink_failure", "browser_closed", "manual"].includes(rawSource)
			? rawSource
			: "browser_closed";

	const [isReapplying, setIsReapplying] = useState(false);
	const [canReapplyFromDash, setCanReapplyFromDash] = useState(false);

	// Missing or empty txnid -> redirect home immediately
	useEffect(() => {
		if (!txnid) {
			Logger.warn("RepaymentStatusScreen: missing txnid param, redirecting to tabs");
			router.replace("/(tabs)");
		}
	}, [txnid, router]);

	// Hardware back button always routes to home
	useEffect(() => {
		const onBackPress = () => {
			router.replace("/(tabs)");
			return true;
		};
		const sub = BackHandler.addEventListener("hardwareBackPress", onBackPress);
		return () => sub.remove();
	}, [router]);

	const {
		isVerifying,
		countdown,
		outcome,
		recheck,
		cancelVerification,
	} = useRepaymentVerification({
		txnid,
		initialSource,
		onSuccess: async (data) => {
			try {
				const dash: any = await getUserDashboardData();
				if (dash?.can_reapply || data?.can_reapply) {
					setCanReapplyFromDash(true);
				}
			} catch {}
		},
	});

	const handleGoHome = useCallback(() => {
		router.replace("/(tabs)");
	}, [router]);

	const handleReapply = useCallback(async () => {
		if (isReapplying) return;
		setIsReapplying(true);
		try {
			await executeLoanReapply(router, queryClient, t);
		} finally {
			setIsReapplying(false);
		}
	}, [isReapplying, router, queryClient, t]);

	// Parse numeric values defensively
	const verifiedData = outcome?.data;
	const amountPaid =
		typeof verifiedData?.amount === "number"
			? verifiedData.amount
			: Number(verifiedData?.amount) || 0;
	const remainingOutstanding =
		typeof verifiedData?.remaining_outstanding === "number"
			? verifiedData.remaining_outstanding
			: Number(verifiedData?.remaining_outstanding) || 0;
	const isLoanClosed =
		verifiedData?.loan_closed === true ||
		(amountPaid > 0 && remainingOutstanding <= 0);
	const canReapply =
		verifiedData?.can_reapply === true || canReapplyFromDash;

	return (
		<SafeAreaView style={styles.safeArea}>
			<View style={styles.container}>
				{/* 1. Verifying State */}
				{isVerifying ? (
					<View style={styles.contentCard}>
						<View style={styles.loaderCircle}>
							<ActivityIndicator size="large" color="#8AD600" />
						</View>

						<Text style={styles.titleText}>
							{t("verifyingPaymentTitle", "Verifying your payment")}
						</Text>
						<Text style={styles.subtitleText}>
							{t("verifyingPaymentSubtitle", "We're confirming your transaction with the bank. Please do not close the app.")}
						</Text>

						{countdown > 0 ? (
							<Text style={styles.countdownText}>
								{t("checkingStatusRemaining", "Checking status...")} {countdown}s
							</Text>
						) : null}

						<TouchableOpacity
							activeOpacity={0.8}
							onPress={cancelVerification}
							style={styles.cancelVerifyBtn}
						>
							<Text style={styles.cancelVerifyBtnText}>
								{t("checkLater", "Check later from Home")}
							</Text>
						</TouchableOpacity>
					</View>
				) : outcome?.type === "success" ? (
					/* 2. Success State */
					<View style={styles.contentCard}>
						<View style={styles.successIconCircle}>
							<MaterialIcons name="check" size={44} color="#FFFFFF" />
						</View>

						<Text style={styles.successTitle}>
							{t("paymentSuccessful", "Payment Successful")}
						</Text>

						{amountPaid > 0 ? (
							<Text style={styles.amountDisplay}>
								{formatRupees(amountPaid)}
							</Text>
						) : null}

						{isLoanClosed ? (
							<View style={styles.statusBadgeSuccess}>
								<Text style={styles.statusBadgeTextSuccess}>
									{t("loanFullyRepaid", "Your loan is fully repaid!")}
								</Text>
							</View>
						) : remainingOutstanding > 0 ? (
							<View style={styles.statusBadgePartial}>
								<Text style={styles.statusBadgeTextPartial}>
									{t("paymentReceivedPartial", "Payment received.")} {formatRupees(remainingOutstanding)} {t("stillDue", "still due.")}
								</Text>
							</View>
						) : null}

						{/* Action Buttons */}
						<View style={styles.actionsContainer}>
							{isLoanClosed && canReapply ? (
								<TouchableOpacity
									activeOpacity={0.85}
									onPress={handleReapply}
									disabled={isReapplying}
									style={styles.primaryBtnWrapper}
								>
									<LinearGradient
										colors={["#8AD600", "#5FA800"]}
										start={{ x: 0.5, y: 0 }}
										end={{ x: 0.5, y: 1 }}
										style={styles.primaryBtn}
									>
										{isReapplying ? (
											<ActivityIndicator size="small" color="#0B1D0E" />
										) : (
											<>
												<Text style={styles.primaryBtnText}>
													{t("reapplyForLoan", "Reapply for a Loan")}
												</Text>
												<MaterialCommunityIcons name="arrow-right" size={18} color="#0B1D0E" />
											</>
										)}
									</LinearGradient>
								</TouchableOpacity>
							) : !isLoanClosed && remainingOutstanding > 0 ? (
								<TouchableOpacity
									activeOpacity={0.85}
									onPress={handleGoHome}
									style={styles.primaryBtnWrapper}
								>
									<LinearGradient
										colors={["#8AD600", "#5FA800"]}
										start={{ x: 0.5, y: 0 }}
										end={{ x: 0.5, y: 1 }}
										style={styles.primaryBtn}
									>
										<Text style={styles.primaryBtnText}>
											{t("payRemaining", "Pay Remaining Balance")}
										</Text>
										<MaterialCommunityIcons name="arrow-right" size={18} color="#0B1D0E" />
									</LinearGradient>
								</TouchableOpacity>
							) : null}

							<TouchableOpacity
								activeOpacity={0.8}
								onPress={handleGoHome}
								style={styles.secondaryBtn}
							>
								<Text style={styles.secondaryBtnText}>
									{t("goToHome", "Go to Home")}
								</Text>
							</TouchableOpacity>
						</View>
					</View>
				) : outcome?.type === "unconfirmed" ? (
					/* 3. Unconfirmed State */
					<View style={styles.contentCard}>
						<View style={styles.unconfirmedIconCircle}>
							<MaterialCommunityIcons name="clock-time-four-outline" size={42} color="#2563EB" />
						</View>

						<Text style={styles.titleText}>
							{t("paymentUnconfirmedTitle", "We're still confirming your payment")}
						</Text>
						<Text style={styles.subtitleText}>
							{t(
								"paymentUnconfirmedBody",
								"If money was deducted from your account, your loan will update automatically. Confirmation can take a few minutes.",
							)}
						</Text>

						<View style={styles.actionsContainer}>
							<TouchableOpacity
								activeOpacity={0.85}
								onPress={recheck}
								style={styles.primaryBtnWrapper}
							>
								<LinearGradient
									colors={["#8AD600", "#5FA800"]}
									start={{ x: 0.5, y: 0 }}
									end={{ x: 0.5, y: 1 }}
									style={styles.primaryBtn}
								>
									<Text style={styles.primaryBtnText}>
										{t("checkStatusAgain", "Check Status Again")}
									</Text>
								</LinearGradient>
							</TouchableOpacity>

							<TouchableOpacity
								activeOpacity={0.8}
								onPress={handleGoHome}
								style={styles.secondaryBtn}
							>
								<Text style={styles.secondaryBtnText}>
									{t("goToHome", "Go to Home")}
								</Text>
							</TouchableOpacity>
						</View>
					</View>
				) : (
					/* 4. Failed / Cancelled / Expired / Not Completed */
					<View style={styles.contentCard}>
						<View style={styles.amberIconCircle}>
							<MaterialCommunityIcons name="alert-circle-outline" size={44} color="#D97706" />
						</View>

						<Text style={styles.titleText}>
							{t("paymentNotCompletedTitle", "Payment Not Completed")}
						</Text>
						<Text style={styles.subtitleText}>
							{t(
								"paymentNotCompletedBody",
								"If money was deducted from your bank account, it will be updated or refunded automatically. You can try again whenever you're ready.",
							)}
						</Text>

						<View style={styles.actionsContainer}>
							<TouchableOpacity
								activeOpacity={0.85}
								onPress={handleGoHome}
								style={styles.primaryBtnWrapper}
							>
								<LinearGradient
									colors={["#8AD600", "#5FA800"]}
									start={{ x: 0.5, y: 0 }}
									end={{ x: 0.5, y: 1 }}
									style={styles.primaryBtn}
								>
									<Text style={styles.primaryBtnText}>
										{t("tryAgain", "Try Again")}
									</Text>
								</LinearGradient>
							</TouchableOpacity>

							<TouchableOpacity
								activeOpacity={0.8}
								onPress={handleGoHome}
								style={styles.secondaryBtn}
							>
								<Text style={styles.secondaryBtnText}>
									{t("goToHome", "Go to Home")}
								</Text>
							</TouchableOpacity>
						</View>
					</View>
				)}
			</View>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	safeArea: {
		flex: 1,
		backgroundColor: "#0B1D0E",
	},
	container: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		paddingHorizontal: width(5),
	},
	contentCard: {
		width: "100%",
		maxWidth: 420,
		backgroundColor: "rgba(16, 32, 15, 0.96)",
		borderRadius: 24,
		paddingHorizontal: width(6),
		paddingVertical: height(4),
		alignItems: "center",
		borderWidth: 1,
		borderColor: "rgba(255, 255, 255, 0.12)",
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 8 },
		shadowOpacity: 0.35,
		shadowRadius: 16,
		elevation: 10,
	},
	loaderCircle: {
		width: 72,
		height: 72,
		borderRadius: 36,
		backgroundColor: "rgba(138, 214, 0, 0.12)",
		alignItems: "center",
		justifyContent: "center",
		marginBottom: height(2.5),
	},
	successIconCircle: {
		width: 72,
		height: 72,
		borderRadius: 36,
		backgroundColor: "#15803D",
		alignItems: "center",
		justifyContent: "center",
		marginBottom: height(2),
		shadowColor: "#15803D",
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.4,
		shadowRadius: 8,
		elevation: 6,
	},
	unconfirmedIconCircle: {
		width: 72,
		height: 72,
		borderRadius: 36,
		backgroundColor: "rgba(37, 99, 235, 0.15)",
		alignItems: "center",
		justifyContent: "center",
		marginBottom: height(2),
	},
	amberIconCircle: {
		width: 72,
		height: 72,
		borderRadius: 36,
		backgroundColor: "rgba(217, 119, 6, 0.15)",
		alignItems: "center",
		justifyContent: "center",
		marginBottom: height(2),
	},
	titleText: {
		color: "#FFFFFF",
		fontSize: font(2.4),
		fontWeight: "800",
		textAlign: "center",
		marginBottom: height(1),
		letterSpacing: -0.2,
	},
	successTitle: {
		color: "#FFFFFF",
		fontSize: font(2.8),
		fontWeight: "800",
		textAlign: "center",
		marginBottom: height(0.5),
		letterSpacing: -0.3,
	},
	subtitleText: {
		color: "rgba(255, 255, 255, 0.72)",
		fontSize: font(1.4),
		fontWeight: "500",
		textAlign: "center",
		lineHeight: 20,
		marginBottom: height(2.5),
		paddingHorizontal: width(2),
	},
	amountDisplay: {
		color: "#8AD600",
		fontSize: font(4),
		fontWeight: "900",
		letterSpacing: -0.5,
		marginVertical: height(1),
	},
	statusBadgeSuccess: {
		backgroundColor: "rgba(21, 128, 61, 0.2)",
		borderWidth: 1,
		borderColor: "rgba(21, 128, 61, 0.4)",
		borderRadius: 12,
		paddingHorizontal: width(3),
		paddingVertical: height(0.6),
		marginBottom: height(2.5),
	},
	statusBadgeTextSuccess: {
		color: "#86EFAC",
		fontSize: font(1.3),
		fontWeight: "700",
	},
	statusBadgePartial: {
		backgroundColor: "rgba(217, 119, 6, 0.2)",
		borderWidth: 1,
		borderColor: "rgba(217, 119, 6, 0.4)",
		borderRadius: 12,
		paddingHorizontal: width(3),
		paddingVertical: height(0.6),
		marginBottom: height(2.5),
	},
	statusBadgeTextPartial: {
		color: "#FDE68A",
		fontSize: font(1.3),
		fontWeight: "700",
	},
	countdownText: {
		color: "rgba(255, 255, 255, 0.5)",
		fontSize: font(1.3),
		fontWeight: "600",
		marginBottom: height(2),
	},
	cancelVerifyBtn: {
		paddingVertical: height(1),
		paddingHorizontal: width(4),
	},
	cancelVerifyBtnText: {
		color: "rgba(255, 255, 255, 0.6)",
		fontSize: font(1.3),
		fontWeight: "600",
		textDecorationLine: "underline",
	},
	actionsContainer: {
		width: "100%",
		marginTop: height(1.5),
		gap: height(1.2),
	},
	primaryBtnWrapper: {
		width: "100%",
	},
	primaryBtn: {
		height: 48,
		borderRadius: 24,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 8,
		paddingHorizontal: width(4),
	},
	primaryBtnText: {
		color: "#0B1D0E",
		fontSize: font(1.6),
		fontWeight: "800",
	},
	secondaryBtn: {
		height: 46,
		borderRadius: 23,
		alignItems: "center",
		justifyContent: "center",
		borderWidth: 1,
		borderColor: "rgba(255, 255, 255, 0.18)",
		backgroundColor: "rgba(255, 255, 255, 0.04)",
	},
	secondaryBtnText: {
		color: "#FFFFFF",
		fontSize: font(1.5),
		fontWeight: "600",
	},
});

