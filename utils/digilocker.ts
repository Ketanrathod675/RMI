import { store } from "@/store";
import { completeDigilocker, IdentityApiError } from "@/utils/api";
import { decode, getUserIdFromToken } from "@/utils/encode_decode";
import Logger from "@/utils/logger";
import SecureStorage from "@/utils/secure-storage";
import { getStorageItem, removeStorageItem, setStorageItem, STORAGE_KEYS } from "@/utils/storage";
import { AppState } from "react-native";

export type DigilockerFinishResult = {
	status: "done" | "pending" | "retry" | "restart" | "unavailable" | "failed";
	code?: string;
	message?: string;
	httpStatus?: number;
};

export interface DigilockerSession {
	txnId: string;
	userId: string;
	startedAt: number; // ms epoch
}

export interface DigilockerFinishOptions {
	silent?: boolean;
	mode?: "single" | "poll";
}

export const DIGILOCKER_POLL_DELAYS = [
	2000, 3000, 4000, 5000, 6000, 8000, 10000,
] as const;

let digilockerGeneration = 0;
const inFlightMap = new Map<string, Promise<DigilockerFinishResult>>();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function getCurrentUserId(): Promise<string | null> {
	try {
		const stateUserId = store.getState()?.auth?.userId;
		if (stateUserId && typeof stateUserId === "string" && stateUserId.trim()) {
			return stateUserId.trim();
		}
	} catch {}

	try {
		const rawUserId = await getStorageItem(STORAGE_KEYS["@user-id"]);
		if (rawUserId) {
			const decoded = decode(rawUserId);
			if (decoded && decoded.trim()) {
				return decoded.trim();
			}
		}
	} catch {}

	try {
		const token = await SecureStorage.getSensitiveWithLegacyMigration(STORAGE_KEYS["@access-token"]);
		if (token) {
			const idFromToken = getUserIdFromToken(token);
			if (idFromToken) return idFromToken;
		}
	} catch {}

	return null;
}

export async function clearDigilockerSession(): Promise<void> {
	await removeStorageItem(STORAGE_KEYS["@digilocker-txn-id"]);
}

export async function saveDigilockerSession(txnId: string): Promise<void> {
	const userId = (await getCurrentUserId()) || "";
	const session: DigilockerSession = {
		txnId,
		userId,
		startedAt: Date.now(),
	};
	await setStorageItem(STORAGE_KEYS["@digilocker-txn-id"], JSON.stringify(session));
}

export async function loadDigilockerSession(): Promise<DigilockerSession | null> {
	const raw = await getStorageItem(STORAGE_KEYS["@digilocker-txn-id"]);
	if (!raw) return null;

	let parsed: any;
	try {
		parsed = JSON.parse(raw);
	} catch {
		Logger.warn("Clearing legacy plain string or invalid DigiLocker session from storage");
		await clearDigilockerSession();
		return null;
	}

	if (!parsed || typeof parsed !== "object" || !parsed.txnId || !parsed.startedAt) {
		Logger.warn("Clearing malformed DigiLocker session from storage");
		await clearDigilockerSession();
		return null;
	}

	const currentUserId = await getCurrentUserId();
	if (!currentUserId || !parsed.userId || parsed.userId !== currentUserId) {
		Logger.warn("Clearing DigiLocker session due to user mismatch", {
			sessionUserId: parsed.userId,
			currentUserId,
		});
		await clearDigilockerSession();
		return null;
	}

	const ageMs = Date.now() - Number(parsed.startedAt);
	if (ageMs > 25 * 60 * 1000 || ageMs < 0) {
		Logger.warn("Clearing expired DigiLocker session", { ageMs });
		await clearDigilockerSession();
		return null;
	}

	return {
		txnId: String(parsed.txnId),
		userId: String(parsed.userId),
		startedAt: Number(parsed.startedAt),
	};
}

export function cancelDigilockerChecks(): void {
	digilockerGeneration += 1;
	inFlightMap.clear();
	Logger.info("DigiLocker checks cancelled", { generation: digilockerGeneration });
}

function waitForActive(maxMs = 3000): Promise<boolean> {
	if (AppState.currentState === "active") {
		return Promise.resolve(true);
	}

	return new Promise((resolve) => {
		let timer: ReturnType<typeof setTimeout> | null = null;
		let subscription: { remove: () => void } | null = null;

		const cleanup = () => {
			if (timer) {
				clearTimeout(timer);
				timer = null;
			}
			if (subscription) {
				subscription.remove();
				subscription = null;
			}
		};

		subscription = AppState.addEventListener("change", (nextState) => {
			if (nextState === "active") {
				cleanup();
				resolve(true);
			}
		});

		timer = setTimeout(() => {
			cleanup();
			resolve(AppState.currentState === "active");
		}, maxMs);
	});
}

