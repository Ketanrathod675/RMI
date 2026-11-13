import React, { useEffect, useRef } from "react";
import {
	AccessibilityInfo,
	ActivityIndicator,
	Animated,
	Pressable,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { JAKARTA } from "@/constants/typography";
import type { ActiveLoan } from "@/utils/api/types/repayment.types";
import { formatRupees, parseDueDateInfo } from "@/utils/repaymentFormatting";
import { getRepaymentCardTheme } from "@/utils/repaymentCardTheme";
import { useRepaymentPayment } from "@/hooks/useRepaymentPayment";
import { useTranslation } from "@/hooks/useTranslation";

interface RepaymentHeaderCardProps {
	activeLoan: ActiveLoan;
}

export const RepaymentHeaderCard: React.FC<RepaymentHeaderCardProps> = React.memo(
	({ activeLoan }) => {
		const router = useRouter();
		const { t } = useTranslation();
		const { handlePayNow, isInitiating } = useRepaymentPayment({ activeLoan });

		const state = String(activeLoan.state || "due").toLowerCase();
		const isPendingPayment = state === "pending_payment";
		const canPay = activeLoan.can_pay !== false;

		// Active payment expiration check
		const activePayment = activeLoan.active_payment;
		const isExpired = activePayment?.expires_at
			? new Date(activePayment.expires_at).getTime() < Date.now()
			: true;

		// Calculate due date, relative status & card theme variant
		const dueDateStr = activeLoan.next_due_date || activeLoan.repayment_date;
		const dueInfo = parseDueDateInfo(dueDateStr);
		const theme = getRepaymentCardTheme({
			state,
			dueInfo,
			isOverdue: activeLoan.is_overdue,
			overdueAmount: activeLoan.overdue_amount,
			canPay: activeLoan.can_pay,
			disbursementDate: activeLoan.disbursement_date || activeLoan.disbursed_at,
			loanStatus: activeLoan.status,
		});
		const isRfd = theme.variant === "rfd";

		// Gentle 2s pulse animation for status dots (skipped when Reduce Motion is enabled)
		const pulseAnim = useRef(new Animated.Value(1)).current;
		const scaleAnim = useRef(new Animated.Value(1)).current;
		const reduceMotionRef = useRef(false);

		useEffect(() => {
			let mounted = true;
			let loopAnim: Animated.CompositeAnimation | null = null;

			AccessibilityInfo.isReduceMotionEnabled()
				.then((reduceMotion) => {
					if (!mounted) return;
					reduceMotionRef.current = reduceMotion;
					if (reduceMotion) return;

					loopAnim = Animated.loop(
						Animated.sequence([
							Animated.timing(pulseAnim, {
								toValue: 0.4,
								duration: 1000,
								useNativeDriver: true,
							}),
							Animated.timing(pulseAnim, {
								toValue: 1,
								duration: 1000,
								useNativeDriver: true,
							}),
						]),
					);
					loopAnim.start();
				})
				.catch(() => {
					// Keep dots static if AccessibilityInfo query fails
				});

			return () => {
				mounted = false;
				if (loopAnim) {
					loopAnim.stop();
				}
				pulseAnim.setValue(1);
			};
		}, [pulseAnim]);

		const handleCheckStatus = () => {
			if (activePayment?.txnid) {
				router.push({
					pathname: "/repayment-status" as any,
					params: { txnid: activePayment.txnid, source: "manual" },
				});
			} else {
				handlePayNow();
			}
		};

		// Decide CTA action & label
		const hasPendingLink = isPendingPayment && !isExpired && Boolean(activePayment?.txnid);
		let ctaText = t("makeThePayment", "Make the payment");
		const onCtaPress: () => void | Promise<void> = handlePayNow;
		const isCtaDisabled = !canPay || isInitiating;

		if (!canPay) {
			ctaText = t("repaymentSchedulePreparing", "Repayment schedule is being prepared");
		} else if (hasPendingLink) {
			ctaText = t("resumePayment", "Resume payment");
		}

		const animateScale = (toValue: number) => {
			if (reduceMotionRef.current) return;
			Animated.timing(scaleAnim, {
				toValue,
				duration: 150,
				useNativeDriver: true,
			}).start();
		};

		const formattedRupees = formatRupees(activeLoan.amount_to_repay);
		const amountNumberOnly = formattedRupees.replace(/^₹\s*/, "");
		const overdueCharges = Number(activeLoan.overdue_amount ?? 0);

		const showDueRow = !isRfd && (Boolean(dueDateStr) || theme.variant === "overdue");
		const dueDateValueText =
			theme.variant === "overdue"
				? dueDateStr
					? `${theme.dueRow.icon} ${dueInfo.formattedDate}${dueInfo.relativeText ? ` (${dueInfo.relativeText})` : ""}`
					: `${theme.dueRow.icon} ${t("overdue", "Overdue")}`
				: `${theme.dueRow.icon} ${t("dueOn", "Due on")} ${dueInfo.formattedDate}${dueInfo.relativeText ? ` (${dueInfo.relativeText})` : ""}`;

		return (
			<View style={styles.container}>
				{/* Light underlay covers lower ~70% behind the card without negative margins */}
				<View pointerEvents="none" style={styles.underlay} />

				<View style={styles.cardShadowWrapper}>
					<View style={styles.card}>
						{/* Row 1: Header label + Status chip */}
						<View style={styles.row1}>
							<View style={styles.row1Left}>
								<Animated.View
									style={[
										styles.labelDot,
										{ backgroundColor: theme.dotColor, opacity: pulseAnim },
									]}
								/>
								<Text style={styles.headerLabel}>
									{t(theme.headerLabelKey, theme.headerLabelFallback)}
								</Text>
							</View>

							<View
								style={[
									styles.statusChip,
									{
										backgroundColor: theme.chip.bg,
										borderColor: theme.chip.border,
									},
								]}
							>
								<Animated.View
									style={[
										styles.chipDot,
										{ backgroundColor: theme.dotColor, opacity: pulseAnim },
									]}
								/>
								<Text style={[styles.chipText, { color: theme.chip.text }]}>
									{t(theme.chip.labelKey, theme.chip.label)}
								</Text>
							</View>
						</View>

						{/* Row 2: Currency symbol + Numeric amount (hidden in RFD) */}
						{!isRfd ? (
							<View style={styles.amountRow}>
								<Text style={styles.currencySymbol}>₹</Text>
								<Text style={styles.amountValue}>{amountNumberOnly}</Text>
							</View>
						) : null}

						{!isRfd && overdueCharges > 0 ? (
							<Text style={styles.overdueChargesNotice}>
								{formatRupees(overdueCharges)}{" "}
								{t("overdueAmountNotice", "overdue charges included")}
							</Text>
						) : null}

						{isRfd ? (
							<View style={styles.rfdNoticeBox}>
								<MaterialCommunityIcons
									name="clock-outline"
									size={18}
									color="#B45309"
									style={styles.rfdNoticeIcon}
								/>
								<Text style={styles.rfdNoticeText}>
									{t(
										"rfdDisbursalMessage",
										"Please wait, your loan amount is in progress and will be credited in 24 hours.",
									)}
								</Text>
							</View>
						) : (
							<>
								{/* Row 3: Due date */}
								{showDueRow ? (
									<View
										style={[
											styles.dueRowBase,
											theme.dueRow.isHighlighted
												? [
														styles.dueRowHighlighted,
														{
															backgroundColor: theme.dueRow.bg,
															borderColor: theme.dueRow.border,
														},
												  ]
												: styles.dueRowNormal,
										]}
									>
										<Text
											style={[
												styles.dueLabel,
												{ color: theme.dueRow.labelColor },
											]}
										>
											{t("dueDateLabel", "Due date")}
										</Text>
										<Text
											style={[
												theme.variant === "overdue"
													? styles.dueValueOverdue
													: styles.dueValueNormal,
												{ color: theme.dueRow.valueColor },
											]}
										>
											{dueDateValueText}
										</Text>
									</View>
								) : null}

								{/* CTA Button */}
								<Animated.View
									style={[
										styles.ctaWrapper,
										canPay ? styles.ctaShadowActive : styles.ctaShadowDisabled,
										{ transform: [{ scale: scaleAnim }] },
									]}
								>
									<Pressable
										accessibilityRole="button"
										accessibilityLabel={ctaText}
										accessibilityState={{ disabled: isCtaDisabled, busy: isInitiating }}
										disabled={isCtaDisabled}
										onPress={onCtaPress}
										onPressIn={() => {
											if (!isCtaDisabled) animateScale(0.98);
										}}
										onPressOut={() => animateScale(1)}
										style={styles.ctaPressable}
									>
										<LinearGradient
											colors={
												!canPay
													? ["#E2E8F0", "#CBD5E1"]
													: ["#09A143", "#78DE26"]
											}
											start={{ x: 0, y: 0.5 }}
											end={{ x: 1, y: 0.5 }}
											style={styles.ctaGradient}
										>
											{isInitiating ? (
												<ActivityIndicator size="small" color="#FFFFFF" />
											) : (
												<>
													<Text
														style={[
															styles.ctaText,
															!canPay && styles.ctaTextDisabled,
														]}
													>
														{ctaText}
													</Text>
													<MaterialCommunityIcons
														name="arrow-right"
														size={20}
														color={!canPay ? "#64748B" : "#FFFFFF"}
													/>
												</>
											)}
										</LinearGradient>
									</Pressable>
								</Animated.View>

								{canPay && hasPendingLink ? (
									<TouchableOpacity
										accessibilityRole="button"
										accessibilityLabel={t("checkPaymentStatus", "Check payment status")}
										activeOpacity={0.7}
										onPress={handleCheckStatus}
										style={styles.secondaryStatusLink}
									>
										<Text style={styles.secondaryStatusLinkText}>
											{t("checkPaymentStatus", "Check payment status")}
										</Text>
									</TouchableOpacity>
								) : null}
							</>
						)}
					</View>
				</View>
			</View>
		);
	},
);

const styles = StyleSheet.create({
	container: {
		position: "relative",
		paddingHorizontal: 16,
	},
	underlay: {
		position: "absolute",
		left: 0,
		right: 0,
		bottom: 0,
		height: "70%",
		backgroundColor: "#F5F7F2",
	},
	cardShadowWrapper: {
		marginBottom: 20,
		borderRadius: 24,
		backgroundColor: "#FFFFFF",
		shadowColor: "#000000",
		shadowOffset: { width: 0, height: 12 },
		shadowOpacity: 0.14,
		shadowRadius: 20,
		elevation: 8,
	},
	card: {
		backgroundColor: "#FFFFFF",
		borderRadius: 24,
		padding: 20,
		borderWidth: 1,
		borderColor: "#F1F5F9",
	},
	row1: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		marginBottom: 10,
		gap: 8,
	},
	row1Left: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
		flexShrink: 1,
	},
	labelDot: {
		width: 8,
		height: 8,
		borderRadius: 4,
	},
	headerLabel: {
		fontFamily: JAKARTA.bold,
		fontSize: 11,
		letterSpacing: 0.55,
		textTransform: "uppercase",
		color: "#64748B",
		flexShrink: 1,
		includeFontPadding: false,
	},
	statusChip: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
		paddingHorizontal: 10,
		paddingVertical: 4,
		borderRadius: 999,
		borderWidth: 1,
		flexShrink: 0,
	},
	chipDot: {
		width: 6,
		height: 6,
		borderRadius: 3,
	},
	chipText: {
		fontFamily: JAKARTA.bold,
		fontSize: 11,
		letterSpacing: 0.3,
		textTransform: "uppercase",
		includeFontPadding: false,
	},
	amountRow: {
		flexDirection: "row",
		alignItems: "baseline",
		marginTop: 4,
		marginBottom: 16,
	},
	currencySymbol: {
		fontFamily: JAKARTA.extraBold,
		fontSize: 24,
		color: "#0F172A",
		marginRight: 6,
		includeFontPadding: false,
	},
	amountValue: {
		fontFamily: JAKARTA.extraBold,
		fontSize: 38,
		lineHeight: 38,
		letterSpacing: -0.9,
		color: "#0F172A",
		includeFontPadding: false,
		flexShrink: 1,
	},
	overdueChargesNotice: {
		fontFamily: JAKARTA.medium,
		fontSize: 12,
		color: "#BE123C",
		marginTop: -8,
		marginBottom: 12,
		includeFontPadding: false,
	},
	dueRowBase: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		marginBottom: 8,
		gap: 8,
	},
	dueRowNormal: {
		paddingHorizontal: 4,
	},
	dueRowHighlighted: {
		borderWidth: 1,
		borderRadius: 12,
		paddingHorizontal: 10,
		paddingVertical: 8,
	},
	dueLabel: {
		fontFamily: JAKARTA.medium,
		fontSize: 12,
		flexShrink: 0,
		includeFontPadding: false,
	},
	dueValueNormal: {
		fontFamily: JAKARTA.semibold,
		fontSize: 12,
		flexShrink: 1,
		textAlign: "right",
		includeFontPadding: false,
	},
	dueValueOverdue: {
		fontFamily: JAKARTA.bold,
		fontSize: 12,
		flexShrink: 1,
		textAlign: "right",
		includeFontPadding: false,
	},
	ctaWrapper: {
		width: "100%",
		borderRadius: 16,
	},
	ctaShadowActive: {
		backgroundColor: "#09A143",
		shadowColor: "#09A143",
		shadowOffset: { width: 0, height: 10 },
		shadowOpacity: 0.38,
		shadowRadius: 12,
		elevation: 6,
	},
	ctaShadowDisabled: {
		backgroundColor: "transparent",
		shadowOpacity: 0,
		elevation: 0,
	},
	ctaPressable: {
		width: "100%",
		borderRadius: 16,
		overflow: "hidden",
	},
	ctaGradient: {
		width: "100%",
		minHeight: 56,
		borderRadius: 16,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 8,
		paddingHorizontal: 16,
		paddingVertical: 8,
	},
	ctaText: {
		fontFamily: JAKARTA.bold,
		fontSize: 16,
		color: "#FFFFFF",
		textAlign: "center",
		flexShrink: 1,
		includeFontPadding: false,
	},
	ctaTextDisabled: {
		color: "#64748B",
	},
	secondaryStatusLink: {
		alignSelf: "center",
		marginTop: 12,
		paddingVertical: 4,
		paddingHorizontal: 8,
	},
	secondaryStatusLinkText: {
		fontFamily: JAKARTA.semibold,
		fontSize: 13,
		color: "#047857",
		textDecorationLine: "underline",
		includeFontPadding: false,
	},
	rfdNoticeBox: {
		flexDirection: "row",
		alignItems: "flex-start",
		gap: 10,
		marginTop: 6,
		backgroundColor: "#FFFBEB",
		borderWidth: 1,
		borderColor: "#FDE68A",
		borderRadius: 14,
		paddingHorizontal: 14,
		paddingVertical: 14,
	},
	rfdNoticeIcon: {
		marginTop: 1,
		flexShrink: 0,
	},
	rfdNoticeText: {
		flex: 1,
		fontFamily: JAKARTA.semibold,
		fontSize: 13,
		lineHeight: 19,
		color: "#92400E",
		includeFontPadding: false,
	},
});

export default RepaymentHeaderCard;
