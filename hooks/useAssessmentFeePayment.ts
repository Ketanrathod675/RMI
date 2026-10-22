import { useNetworkAwareMutation } from "@/hooks/useNetworkAwareMutation";
import { useTranslation } from "@/hooks/useTranslation";
import { clearTransactionId, setTransactionId, useDispatch } from "@/store";
import { trackAssessmentFeePaid } from "@/utils/analytics";
import {
	checkPaymentStatus,
	errorHandler,
	getUserDashboardData,
	getUserProfile,
	initiateAssessmentFee,
} from "@/utils/api";
import { decode } from "@/utils/encode_decode";
import Logger from "@/utils/logger";
import { getStorageItem, removeStorageItem, setStorageItem, STORAGE_KEYS } from "@/utils/storage";
import { useQueryClient } from "@tanstack/react-query";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, DeviceEventEmitter, Platform, ToastAndroid } from "react-native";
import Toast from "react-native-toast-message";

const PAYMENT_RETURN_SCHEME = "rapid-money://";
const POLL_INTERVAL_MS = 4000;

/**
 * How long we keep asking the server, depending on HOW the user came back.
 * - deeplink_success : gateway told us "success", our server may just be a bit slow -> wait longest
 * - deeplink_failure : gateway told us it failed -> one quick confirmation
 * - browser_closed   : user pressed back / closed the tab / network error page -> short check
 * - manual           : user tapped "Check again"
 */
export type VerifySource =
	| "deeplink_success"
	| "deeplink_failure"
	| "browser_closed"
	| "manual";

const WINDOW_MS: Record<VerifySource, number> = {
	deeplink_success: 90_000,
	deeplink_failure: 8_000,
	browser_closed: 20_000,
	manual: 30_000,
};

export type PaymentOutcome =
	| null
	| {
		// cancelled   : user left the gateway without paying
		// failed      : gateway reported failure
		// expired     : the attempt timed out on the server
		// unconfirmed : we could not confirm either way (money might have been debited)
		type: "cancelled" | "failed" | "expired" | "unconfirmed";
		txnId: string;
	};

type Classified = "SUCCESS" | "FAILED" | "CANCELLED" | "EXPIRED" | "PENDING" | "ERROR";

const classify = (res: any): { kind: Classified; notStarted: boolean } => {
	const raw = String(res?.data?.status ?? "").toUpperCase();
	const notStarted = res?.data?.reason === "not_started";
	if (["COMPLETED", "SUCCESS", "WAIVED"].includes(raw)) return { kind: "SUCCESS", notStarted };
	if (["FAILED", "FAILURE", "REJECTED", "DROPPED", "BOUNCED"].includes(raw))
		return { kind: "FAILED", notStarted };
	if (["CANCELLED", "CANCELED", "USERCANCELLED"].includes(raw))
		return { kind: "CANCELLED", notStarted };
	if (raw === "EXPIRED") return { kind: "EXPIRED", notStarted };
	return { kind: "PENDING", notStarted };
};

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export type InitiatePaymentResponse = {
	status: string;
	message: string;
	payment_data: Record<string, any>;
	payment_methods: Record<string, any>;
	next_step: string;
};

interface UseAssessmentFeePaymentOptions {
	processingFeeAmount: number;
	leadId?: string;
	couponCode?: string;
	onPaymentSuccess: (txnId: string) => void;
	onCouponRejected?: () => void;
}

