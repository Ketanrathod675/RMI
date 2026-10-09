import { getUserProfile } from "@/utils/api/services/user.service";
import { getStorageItem, STORAGE_KEYS } from "@/utils/storage";

/**
 * Resolves lead_id across all available sources in priority order:
 * 1. Explicit parameter / route param (if passed)
 * 2. Authenticated user profile / current_workflow
 * 3. AsyncStorage `@lead-id`
 */
export async function resolveLeadId(explicitLeadId?: string | null): Promise<string> {
	if (explicitLeadId && String(explicitLeadId).trim()) {
		return String(explicitLeadId).trim();
	}

	try {
		const profile = await getUserProfile();
		const meData = (profile as any)?.data || profile;
		const wf = meData?.current_workflow;
		const kycResp = wf?.profile_response;
		const recoveredLeadId = wf?.lead_id || kycResp?.lead_id;
		if (recoveredLeadId) {
			return String(recoveredLeadId);
		}
	} catch {
		// Fallback to local storage
	}

	const storedLeadId = await getStorageItem(STORAGE_KEYS["@lead-id"]);
	if (storedLeadId && String(storedLeadId).trim()) {
		return String(storedLeadId).trim();
	}

	return "";
}
