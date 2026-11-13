import AsyncStorage from "@react-native-async-storage/async-storage";
import { generateUUID } from "@/utils/paymentVerification";
import { IDEMPOTENCY_KEY_PREFIX } from "@/utils/storage";

export interface IdempotencyEntry {
	key: string;
	fingerprint: string;
	createdAt: number;
	amount?: number;
	expiresAt?: number;
}

const DEFAULT_TTL_MS = 30 * 60 * 1000;

export function getIdempotencyStorageKey(scope: string): string {
	return `${IDEMPOTENCY_KEY_PREFIX}${scope}`;
}

/**
 * Reads a persisted idempotency entry if valid and unexpired.
 * Returns null (and deletes the entry) when expired by expiresAt or corrupted.
 */
export async function getIdempotencyEntry(
	scope: string,
	ttlMs: number = DEFAULT_TTL_MS,
): Promise<IdempotencyEntry | null> {
	const storageKey = getIdempotencyStorageKey(scope);
	try {
		const raw = await AsyncStorage.getItem(storageKey);
		if (!raw) return null;

		const parsed = JSON.parse(raw) as Partial<IdempotencyEntry> | null;
		if (!parsed || typeof parsed.key !== "string" || typeof parsed.createdAt !== "number") {
			await AsyncStorage.removeItem(storageKey);
			return null;
		}

		const now = Date.now();
		if (now - parsed.createdAt >= ttlMs) {
			await AsyncStorage.removeItem(storageKey);
			return null;
		}

		if (typeof parsed.expiresAt === "number" && now >= parsed.expiresAt) {
			await AsyncStorage.removeItem(storageKey);
			return null;
		}

		return {
			key: parsed.key,
			fingerprint: typeof parsed.fingerprint === "string" ? parsed.fingerprint : "",
			createdAt: parsed.createdAt,
			...(typeof parsed.amount === "number" ? { amount: parsed.amount } : {}),
			...(typeof parsed.expiresAt === "number" ? { expiresAt: parsed.expiresAt } : {}),
		};
	} catch {
		await AsyncStorage.removeItem(storageKey).catch(() => {});
		return null;
	}
}

/**
 * Returns the persisted key for scope only if fingerprint matches and entry has not expired;
 * otherwise generates, persists, and returns a new UUID key.
 */
export async function getOrCreateIdempotencyKey(
	scope: string,
	fingerprint: string,
	ttlMs: number = DEFAULT_TTL_MS,
): Promise<string> {
	const existing = await getIdempotencyEntry(scope, ttlMs);
	if (existing && existing.fingerprint === fingerprint) {
		return existing.key;
	}

	const nextEntry: IdempotencyEntry = {
		key: generateUUID(),
		fingerprint,
		createdAt: Date.now(),
	};
	await AsyncStorage.setItem(getIdempotencyStorageKey(scope), JSON.stringify(nextEntry));
	return nextEntry.key;
}

/**
 * Merges extra fields (such as amount or expiresAt) onto an existing stored entry.
 */
export async function updateIdempotencyKeyMeta(
	scope: string,
	meta: Partial<Pick<IdempotencyEntry, "amount" | "expiresAt">>,
): Promise<void> {
	const storageKey = getIdempotencyStorageKey(scope);
	try {
		const raw = await AsyncStorage.getItem(storageKey);
		if (!raw) return;
		const parsed = JSON.parse(raw) as IdempotencyEntry | null;
		if (!parsed || typeof parsed.key !== "string") return;

		const updated: IdempotencyEntry = {
			...parsed,
			...(meta.amount !== undefined ? { amount: meta.amount } : {}),
			...(meta.expiresAt !== undefined ? { expiresAt: meta.expiresAt } : {}),
		};
		await AsyncStorage.setItem(storageKey, JSON.stringify(updated));
	} catch {
		// Ignore storage metadata update errors
	}
}

/**
 * Removes the persisted idempotency key for the given scope.
 */
export async function clearIdempotencyKey(scope: string): Promise<void> {
	await AsyncStorage.removeItem(getIdempotencyStorageKey(scope));
}