export const useAssessmentFeePayment = ({
	processingFeeAmount,
	leadId,
	couponCode,
	onPaymentSuccess,
	onCouponRejected,
}: UseAssessmentFeePaymentOptions) => {
	const { t } = useTranslation();
	const dispatch = useDispatch();
	const queryClient = useQueryClient();

	const [isPaymentInitiated, setIsPaymentInitiated] = useState(false);
	const [isPaymentPolling, setIsPaymentPolling] = useState(false);
	const [isPaymentCompleted, setIsPaymentCompleted] = useState(false);
	const [delayVisible, setDelayVisible] = useState(false);
	const [paymentOutcome, setPaymentOutcome] = useState<PaymentOutcome>(null);
	const [outcomePending, setOutcomePending] = useState(false);
	const [paymentStatus, setPaymentStatus] = useState({
		paymentPending: false,
		paymentTimer: 0,
		timerStartTime: 0,
	});

	// One verification loop at a time. Bumping runIdRef cancels any loop already running.
	const runIdRef = useRef(0);
	const activeRef = useRef<{ txnId: string; source: VerifySource } | null>(null);
	const gatewayOpenRef = useRef(false);
	const windowSecRef = useRef(0);
	const mountedRef = useRef(true);
	const retriedInProgressRef = useRef(false);
	const onSuccessRef = useRef(onPaymentSuccess);
	onSuccessRef.current = onPaymentSuccess;
	const successHandledRef = useRef<Set<string>>(new Set());
	const outcomeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const urlHook = Linking.useLinkingURL();

	const clearTimer = async () => {
		await removeStorageItem(STORAGE_KEYS["@assessment-timer-id"]);
	};

	const clearStoredPayment = useCallback(async () => {
		dispatch(clearTransactionId());
		await removeStorageItem(STORAGE_KEYS["@transaction-id"]);
		await removeStorageItem(STORAGE_KEYS["@payment-timer-start"]);
	}, [dispatch]);

	useEffect(() => {
		mountedRef.current = true;
		return () => {
			mountedRef.current = false;
			runIdRef.current += 1; // stop any running loop
			if (outcomeTimerRef.current) {
				clearTimeout(outcomeTimerRef.current);
				outcomeTimerRef.current = null;
			}
		};
	}, []);

	// Countdown shown on the button. Display only: it never touches storage or navigation.
	useEffect(() => {
		if (!paymentStatus.paymentPending || paymentStatus.timerStartTime <= 0) return;
		const id = setInterval(() => {
			const elapsed = Math.floor((Date.now() - paymentStatus.timerStartTime) / 1000);
			const remaining = Math.max(0, windowSecRef.current - elapsed);
			setPaymentStatus((prev) => ({ ...prev, paymentTimer: remaining }));
		}, 1000);
		return () => clearInterval(id);
	}, [paymentStatus.paymentPending, paymentStatus.timerStartTime]);

	const resetPendingUi = () => {
		setIsPaymentPolling(false);
		setDelayVisible(false);
		setIsPaymentInitiated(false);
		setPaymentStatus({ paymentPending: false, paymentTimer: 0, timerStartTime: 0 });
	};

	/** One server check. Never throws. */
	const checkOnce = async (txnId: string): Promise<{ kind: Classified; notStarted: boolean; res?: any }> => {
		try {
			const res = await checkPaymentStatus(txnId);
			Logger.debug("Payment status response", res);
			return { ...classify(res), res };
		} catch (err) {
			Logger.warn("Payment status check failed (will retry)", err);
			return { kind: "ERROR", notStarted: false };
		}
	};

	const POST_FEE_STEPS = [
		"pan_verification",
		"customer_consent_step",
		"professional_details",
		"ekyc_ckyc",
		"selfie_match",
		"address_submission",
		"loan_application",
		"bank_details",
		"kfs_signing",
		"enach_mandate",
		"agreement_signing",
		"disbursement",
		"credit_queue",
		"digilocker",
		"ckyc",
	];

	/** Safety net: did the workflow already move past the fee step on the server? */
	const workflowAdvanced = async (): Promise<boolean> => {
		try {
			const dash: any = await getUserDashboardData();
			const step = String(
				dash?.current_step || dash?.workflow_progress?.current_step || dash?.current_step_info?.step || "",
			).toLowerCase().trim();
			const status = String(
				dash?.workflow_progress?.overall_status || dash?.kyc_status || ""
			).toLowerCase().trim();

			if (status === "rejected" || status === "failed" || step.includes("reject") || step.includes("fail")) {
				return false;
			}

			return POST_FEE_STEPS.includes(step);
		} catch {
			return false;
		}
	};

	const finishSuccess = async (txnId: string, res?: any) => {
		const canonicalTxnId = res?.data?.txnid || txnId;
		gatewayOpenRef.current = false;
		activeRef.current = null;
		resetPendingUi();
		setIsPaymentCompleted(true);
		setOutcomePending(false);

		if (successHandledRef.current.has(canonicalTxnId)) {
			return;
		}
		successHandledRef.current.add(canonicalTxnId);

		await setStorageItem(STORAGE_KEYS["@latest-assessment-fee-txnid"], canonicalTxnId);
		await clearStoredPayment();
		const paymentRef = res?.data?.payment_id || res?.data?.easepayid || canonicalTxnId;
		trackAssessmentFeePaid(processingFeeAmount, paymentRef).catch(() => { });
		queryClient.invalidateQueries({ queryKey: ["user", "dashboard"] });
		onSuccessRef.current(canonicalTxnId);
	};

	const finishWithOutcome = async (
		type: NonNullable<PaymentOutcome>["type"],
		txnId: string,
	) => {
		// "unconfirmed" keeps the txn id so we can re-check later (money may have left the account).
		if (type !== "unconfirmed") await clearStoredPayment();
		gatewayOpenRef.current = false;
		activeRef.current = null;
		resetPendingUi();
		setOutcomePending(true);
		// Give the full-screen loader a moment to close before presenting another modal (iOS drops stacked modals).
		if (outcomeTimerRef.current) {
			clearTimeout(outcomeTimerRef.current);
		}
		outcomeTimerRef.current = setTimeout(() => {
			if (mountedRef.current) {
				setPaymentOutcome({ type, txnId });
				setOutcomePending(false);
			}
		}, 450);
	};

	/**
	 * Verify a transaction with the server until it resolves to success / failure / cancelled,
	 * or the window for this "source" runs out. Always ends in exactly one terminal state.
	 */
	const verifyPayment = async (txnId: string, source: VerifySource) => {
		const current = activeRef.current;
		if (current && current.txnId === txnId) {
			// Already verifying this txn. Only restart if we just learned something stronger.
			if (!(source === "deeplink_success" && current.source !== "deeplink_success") && source !== "manual") return;
		}

		const runId = ++runIdRef.current;
		activeRef.current = { txnId, source };
		gatewayOpenRef.current = false;

		const windowMs = WINDOW_MS[source];
		const startedAt = Date.now();
		windowSecRef.current = Math.ceil(windowMs / 1000);

		setPaymentOutcome(null);
		setIsPaymentPolling(true);
		setDelayVisible(true);
		setPaymentStatus({ paymentPending: true, paymentTimer: windowSecRef.current, timerStartTime: startedAt });
		setStorageItem(STORAGE_KEYS["@payment-timer-start"], String(startedAt)).catch(() => { });
		DeviceEventEmitter.emit("HIDE_GLOBAL_LOADER");

		const isStale = () => runIdRef.current !== runId || !mountedRef.current;
		let notStartedHits = 0;
		let consecutiveErrors = 0;

		while (!isStale()) {
			const r = await checkOnce(txnId);
			if (isStale()) return;

			if (r.kind === "SUCCESS") return finishSuccess(txnId, r.res);
			if (r.kind === "FAILED") return finishWithOutcome("failed", txnId);
			if (r.kind === "CANCELLED") return finishWithOutcome("cancelled", txnId);
			if (r.kind === "EXPIRED") return finishWithOutcome("expired", txnId);

			if (r.kind === "ERROR") {
				consecutiveErrors += 1;
				if (consecutiveErrors >= 2 && (await workflowAdvanced())) {
					return finishSuccess(txnId);
				}
			} else {
				consecutiveErrors = 0;
			}

			// The user left the gateway and the server has no payment attempt at all -> they backed out.
			if (source === "browser_closed" && r.kind === "PENDING" && r.notStarted) {
				notStartedHits += 1;
				if (notStartedHits >= 2) return finishWithOutcome("cancelled", txnId);
			}

			if (Date.now() - startedAt >= windowMs) break;
			await sleep(POLL_INTERVAL_MS);
		}
		if (isStale()) return;

		// Window over, still no answer.
		if (await workflowAdvanced()) return finishSuccess(txnId);

		if (source === "deeplink_failure") return finishWithOutcome("failed", txnId);
		// Could not confirm: never auto-navigate away and never silently drop the txn.
		return finishWithOutcome("unconfirmed", txnId);
	};

	// ---- Recover a payment that was in flight when the app was killed / backgrounded ----
	useEffect(() => {
		(async () => {
			const pendingTxn = await getStorageItem(STORAGE_KEYS["@transaction-id"]);
			if (!pendingTxn) return;
			await removeStorageItem(STORAGE_KEYS["@payment-timer-start"]);
			const r = await checkOnce(pendingTxn);
			if (r.kind === "SUCCESS") return finishSuccess(pendingTxn, r.res);
			if (["FAILED", "CANCELLED", "EXPIRED"].includes(r.kind)) await clearStoredPayment();
			// The user never reached the gateway / never paid: forget this attempt so no stale state is carried over.
			if (r.kind === "PENDING" && r.notStarted) await clearStoredPayment();
			// Other PENDING / ERROR: leave it; the server supersedes abandoned attempts when the user pays again.
		})();
	}, []);

	// ---- Deep link return (rapid-money://assessment-fee-success?txnid=..&status=..) ----
	useEffect(() => {
		(async () => {
			if (!urlHook) return;
			const { hostname, queryParams } = Linking.parse(urlHook);
			if (!hostname?.includes("assessment-fee")) return;
			const txnId = await getStorageItem(STORAGE_KEYS["@transaction-id"]);
			if (!txnId || queryParams?.txnid !== txnId) return;
			const ok = String(queryParams?.status).toLowerCase() === "success";
			verifyPayment(txnId, ok ? "deeplink_success" : "deeplink_failure");
		})();
	}, [urlHook]);

	// ---- User came back to the app (app switcher / back) while the gateway was open ----
	useEffect(() => {
		const sub = AppState.addEventListener("change", (state) => {
			if (state !== "active" || !gatewayOpenRef.current || activeRef.current) return;
			// Set verifying state synchronously FIRST to avoid visible assessment screen gap
			setIsPaymentPolling(true);
			setDelayVisible(true);
			setPaymentStatus((prev) => ({ ...prev, paymentPending: true }));
			(async () => {
				const txnId = await getStorageItem(STORAGE_KEYS["@transaction-id"]);
				if (txnId) {
					verifyPayment(txnId, "browser_closed");
				} else {
					resetPendingUi();
				}
			})();
		});
		return () => sub.remove();
	}, []);

	// ---- Start payment ----
	const { mutate: initiatePayment, isPending } = useNetworkAwareMutation({
		mutationFn: async () => {
			setPaymentOutcome(null);
			let targetLeadId = leadId;
			if (!targetLeadId) targetLeadId = (await getStorageItem(STORAGE_KEYS["@lead-id"])) || undefined;
			if (!targetLeadId) {
				try {
					const profile = await getUserProfile();
					const meData = (profile as any)?.data || profile;
					const wf = meData?.current_workflow;
					const kycResp = wf?.profile_response;
					const recoveredLeadId = wf?.lead_id || kycResp?.lead_id;
					if (recoveredLeadId) {
						targetLeadId = String(recoveredLeadId);
						await setStorageItem(STORAGE_KEYS["@lead-id"], targetLeadId);
					}
					const fee = kycResp?.af_amount || kycResp?.assessment_fee;
					if (fee) {
						await setStorageItem(STORAGE_KEYS["@assessment-fee-amount"], String(fee));
						await setStorageItem(STORAGE_KEYS["@assessment-fee"], String(fee));
					}
					if (kycResp?.af) {
						await setStorageItem(STORAGE_KEYS["@af-flag"], String(kycResp.af));
					}
				} catch (recoverErr) {
					console.warn("⚠️ [useAssessmentFeePayment] Failed to recover leadId from /auth/me:", recoverErr);
				}
			}
			if (!targetLeadId) throw new Error("Lead ID is missing. Please submit your basic details again.");

			let resolvedPhone = "";
			let resolvedName = "Applicant";
			let resolvedEmail = "";
			try {
				const rawPhone = await getStorageItem(STORAGE_KEYS["@phone-number"]);
				if (rawPhone) {
					try {
						resolvedPhone = decode(rawPhone).replace(/\D/g, "").slice(-10);
					} catch {
						resolvedPhone = rawPhone.replace(/\D/g, "").slice(-10);
					}
				}
			} catch { }
			try {
				const profile = await getUserProfile();
				const full = profile?.personal_details?.full_name || (profile as any)?.profile?.full_name || (profile as any)?.name;
				if (full) resolvedName = full.split(" ")[0].trim() || "Applicant";
				if (profile?.email) resolvedEmail = profile.email.trim();
				if (!resolvedEmail && (profile as any)?.personal_details?.email) {
					resolvedEmail = (profile as any).personal_details.email.trim();
				}
				if (!resolvedPhone && (profile as any)?.phone_number)
					resolvedPhone = String((profile as any).phone_number).replace(/\D/g, "").slice(-10);
			} catch { }

			if (!resolvedPhone || resolvedPhone.length < 10) {
				throw new Error("Valid 10-digit mobile number required. Please complete your profile before proceeding.");
			}
			if (!resolvedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resolvedEmail)) {
				throw new Error("Valid email address required. Please complete your profile before proceeding.");
			}

			return await initiateAssessmentFee({
				lead_id: targetLeadId,
				phone_no: resolvedPhone.slice(-10),
				firstname: resolvedName.slice(0, 50),
				email: resolvedEmail.slice(0, 100),
				coupon_code: couponCode || null,
			});
		},
		onSuccess: async (res) => {
			const data = (res as any)?.data ?? res;
			if (!data) {
				Toast.show({ type: "error", text1: t("unableToInitiatePayment"), text2: t("pleaseRetryPayment") });
				return;
			}

			if (data.status === "WAIVED" || data.amount === 0) {
				await clearTimer();
				setIsPaymentInitiated(false);
				setIsPaymentCompleted(true);
				const waivedTxn = data.txnid || "WAIVED";
				await setStorageItem(STORAGE_KEYS["@latest-assessment-fee-txnid"], waivedTxn);
				onSuccessRef.current(waivedTxn);
				return;
			}

			if (typeof data.amount === "number" && Math.abs(data.amount - processingFeeAmount) >= 1) {
				Toast.show({ type: "info", text1: `Amount updated to ₹${data.amount}` });
			}

			const url = data.payment_url || data.payment_link;
			const txnid = data.txnid || data.transaction_id || data.order_id;
			if (!url || !txnid) {
				Toast.show({ type: "error", text1: t("unableToInitiatePayment"), text2: t("pleaseRetryPayment") });
				return;
			}

			await clearTimer();
			if (Platform.OS === "android") {
				ToastAndroid.show(t("redirectingToYourBrowser") || "Opening payment gateway...", ToastAndroid.SHORT);
			}

			dispatch(setTransactionId(txnid));
			await setStorageItem(STORAGE_KEYS["@transaction-id"], txnid);
			await setStorageItem(STORAGE_KEYS["@latest-assessment-fee-txnid"], txnid);
			setIsPaymentInitiated(true);
			gatewayOpenRef.current = true;

			// No loader, no polling while the user is inside the gateway (they may take minutes).
			setTimeout(async () => {
				try {
					const result: any = await WebBrowser.openAuthSessionAsync(url, PAYMENT_RETURN_SCHEME);
					Logger.debug("Payment browser session closed", result?.type);

					// Set verifying state synchronously immediately upon browser return
					setIsPaymentPolling(true);
					setDelayVisible(true);
					setPaymentStatus((prev) => ({ ...prev, paymentPending: true }));

					if (result?.type === "success" && result?.url) {
						const { queryParams } = Linking.parse(result.url);
						const ok = String(queryParams?.status).toLowerCase() === "success";
						verifyPayment(txnid, ok ? "deeplink_success" : "deeplink_failure");
					} else {
						// cancel / dismiss / locked. On Android "dismiss" also happens after a good payment,
						// so we never trust the result type: the server is the source of truth.
						verifyPayment(txnid, "browser_closed");
					}
				} catch (err) {
					Logger.warn("openAuthSessionAsync failed, falling back to Linking.openURL", err);
					await Linking.openURL(url).catch((e) => Logger.error("Failed to open payment URL", e));
					// Return is picked up by the deep-link effect or the AppState listener.
				}
			}, 300);
		},
		onError: (err, variables, ctx) => {
			const { error } = errorHandler(err, variables, ctx);
			const rawDetail = (err as any)?.response?.data?.detail;

			// Backend says a previous attempt for this lead was actually paid -> verify it instead of paying twice.
			if (rawDetail && typeof rawDetail === "object" && rawDetail.code === "PAYMENT_ALREADY_PAID" && rawDetail.txnid) {
				setStorageItem(STORAGE_KEYS["@transaction-id"], rawDetail.txnid).catch(() => { });
				verifyPayment(rawDetail.txnid, "manual");
				return;
			}

			// An older attempt is still open on the server (e.g. app was closed mid-payment).
			// Check it once; if it is not paid the backend retires it, so one silent retry is safe.
			if (typeof rawDetail === "string" && /already in progress/i.test(rawDetail) && !retriedInProgressRef.current) {
				retriedInProgressRef.current = true;
				(async () => {
					const storedTxn = await getStorageItem(STORAGE_KEYS["@transaction-id"]);
					if (storedTxn) {
						const r = await checkOnce(storedTxn);
						if (r.kind === "SUCCESS") return finishSuccess(storedTxn, r.res);
						await clearStoredPayment();
					}
					setTimeout(() => {
						retriedInProgressRef.current = false;
						initiatePayment();
					}, 1200);
				})();
				return;
			}
			retriedInProgressRef.current = false;

			if (rawDetail && /coupon/i.test(String(rawDetail))) onCouponRejected?.();
			const displayMessage = typeof rawDetail === "string" ? rawDetail : error?.message ?? t("pleaseRetryPayment");
			Toast.show({ type: "error", text1: t("errorInitiatingPayment"), text2: displayMessage });
		},
	});

	/** "Check again" from the unconfirmed dialog. */
	const recheckPayment = async () => {
		const txnId = paymentOutcome?.txnId || (await getStorageItem(STORAGE_KEYS["@transaction-id"]));
		if (txnId) verifyPayment(txnId, "manual");
	};

	/** Close the result dialog. "unconfirmed" keeps the stored txn so it can still be re-checked. */
	const dismissPaymentOutcome = () => setPaymentOutcome(null);

	/** Dev only */
	const simulateDeepLinkReturn = (status: "success" | "failure", txnId?: string) => {
		if (__DEV__ && txnId) {
			DeviceEventEmitter.emit("HIDE_GLOBAL_LOADER");
			verifyPayment(txnId, status === "success" ? "deeplink_success" : "deeplink_failure");
		}
	};

	return {
		initiatePayment,
		isPending,
		isPaymentInitiated,
		isPaymentPolling,
		isPaymentCompleted,
		delayVisible,
		setDelayVisible,
		paymentStatus,
		paymentOutcome,
		outcomePending,
		recheckPayment,
		dismissPaymentOutcome,
		simulateDeepLinkReturn,
		clearTimer,
		clearStoredPayment,
	};
};

export default useAssessmentFeePayment;