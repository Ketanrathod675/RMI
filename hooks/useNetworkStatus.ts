import NetInfo, { useNetInfo } from "@react-native-community/netinfo";
import { useEffect, useState } from "react";
import { onlineManager } from "@tanstack/react-query";
import { setDeviceConnected } from "@/utils/api/core/friendlyError";
import CONFIG from "@/utils/config";

// Configure NetInfo with the app's backend health check
const reachabilityUrl = `${CONFIG.API.BASE_URL.replace(/\/api\/v1\/?$/, "")}/health`;
NetInfo.configure({
	reachabilityUrl,
	reachabilityTest: async (res) => res.status < 500,
	reachabilityLongTimeout: 30000,
	reachabilityShortTimeout: 8000,
});

let currentIsConnected = true; // Optimistic default so app doesn't block on boot

NetInfo.fetch().then((state) => {
	currentIsConnected = state.isConnected !== false;
	setDeviceConnected(currentIsConnected);
	onlineManager.setOnline(currentIsConnected);
}).catch(() => {});

NetInfo.addEventListener((state) => {
	currentIsConnected = state.isConnected !== false;
	setDeviceConnected(currentIsConnected);
	onlineManager.setOnline(currentIsConnected);
});

export function isDeviceConnected(): boolean {
	return currentIsConnected;
}

export function installNetworkAwareness() {
	return () => {};
}

export function useNetworkStatus() {
	const state = useNetInfo();
	const [connected, setConnected] = useState<boolean>(currentIsConnected);

	useEffect(() => {
		const unsubscribe = NetInfo.addEventListener((next) => {
			const isConn = next.isConnected !== false;
			setConnected(isConn);
		});
		return unsubscribe;
	}, []);

	// Never block on isInternetReachable; only consider offline if isConnected is explicitly false
	const isConnected = state.isConnected !== null ? state.isConnected !== false : connected;
	return {
		isConnected,
		isOffline: !isConnected,
	};
}

export function createOfflineError() {
	const error = new Error("offline") as Error & { kind: string };
	error.kind = "offline";
	return error;
}