async function checkOnce(txnId: string): Promise<DigilockerFinishResult> {
	try {
		const res = await completeDigilocker({ txn_id: txnId });

		// Do not overwrite the stored txn with res.data.txn_id from the response;
		// if the response txn_id differs from the one we sent, log a warning with Logger and return status "restart".
		if (res.data?.txn_id && res.data.txn_id !== txnId) {
			Logger.warn("DigiLocker response txn_id differs from sent txnId; restarting session", {
				sentTxnId: txnId,
				responseTxnId: res.data.txn_id,
			});
			await clearDigilockerSession();
			return {
				status: "restart",
				code: "TXN_MISMATCH",
				message: "DigiLocker session mismatched. Please start a new session.",
				httpStatus: 200,
			};
		}

		Logger.debug("DigiLocker complete response", {
			success: res.success,
			code: res.data?.code,
			next_action: res.data?.next_action,
			step: res.data?.workflow_current_step,
		});

		if (res.success) {
			await clearDigilockerSession();
			return {
				status: "done",
				code: res.data?.code || "COMPLETED",
				message: res.message || "DigiLocker verification completed",
				httpStatus: 200,
			};
		}

		// When backend returns 200 envelope with success: false
		const code = res.data?.code || "";
		const msg = res.message || "";
		const msgLower = msg.toLowerCase();
		const httpStatus = 200;

		const isPending =
			code === "PENDING" ||
			code === "PROCESSING" ||
			msgLower.includes("not completed") ||
			msgLower.includes("pending") ||
			msgLower.includes("processing") ||
			msgLower.includes("in progress");

		if (isPending) {
			Logger.info("DigiLocker pending", { code, httpStatus });
			return {
				status: "pending",
				code: code || "PENDING",
				message: msg || "DigiLocker verification is still in progress.",
				httpStatus,
			};
		}

		Logger.error("finishDigilocker non-success", { httpStatus, code });

		if (code === "AADHAAR_NOT_SHARED") {
			await clearDigilockerSession();
			return {
				status: "restart",
				code: "AADHAAR_NOT_SHARED",
				message: "Aadhaar was not shared. Please retry and allow Aadhaar access in DigiLocker.",
				httpStatus,
			};
		}

		if (
			code === "SESSION_INVALID" ||
			code === "SESSION_EXPIRED" ||
			code === "TXN_MISMATCH" ||
			code === "TOO_MANY_CHECKS" ||
			msgLower.includes("invalid digilocker session") ||
			msgLower.includes("session expired")
		) {
			await clearDigilockerSession();
			return {
				status: "restart",
				code: code || "SESSION_EXPIRED",
				message: msg || "DigiLocker session expired. Please start a new session.",
				httpStatus,
			};
		}

		if (
			code === "PARSE_FAILED" ||
			code === "PHOTO_UNUSABLE" ||
			msgLower.includes("parse") ||
			msgLower.includes("photo")
		) {
			await clearDigilockerSession();
			return {
				status: "restart",
				code: code || "PARSE_FAILED",
				message: "We couldn't read your DigiLocker details. Please try again.",
				httpStatus,
			};
		}

		if (code === "CONFIG_MISSING") {
			return {
				status: "unavailable",
				code: "CONFIG_MISSING",
				message:
					__DEV__ && msg
						? msg
						: "DigiLocker is taking longer than usual. Please try again in a minute.",
				httpStatus,
			};
		}

		if (code === "PROVIDER_ERROR") {
			return {
				status: "unavailable",
				code: code || "PROVIDER_ERROR",
				message: "DigiLocker is taking longer than usual. Please try again in a minute.",
				httpStatus,
			};
		}

		return {
			status: "failed",
			code: code || "FAILED",
			message: "Something went wrong on our side. Please try again.",
			httpStatus,
		};
	} catch (err: any) {
		const httpStatus = err instanceof IdentityApiError ? err.status : err.response?.status;
		const code =
			(err instanceof IdentityApiError ? err.code : undefined) ||
			err.response?.data?.code ||
			err.response?.data?.data?.code ||
			"";
		const rawMsg =
			(err instanceof IdentityApiError ? err.detail || err.message : undefined) ||
			err.response?.data?.message ||
			err.message ||
			"";
		const msgLower = rawMsg.toLowerCase();

		// Network error with no HTTP response (timeout, offline)
		if (!httpStatus) {
			Logger.error("finishDigilocker network error", { httpStatus, code: "NETWORK_ERROR" });
			return {
				status: "retry",
				code: "NETWORK_ERROR",
				message: "No internet connection. Check your network and tap Check status.",
			};
		}

		const isPendingCatch =
			code === "PENDING" ||
			code === "PROCESSING" ||
			msgLower.includes("not completed") ||
			msgLower.includes("pending") ||
			msgLower.includes("processing") ||
			msgLower.includes("in progress");

		if (isPendingCatch) {
			Logger.info("DigiLocker pending (caught)", { code, httpStatus });
			return {
				status: "pending",
				code: code || "PENDING",
				message: rawMsg || "DigiLocker verification is still in progress.",
				httpStatus,
			};
		}

		Logger.error("finishDigilocker error caught", { httpStatus, code });

		if (code === "AADHAAR_NOT_SHARED") {
			await clearDigilockerSession();
			return {
				status: "restart",
				code: "AADHAAR_NOT_SHARED",
				message: "Aadhaar was not shared. Please retry and allow Aadhaar access in DigiLocker.",
				httpStatus,
			};
		}

		if (
			code === "SESSION_INVALID" ||
			code === "SESSION_EXPIRED" ||
			code === "TXN_MISMATCH" ||
			code === "TOO_MANY_CHECKS" ||
			(httpStatus === 400 &&
				(msgLower.includes("invalid") ||
					msgLower.includes("session") ||
					msgLower.includes("expired")))
		) {
			await clearDigilockerSession();
			return {
				status: "restart",
				code: code || "SESSION_EXPIRED",
				message: rawMsg || "DigiLocker session expired. Please start a new session.",
				httpStatus,
			};
		}

		if (
			code === "PARSE_FAILED" ||
			code === "PHOTO_UNUSABLE" ||
			msgLower.includes("parse") ||
			msgLower.includes("photo")
		) {
			await clearDigilockerSession();
			return {
				status: "restart",
				code: code || "PARSE_FAILED",
				message: "We couldn't read your DigiLocker details. Please try again.",
				httpStatus,
			};
		}

		if (code === "CONFIG_MISSING") {
			return {
				status: "unavailable",
				code: "CONFIG_MISSING",
				message:
					__DEV__ && rawMsg
						? rawMsg
						: "DigiLocker is taking longer than usual. Please try again in a minute.",
				httpStatus,
			};
		}

		if (
			code === "PROVIDER_ERROR" ||
			httpStatus === 502 ||
			httpStatus === 503
		) {
			return {
				status: "unavailable",
				code: code || "PROVIDER_ERROR",
				message: "DigiLocker is taking longer than usual. Please try again in a minute.",
				httpStatus,
			};
		}

		return {
			status: "failed",
			code: code || "FAILED",
			message: "Something went wrong on our side. Please try again.",
			httpStatus,
		};
	}
}

