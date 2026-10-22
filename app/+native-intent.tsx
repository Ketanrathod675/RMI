/**
 * Native intent handler for deep links (Phase 1.4).
 * Intercepts incoming deep links before Expo Router routes them to avoid blank screens or duplicate mountings.
 */
export function redirectSystemPath({
	path,
	initial,
}: {
	path: string;
	initial: boolean;
}): string | Promise<string | null> | null {
	try {
		const normalizedPath = path.startsWith("/") ? path : `/${path}`;
		const dummyBase = "http://localhost";
		const url = new URL(normalizedPath, dummyBase);
		const pathname = url.pathname;
		const searchParams = url.searchParams;

		const txnid = searchParams.get("txnid");

		// 1. Payment return: assessment-fee-success with txnid -> redirect to /new-assessment-fee
		if (pathname.includes("assessment-fee-success") && txnid) {
			const query = searchParams.toString();
			return `/new-assessment-fee${query ? `?${query}` : ""}`;
		}

		// 2. Mandate return: support the backend app callback and Easebuzz status aliases.
		const callbackStatus =
			searchParams.get("mandate_status")
			?? searchParams.get("payment_status")
			?? searchParams.get("status")
			?? searchParams.get("success");
		if (
			(pathname === "/" || pathname === "" || pathname.includes("emandate-return") || pathname.includes("emandate-status")) &&
			callbackStatus !== null
		) {
			const statusLower = callbackStatus.trim().toLowerCase();
			let source = "deeplink_failure";
			if (["true", "success", "successful", "completed", "active", "authorized", "authorised"].includes(statusLower)) {
				source = "deeplink_success";
			} else if (["pending", "initiated", "processing", "inprogress", "in_process"].includes(statusLower)) {
				source = "deeplink_pending";
			}
			searchParams.set("status", statusLower);
			searchParams.set("source", source);
			return `/emandate-status?${searchParams.toString()}`;
		}

		return path;
	} catch {
		return path;
	}
}
