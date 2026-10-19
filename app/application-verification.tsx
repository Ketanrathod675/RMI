import { TranslatedText } from "@/components/TranslatedText";
import { IconSymbol } from "@/components/ui/IconSymbol";
import { useJourneyTracker } from "@/hooks/useJourneyTracker";
import { useTranslation } from "@/hooks/useTranslation";
import { getCreditQueueStatus } from "@/utils/api/services/creditQueue.service";
import { font, height, width } from "@/utils/dimensions";
import Logger from "@/utils/logger";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
	Animated,
	AppState,
	BackHandler,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ApplicationVerification() {
	useJourneyTracker("/application-verification");
	const router = useRouter();
	const queryClient = useQueryClient();
	const [isFocused, setIsFocused] = useState(true);
	const scaleAnim = useRef(new Animated.Value(0)).current;

	useFocusEffect(
		React.useCallback(() => {
			setIsFocused(true);
			return () => {
				setIsFocused(false);
			};
		}, [])
	);

	// Back handler to navigate back to dashboard
	useEffect(() => {
		const backHandler = BackHandler.addEventListener("hardwareBackPress", () => {
			router.replace("/(tabs)");
			return true;
		});

		return () => backHandler.remove();
	}, [router]);

	// Card scale animation on mount
	useEffect(() => {
		Animated.spring(scaleAnim, {
			toValue: 1,
			friction: 5,
			tension: 40,
			useNativeDriver: true,
		}).start();
	}, [scaleAnim]);

	// Poll credit queue status
	const { data, isError, refetch, isFetching } = useQuery({
		queryKey: ["credit-queue", "status"],
		queryFn: getCreditQueueStatus,
		refetchInterval: (query) => {
			if (!isFocused) return false;
			const currentStatus = query.state.data?.status;
			const canProceed = query.state.data?.can_proceed;
			if (currentStatus === "approved" || canProceed || currentStatus === "rejected") {
				return false;
			}
			return 10000;
		},
		refetchOnWindowFocus: true,
	});

	// Refetch when returning to foreground
	useEffect(() => {
		const subscription = AppState.addEventListener("change", (nextState) => {
			if (nextState === "active" && isFocused) {
				refetch();
			}
		});

		return () => subscription.remove();
	}, [isFocused, refetch]);

	// React to credit queue result
	useEffect(() => {
		if (!data) return;

		Logger.debug("Credit queue review status", {
			status: data.status,
			can_proceed: data.can_proceed,
		});

		if (data.status === "approved" || data.can_proceed) {
			queryClient.invalidateQueries({ queryKey: ["user", "dashboard"] });
			// Always show the real "searching for best loan" loader before the offer screen.
			router.replace("/search-loan");
			return;
		}

		if (data.status === "rejected") {
			queryClient.invalidateQueries({ queryKey: ["user", "dashboard"] });
			router.replace("/no-approved-amount");
			return;
		}

		if (data.status === "not_started") {
			router.replace("/(tabs)");
			return;
		}
	}, [data, queryClient, router]);

	return (
		<SafeAreaView style={styles.container}>
			<View style={styles.content}>
				<Animated.View
					style={[
						styles.card,
						{
							opacity: scaleAnim,
							transform: [{ scale: scaleAnim }],
						},
					]}>
					{/* Icon Container */}
					<Animated.View
						style={[
							styles.iconContainer,
							{
								transform: [
									{
										scale: scaleAnim.interpolate({
											inputRange: [0, 1],
											outputRange: [0, 1],
										}),
									},
								],
							},
						]}>
						<MaterialCommunityIcons name="timer-outline" size={48} color="#79CA01" />
					</Animated.View>

					{/* Text Content */}
					<View style={styles.textContainer}>
						<TranslatedText
							style={styles.title}
							translationKey="applicationVerificationMessage"
						/>

						<TranslatedText
							style={styles.message}
							translationKey="applicationUnderProcessDesc"
						/>

						<TranslatedText
							style={styles.note}
							translationKey="applicationUnderProcessNote"
						/>

						{data?.status === "rejected" && data.rejection_reason ? (
							<Text style={styles.rejectionReason}>{data.rejection_reason}</Text>
						) : null}
					</View>

					{/* Action Button */}
					<TouchableOpacity
						style={styles.button}
						onPress={() => router.replace("/(tabs)")}
						activeOpacity={0.8}>
						<View style={{ flexDirection: "row", alignItems: "center" }}>
							<TranslatedText
								style={styles.buttonText}
								translationKey="backToDashboard"
							/>
							<IconSymbol name="arrow.right" size={20} color="#1F2937" />
						</View>
					</TouchableOpacity>

					{/* Non-blocking retry error indicator */}
					{isError && (
						<View style={styles.errorContainer}>
							<TranslatedText
								style={styles.errorText}
								translationKey={"couldntRefreshRetrying" as any}
								fallback="Couldn't refresh. Retrying..."
							/>
							<TouchableOpacity
								onPress={() => refetch()}
								disabled={isFetching}
								hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
								<TranslatedText
									style={styles.retryText}
									translationKey="retry"
									fallback="Retry"
								/>
							</TouchableOpacity>
						</View>
					)}
				</Animated.View>
			</View>
		</SafeAreaView>
	);
}

export { RouteErrorBoundary as ErrorBoundary } from "@/components/ErrorBoundary";

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#F9FAFB",
	},
	content: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		padding: width(4),
	},
	card: {
		backgroundColor: "#FFFFFF",
		borderRadius: 24,
		padding: width(8),
		width: "100%",
		maxWidth: 400,
		alignItems: "center",
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 10 },
		shadowOpacity: 0.1,
		shadowRadius: 20,
		elevation: 5,
		borderWidth: 1,
		borderColor: "#F3F4F6",
	},
	iconContainer: {
		width: 96,
		height: 96,
		backgroundColor: "#F4FDE3",
		borderRadius: 48,
		alignItems: "center",
		justifyContent: "center",
		marginBottom: height(3),
	},
	textContainer: {
		alignItems: "center",
		marginBottom: height(4),
		gap: height(2),
	},
	title: {
		fontSize: font(2.4),
		fontWeight: "700",
		color: "#1F2937",
		textAlign: "center",
		marginBottom: height(1),
	},
	message: {
		fontSize: font(1.8),
		color: "#4B5563",
		textAlign: "center",
		lineHeight: font(2.6),
		fontWeight: "500",
	},
	note: {
		fontSize: font(1.4),
		color: "#6B7280",
		textAlign: "center",
		lineHeight: font(2),
		marginTop: height(1),
	},
	rejectionReason: {
		fontSize: font(1.4),
		color: "#DC2626",
		textAlign: "center",
		marginTop: height(1),
		fontWeight: "500",
	},
	button: {
		width: "100%",
		backgroundColor: "#B7FB52",
		paddingVertical: height(2),
		borderRadius: 12,
		alignItems: "center",
		justifyContent: "center",
		shadowColor: "#B7FB52",
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.2,
		shadowRadius: 8,
		elevation: 2,
		marginTop: height(2),
	},
	buttonText: {
		fontSize: font(1.8),
		fontWeight: "700",
		color: "#000000",
	},
	errorContainer: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
		marginTop: height(2),
	},
	errorText: {
		fontSize: font(1.3),
		color: "#6B7280",
	},
	retryText: {
		fontSize: font(1.3),
		fontWeight: "600",
		color: "#2563EB",
		textDecorationLine: "underline",
	},
});