export async function finishDigilocker(
	txnId: string,
	options?: DigilockerFinishOptions,
): Promise<DigilockerFinishResult> {
	if (!txnId) {
		return {
			status: "restart",
			code: "NO_TXN_ID",
			message: "No DigiLocker transaction found.",
		};
	}

	const existing = inFlightMap.get(txnId);
	if (existing) {
		return existing;
	}

	const currentGen = digilockerGeneration;
	const isCancelled = () => digilockerGeneration !== currentGen;
	const mode = options?.mode ?? "poll";

	const flightPromise = (async (): Promise<DigilockerFinishResult> => {
		if (isCancelled()) {
			return { status: "restart", code: "CANCELLED", message: "Check cancelled" };
		}

		let result = await checkOnce(txnId);
		if (isCancelled()) {
			return { status: "restart", code: "CANCELLED", message: "Check cancelled" };
		}

		if (mode === "single") {
			return result;
		}

		// "poll" mode: retry if pending with backoff delays (max 8 calls total, ~38s)
		if (result.status === "pending") {
			for (const delay of DIGILOCKER_POLL_DELAYS) {
				await sleep(delay);
				if (isCancelled()) {
					return { status: "restart", code: "CANCELLED", message: "Check cancelled" };
				}
				result = await checkOnce(txnId);
				if (isCancelled()) {
					return { status: "restart", code: "CANCELLED", message: "Check cancelled" };
				}
				if (result.status !== "pending") {
					break;
				}
			}
		}

		return result;
	})().finally(() => {
		inFlightMap.delete(txnId);
	});

	inFlightMap.set(txnId, flightPromise);
	return flightPromise;
}
