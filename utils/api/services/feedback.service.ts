import { decode } from "@/utils/encode_decode";
import Logger from "@/utils/logger";
import { getStorageItem, STORAGE_KEYS } from "@/utils/storage";
import { axios } from "../core/client";
import { URLS } from "../core/endpoints";
import type { PaginatedResponse, StandardResponse } from "../types/common";

export type RateUsPayload = {
	rating: number; // 1 to 5
	feedback: string;
	suggestions?: string;
	is_recommended?: boolean;
};

export type RateUsItem = {
	id: string;
	user_id: string;
	user_name?: string | null;
	rating: number;
	feedback: string;
	suggestions?: string | null;
	is_recommended: boolean;
	created_at: string;
	updated_at: string;
};

/**
 * Submit new rating and feedback (POST /rate-us)
 */
export const submitFeedback = async (
	payload: RateUsPayload,
): Promise<RateUsItem> => {
	const response = await axios.post<StandardResponse<RateUsItem>>(
		URLS.rate_us.base,
		payload,
	);
	return response.data.data;
};

/**
 * Update existing rating and feedback (PUT /rate-us/{id})
 */
export const updateFeedback = async (
	id: string,
	payload: Partial<RateUsPayload>,
): Promise<RateUsItem> => {
	const response = await axios.put<StandardResponse<RateUsItem>>(
		URLS.rate_us.by_id(id),
		payload,
	);
	return response.data.data;
};

/**
 * Fetch feedback from the backend, filtered by the user's ID
 */
export const getUserFeedback = async (
	userId?: string,
): Promise<RateUsItem | null> => {
	let targetUserId = userId;
	if (!targetUserId) {
		try {
			const raw = await getStorageItem(STORAGE_KEYS["@user-id"]);
			if (raw) {
				try {
					targetUserId = decode(raw);
				} catch {
					targetUserId = raw;
				}
			}
		} catch (_err) {
			// ignore storage read error
		}
	}

	if (!targetUserId) return null;

	try {
		const response = await axios.get<PaginatedResponse<RateUsItem>>(
			URLS.rate_us.base,
			{
				params: { user_id: targetUserId, page: 1, page_size: 1 },
			},
		);
		const items = response.data?.data?.items ?? [];
		return (
			items.find(
				(item) =>
					String(item.user_id).toLowerCase() === String(targetUserId).toLowerCase(),
			) ?? null
		);
	} catch (error) {
		Logger.warn("Failed to fetch user feedback:", error);
		return null;
	}
};

/**
 * Smart helper: Creates new feedback or updates existing feedback if already submitted
 */
export const saveFeedback = async (
	payload: RateUsPayload,
	existingId?: string | null,
	userId?: string | null,
): Promise<RateUsItem> => {
	if (existingId) {
		return await updateFeedback(existingId, payload);
	}
	try {
		return await submitFeedback(payload);
	} catch (err: any) {
		const detail = err?.response?.data?.detail;
		if (
			typeof detail === "string" &&
			detail.toLowerCase().includes("already submitted")
		) {
			// Find existing review ID and update instead
			const existing = await getUserFeedback(userId ?? undefined);
			if (existing?.id) {
				return await updateFeedback(existing.id, payload);
			}
		}
		throw err;
	}
};

/**
 * Fetch public reviews for displaying on the dashboard carousel (GET /rate-us)
 */
export const getPublicReviews = async (
	pageSize: number = 10,
): Promise<RateUsItem[]> => {
	try {
		const response = await axios.get<PaginatedResponse<RateUsItem>>(
			URLS.rate_us.base,
			{
				params: { page: 1, page_size: pageSize, sort_by: "created_at", sort_order: "desc" },
			},
		);
		return response.data?.data?.items ?? [];
	} catch (error) {
		Logger.warn("Failed to fetch public reviews for dashboard:", error);
		return [];
	}
};

