import { useCameraPermissions } from "expo-camera";
import {
	getPermissionsAsync,
	requestPermissionsAsync,
} from "expo-notifications/build/NotificationPermissions";
import { useEffect, useState } from "react";

export const usePermissions = () => {
	const [notificationsPermission, setNotificationsPermission] = useState(false);

	const [camera, requestCamera] = useCameraPermissions();

	// Checkers (do not request)
	const requestCameraPermission = async () => {
		try {
			const { status } = await requestCamera();
			return status === "granted";
		} catch (err) {
			console.error("Camera permission error:", err);
			return false;
		}
	};

	const checkNotifications = async () => {
		try {
			const { status } = await getPermissionsAsync();
			setNotificationsPermission(status === "granted");
			return status === "granted";
		} catch {
			return false;
		}
	};

	const requestNotificationsPermission = async () => {
		try {
			const { status } = await requestPermissionsAsync();
			setNotificationsPermission(status === "granted");
			return status === "granted";
		} catch {
			return false;
		}
	};

	// On mount, check all permissions
	useEffect(() => {
		checkNotifications();
	}, []);

	return {
		cameraPermission: camera?.granted,
		notificationsPermission,
		allPermissionsGranted: camera?.granted,
		requestCameraPermission,
		requestNotificationsPermission,
	};
};
