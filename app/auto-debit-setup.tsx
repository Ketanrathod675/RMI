import { useJourneyTracker } from "@/hooks/useJourneyTracker";
import {
	createMandate,
	getMandateStatus,
	getUserDashboardData,
	StepHref,
	type MandateMethod,
} from "@/utils/api";
import { getApiErrorInfo } from "@/utils/api/errors";
import { font, height, width } from "@/utils/dimensions";
import Logger from "@/utils/logger";
import { getStorageItem, removeStorageItem, setStorageItem, STORAGE_KEYS } from "@/utils/storage";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useQueryClient } from "@tanstack/react-query";
import * as Linking from "expo-linking";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
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

const RETURN_URL = Linking.createURL("emandate-status");

const PENDING_MANDATE_MAX_AGE_MS = 30 * 60 * 1000;

const FINISHED_STATUSES = new Set([
	"success",
	"authorized",
	"initiated",
	"pending",
	"failure",
	"failed",
	"usercancelled",
	"dropped",
	"bounced",
]);

const isMandateFinished = (data?: { current_step?: string | null; status?: string | null }) => {
	if (!data) return false;
	const currentStep = data.current_step;
	if (currentStep && currentStep !== "enach_mandate") {
		return true;
	}
	const rawStatus = (data.status ?? "").toLowerCase().trim();
	if (FINISHED_STATUSES.has(rawStatus)) {
		return true;
	}
	return false;
};

const dismissPaymentTab = () => {
	try {
		if (typeof WebBrowser.dismissAuthSession === "function") {
			WebBrowser.dismissAuthSession();
		}
	} catch {
		// Platform might not support dismissAuthSession
	}
	try {
		if (typeof WebBrowser.dismissBrowser === "function") {
			void WebBrowser.dismissBrowser().catch(() => {});
		}
	} catch {
		// Platform might not support dismissBrowser
	}
};

