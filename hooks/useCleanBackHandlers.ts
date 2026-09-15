import { useNavigation } from "expo-router";
import { useEffect } from "react";
import { BackHandler } from "react-native";

/**
 * Custom hook to clear any persistent back handlers and navigation listeners
 * Useful for screens that might be accessed via deep links where previous
 * screen handlers might still be active.
 */
export const useCleanBackHandlers = () => {
	const navigation = useNavigation();

	useEffect(() => {
		// Override any existing back handlers with a clean one that allows normal behavior
		const backHandler = BackHandler.addEventListener("hardwareBackPress", () => {
			// Return false to allow default behavior (go back normally or exit app)
			return false;
		});

		// Clear any navigation listeners that might block navigation
		const unsubscribe = navigation.addListener("beforeRemove", (_e) => {
			// Allow normal navigation behavior - don't prevent anything
			// This effectively overrides any blocking listeners from other screens
		});

		// Cleanup on unmount
		return () => {
			backHandler.remove();
			unsubscribe();
		};
	}, [navigation]);
};

export default useCleanBackHandlers;
