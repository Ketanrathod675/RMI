import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";

export default function AssessmentFeeSuccess() {
	const router = useRouter();
	const params = useLocalSearchParams();

	useEffect(() => {
		const txnid = params.txnid;
		if (txnid) {
			router.replace({
				pathname: "/new-assessment-fee",
				params: { ...params },
			});
		} else {
			router.replace("/(tabs)");
		}
	}, []);

	return <View style={{ flex: 1, backgroundColor: "#060A0C" }} />;
}
