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

const extractStringValue = (val: any): string | null => {
	if (val == null) return null;
	if (typeof val === "string") {
		const trimmed = val.trim();
		return trimmed.length > 0 ? trimmed : null;
	}
	if (typeof val === "number") {
		return String(val);
	}
	if (typeof val === "object") {
		if (typeof val.value === "string" && val.value.trim().length > 0) {
			return val.value.trim();
		}
		if (typeof val.content === "string" && val.content.trim().length > 0) {
			return val.content.trim();
		}
		if (typeof val.phone === "string" && val.phone.trim().length > 0) {
			return val.phone.trim();
		}
		if (typeof val.email === "string" && val.email.trim().length > 0) {
			return val.email.trim();
		}
		if (typeof val.whatsapp === "string" && val.whatsapp.trim().length > 0) {
			return val.whatsapp.trim();
		}
	}
	return null;
};

const populateFromItems = (items: any[], care: CustomerCare) => {
	for (const item of items) {
		const rawSlug = String(item?.slug ?? "").toLowerCase().trim();
		const val = extractStringValue(item?.value ?? item?.content ?? item);
		if (!val) continue;

		if (
			rawSlug === "phone" ||
			rawSlug === "customer-care-phone" ||
			rawSlug.endsWith("-phone") ||
			rawSlug === "contact-phone"
		) {
			if (!care.phone) care.phone = val;
		} else if (
			rawSlug === "whatsapp" ||
			rawSlug === "customer-care-whatsapp" ||
			rawSlug.endsWith("-whatsapp")
		) {
			if (!care.whatsapp) care.whatsapp = val;
		} else if (
			rawSlug === "email" ||
			rawSlug === "customer-care-email" ||
			rawSlug.endsWith("-email")
		) {
			if (!care.email) care.email = val;
		}
	}
};

/** Handles both dedicated /general-info/customer-care and generic /general-info paginated lists */
export const getCustomerCare = async (): Promise<CustomerCare | null> => {
	const care: CustomerCare = { email: null, phone: null, whatsapp: null };

	// 1. Try dedicated customer_care endpoint first
	try {
		const response = await axios.get<StandardResponse<any>>(
			URLS.general_info.customer_care,
		);
		const raw = response.data;
		const payload = (raw as any)?.data ?? raw;
		if (payload && typeof payload === "object") {
			if (payload.email) care.email = extractStringValue(payload.email);
			if (payload.phone) care.phone = extractStringValue(payload.phone);
			if (payload.whatsapp) care.whatsapp = extractStringValue(payload.whatsapp);

			const items = Array.isArray(payload)
				? payload
				: Array.isArray(payload.items)
					? payload.items
					: null;
			if (items) {
				populateFromItems(items, care);
			}
		}
	} catch (error) {
		Logger.warn("Customer-care endpoint query issue; checking general-info", error);
	}

	// 2. If any contact field is missing (e.g. backend slug mismatch where /customer-care returned nulls), query /general-info
	if (!care.phone || !care.whatsapp || !care.email) {
		try {
			const listResponse = await axios.get<StandardResponse<any>>(
				URLS.general_info.list,
				{ params: { type: "customer_care", page_size: 50 } },
			);
			const listRaw = listResponse.data;
			const listPayload = (listRaw as any)?.data ?? listRaw;
			const items = Array.isArray(listPayload)
				? listPayload
				: Array.isArray(listPayload?.items)
					? listPayload.items
					: null;
			if (items) {
				populateFromItems(items, care);
			}
		} catch (fallbackError) {
			Logger.warn("General-info list fallback also failed", fallbackError);
		}
	}

	Logger.info("Resolved Customer Care configuration:", care);
	return care;
};
