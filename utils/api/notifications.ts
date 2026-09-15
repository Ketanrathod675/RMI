import { axios, URLS } from ".";

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

	console.log("🔔 Registering push token with backend:", {
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

		console.log("✅ Push token registration response:", response.data);
		return response.data;
	} catch (error: any) {
		console.error("❌ Failed to register push token:", error);
		console.error("Error details:", {
			message: error.message,
			response: error.response?.data,
			status: error.response?.status,
		});
		throw error;
	}
};

/**
 * Send custom notification (for testing)
 */
export const sendTestNotification = async (
	data: SendNotificationRequest,
): Promise<NotificationResponse> => {
	console.log("🧪 Sending test notification:", data);

	const response = await axios.post<NotificationResponse>(URLS.notifications.send, data);

	console.log("✅ Test notification response:", response.data);
	return response.data;
};

/**
 * Send loan notification
 */
export const sendLoanNotification = async (
	data: SendLoanNotificationRequest,
): Promise<NotificationResponse> => {
	console.log("🏦 Sending loan notification:", data);

	const response = await axios.post<NotificationResponse>(URLS.notifications.loan, data);

	console.log("✅ Loan notification response:", response.data);
	return response.data;
};
