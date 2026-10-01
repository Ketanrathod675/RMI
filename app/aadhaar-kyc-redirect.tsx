import { useCleanBackHandlers } from "@/hooks/useCleanBackHandlers";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import { useEffect } from "react";
import Toast from "react-native-toast-message";

export default function AadhaarKycRedirect() {
	const urlHook = Linking.useLinkingURL();

	// Clear any persistent back handlers from previous screens
	useCleanBackHandlers();

	useEffect(() => {
		const init = async () => {
			if (!urlHook) {
				router.replace("/(tabs)");
				return;
			}

			try {
				const { hostname, path, queryParams } = Linking.parse(urlHook);

				console.log("AadhaarKycRedirect - Parsed URL:", {
					hostname,
					path,
					queryParams,
				});

				// Check if this is a valid aadhaar-kyc redirect
				if (!hostname?.includes("aadhaar-kyc-redirect")) {
					Toast.show({
						type: "error",
						text1: "Invalid redirect",
						text2: "This link is not for KYC verification",
					});

					router.replace("/(tabs)");
					return;
				}

				// Navigate to aadhaar-kyc with the query parameters
				// Support both txnId (old format) and transaction_id (new format)
				const txnId = queryParams?.txnId || queryParams?.transaction_id || "";
				router.replace({
					pathname: "/aadhaar-kyc",
					params: {
						txnId: txnId,
						status: queryParams?.status || "",
						message: queryParams?.message || "",
						fromRedirect: "true",
					},
				});
			} catch (error) {
				console.error("Error parsing redirect URL:", error);

				Toast.show({
					type: "error",
					text1: "Invalid Transaction",
					text2: "Unable to process the redirect URL",
				});

				router.replace("/(tabs)");
			}
		};

		init();
	}, [urlHook]);

	return null;
}
