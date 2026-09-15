import * as Application from "expo-application";

export type AppConfig = {
	_id?: string;
	latestVersion: string;
	minRequiredVersion: string;
	forceUpdate: boolean;
	playStoreUrl: string;
	updated_at?: string;
};

export type VersionCheckResult =
	| { status: "up-to-date" }
	| { status: "force-update"; playStoreUrl: string }
	| { status: "optional-update"; playStoreUrl: string }
	| { status: "error" };

/**
 * Compare two semantic version strings.
 * Returns:
 *  -1 if a < b
 *   0 if a === b
 *   1 if a > b
 */
export function compareVersions(a: string, b: string): -1 | 0 | 1 {
	const parse = (v: string) =>
		v
			.split(".")
			.map((n) => parseInt(n, 10) || 0)
			.concat([0, 0, 0])
			.slice(0, 3);

	const [aMajor, aMinor, aPatch] = parse(a);
	const [bMajor, bMinor, bPatch] = parse(b);

	if (aMajor !== bMajor) return aMajor < bMajor ? -1 : 1;
	if (aMinor !== bMinor) return aMinor < bMinor ? -1 : 1;
	if (aPatch !== bPatch) return aPatch < bPatch ? -1 : 1;
	return 0;
}

/**
 * Fetch the app config from the server and determine update status.
 * Gracefully returns { status: "error" } / { status: "up-to-date" } if request fails or offline.
 */
export async function checkAppVersion(apiUrl?: string): Promise<VersionCheckResult> {
	try {
		const currentVersion = Application.nativeApplicationVersion ?? "1.0.0";
		if (!apiUrl) {
			return { status: "up-to-date" };
		}

		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 3500);

		const response = await fetch(`${apiUrl}app-config/`, {
			method: "GET",
			headers: { "Content-Type": "application/json" },
			signal: controller.signal,
		});
		clearTimeout(timeoutId);

		if (!response.ok) {
			return { status: "error" };
		}

		const config: AppConfig = await response.json();

		if (config.minRequiredVersion && compareVersions(currentVersion, config.minRequiredVersion) < 0) {
			return { status: "force-update", playStoreUrl: config.playStoreUrl || "" };
		}

		if (config.forceUpdate && config.latestVersion && compareVersions(currentVersion, config.latestVersion) < 0) {
			return { status: "force-update", playStoreUrl: config.playStoreUrl || "" };
		}

		if (config.latestVersion && compareVersions(currentVersion, config.latestVersion) < 0) {
			return { status: "optional-update", playStoreUrl: config.playStoreUrl || "" };
		}

		return { status: "up-to-date" };
	} catch (error) {
		// Non-blocking graceful fallback
		return { status: "error" };
	}
}
