import React from "react";
import {
	ActivityIndicator,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { ActiveLoan } from "@/utils/api/types/repayment.types";
import { font, height, width } from "@/utils/dimensions";
import { formatRupees, parseDueDateInfo } from "@/utils/repaymentFormatting";
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
		const isOverdue = state === "overdue";
		const canPay = activeLoan.can_pay !== false;

		// Active payment expiration check
		const activePayment = activeLoan.active_payment;
		const isExpired = activePayment?.expires_at
			? new Date(activePayment.expires_at).getTime() < Date.now()
			: true;

		// Calculate due date & relative status
		const dueDateStr = activeLoan.next_due_date || activeLoan.repayment_date;
		const dueInfo = parseDueDateInfo(dueDateStr);

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
		let ctaText = t("payNow", "Pay Now");
		let onCtaPress: () => void | Promise<void> = handlePayNow;
		let isCtaDisabled = !canPay || isInitiating;

		if (!canPay) {
			ctaText = t("repaymentSchedulePreparing", "Repayment schedule is being prepared");
		} else if (isPendingPayment && !isExpired && activePayment?.txnid) {
			ctaText = t("checkPaymentStatus", "Check payment status");
			onCtaPress = handleCheckStatus;
		}

		return (
			<View style={styles.container}>
				<LinearGradient
					colors={["rgba(26, 51, 0, 0.8)", "rgba(13, 30, 0, 0.8)"]}
					start={{ x: 0.9, y: 0.1 }}
					end={{ x: 0.1, y: 0.9 }}
					style={styles.cardShell}
				>
					{/* Subtle Glow at top right */}
					<View style={styles.cardGlow} />

					{/* Card Top: Title, Amount & Due Status */}
					<View style={styles.cardTop}>
						<View style={styles.titleRow}>
							<Text style={styles.cardTitle}>
								{isOverdue
									? t("amountOverdueTitle", "AMOUNT OVERDUE")
									: isPendingPayment
									? t("paymentInProgressTitle", "PAYMENT IN PROGRESS")
									: t("amountDueTitle", "AMOUNT DUE")}
							</Text>

							{/* Due Date or Overdue Chip */}
							{isOverdue ? (
								<View style={styles.overdueChip}>
									<Text style={styles.overdueChipText}>
										{dueInfo.relativeText || t("overdue", "Overdue")}
									</Text>
								</View>
							) : dueDateStr ? (
								<View style={styles.dueChip}>
									<Text style={styles.dueChipText}>
										{t("dueOn", "Due on")} {dueInfo.formattedDate} ({dueInfo.relativeText})
									</Text>
								</View>
							) : null}
						</View>

						<Text style={styles.amountText}>
							{formatRupees(activeLoan.amount_to_repay)}
						</Text>

						{/* Overdue subtext if applicable */}
						{isOverdue && activeLoan.overdue_amount && activeLoan.overdue_amount > 0 ? (
							<Text style={styles.overdueSubtext}>
								{formatRupees(activeLoan.overdue_amount)} {t("overdueAmountNotice", "overdue charges included")}
							</Text>
						) : null}
					</View>

					{/* CTA Button */}
					<TouchableOpacity
						activeOpacity={0.85}
						onPress={onCtaPress}
						disabled={isCtaDisabled}
						style={styles.ctaBtnWrapper}
					>
						<LinearGradient
							colors={isCtaDisabled && !isInitiating ? ["#4A5A3B", "#38442D"] : ["#8AD600", "#5FA800"]}
							start={{ x: 0.5, y: 0 }}
							end={{ x: 0.5, y: 1 }}
							style={styles.ctaBtn}
						>
							{isInitiating ? (
								<ActivityIndicator size="small" color="#F9FDF5" />
							) : (
								<>
									<Text style={styles.ctaText}>{ctaText}</Text>
									<MaterialCommunityIcons name="arrow-right" size={18} color="#F9FDF5" />
								</>
							)}
						</LinearGradient>
					</TouchableOpacity>

					{/* Trust Metric Badges */}
					<View style={styles.metricBadges}>
						<View style={styles.badgeItem}>
							<View style={styles.badgeIconContainer}>
								<MaterialCommunityIcons name="shield-outline" size={20} color="#EEF8E0" />
							</View>
							<Text style={styles.badgeText}>{t("trustedRbiRegistered", "Trusted RBI-Registered")}</Text>
						</View>

						<View style={styles.badgeItem}>
							<View style={styles.badgeIconContainer}>
								<MaterialCommunityIcons name="clock-outline" size={20} color="#EEF8E0" />
							</View>
							<Text style={styles.badgeText}>{t("approvedIn2Mins", "Approved in 2 Mins")}</Text>
						</View>

						<View style={styles.badgeItem}>
							<View style={styles.badgeIconContainer}>
								<MaterialCommunityIcons name="database-outline" size={20} color="#EEF8E0" />
							</View>
							<Text style={styles.badgeText}>{t("bureauBasedPaperless", "Bureau-based Paperless")}</Text>
						</View>
					</View>
				</LinearGradient>
			</View>
		);
	},
);

