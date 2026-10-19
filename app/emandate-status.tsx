import { useJourneyTracker } from "@/hooks/useJourneyTracker";
import { getMandateStatus, getUserDashboardData, StepHref } from "@/utils/api";
import { font, height } from "@/utils/dimensions";
import { getStorageItem, removeStorageItem, STORAGE_KEYS } from "@/utils/storage";
import { useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, AppState, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const FAST_POLL_MS = 3000;
const SLOW_POLL_MS = 6000;
const FAST_POLL_WINDOW_MS = 60_000;
const NO_CALLBACK_AFTER_MS = 45_000; // gateway never reported back (closed tab / unreachable return page)
const TOTAL_LIMIT_MS = 5 * 60_000;
const OFFER_HOME_AFTER_MS = 20_000;
const FAILED_STATUSES = ["failure", "failed", "usercancelled", "dropped", "bounced"];

type ViewState = "verifying" | "waiting_bank" | "success" | "failed" | "not_confirmed";

const clearPendingMandate = () => removeStorageItem(STORAGE_KEYS["@mandate-pending"]).catch(() => undefined);

/**
 * Mirrors the assessment-fee payment handling:
 *  - a pending attempt is remembered (see auto-debit-setup) and re-checked on return / app foreground;
 *  - the screen never waits forever: it ends in success, failed, or "not confirmed" with clear actions;
 *  - success is shown only after the workflow really moved past enach_mandate.
 */
export default function EmandateStatus() {
	const insets = useSafeAreaInsets();
	const router = useRouter();
	const queryClient = useQueryClient();
	const params = useLocalSearchParams<{ status?: string; txnid?: string }>();
	useJourneyTracker("/emandate-status");

	const callbackStatus = String(params.status ?? "").trim().toLowerCase();
	const [state, setState] = useState<ViewState>(callbackStatus === "false" ? "failed" : "verifying");
	const [attempt, setAttempt] = useState(0);
	const [lastStatus, setLastStatus] = useState("");
	const [txnid, setTxnid] = useState(String(params.txnid ?? ""));
	const [canLeave, setCanLeave] = useState(false);

	const goNext = useCallback(
		(step?: string | null) => {
			const href = step ? StepHref[step as keyof typeof StepHref] : undefined;
			router.replace((href && href !== "/auto-debit-setup" ? href : "/(tabs)") as any);
		},
		[router],
	);

	const tryAgain = useCallback(async () => {
		await clearPendingMandate();
		router.replace({ pathname: "/auto-debit-setup", params: { fresh: "1" } } as any);
	}, [router]);

	// Re-check immediately when the borrower comes back to the app (e.g. after closing the bank tab).
	useEffect(() => {
		const sub = AppState.addEventListener("change", (next) => {
			if (next === "active") setAttempt((a) => a + 1);
		});
		return () => sub.remove();
	}, []);

	useEffect(() => {
		if (callbackStatus === "false" && attempt === 0) {
			void clearPendingMandate();
			return; // gateway already said failed
		}
		let cancelled = false;
		const startedAt = Date.now();
		let bankSince: number | null = null;
		const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
		setState("verifying");
		setCanLeave(false);

		(async () => {
			let lookupTxn = txnid;
			if (!lookupTxn) {
				try {
					const stored = await getStorageItem(STORAGE_KEYS["@mandate-pending"]);
					if (stored) lookupTxn = String(JSON.parse(stored)?.txnid ?? "");
				} catch {
					// ignore malformed record
				}
			}

			while (!cancelled) {
				try {
					const dash: any = await getUserDashboardData();
					const step: string | undefined = dash?.workflow_progress?.current_step;
					if (step && step !== "enach_mandate") {
						if (cancelled) return;
						setState("success");
						await clearPendingMandate();
						queryClient.invalidateQueries({ queryKey: ["user", "dashboard"] });
						await wait(1500);
						if (!cancelled) goNext(step);
						return;
					}

					const mandate = await getMandateStatus(lookupTxn || undefined);
					const data = mandate?.data;
					const raw = String(data?.status ?? "").toLowerCase();
					if (!cancelled) {
						setLastStatus(String(data?.status ?? ""));
						if (data?.txnid) setTxnid(String(data.txnid));
					}
					if (FAILED_STATUSES.includes(raw)) {
						await clearPendingMandate();
						if (!cancelled) setState("failed");
						return;
					}
					if (data?.is_active) {
						bankSince = bankSince ?? Date.now();
						if (!cancelled) {
							setState("waiting_bank");
							if (Date.now() - bankSince > OFFER_HOME_AFTER_MS) setCanLeave(true);
						}
					} else if (data && data.callback_received === false && Date.now() - startedAt > NO_CALLBACK_AFTER_MS) {
						// The gateway never reported back: do not spin forever.
						if (!cancelled) setState("not_confirmed");
						return;
					}
				} catch {
					// keep polling; a slow or offline server must not end the verification
				}

				const elapsed = Date.now() - startedAt;
				if (elapsed > TOTAL_LIMIT_MS) {
					if (!cancelled) setState("not_confirmed");
					return;
				}
				await wait(elapsed < FAST_POLL_WINDOW_MS ? FAST_POLL_MS : SLOW_POLL_MS);
			}
		})();

		return () => {
			cancelled = true;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [attempt]);

	return (
		<View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
			{state === "failed" ? (
				<View style={styles.center}>
					<Text style={styles.title}>Mandate Failed</Text>
					<Text style={styles.subtitle}>
						We couldn’t complete the mandate. Please try again or contact support.
					</Text>
					<TouchableOpacity style={styles.button} onPress={tryAgain}>
						<Text style={styles.buttonText}>Try e-Mandate Again</Text>
					</TouchableOpacity>
				</View>
			) : state === "not_confirmed" ? (
				<View style={styles.center}>
					<Text style={styles.title}>We couldn’t confirm your mandate</Text>
					<Text style={styles.subtitle}>
						If you finished the bank step, wait a minute and check again. If the bank page showed an
						error or you closed it, start the setup again.
					</Text>
					{!!lastStatus && <Text style={styles.meta}>Status: {lastStatus}</Text>}
					{!!txnid && <Text style={styles.meta}>Reference: {txnid}</Text>}
					<TouchableOpacity style={styles.button} onPress={() => setAttempt((a) => a + 1)}>
						<Text style={styles.buttonText}>Check again</Text>
					</TouchableOpacity>
					<TouchableOpacity style={styles.secondary} onPress={tryAgain}>
						<Text style={styles.secondaryText}>Try e-Mandate Again</Text>
					</TouchableOpacity>
					<TouchableOpacity style={styles.link} onPress={() => router.replace("/(tabs)")}>
						<Text style={styles.linkText}>Go to Home</Text>
					</TouchableOpacity>
				</View>
			) : (
				<View style={styles.center}>
					<ActivityIndicator size="large" color="#15803d" />
					<Text style={styles.subtitle}>
						{state === "success"
							? "Mandate setup successful. Updating your application status."
							: state === "waiting_bank"
								? "Your mandate was submitted. Waiting for your bank to confirm it."
								: "Please wait, we are verifying your mandate."}
					</Text>
					{state === "waiting_bank" && (
						<Text style={styles.meta}>
							You can keep this screen open; it moves on as soon as the bank confirms.
						</Text>
					)}
					{canLeave && state === "waiting_bank" && (
						<TouchableOpacity style={styles.link} onPress={() => router.replace("/(tabs)")}>
							<Text style={styles.linkText}>Continue later (go to Home)</Text>
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
