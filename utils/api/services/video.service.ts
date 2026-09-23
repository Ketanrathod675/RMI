import Logger from "@/utils/logger";
import { axios } from "../core/client";
import { URLS } from "../core/endpoints";
import type { PaginatedResponse, StandardResponse } from "../types/common";

export interface BackendVideoItem {
	id: string;
	title: string;
	thumbnail_url: string;
	video_url: string;
	description?: string;
	duration?: string;
}

/**
 * Fetches public video tutorials list from FastAPI backend.
 * Public endpoint: GET /api/v1/videos (no authentication required)
 */
export const getVideos = async (): Promise<BackendVideoItem[]> => {
	try {
		const response = await axios.get<
			PaginatedResponse<BackendVideoItem> | StandardResponse<BackendVideoItem[]> | BackendVideoItem[]
		>(URLS.videos.list, {
			params: { page: 1, page_size: 100 },
		});

		const data = response.data;
		if (Array.isArray(data)) {
			return data;
		}
		if (data && "data" in data) {
			const payload = data.data;
			if (Array.isArray(payload)) {
				return payload;
			}
			if (payload && Array.isArray((payload as any).items)) {
				return (payload as any).items;
			}
		}
		return [];
	} catch (error) {
		Logger.warn("Failed to fetch videos from backend, falling back to local defaults", error);
		return [];
	}
};
