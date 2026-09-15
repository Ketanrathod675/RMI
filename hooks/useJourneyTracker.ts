import { saveCurrentScreen } from "@/utils/journey-tracker";
import type { Href } from "expo-router";
import { useEffect } from "react";

/**
 * Hook to automatically track the current screen in the user's journey
 * Call this hook at the top of any journey screen component
 *
 * @param screenPath - The path of the current screen (e.g., "/loan-application")
 */
export const useJourneyTracker = (screenPath: Href) => {
	useEffect(() => {
		// Save the current screen when component mounts
		saveCurrentScreen(screenPath);
	}, [screenPath]);
};
