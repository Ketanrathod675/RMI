import * as FileSystem from "expo-file-system/legacy";
import * as Linking from "expo-linking";
import { Platform } from "react-native";

import SecureStorage from "@/utils/secure-storage";
import { STORAGE_KEYS } from "@/utils/storage";

import { getApiBaseUrl } from "../core/client";

/**
 * Builds an absolute URL for an API path or a server-relative URL.
 * Accepts "loan/kfs/document/file", "/api/v1/loan/kfs/document/file" or a full http(s) URL.
 */
export function resolveApiUrl(pathOrUrl: string): string {
	if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
	const base = getApiBaseUrl().replace(/\/+$/, "");
	if (pathOrUrl.startsWith("/")) {
		// Server-relative URL such as /api/v1/...: attach to the origin, not the base path.
		const origin = base.replace(/\/api\/v\d+$/, "");
		return `${origin}${pathOrUrl}`;
	}
	return `${base}/${pathOrUrl}`;
}

/**
 * Downloads a PDF from an authenticated API endpoint into the app's document
 * directory and returns the local file URI. Throws on any non-200 response so
 * callers never show a stale or placeholder document.
 */
export async function downloadAuthenticatedPdf(
	pathOrUrl: string,
	fileName: string,
): Promise<string> {
	const token = await SecureStorage.getSensitiveWithLegacyMigration(
		STORAGE_KEYS["@access-token"],
	);
	if (!token) {
		throw new Error("Not authenticated");
	}

	const dir = (FileSystem as any).documentDirectory || "";
	const destination = `${dir}${fileName}`;
	try {
		await FileSystem.deleteAsync(destination, { idempotent: true });
	} catch {
		// ignore: nothing to delete
	}

	const response = await FileSystem.downloadAsync(
		resolveApiUrl(pathOrUrl),
		destination,
		{ headers: { Authorization: `Bearer ${token}` } },
	);
	if (response.status !== 200) {
		await FileSystem.deleteAsync(destination, { idempotent: true }).catch(
			() => undefined,
		);
		throw new Error(`PDF download failed (${response.status})`);
	}
	return response.uri;
}

import * as Sharing from "expo-sharing";

/**
 * Opens or shares a locally downloaded PDF in an external viewer.
 * Uses expo-sharing if available (supports "Open With", "Save to Files", etc.),
 * and falls back to system linking.
 */
export async function openLocalPdf(fileUri: string): Promise<void> {
	try {
		const isSharingAvailable = await Sharing.isAvailableAsync();
		if (isSharingAvailable) {
			await Sharing.shareAsync(fileUri, {
				mimeType: "application/pdf",
				dialogTitle: "Sanction Letter",
				UTI: "com.adobe.pdf",
			});
			return;
		}
	} catch {
		// Fallback to linking if sharing fails
	}

	if (Platform.OS === "android") {
		const contentUri = await FileSystem.getContentUriAsync(fileUri);
		await Linking.openURL(contentUri);
		return;
	}
	await Linking.openURL(fileUri);
}
