import React, { useCallback, useEffect, useRef, useState } from "react";
import {
	ActivityIndicator,
	BackHandler,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Logger from "@/utils/logger";
import { font, height, width } from "@/utils/dimensions";
import { formatRupees } from "@/utils/repaymentFormatting";
import { useRepaymentPayment } from "@/hooks/useRepaymentPayment";
import {
	useRepaymentVerification,
	type RepaymentOutcome,
} from "@/hooks/useRepaymentVerification";
import {
	classify,
	invalidatePostRepaymentQueries,
	type VerifySource,
} from "@/utils/paymentVerification";
import { clearStoredRepaymentKeys } from "@/utils/repaymentIdempotency";
import { executeLoanReapply, formatReapplyAvailableDate, isFutureCooldownDate } from "@/utils/reapply";
import { useAuth } from "@/hooks/useAuth";
import { useDefault } from "@/hooks/useDefault";
import { useTranslation } from "@/hooks/useTranslation";
import { cancelRepaymentPayment } from "@/utils/api/services/repayment.service";
import { getUserDashboardData } from "@/utils/api/services/user.service";

export default function RepaymentStatusScreen() {
	const router = useRouter();
	const queryClient = useQueryClient();
	const { userId } = useAuth();
	const { t } = useTranslation();
	const { language } = useDefault();
	const params = useLocalSearchParams<{
		txnid?: string;
		status?: string;
		source?: string;
	}>();

	const txnid = params.txnid ? String(params.txnid) : "";
	const rawSource = params.source as VerifySource | undefined;
	const paramStatus = params.status ? String(params.status).trim().toLowerCase() : "";
	const initialSource: VerifySource =
		rawSource && ["deeplink_success", "deeplink_failure", "browser_closed", "manual"].includes(rawSource)
			? rawSource
			: ["success", "true", "successful", "completed"].includes(paramStatus)
				? "deeplink_success"
				: ["failure", "failed", "false", "cancelled"].includes(paramStatus)
					? "deeplink_failure"
					: "browser_closed";

	const cachedDashboard = userId
		? queryClient.getQueryData<any>(["user", "dashboard", userId])
		: undefined;
	const { handlePayNow, isInitiating } = useRepaymentPayment({
		activeLoan: cachedDashboard?.active_loan ?? null,
	});

	const [isReapplying, setIsReapplying] = useState(false);
	const [canReapplyFromDash, setCanReapplyFromDash] = useState(false);
	const [canReapplyAtFromDash, setCanReapplyAtFromDash] = useState<string | null>(null);
	const cancelledOutcomeRef = useRef<RepaymentOutcome | null>(null);

	// Missing or empty txnid -> redirect home immediately
	useEffect(() => {
		if (!txnid) {
			Logger.warn("RepaymentStatusScreen: missing txnid param, redirecting to tabs");
			router.replace("/(tabs)");
		}
	}, [txnid, router]);

	const {
		isVerifying,
		countdown,
		outcome,
		recheck,
		cancelVerification,
		markSuccessFromCancel,
	} = useRepaymentVerification({
		txnid,
		initialSource,
		onSuccess: async (data) => {
			try {
				await invalidatePostRepaymentQueries(queryClient);
			} catch {}
			try {
				const dash: any = await getUserDashboardData();
				if (dash?.can_reapply || data?.can_reapply) {
					setCanReapplyFromDash(true);
				}
				const canReapplyAt =
					dash?.can_reapply_at ||
					dash?.workflow_progress?.can_reapply_at ||
					data?.can_reapply_at ||
					null;
				if (canReapplyAt) {
					setCanReapplyAtFromDash(String(canReapplyAt));
				}
			} catch {}
		},
	});

	const handleGoHome = useCallback(async () => {
		if (outcome?.type === "success" || outcome?.type === "not_completed") {
			await invalidatePostRepaymentQueries(queryClient);
		}
		router.replace("/(tabs)");
	}, [router, queryClient, outcome?.type]);

	// When entering not_completed (e.g. browser closed without payment), cancel the unattempted
	// row on the server once so Home returns immediately to normal due/overdue state.
	useEffect(() => {
		if (outcome?.type !== "not_completed" || !txnid) return;
		if (cancelledOutcomeRef.current === outcome) return;
		cancelledOutcomeRef.current = outcome;

		let ignore = false;
		cancelRepaymentPayment(txnid)
			.then(async (res) => {
				if (ignore) return;
				const { kind } = classify(res);
				if (kind === "SUCCESS") {
					await markSuccessFromCancel(res);
					return;
				}
				if (kind !== "PENDING") {
					await clearStoredRepaymentKeys();
				}
				await invalidatePostRepaymentQueries(queryClient);
			})
			.catch(async () => {
				if (ignore) return;
				await invalidatePostRepaymentQueries(queryClient).catch(() => {});
			});

		return () => {
			ignore = true;
		};
	}, [outcome, txnid, markSuccessFromCancel, queryClient]);

	// Hardware back button always routes to home after refreshing queries on success
	useEffect(() => {
		const onBackPress = () => {
			void handleGoHome();
			return true;
		};
		const sub = BackHandler.addEventListener("hardwareBackPress", onBackPress);
		return () => sub.remove();
	}, [handleGoHome]);

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
	const canReapplyAt = verifiedData?.can_reapply_at ?? canReapplyAtFromDash;
	const isReapplyCooldownFuture = isFutureCooldownDate(canReapplyAt);
	const formattedReapplyAt = isReapplyCooldownFuture
		? formatReapplyAvailableDate(canReapplyAt, language)
		: "";
	const reapplyAvailableLabel =
		isReapplyCooldownFuture && formattedReapplyAt
			? t("reapplyAvailableFrom", "Available from {date}").replace("{date}", formattedReapplyAt)
			: null;

	return (
		<SafeAreaView style={styles.safeArea}>
			<StatusBar style="dark" />
			<View style={styles.container}>
				{/* 1. Verifying State */}
				{isVerifying || (!outcome && Boolean(txnid)) ? (
					<View style={styles.contentCard}>
						<View style={styles.loaderCircle}>
							<ActivityIndicator size="large" color="#09A143" />
						</View>

						<Text style={styles.titleText}>
							{t("verifyingPaymentTitle", "Verifying your payment")}
						</Text>
						<Text style={styles.subtitleText}>
							{t("verifyingPaymentSubtitle", "We're confirming your transaction with the bank. Please do not close the app.")}
						</Text>

						{countdown > 0 ? (
							<View style={styles.countdownPill}>
								<MaterialCommunityIcons name="clock-outline" size={14} color="#64748B" />
								<Text style={styles.countdownText}>
									{t("checkingStatusRemaining", "Checking status...")} {countdown}s
								</Text>
							</View>
						) : null}

						<TouchableOpacity
							activeOpacity={0.8}
							onPress={() => {
								cancelVerification();
								void handleGoHome();
							}}
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
							<MaterialIcons name="check" size={44} color="#09A143" />
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
							{isLoanClosed && (canReapply || isReapplyCooldownFuture) ? (
								<TouchableOpacity
									activeOpacity={0.85}
									onPress={handleReapply}
									disabled={isReapplying || isReapplyCooldownFuture}
									style={[styles.primaryBtnWrapper, isReapplyCooldownFuture && { opacity: 0.6 }]}
								>
									<LinearGradient
										colors={isReapplyCooldownFuture ? ["#94A3B8", "#64748B"] : ["#09A143", "#78DE26"]}
										start={{ x: 0, y: 0.5 }}
										end={{ x: 1, y: 0.5 }}
										style={styles.primaryBtn}
									>
										{isReapplying ? (
											<ActivityIndicator size="small" color="#FFFFFF" />
										) : (
											<>
												<Text style={styles.primaryBtnText}>
													{isReapplyCooldownFuture && reapplyAvailableLabel
														? reapplyAvailableLabel
														: t("reapplyForLoan", "Reapply for a Loan")}
												</Text>
												{!isReapplyCooldownFuture && (
													<MaterialCommunityIcons name="arrow-right" size={18} color="#FFFFFF" />
												)}
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
										colors={["#09A143", "#78DE26"]}
										start={{ x: 0, y: 0.5 }}
										end={{ x: 1, y: 0.5 }}
										style={styles.primaryBtn}
									>
										<Text style={styles.primaryBtnText}>
											{t("payRemaining", "Pay Remaining Balance")}
										</Text>
										<MaterialCommunityIcons name="arrow-right" size={18} color="#FFFFFF" />
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
									colors={["#09A143", "#78DE26"]}
									start={{ x: 0, y: 0.5 }}
									end={{ x: 1, y: 0.5 }}
									style={styles.primaryBtn}
								>
									<Text style={styles.primaryBtnText}>
										{t("checkStatusAgain", "Check Status Again")}
									</Text>
									<MaterialCommunityIcons name="refresh" size={18} color="#FFFFFF" />
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
				) : outcome ? (
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
								disabled={isInitiating}
								onPress={handlePayNow}
								style={[styles.primaryBtnWrapper, isInitiating && { opacity: 0.75 }]}
							>
								<LinearGradient
									colors={["#09A143", "#78DE26"]}
									start={{ x: 0, y: 0.5 }}
									end={{ x: 1, y: 0.5 }}
									style={styles.primaryBtn}
								>
									{isInitiating ? (
										<ActivityIndicator size="small" color="#FFFFFF" />
									) : (
										<>
											<Text style={styles.primaryBtnText}>
												{t("tryAgain", "Try Again")}
											</Text>
											<MaterialCommunityIcons name="refresh" size={18} color="#FFFFFF" />
										</>
									)}
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
					/* 5. Fallback Initial Loading State */
					<View style={styles.contentCard}>
						<View style={styles.loaderCircle}>
							<ActivityIndicator size="large" color="#09A143" />
						</View>
						<Text style={styles.titleText}>
							{t("verifyingPaymentTitle", "Verifying your payment")}
						</Text>
					</View>
				)}
			</View>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	safeArea: {
		flex: 1,
		backgroundColor: "#F8FAFC",
	},
	container: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		paddingHorizontal: width(5),
		paddingVertical: height(3),
	},
	contentCard: {
		width: "100%",
		maxWidth: 420,
		backgroundColor: "#FFFFFF",
		borderRadius: 24,
		paddingHorizontal: width(6),
		paddingVertical: height(4),
		alignItems: "center",
		borderWidth: 1,
		borderColor: "#E2E8F0",
		shadowColor: "#0F172A",
		shadowOffset: { width: 0, height: 8 },
		shadowOpacity: 0.08,
		shadowRadius: 20,
		elevation: 4,
	},
	loaderCircle: {
		width: 80,
		height: 80,
		borderRadius: 40,
		backgroundColor: "#ECFDF5",
		borderWidth: 2,
		borderColor: "#A7F3D0",
		alignItems: "center",
		justifyContent: "center",
		marginBottom: height(2.5),
	},
	successIconCircle: {
		width: 80,
		height: 80,
		borderRadius: 40,
		backgroundColor: "#ECFDF5",
		borderWidth: 2,
		borderColor: "#86EFAC",
		alignItems: "center",
		justifyContent: "center",
		marginBottom: height(2),
		shadowColor: "#09A143",
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.15,
		shadowRadius: 10,
		elevation: 3,
	},
	unconfirmedIconCircle: {
		width: 80,
		height: 80,
		borderRadius: 40,
		backgroundColor: "#EFF6FF",
		borderWidth: 2,
		borderColor: "#BFDBFE",
		alignItems: "center",
		justifyContent: "center",
		marginBottom: height(2),
	},
	amberIconCircle: {
		width: 80,
		height: 80,
		borderRadius: 40,
		backgroundColor: "#FEF3C7",
		borderWidth: 2,
		borderColor: "#FDE68A",
		alignItems: "center",
		justifyContent: "center",
		marginBottom: height(2),
	},
	titleText: {
		color: "#0F172A",
		fontSize: font(2.4),
		fontWeight: "800",
		textAlign: "center",
		marginBottom: height(1),
		letterSpacing: -0.2,
	},
	successTitle: {
		color: "#0F172A",
		fontSize: font(2.6),
		fontWeight: "800",
		textAlign: "center",
		marginBottom: height(0.5),
		letterSpacing: -0.3,
	},
	subtitleText: {
		color: "#64748B",
		fontSize: font(1.5),
		fontWeight: "500",
		textAlign: "center",
		lineHeight: 22,
		marginBottom: height(2.5),
		paddingHorizontal: width(2),
	},
	amountDisplay: {
		color: "#0F172A",
		fontSize: font(3.8),
		fontWeight: "800",
		letterSpacing: -0.5,
		marginVertical: height(1),
	},
	statusBadgeSuccess: {
		backgroundColor: "#ECFDF5",
		borderWidth: 1,
		borderColor: "#A7F3D0",
		borderRadius: 12,
		paddingHorizontal: width(3.5),
		paddingVertical: height(0.8),
		marginBottom: height(2.5),
	},
	statusBadgeTextSuccess: {
		color: "#047857",
		fontSize: font(1.4),
		fontWeight: "700",
	},
	statusBadgePartial: {
		backgroundColor: "#FFFBEB",
		borderWidth: 1,
		borderColor: "#FDE68A",
		borderRadius: 12,
		paddingHorizontal: width(3.5),
		paddingVertical: height(0.8),
		marginBottom: height(2.5),
	},
	statusBadgeTextPartial: {
		color: "#B45309",
		fontSize: font(1.4),
		fontWeight: "700",
	},
	countdownPill: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
		backgroundColor: "#F1F5F9",
		borderWidth: 1,
		borderColor: "#E2E8F0",
		borderRadius: 20,
		paddingHorizontal: width(3.5),
		paddingVertical: height(0.6),
		marginBottom: height(2),
	},
	countdownText: {
		color: "#64748B",
		fontSize: font(1.3),
		fontWeight: "600",
	},
	cancelVerifyBtn: {
		paddingVertical: height(1.2),
		paddingHorizontal: width(4),
		marginTop: height(0.5),
	},
	cancelVerifyBtnText: {
		color: "#09A143",
		fontSize: font(1.5),
		fontWeight: "600",
	},
	actionsContainer: {
		width: "100%",
		marginTop: height(1.5),
		gap: height(1.2),
	},
	primaryBtnWrapper: {
		width: "100%",
		borderRadius: 16,
		overflow: "hidden",
		shadowColor: "#09A143",
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.2,
		shadowRadius: 8,
		elevation: 3,
	},
	primaryBtn: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		paddingVertical: height(1.8),
		paddingHorizontal: width(4),
		gap: width(2),
	},
	primaryBtnText: {
		color: "#FFFFFF",
		fontSize: font(1.7),
		fontWeight: "700",
	},
	secondaryBtn: {
		width: "100%",
		paddingVertical: height(1.6),
		alignItems: "center",
		justifyContent: "center",
		borderRadius: 16,
		backgroundColor: "#F1F5F9",
		borderWidth: 1,
		borderColor: "#E2E8F0",
	},
	secondaryBtnText: {
		color: "#334155",
		fontSize: font(1.5),
		fontWeight: "600",
	},
});

