import { axios } from "../core/client";
import { URLS } from "../core/endpoints";
import type { StandardResponse } from "../types/common";

export interface PincodeLookupResponse {
	found: boolean;
	pin_code?: string;
	city?: string | null;
	district?: string | null;
	state?: string | null;
	serviceable?: boolean | null;
	message?: string | null;
}

/**
 * Lookup pincode details (city, district, state, serviceability)
 * GET pincode/lookup/{pin}
 */
export const getPincodeDetails = async (
	pin: string,
	signal?: AbortSignal,
): Promise<PincodeLookupResponse> => {
	const response = await axios.get<StandardResponse<PincodeLookupResponse> | PincodeLookupResponse>(
		URLS.pincode.lookup(pin),
		{ signal },
	);
	const data = (response.data as any)?.data ?? response.data;
	return data;
};
