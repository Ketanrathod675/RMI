import Logger from "@/utils/logger";

import { axios } from "../core/client";
import { URLS } from "../core/endpoints";
import type { PaginatedResponse, StandardResponse } from "../types/common";

export type FAQItem = {
	id: string;
	category?: string | null;
	question: string;
	answer: string;
	created_at: string;
};

export type CustomerCare = {
	email: string | null;
	phone: string | null;
	whatsapp: string | null;
};

export const getFaqs = async (): Promise<FAQItem[]> => {
	const response = await axios.get<PaginatedResponse<FAQItem>>(URLS.faq.list, {
		params: { page: 1, page_size: 100 },
	});
	return response.data.data?.items ?? [];
};

/** Handles both dedicated /general-info/customer-care and generic /general-info paginated lists */
export const getCustomerCare = async (): Promise<CustomerCare | null> => {
	try {
		const response = await axios.get<StandardResponse<any>>(
			URLS.general_info.customer_care,
		);
		const payload = response.data?.data;
		if (!payload) return null;

		// 1. If backend returns direct key-value mapping: { email, phone, whatsapp }
		if (
			payload.email !== undefined ||
			payload.phone !== undefined ||
			payload.whatsapp !== undefined
		) {
			return {
				email: payload.email ?? null,
				phone: payload.phone ?? null,
				whatsapp: payload.whatsapp ?? null,
			};
		}

		// 2. If backend returns paginated items: { items: [ { slug, value } ] }
		if (Array.isArray(payload.items)) {
			const care: CustomerCare = { email: null, phone: null, whatsapp: null };
			for (const item of payload.items) {
				if (item.slug === "customer-care-phone") care.phone = item.value;
				if (item.slug === "customer-care-whatsapp") care.whatsapp = item.value;
				if (item.slug === "customer-care-email") care.email = item.value;
			}
			return care;
		}

		return null;
	} catch (error) {
		Logger.warn("Customer-care configuration is unavailable; using app fallbacks", error);
		return null;
	}
};
