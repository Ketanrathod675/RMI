import { useJourneyTracker } from "@/hooks/useJourneyTracker";
import { type MandateVerifySource, useMandateVerification } from "@/hooks/useMandateVerification";
import { useTranslation } from "@/hooks/useTranslation";
import { getUserDashboardData, StepHref } from "@/utils/api";
import { font, height } from "@/utils/dimensions";
import { getStorageItem, removeStorageItem, STORAGE_KEYS } from "@/utils/storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, AppState, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function EmandateStatus() {
	const { t } = useTranslation();
	const insets = useSafeAreaInsets();
	const router = useRouter();
	const params = useLocalSearchParams<{ status?: string; txnid?: string; source?: string }>();
	useJourneyTracker("/emandate-status");

	const {
		state,
		outcome,
		lastStatus,
		txnid,
		nextStep,
		verify,
		recheck,
		recover,
	} = useMandateVerification();

	const [canLeave, setCanLeave] = useState(false);

	const goNext = useCallback(
		async (step?: string | null) => {
			if (outcome !== "success") {
				void recheck();
				return;
			}
			let targetStep = step;
			if (!targetStep) {
				try {
					const dash: any = await getUserDashboardData();
					targetStep = dash?.workflow_progress?.current_step || dash?.current_step;
				} catch {
					// ignore
				}
			}

			// The mandate endpoint has already confirmed success. Dashboard workflow state
			// can lag behind that result, so don't reclassify a completed mandate as incomplete.
			const normalizedStep = String(targetStep ?? "").trim().toLowerCase();
			if (!normalizedStep || normalizedStep === "enach_mandate" || normalizedStep === "auto_debit_setup") {
				router.replace("/loan-congratulations" as any);
				return;
			}

			const href = StepHref[targetStep as keyof typeof StepHref];
			router.replace((href && href !== "/auto-debit-setup" ? href : "/loan-congratulations") as any);
		},
		[outcome, recheck, router],
	);

	const tryAgain = useCallback(async () => {
		await removeStorageItem(STORAGE_KEYS["@mandate-pending"]).catch(() => undefined);
		router.replace({ pathname: "/auto-debit-setup", params: { fresh: "1" } } as any);
	}, [router]);

	// When success is confirmed, show the success state briefly then navigate.
	useEffect(() => {
		if (outcome === "success") {
			const timer = setTimeout(() => {
				void goNext(nextStep);
			}, 1500);
			return () => clearTimeout(timer);
		}
	}, [outcome, nextStep, goNext]);

	// When mandate registration is in progress, auto-redirect to Home after 10 seconds (matching web)
	useEffect(() => {
		if (outcome === "in_progress") {
			const timer = setTimeout(() => {
				router.replace("/(tabs)");
			}, 10_000);
			return () => clearTimeout(timer);
		}
	}, [outcome, router]);

	// Allow leaving to home after waiting 8s in waiting_bank state
	useEffect(() => {
		if (state !== "waiting_bank") {
			setCanLeave(false);
			return;
		}
		const timer = setTimeout(() => {
			setCanLeave(true);
		}, 8_000);
		return () => clearTimeout(timer);
	}, [state]);

	// Re-check when app becomes active ONLY IF in the unconfirmed state
	useEffect(() => {
		const sub = AppState.addEventListener("change", (next) => {
			if (next === "active" && outcome === "unconfirmed") {
				void recheck();
			}
		});
		return () => sub.remove();
	}, [outcome, recheck]);

	// Mount verification
	useEffect(() => {
		let cancelled = false;

		const init = async () => {
			let lookupTxn = params.txnid ? String(params.txnid) : "";
			if (!lookupTxn) {
				try {
					const stored = await getStorageItem(STORAGE_KEYS["@mandate-pending"]);
					if (stored) {
						lookupTxn = String(JSON.parse(stored)?.txnid ?? "");
					}
				} catch {
					// ignore malformed record
				}
			}

			const sourceParam = params.source;
			if (sourceParam === "recovered") {
				const res = await recover(lookupTxn);
				if (cancelled) return;
				if (res.outcome === "failed_or_not_started") {
					router.replace({ pathname: "/auto-debit-setup", params: { fresh: "1" } } as any);
				}
				return;
			}

			let verifySource: MandateVerifySource;
			if (
				sourceParam &&
				["deeplink_success", "deeplink_pending", "deeplink_failure", "browser_closed", "manual"].includes(
					sourceParam,
				)
			) {
				verifySource = sourceParam as MandateVerifySource;
			} else {
				const rawStatus = String(params.status ?? "").trim().toLowerCase();
				if (rawStatus === "true") {
					verifySource = "deeplink_success";
				} else if (rawStatus === "pending") {
					verifySource = "deeplink_pending";
				} else if (rawStatus === "false") {
					verifySource = "deeplink_failure";
				} else {
					verifySource = "browser_closed";
				}
			}

			if (!cancelled) {
				void verify(lookupTxn, verifySource);
			}
		};

		void init();

		return () => {
			cancelled = true;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	return (
		<View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
			{outcome === "in_progress" ? (
				<View style={styles.center}>
					<View style={styles.amberBadge}>
						<ActivityIndicator size="small" color="#d97706" />
					</View>
					<Text style={styles.progressTitle}>{t("mandateRegistrationInProgress")}</Text>
					<Text style={styles.subtitle}>
						{t("mandateRegistrationInProgressDesc")}
					</Text>
					{!!txnid && <Text style={styles.meta}>Reference: {txnid}</Text>}
					<TouchableOpacity style={styles.button} onPress={() => router.replace("/(tabs)")}>
						<Text style={styles.buttonText}>{t("returnToHome")}</Text>
					</TouchableOpacity>
				</View>
			) : outcome === "failed" ? (
				<View style={styles.center}>
					<Text style={styles.title}>{t("mandateFailed")}</Text>
					<Text style={styles.subtitle}>
						{t("mandateFailedDesc")}
					</Text>
					<TouchableOpacity style={styles.button} onPress={tryAgain}>
						<Text style={styles.buttonText}>{t("tryEmandateAgain")}</Text>
					</TouchableOpacity>
				</View>
			) : outcome === "cancelled" ? (
				<View style={styles.center}>
					<Text style={styles.title}>{t("mandateCancelled")}</Text>
					<Text style={styles.subtitle}>
						{t("mandateCancelledDesc")}
					</Text>
					<TouchableOpacity style={styles.button} onPress={tryAgain}>
						<Text style={styles.buttonText}>{t("tryEmandateAgain")}</Text>
					</TouchableOpacity>
				</View>
			) : outcome === "unconfirmed" ? (
				<View style={styles.center}>
					<Text style={styles.title}>{t("mandateUnconfirmed")}</Text>
					<Text style={styles.subtitle}>
						{t("mandateUnconfirmedDesc")}
					</Text>
					{!!lastStatus && <Text style={styles.meta}>Status: {lastStatus}</Text>}
					{!!txnid && <Text style={styles.meta}>Reference: {txnid}</Text>}
					<TouchableOpacity
						style={styles.button}
						onPress={() => {
							void recheck();
						}}>
						<Text style={styles.buttonText}>{t("checkAgain")}</Text>
					</TouchableOpacity>
					<TouchableOpacity style={styles.secondary} onPress={tryAgain}>
						<Text style={styles.secondaryText}>{t("tryEmandateAgain")}</Text>
					</TouchableOpacity>
					<TouchableOpacity style={styles.link} onPress={() => router.replace("/(tabs)")}>
						<Text style={styles.linkText}>{t("goToDashboard")}</Text>
					</TouchableOpacity>
				</View>
			) : (
				<View style={styles.center}>
					<ActivityIndicator size="large" color="#15803d" />
					<Text style={styles.subtitle}>
						{state === "success" || outcome === "success"
							? t("mandateSuccessfulSubtitle")
							: state === "waiting_bank"
								? t("mandateWaitingBankSubtitle")
								: t("mandateVerifyingSubtitle")}
					</Text>
					{state === "waiting_bank" && (
						<Text style={styles.meta}>
							{t("mandateWaitingBankNote")}
						</Text>
					)}
					{canLeave && state === "waiting_bank" && (
						<TouchableOpacity style={styles.link} onPress={() => router.replace("/(tabs)")}>
							<Text style={styles.linkText}>{t("continueLaterGoToHome")}</Text>
						</TouchableOpacity>
					)}
				</View>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: "#f5f7f2" },
	center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 28, gap: 14 },
	progressTitle: { fontSize: font(2.2), fontWeight: "700", color: "#d97706", textAlign: "center" },
	amberBadge: {
		width: 64,
		height: 64,
		borderRadius: 32,
		backgroundColor: "#fef3c7",
		borderWidth: 2,
		borderColor: "#fde68a",
		alignItems: "center",
		justifyContent: "center",
		marginBottom: 8,
	},
	title: { fontSize: font(2.2), fontWeight: "700", color: "#13251b", textAlign: "center" },
	subtitle: { fontSize: font(1.6), color: "#4b5563", textAlign: "center", lineHeight: font(2.4) },
	meta: { fontSize: font(1.3), color: "#6b7280", textAlign: "center" },
	button: {
		marginTop: height(2),
		backgroundColor: "#B7FB52",
		borderRadius: 16,
		paddingVertical: 14,
		paddingHorizontal: 28,
	},
	buttonText: { fontSize: font(1.6), fontWeight: "700", color: "#113922" },
	secondary: {
		borderRadius: 16,
		borderWidth: 1.5,
		borderColor: "#15803d",
		paddingVertical: 12,
		paddingHorizontal: 28,
	},
	secondaryText: { fontSize: font(1.5), fontWeight: "700", color: "#15803d" },
	link: { padding: 10 },
	linkText: { fontSize: font(1.5), color: "#15803d", fontWeight: "600" },
});
