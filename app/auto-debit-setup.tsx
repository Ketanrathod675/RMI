import { getFriendlyError } from "@/utils/api/core/friendlyError";
import { useMountedRef } from "@/hooks/useMountedRef";
import { useJourneyTracker } from "@/hooks/useJourneyTracker";
import { type MandateVerifySource } from "@/hooks/useMandateVerification";
import { useTranslation } from "@/hooks/useTranslation";
import {
	createMandate,
	getMandateStatus,
	getMandateType,
	getUserDashboardData,
	getWorkflowProgress,
	StepHref,
	type MandateMethod,
} from "@/utils/api";
import { formatAccountTail, getMandateMethod } from "@/utils/mandateMethod";
import { font, height, width } from "@/utils/dimensions";
import { getStorageItem, removeStorageItem, setStorageItem, STORAGE_KEYS } from "@/utils/storage";
import { useApplicationStatusGuard } from "@/hooks/useApplicationStatusGuard";
import { isRejectedStatus, handleApplicationRejected } from "@/utils/applicationRejection";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Linking from "expo-linking";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTypedNavigation } from "@/hooks/useTypedNavigation";
import * as WebBrowser from "expo-web-browser";
import React, { useEffect, useRef, useState } from "react";
import {
	ActivityIndicator,
	BackHandler,
	ScrollView,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

import ExitIntentModal from "@/components/assessment-fee/ExitIntentModal";

// Same palette as the web e-Mandate page (app/borrower/(protected)/emandate/page.tsx)
const C = {
	page: "#f5f7f2",
	ink: "#13251b",
	green: "#15803d",
	selectedBg: "#f3fbf4",
	lime: "#B7FB52",
	limeText: "#113922",
	badgeText: "#14391f",
	note: "#f8faf8",
	noteBorder: "#e4eee6",
	border: "#e5e7eb",
	grey: "#6b7280",
	zap: "#f59e0b",
	card: "#176b8b",
};

const RETURN_URL = "rapid-money://emandate-status";

const PENDING_MANDATE_MAX_AGE_MS = 30 * 60 * 1000;

export default function AutoDebitSetup() {
	const mountedRef = useMountedRef();
	const { t } = useTranslation();
	const insets = useSafeAreaInsets();
	const router = useRouter();
	const navigation = useTypedNavigation();
	const queryClient = useQueryClient();
	useJourneyTracker("/auto-debit-setup");
	useApplicationStatusGuard();

	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isExitModalVisible, setIsExitModalVisible] = useState(false);
	const launchingRef = useRef(false);
	const { fresh } = useLocalSearchParams<{ fresh?: string }>();

	const typeQuery = useQuery({
		queryKey: ["mandate", "type"],
		queryFn: getMandateType,
		staleTime: 0,
		gcTime: 0,
		retry: 1,
		refetchOnMount: "always",
	});

	const typeData = typeQuery.data?.data;
	const fallbackToEnach = !typeQuery.isError && typeData?.fallback_to_enach === true;
	const method: MandateMethod = getMandateMethod(typeQuery.isError ? undefined : typeData);
	const bank = (!typeQuery.isError && typeData?.bank_account) ? typeData.bank_account : null;
	const isProceedDisabled = isSubmitting || typeQuery.isLoading;

	// Single sequential mount check:
	// 1. Pending mandate recovery (from storage or server check)
	// 2. Dashboard step redirect if already advanced
	useEffect(() => {
		if (fresh === "1") return;
		let active = true;

		(async () => {
			try {
				// 0. Pre-check workflow status: if rejected, route out immediately
				const progressRes = await getWorkflowProgress().catch(() => null);
				if (isRejectedStatus(progressRes?.data)) {
					if (active) handleApplicationRejected({ router, queryClient, source: "auto-debit-setup" });
					return;
				}

				// 1. Check storage for pending mandate attempt
				const stored = await getStorageItem(STORAGE_KEYS["@mandate-pending"]);
				if (stored && active) {
					const pending = JSON.parse(stored) as { txnid?: string; startedAt?: number };
					if (pending.startedAt && Date.now() - pending.startedAt <= PENDING_MANDATE_MAX_AGE_MS) {
						router.replace({
							pathname: "/emandate-status" as any,
							params: { txnid: pending.txnid ?? "", source: "recovered" },
						});
						return;
					}
					await removeStorageItem(STORAGE_KEYS["@mandate-pending"]);
				}

				if (!active) return;

				// 2. Check server for an active/pending mandate attempt
				try {
					const serverStatus = await getMandateStatus();
					const statusData = serverStatus?.data;
					const rawStatus = String(statusData?.status ?? "").toLowerCase().trim();
					if (
						statusData?.is_active ||
						rawStatus === "pending" ||
						rawStatus === "initiated" ||
						rawStatus === "preinitiated"
					) {
						if (!active) return;
						const txnid = statusData?.txnid ? String(statusData.txnid) : "";
						await setStorageItem(
							STORAGE_KEYS["@mandate-pending"],
							JSON.stringify({ txnid, startedAt: Date.now() }),
						);
						router.replace({
							pathname: "/emandate-status" as any,
							params: { txnid, source: "recovered" },
						});
						return;
					}
				} catch {
					// Ignore status check errors
				}

				if (!active) return;

				// 3. Check dashboard step to see if user has already advanced
				// StepHref maps: pdq_check -> /emandate-status, agreement_signing -> /sanction-letter, disbursement -> /loan-congratulations?final=1
				try {
					const dash: any = await getUserDashboardData();
					const step: string | undefined = dash?.workflow_progress?.current_step || dash?.current_step;
					if (!active || !step || step === "enach_mandate" || step === "auto_debit_setup") return;
					const href = StepHref[step as keyof typeof StepHref];
					if (href && href !== "/auto-debit-setup") {
						router.replace(href as any);
						return;
					}
				} catch {
					// Non-blocking
				}
			} catch {
				// Ignore errors in recovery
			}
		})();

		return () => {
			active = false;
		};
	}, [fresh, router, queryClient]);

	useEffect(() => {
		const unsubscribe = navigation.addListener("beforeRemove", (e) => {
			if (["GO_BACK", "POP"].includes(e.data.action.type)) {
				e.preventDefault();
				setIsExitModalVisible(true);
			}
		});
		const backHandler = BackHandler.addEventListener("hardwareBackPress", () => {
			setIsExitModalVisible(true);
			return true;
		});
		return () => {
			unsubscribe();
			backHandler.remove();
		};
	}, [navigation]);

	const handleProceed = async () => {
		if (isSubmitting || launchingRef.current) return;
		launchingRef.current = true;
		setIsSubmitting(true);
		try {
			// Check status once before creating mandate: if rejected, stop and route out
			const progressRes = await getWorkflowProgress().catch(() => null);
			if (isRejectedStatus(progressRes?.data)) {
				handleApplicationRejected({ router, queryClient, source: "auto-debit-setup" });
				return;
			}

			const mandate = await createMandate(method);
			if (!mountedRef.current) return;
			if (!mandate?.url) {
				throw new Error(t("mandateNoCheckoutUrl"));
			}
			queryClient.invalidateQueries({ queryKey: ["user", "dashboard"] });
			await setStorageItem(
				STORAGE_KEYS["@mandate-pending"],
				JSON.stringify({ txnid: mandate.txnid ?? "", method, startedAt: Date.now() }),
			);
			if (!mountedRef.current) return;

			let source: MandateVerifySource = "browser_closed";
			let targetTxnid = mandate.txnid ?? "";

			try {
				const result = await WebBrowser.openAuthSessionAsync(mandate.url, RETURN_URL);
				if (!mountedRef.current) return;
				if (result.type === "success" && result.url) {
					const { queryParams } = Linking.parse(result.url);
					const statusParam = String(
						queryParams?.mandate_status ??
						queryParams?.payment_status ??
						queryParams?.status ??
						(queryParams?.success === "true" ? "true" : queryParams?.success === "false" ? "false" : ""),
					).trim().toLowerCase();
					if (queryParams?.txnid) {
						targetTxnid = String(queryParams.txnid);
					}
					if (["true", "success", "successful", "completed", "active", "authorized", "authorised"].includes(statusParam)) {
						source = "deeplink_success";
					} else if (["pending", "initiated", "processing", "inprogress", "in_process"].includes(statusParam)) {
						source = "deeplink_pending";
					} else if (["false", "failure", "failed", "cancelled", "canceled"].includes(statusParam)) {
						source = "deeplink_failure";
					} else {
						source = "browser_closed";
					}
				} else {
					source = "browser_closed";
				}
			} catch {
				source = "browser_closed";
			}

			// If rejection arrived while gateway was open, check status first before proceeding
			const returnProgress = await getWorkflowProgress().catch(() => null);
			if (isRejectedStatus(returnProgress?.data)) {
				handleApplicationRejected({ router, queryClient, source: "auto-debit-setup-return" });
				return;
			}

			if (mountedRef.current) router.replace({ pathname: "/emandate-status" as any, params: { txnid: targetTxnid, source } });
		} catch (err) {
			if (!mountedRef.current) return;
			if ((err as any)?.isApplicationRejected) return;
			Toast.show({
				type: "error",
				text1: t("unableToStartMandateSetup"),
				text2: getFriendlyError(err).message,
			});
		} finally {
			if (mountedRef.current) setIsSubmitting(false);
			launchingRef.current = false;
		}
	};

	const optionAccessibilityLabel = fallbackToEnach
		? `${t("mandateEnachLabel")}${bank?.account_last4 ? `, ${bank.bank_name || ""} ${t("mandateAccountEnding")} ${bank.account_last4}` : ""}`
		: `${t("mandateUpiOnlyLabel")}${bank?.account_last4 ? `, ${bank.bank_name || ""} ${t("mandateAccountEnding")} ${bank.account_last4}` : ""}`;

	return (
		<View style={[styles.container, { paddingTop: insets.top }]}>
			<View style={styles.header}>
				<TouchableOpacity
					style={styles.backButton}
					onPress={() => setIsExitModalVisible(true)}
					accessibilityLabel="Go back">
					<MaterialIcons name="arrow-back" size={24} color={C.ink} />
				</TouchableOpacity>
				<Text style={styles.headerTitle}>e-Mandate Setup</Text>
				<View style={styles.headerRight} />
			</View>

			<ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
				<View style={styles.card}>
					<View style={styles.cardHead}>
						<Text style={styles.eyebrow}>SECURE REPAYMENT SETUP</Text>
						<Text style={styles.title}>Choose a setup method</Text>
						<Text style={styles.subtitle}>
							Automate your recurring payments so you never miss a due date.
						</Text>
					</View>

					<View style={styles.cardBody}>
						{typeQuery.isLoading ? (
							<View style={styles.loadingRow}>
								<ActivityIndicator size="small" color={C.green} />
								<Text style={styles.loadingText}>{t("mandateLoadingOptions")}</Text>
							</View>
						) : (
							<>
								{bank?.account_last4 ? (
									<View style={styles.bankCard}>
										<Text style={styles.bankCardTitle}>{t("mandateBankCardTitle").toUpperCase()}</Text>
										<View style={styles.bankCardRow}>
											<View style={styles.bankNameCol}>
												<MaterialIcons name="account-balance" size={20} color={C.green} />
												<Text style={styles.bankNameText} numberOfLines={1}>
													{bank.bank_name || ""}
												</Text>
											</View>
											<Text style={styles.bankAccountTailText}>
												{formatAccountTail(bank.account_last4)}
											</Text>
										</View>
										<Text style={styles.bankCardHint}>{t("mandateUseSameAccount")}</Text>
									</View>
								) : null}

								{fallbackToEnach ? (
									<>
										<View style={styles.enachNotice}>
											<MaterialIcons name="warning" size={18} color="#d97706" style={styles.noticeIcon} />
											<Text style={styles.enachNoticeText}>{t("mandateUpiFailedUseEnach")}</Text>
										</View>
										<View
											accessibilityRole="text"
											accessibilityLabel={optionAccessibilityLabel}
											style={[styles.option, styles.optionSelected]}>
											<MaterialIcons name="check-circle" size={22} color={C.green} />
											<Text style={styles.optionLabel}>{t("mandateEnachLabel")}</Text>
											<MaterialIcons name="credit-card" size={18} color={C.card} />
										</View>
									</>
								) : (
									<View
										accessibilityRole="text"
										accessibilityLabel={optionAccessibilityLabel}
										style={[styles.option, styles.optionSelected]}>
										<View style={styles.badge}>
											<Text style={styles.badgeText}>RECOMMENDED</Text>
										</View>
										<MaterialIcons name="check-circle" size={22} color={C.green} />
										<Text style={styles.optionLabel}>{t("mandateUpiOnlyLabel")}</Text>
										<MaterialIcons name="bolt" size={18} color={C.zap} />
									</View>
								)}
							</>
						)}

						<View style={styles.note}>
							<MaterialIcons name="lock" size={16} color={C.green} style={styles.noteIcon} />
							<Text style={styles.noteText}>
								Mandates can be paused, modified, or cancelled anytime from your banking
								application without any penalty.
							</Text>
						</View>
					</View>

					<View style={styles.cardFooter}>
						<TouchableOpacity
							style={[styles.proceed, isProceedDisabled && styles.proceedDisabled]}
							disabled={isProceedDisabled}
							onPress={handleProceed}
							activeOpacity={0.85}>
							{isSubmitting ? (
								<View style={styles.proceedRow}>
									<ActivityIndicator size="small" color={C.limeText} />
									<Text style={styles.proceedText}>Submitting...</Text>
								</View>
							) : (
								<View style={styles.proceedRow}>
									<Text style={styles.proceedText}>Proceed to Setup</Text>
									<MaterialIcons name="arrow-forward" size={20} color={C.limeText} />
								</View>
							)}
						</TouchableOpacity>
					</View>
				</View>
			</ScrollView>

			<View style={{ height: Math.max(insets.bottom, 8) }} />

			<ExitIntentModal
				visible={isExitModalVisible}
				onClose={() => setIsExitModalVisible(false)}
				onConfirmExit={() => {
					setIsExitModalVisible(false);
					router.replace("/(tabs)");
				}}
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: C.page },
	header: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: 16,
		paddingVertical: 12,
		backgroundColor: "#ffffff",
		borderBottomWidth: 1,
		borderBottomColor: "#f3f4f6",
	},
	backButton: { padding: 6, borderRadius: 8 },
	headerTitle: { fontSize: 18, fontWeight: "600", color: C.ink },
	headerRight: { width: 36 },
	scroll: { padding: width(4), paddingTop: height(2.5), paddingBottom: height(4) },
	card: {
		backgroundColor: "#ffffff",
		borderRadius: 24,
		borderWidth: 1,
		borderColor: "#e6ebe5",
		overflow: "hidden",
		elevation: 3,
		shadowColor: "#061714",
		shadowOpacity: 0.12,
		shadowRadius: 18,
		shadowOffset: { width: 0, height: 10 },
	},
	cardHead: {
		padding: 22,
		borderBottomWidth: 1,
		borderBottomColor: "#f3f4f6",
	},
	eyebrow: { fontSize: 11, fontWeight: "700", letterSpacing: 1.6, color: C.green },
	title: { marginTop: 6, fontSize: font(2.2), fontWeight: "700", color: C.ink },
	subtitle: { marginTop: 6, fontSize: font(1.5), lineHeight: font(2.2), color: C.grey },
	cardBody: { padding: 18, gap: 16 },
	loadingRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 10,
		paddingVertical: 20,
	},
	loadingText: {
		fontSize: font(1.5),
		color: C.grey,
		fontWeight: "500",
	},
	bankCard: {
		backgroundColor: C.note,
		borderWidth: 1,
		borderColor: C.noteBorder,
		borderRadius: 16,
		padding: 16,
		gap: 8,
	},
	bankCardTitle: {
		fontSize: 11,
		fontWeight: "700",
		letterSpacing: 0.8,
		color: C.grey,
	},
	bankCardRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: 12,
	},
	bankNameCol: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
		flex: 1,
	},
	bankNameText: {
		fontSize: font(1.6),
		fontWeight: "600",
		color: C.ink,
		flexShrink: 1,
	},
	bankAccountTailText: {
		fontSize: font(1.6),
		fontWeight: "600",
		color: C.ink,
	},
	bankCardHint: {
		fontSize: 11.5,
		lineHeight: 16,
		color: C.grey,
	},
	enachNotice: {
		flexDirection: "row",
		gap: 10,
		alignItems: "flex-start",
		backgroundColor: "#fffbeb",
		borderWidth: 1,
		borderColor: "#fde68a",
		borderRadius: 16,
		padding: 14,
	},
	noticeIcon: {
		marginTop: 2,
	},
	enachNoticeText: {
		flex: 1,
		fontSize: 12,
		lineHeight: 18,
		color: "#92400e",
		fontWeight: "500",
	},
	option: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
		borderWidth: 2,
		borderColor: C.border,
		borderRadius: 16,
		padding: 18,
		backgroundColor: "#ffffff",
	},
	optionSelected: { borderColor: C.green, backgroundColor: C.selectedBg },
	optionLabel: { fontSize: font(1.7), fontWeight: "600", color: C.ink },
	badge: {
		position: "absolute",
		top: -13,
		right: 18,
		backgroundColor: C.lime,
		borderRadius: 999,
		paddingHorizontal: 12,
		paddingVertical: 4,
	},
	badgeText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.6, color: C.badgeText },
	note: {
		flexDirection: "row",
		gap: 10,
		alignItems: "flex-start",
		backgroundColor: C.note,
		borderWidth: 1,
		borderColor: C.noteBorder,
		borderRadius: 16,
		padding: 14,
	},
	noteIcon: { marginTop: 2 },
	noteText: { flex: 1, fontSize: 11.5, lineHeight: 17, color: "#4b5563" },
	cardFooter: {
		padding: 18,
		borderTopWidth: 1,
		borderTopColor: "#f3f4f6",
		backgroundColor: "#fcfdfb",
	},
	proceed: {
		backgroundColor: C.lime,
		borderRadius: 16,
		paddingVertical: 16,
		alignItems: "center",
		justifyContent: "center",
	},
	proceedDisabled: { opacity: 0.6 },
	proceedRow: { flexDirection: "row", alignItems: "center", gap: 8 },
	proceedText: { fontSize: font(1.7), fontWeight: "700", color: C.limeText },
});
