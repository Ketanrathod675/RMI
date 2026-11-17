import { API_URL } from "./api/core/config";

/**
 * Resolves an avatar / image URL from backend response or local device storage.
 * Handles:
 * - full S3 / HTTPS URLs: "https://bucket.s3.amazonaws.com/selfie.jpg"
 * - base64 data URIs: "data:image/jpeg;base64,..."
 * - local file URIs: "file:///..."
 * - raw base64 payloads without "data:" prefix (e.g. starting with /9j/, iVBORw0KGgo, R0lGOD, UklGR)
 * - relative upload paths: "/uploads/..." or "uploads/..."
 */
export function resolveImageUrl(url?: string | null): string | null {
	if (!url || typeof url !== "string") return null;
	const trimmed = url.trim();
	if (!trimmed) return null;

	// Already a full remote URL
	if (/^https?:\/\//i.test(trimmed)) return trimmed;

	// Already a data URI or local device file URI
	if (
		trimmed.startsWith("data:") ||
		trimmed.startsWith("file://") ||
		trimmed.startsWith("ph://") ||
		trimmed.startsWith("content://")
	) {
		return trimmed;
	}

	// Detect raw base64 strings with magic image prefixes
	if (trimmed.startsWith("/9j/")) {
		return `data:image/jpeg;base64,${trimmed}`;
	}
	if (trimmed.startsWith("iVBORw0KGgo")) {
		return `data:image/png;base64,${trimmed}`;
	}
	if (trimmed.startsWith("R0lGOD")) {
		return `data:image/gif;base64,${trimmed}`;
	}
	if (trimmed.startsWith("UklGR")) {
		return `data:image/webp;base64,${trimmed}`;
	}

	// Long base64 string without spaces or path slashes (except standard base64)
	if (
		trimmed.length > 100 &&
		!trimmed.includes(" ") &&
		!trimmed.includes(".") &&
		/^[A-Za-z0-9+/=]+$/.test(trimmed)
	) {
		return `data:image/jpeg;base64,${trimmed}`;
	}

	// Relative path: resolve against the API domain root (without /api/v1)
	try {
		const base = (API_URL || "").replace(/\/api\/v1\/?$/i, "").replace(/\/+$/, "");
		const path = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
		return `${base}${path}`;
	} catch {
		return trimmed;
	}
}

/**
 * Returns any necessary HTTP headers for fetching the image.
 * E.g., for free ngrok tunnels, the "ngrok-skip-browser-warning" header prevents
 * returning an HTML interstitial warning page instead of the image binary.
 */
export function getImageHeaders(url?: string | null): Record<string, string> | undefined {
	if (!url || typeof url !== "string") return undefined;
	if (/ngrok/i.test(url)) {
		return { "ngrok-skip-browser-warning": "true" };
	}
	return undefined;
}

/**
 * Extracts a candidate selfie / image URL or path from an API response, profile object, or nested wrapper.
 */
export function extractSelfieUrl(source: any): string | null {
	if (!source) return null;
	if (typeof source === "string") {
		const trimmed = source.trim();
		return trimmed.length > 0 ? trimmed : null;
	}
	if (typeof source === "object") {
		const candidates = [
			source.selfie_url,
			source.selfie_upload_url,
			source.file_url,
			source.image_url,
			source.photo_url,
			source.avatar_url,
			source.url,
			source.data?.selfie_url,
			source.data?.selfie_upload_url,
			source.data?.file_url,
			source.data?.image_url,
			source.data?.photo_url,
			source.data?.avatar_url,
			source.data?.url,
		];
		for (const cand of candidates) {
			if (typeof cand === "string" && cand.trim().length > 0) {
				return cand.trim();
			}
		}
	}
	return null;
}

/**
 * Convenience helper returning { uri, headers? } for React Native <Image source={...} />
 */
export function getImageSource(
	url?: string | null,
): { uri: string; headers?: Record<string, string> } | null {
	const resolved = resolveImageUrl(url);
	if (!resolved) return null;
	const headers = getImageHeaders(resolved);
	return headers ? { uri: resolved, headers } : { uri: resolved };
}