const styles = StyleSheet.create({
	container: {
		paddingHorizontal: width(4),
		marginBottom: height(1.5),
	},
	cardShell: {
		borderRadius: width(4.5),
		padding: width(4.5),
		borderWidth: 1,
		borderColor: "rgba(255, 255, 255, 0.08)",
		overflow: "hidden",
		position: "relative",
	},
	cardGlow: {
		position: "absolute",
		top: -height(5),
		right: -width(10),
		width: width(45),
		height: width(45),
		borderRadius: width(22.5),
		backgroundColor: "rgba(164, 223, 85, 0.12)",
	},
	cardTop: {
		marginBottom: height(1.5),
	},
	titleRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		marginBottom: height(0.6),
		flexWrap: "wrap",
		gap: width(1.5),
	},
	cardTitle: {
		color: "rgba(255, 255, 255, 0.7)",
		fontSize: font(1.3),
		fontWeight: "700",
		letterSpacing: 0.8,
	},
	dueChip: {
		backgroundColor: "rgba(164, 223, 85, 0.15)",
		paddingHorizontal: width(2.2),
		paddingVertical: height(0.3),
		borderRadius: 12,
		borderWidth: 1,
		borderColor: "rgba(164, 223, 85, 0.3)",
	},
	dueChipText: {
		color: "#C5F87D",
		fontSize: font(1.15),
		fontWeight: "600",
	},
	overdueChip: {
		backgroundColor: "rgba(239, 68, 68, 0.2)",
		paddingHorizontal: width(2.2),
		paddingVertical: height(0.3),
		borderRadius: 12,
		borderWidth: 1,
		borderColor: "rgba(239, 68, 68, 0.4)",
	},
	overdueChipText: {
		color: "#FCA5A5",
		fontSize: font(1.15),
		fontWeight: "700",
	},
	amountText: {
		color: "#FFFFFF",
		fontSize: font(3.8),
		fontWeight: "800",
		letterSpacing: -0.5,
		marginTop: height(0.2),
	},
	overdueSubtext: {
		color: "#FCA5A5",
		fontSize: font(1.2),
		fontWeight: "500",
		marginTop: height(0.4),
	},
	ctaBtnWrapper: {
		width: "100%",
		marginBottom: height(2),
	},
	ctaBtn: {
		height: 48,
		borderRadius: 24,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 6,
		paddingHorizontal: width(4),
	},
	ctaText: {
		color: "#0B1D0E",
		fontSize: font(1.7),
		fontWeight: "800",
		letterSpacing: 0.2,
	},
	metricBadges: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		borderTopWidth: 1,
		borderTopColor: "rgba(255, 255, 255, 0.08)",
		paddingTop: height(1.2),
	},
	badgeItem: {
		flex: 1,
		alignItems: "center",
		paddingHorizontal: width(1),
	},
	badgeIconContainer: {
		width: 32,
		height: 32,
		borderRadius: 16,
		backgroundColor: "rgba(255, 255, 255, 0.06)",
		alignItems: "center",
		justifyContent: "center",
		marginBottom: height(0.4),
	},
	badgeText: {
		color: "rgba(255, 255, 255, 0.75)",
		fontSize: font(1.1),
		fontWeight: "500",
		textAlign: "center",
		lineHeight: 14,
	},
});

export default RepaymentHeaderCard;