export default function AutoDebitSetup() {
	const insets = useSafeAreaInsets();
	const router = useRouter();
	const navigation = useNavigation();
	const queryClient = useQueryClient();
	useJourneyTracker("/auto-debit-setup");

	const [selectedMethod, setSelectedMethod] = useState<MandateMethod>("upi");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isExitModalVisible, setIsExitModalVisible] = useState(false);
	const pollingRef = useRef<{ stop: () => void } | null>(null);
	const { fresh } = useLocalSearchParams<{ fresh?: string }>();

	const stopPolling = () => {
		if (pollingRef.current) {
			pollingRef.current.stop();
			pollingRef.current = null;
		}
	};

	useEffect(() => {
		return () => {
			stopPolling();
		};
	}, []);

	// A mandate attempt was started earlier (app closed / bank tab closed): resume its verification
	// instead of showing a blank form, exactly like a pending assessment-fee payment.
	useEffect(() => {
		if (fresh === "1") return;
		let active = true;
		(async () => {
			try {
				const stored = await getStorageItem(STORAGE_KEYS["@mandate-pending"]);
				if (!stored || !active) return;
				const pending = JSON.parse(stored) as { txnid?: string; startedAt?: number };
				if (!pending.startedAt || Date.now() - pending.startedAt > PENDING_MANDATE_MAX_AGE_MS) {
					await removeStorageItem(STORAGE_KEYS["@mandate-pending"]);
					return;
				}
				router.replace({ pathname: "/emandate-status" as any, params: { txnid: pending.txnid ?? "" } });
			} catch {
				// ignore a malformed record
			}
		})();
		return () => {
			active = false;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// If the mandate is already done (or the borrower is not at this step), do not show the form.
	useEffect(() => {
		let active = true;
		(async () => {
			try {
				const dash: any = await getUserDashboardData();
				const step: string | undefined = dash?.workflow_progress?.current_step;
				if (!active || !step || step === "enach_mandate") return;
				const href = StepHref[step as keyof typeof StepHref];
				if (href && href !== "/auto-debit-setup") router.replace(href as any);
			} catch {
				// Non-blocking: stay on the form if the workflow cannot be read.
			}
		})();
		return () => {
			active = false;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

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
		if (isSubmitting || pollingRef.current) return;
		setIsSubmitting(true);
		stopPolling();
		try {
			const mandate = await createMandate(selectedMethod);
			if (!mandate?.url) {
				throw new Error("The payment gateway did not return a checkout URL.");
			}
			queryClient.invalidateQueries({ queryKey: ["user", "dashboard"] });
			await setStorageItem(
				STORAGE_KEYS["@mandate-pending"],
				JSON.stringify({ txnid: mandate.txnid ?? "", method: selectedMethod, startedAt: Date.now() }),
			);

			let isStopped = false;
			let intervalId: ReturnType<typeof setInterval> | null = null;
			let timeoutId: ReturnType<typeof setTimeout> | null = null;
			let polledStatus = "";
			let polledTxnid = "";

			const stop = () => {
				if (isStopped) return;
				isStopped = true;
				if (intervalId) {
					clearInterval(intervalId);
					intervalId = null;
				}
				if (timeoutId) {
					clearTimeout(timeoutId);
					timeoutId = null;
				}
			};

			pollingRef.current = { stop };

			const checkStatus = async () => {
				if (isStopped) return;
				try {
					Logger.debug("Checking e-Mandate status in background");
					const res = await getMandateStatus(mandate.txnid ?? undefined);
					const data = res?.data;
					if (data?.status) polledStatus = String(data.status);
					if (data?.txnid) polledTxnid = String(data.txnid);

					if (isMandateFinished(data)) {
						Logger.debug("e-Mandate status check detected completion; closing payment tab");
						stop();
						dismissPaymentTab();
					}
				} catch {
					// errors while checking are ignored (the next tick tries again); never throw out of the loop
				}
			};

			intervalId = setInterval(() => {
				void checkStatus();
			}, 3000);

			timeoutId = setTimeout(() => {
				stop();
			}, 15 * 60 * 1000);

			let status = "";
			let txnid = "";
			try {
				const result = await WebBrowser.openAuthSessionAsync(mandate.url, RETURN_URL);
				if (result.type === "success" && result.url) {
					const { queryParams } = Linking.parse(result.url);
					status = String(queryParams?.status ?? "");
					txnid = String(queryParams?.txnid ?? "");
				}
			} finally {
				stop();
				pollingRef.current = null;
			}

			if (!status && polledStatus) {
				status = polledStatus;
			}
			if (!txnid && polledTxnid) {
				txnid = polledTxnid;
			}
			if (!txnid && mandate.txnid) {
				txnid = mandate.txnid;
			}

			router.replace({ pathname: "/emandate-status" as any, params: { status, txnid } });
		} catch (err) {
			stopPolling();
			const info = getApiErrorInfo(err);
			Toast.show({
				type: "error",
				text1: "Unable to start mandate setup",
				text2: info.detail || info.message || "Please try again.",
			});
		} finally {
			setIsSubmitting(false);
		}
	};

	const Radio = ({ selected }: { selected: boolean }) => (
		<View style={[styles.radio, selected && styles.radioSelected]}>
			{selected && <View style={styles.radioDot} />}
		</View>
	);

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
						<TouchableOpacity
							activeOpacity={0.9}
							disabled={isSubmitting}
							onPress={() => setSelectedMethod("upi")}
							accessibilityRole="radio"
							accessibilityState={{ selected: selectedMethod === "upi" }}
							style={[styles.option, selectedMethod === "upi" && styles.optionSelected]}>
							<View style={styles.badge}>
								<Text style={styles.badgeText}>RECOMMENDED</Text>
							</View>
							<Radio selected={selectedMethod === "upi"} />
							<Text style={styles.optionLabel}>Auto Debit via UPI</Text>
							<MaterialIcons name="bolt" size={18} color={C.zap} />
						</TouchableOpacity>

						<TouchableOpacity
							activeOpacity={0.9}
							disabled={isSubmitting}
							onPress={() => setSelectedMethod("enach")}
							accessibilityRole="radio"
							accessibilityState={{ selected: selectedMethod === "enach" }}
							style={[styles.option, selectedMethod === "enach" && styles.optionSelected]}>
							<Radio selected={selectedMethod === "enach"} />
							<Text style={styles.optionLabel}>Auto Debit via eNACH</Text>
							<MaterialIcons name="credit-card" size={18} color={C.card} />
						</TouchableOpacity>

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
							style={[styles.proceed, isSubmitting && styles.proceedDisabled]}
							disabled={isSubmitting}
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
	radio: {
		width: 24,
		height: 24,
		borderRadius: 12,
		borderWidth: 2,
		borderColor: "#d1d5db",
		alignItems: "center",
		justifyContent: "center",
	},
	radioSelected: { borderColor: C.green, backgroundColor: C.green },
	radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#ffffff" },
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
