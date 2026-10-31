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
import Toast from "react-native-toast-message";
import { openExternalUrl } from "@/utils/openExternalUrl";
import { getSyncTranslation } from "@/utils/toast_translations";

/**
 * Opens or shares a locally downloaded PDF in an external viewer.
 * Uses expo-sharing if available (supports "Open With", "Save to Files", etc.),
 * and falls back to system linking or openExternalUrl with friendly toast on failure.
 */
export async function openLocalPdf(fileUri: string): Promise<void> {
	if (/^https?:\/\//i.test(fileUri)) {
		await openExternalUrl(fileUri);
		return;
	}

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

	try {
		let targetUri = fileUri;
		if (Platform.OS === "android" && !fileUri.startsWith("content://")) {
			try {
				targetUri = await FileSystem.getContentUriAsync(fileUri);
			} catch {
				targetUri = fileUri;
			}
		}

		if (await Linking.canOpenURL(targetUri)) {
			await Linking.openURL(targetUri);
			return;
		}
		throw new Error("No PDF viewer available");
	} catch {
		Toast.show({
			type: "error",
			text1: getSyncTranslation("errGeneric", "Unable to open document. Please install a PDF viewer."),
		});
	}
}

