import { axios } from "../core/client";
import { URLS } from "../core/endpoints";
import Logger from "@/utils/logger";

export interface RegisterPushTokenRequest {
	userId: string;
	pushToken: string;
	platform: "android" | "ios" | "web";
}

export interface RegisterPushTokenResponse {
	success: boolean;
	message: string;
	data?: any;
}

export interface SendNotificationRequest {
	userId: string;
	title: string;
	body: string;
	data?: Record<string, any>;
	categoryId?: string;
}

export interface SendLoanNotificationRequest {
	userId: string;
	loanId: string;
	type: "approved" | "disbursed" | "payment_due" | "rejected";
	amount: number;
}

export interface NotificationResponse {
	success: boolean;
	message: string;
	data?: any;
}

/**
 * Register push token with backend
 */
export const registerPushToken = async (
	data: RegisterPushTokenRequest,
): Promise<RegisterPushTokenResponse> => {
	const isFCMToken = !data.pushToken.startsWith("ExponentPushToken");

	Logger.debug("Registering push token with backend", {
		userId: data.userId,
		pushToken: data.pushToken ? `${data.pushToken.substring(0, 30)}...` : "none",
		platform: data.platform,
		tokenFormat: isFCMToken ? "FCM" : "Expo",
		tokenLength: data.pushToken?.length,
		timestamp: new Date().toISOString(),
	});

	try {
		const response = await axios.post<RegisterPushTokenResponse>(
			URLS.notifications.register_token,
			data,
		);

		Logger.debug("Push token registration response", response.data);
		return response.data;
	} catch (error: any) {
		Logger.error("Failed to register push token", error);
		throw error;
	}
};

/**
 * Send custom notification (for testing)
 */
export const sendTestNotification = async (
	data: SendNotificationRequest,
): Promise<NotificationResponse> => {
	const response = await axios.post<NotificationResponse>(URLS.notifications.send, data);
	return response.data;
};

/**
 * Send loan-specific notification
 */
export const sendLoanNotification = async (
	data: SendLoanNotificationRequest,
): Promise<NotificationResponse> => {
	const response = await axios.post<NotificationResponse>(URLS.notifications.loan, data);
	return response.data;
};

/**
 * Get user notifications
 */
export const getUserNotifications = async (params: {
	skip?: number;
	limit?: number;
	unread_only?: boolean;
}) => {
	const response = await axios.get(URLS.notifications.get_notifications(params));
	return response.data;
};
