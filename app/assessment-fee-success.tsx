import { useCleanBackHandlers } from "@/hooks/useCleanBackHandlers";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";

export default function AssessmentFeeSuccess() {
	const urlHook = Linking.useLinkingURL();

	// Clear any persistent back handlers
	useCleanBackHandlers();

	useEffect(() => {
		const init = async () => {
			if (!urlHook) {
				router.replace("/(tabs)");
				return;
			}

			const { hostname, queryParams } = Linking.parse(urlHook);

			if (!hostname?.includes("assessment-fee-success") || !queryParams?.txnid) {
				router.replace("/(tabs)");
				return;
			}

			setTimeout(() => {
				if (router.canGoBack()) {
					router.back();
				} else {
					router.replace("/new-assessment-fee");
				}
			}, 100);
		};

		init();
	}, [urlHook]);

	return <View style={styles.container} />;
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#ffffff",
	},
});
