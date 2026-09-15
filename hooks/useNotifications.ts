import {
	getPermissionsAsync,
	requestPermissionsAsync,
} from "expo-notifications/build/NotificationPermissions";
import { useCallback, useEffect, useState } from "react";

export interface NotificationPermissions {
	granted: boolean;
	canAskAgain: boolean;
	status: string;
}

export interface UseNotificationsReturn {
	permissions: NotificationPermissions | null;
	pushToken: string | null;
	isLoading: boolean;
	error: string | null;
	requestPermissions: () => Promise<boolean>;
}

export function useNotifications(): UseNotificationsReturn {
	const [permissions, setPermissions] = useState<NotificationPermissions | null>(null);
	const [pushToken, setPushToken] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const checkPermissions = useCallback(async () => {
		try {
			setIsLoading(true);
			const settings = await getPermissionsAsync();
			setPermissions({
				granted: settings.granted || settings.status === "granted",
				canAskAgain: settings.canAskAgain,
				status: settings.status,
			});
		} catch (err: any) {
			setError(err?.message ?? "Error getting notification permissions");
		} finally {
			setIsLoading(false);
		}
	}, []);

	const requestPermissions = useCallback(async (): Promise<boolean> => {
		try {
			setIsLoading(true);
			const settings = await requestPermissionsAsync();
			const isGranted = settings.granted || settings.status === "granted";
			setPermissions({
				granted: isGranted,
				canAskAgain: settings.canAskAgain,
				status: settings.status,
			});
			return isGranted;
		} catch (err: any) {
			setError(err?.message ?? "Error requesting notification permissions");
			return false;
		} finally {
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		checkPermissions();
	}, [checkPermissions]);

	return {
		permissions,
		pushToken,
		isLoading,
		error,
		requestPermissions,
	};
}
