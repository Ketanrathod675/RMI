import Colors, { dark_primary, primary } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/useColorScheme";
import { useTranslation } from "@/hooks/useTranslation";
import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useState } from "react";
import {
	Animated,
	AppState,
	type AppStateStatus,
	Modal,
	Pressable,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export interface RateLimitModalProps {
	visible: boolean;
	title: string;
	message: string;
	endsAt: number | null;
	primaryLabel: string;
	onPrimary: () => void;
	secondaryLabel?: string;
	onSecondary?: () => void;
	dismissible?: boolean;
}

function formatMmSs(totalSeconds: number): string {
	const clamped = Math.max(0, Math.ceil(totalSeconds));
	const mins = Math.floor(clamped / 60);
	const secs = clamped % 60;
	return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export default function RateLimitModal({
	visible,
	title,
	message,
	endsAt,
	primaryLabel,
	onPrimary,
	secondaryLabel,
	onSecondary,
	dismissible = false,
}: RateLimitModalProps) {
	const { t } = useTranslation();
	const insets = useSafeAreaInsets();
	const colorScheme = useColorScheme() ?? "light";
	const isDark = colorScheme === "dark";
	const theme = Colors[colorScheme];

	const [scaleAnim] = useState(() => new Animated.Value(0.92));
	const [remainingSeconds, setRemainingSeconds] = useState<number>(() =>
		endsAt ? Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)) : 0,
	);

	const recalcRemaining = useCallback(() => {
		if (!endsAt) {
			setRemainingSeconds(0);
			return;
		}
		setRemainingSeconds(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));
	}, [endsAt]);

	useEffect(() => {
		const syncTimer = setTimeout(recalcRemaining, 0);
		if (!visible || !endsAt) {
			return () => clearTimeout(syncTimer);
		}

		const interval = setInterval(recalcRemaining, 1000);
		const sub = AppState.addEventListener("change", (nextState: AppStateStatus) => {
			if (nextState === "active") {
				recalcRemaining();
			}
		});
		return () => {
			clearTimeout(syncTimer);
			clearInterval(interval);
			sub.remove();
		};
	}, [visible, endsAt, recalcRemaining]);

	useEffect(() => {
		if (visible) {
			scaleAnim.setValue(0.92);
			Animated.spring(scaleAnim, {
				toValue: 1,
				useNativeDriver: true,
				tension: 65,
				friction: 8,
			}).start();
		}
	}, [visible, scaleAnim]);

	const isReadyNow = remainingSeconds <= 0;
	const effectivePrimaryLabel =
		isReadyNow && primaryLabel === (t("ok") || "OK")
			? t("tryAgain") || "Try again"
			: primaryLabel;

	const handleBackdropPress = () => {
		if (!dismissible) return;
		if (onSecondary) {
			onSecondary();
		} else {
			onPrimary();
		}
	};

	const handleHardwareBack = () => {
		if (dismissible && onSecondary) {
			onSecondary();
			return;
		}
		onPrimary();
	};

	return (
		<Modal
			visible={visible}
			transparent={true}
			animationType="fade"
			statusBarTranslucent={true}
			onRequestClose={handleHardwareBack}
		>
			<Pressable
				style={[
					styles.overlay,
					{
						paddingTop: insets.top + 16,
						paddingBottom: insets.bottom + 16,
					},
				]}
				onPress={handleBackdropPress}
				accessible={false}
			>
				<Pressable onPress={(e) => e.stopPropagation()} style={styles.cardWrapper}>
					<Animated.View
						style={[
							styles.card,
							{
								backgroundColor: isDark ? theme.card : "#FFFFFF",
								borderColor: isDark ? theme.border : "#E2E8F0",
								transform: [{ scale: scaleAnim }],
							},
						]}
						accessibilityRole="alert"
						accessibilityLiveRegion="polite"
					>
						<View style={styles.accentBar} />

						<View style={styles.iconRing}>
							<View
								style={[
									styles.iconCircle,
									{ backgroundColor: isReadyNow ? "#DCFCE7" : "#F3FEE3" },
								]}
							>
								<Ionicons
									name={isReadyNow ? "checkmark-circle" : "time"}
									size={32}
									color={isReadyNow ? dark_primary : "#4D7C0F"}
								/>
							</View>
						</View>

						<Text
							style={[styles.title, { color: isDark ? theme.text : "#0F172A" }]}
							accessibilityRole="header"
						>
							{title}
						</Text>

						<Text
							style={[
								styles.message,
								{ color: isDark ? "#CBD5E1" : "#475569" },
							]}
						>
							{message}
						</Text>

						<View
							style={[
								styles.countdownBox,
								{
									backgroundColor: isReadyNow
										? isDark
											? "rgba(9, 161, 67, 0.18)"
											: "#F0FDF4"
										: isDark
											? "rgba(183, 251, 82, 0.12)"
											: "#F7FFF0",
									borderColor: isReadyNow
										? isDark
											? "#15803D"
											: "#BBF7D0"
										: isDark
											? "#4D7C0F"
											: "#D9F99D",
								},
							]}
						>
							<Ionicons
								name={isReadyNow ? "checkmark-done-circle-outline" : "hourglass-outline"}
								size={18}
								color={isReadyNow ? dark_primary : isDark ? primary : "#3F6212"}
							/>
							<Text
								style={[
									styles.countdownText,
									{
										color: isReadyNow
											? isDark
												? "#4ADE80"
												: "#15803D"
											: isDark
												? primary
												: "#365314",
									},
								]}
								accessibilityRole="alert"
							>
								{isReadyNow
									? t("rateLimitTryAgainNow") || "You can try again now"
									: `${t("rateLimitTryAgainIn") || "Try again in"} ${formatMmSs(remainingSeconds)}`}
							</Text>
						</View>

						<TouchableOpacity
							style={[
								styles.primaryButton,
								isReadyNow && styles.primaryButtonReady,
							]}
							onPress={onPrimary}
							activeOpacity={0.85}
							accessibilityRole="button"
							accessibilityLabel={effectivePrimaryLabel}
						>
							<Text style={styles.primaryButtonText}>{effectivePrimaryLabel}</Text>
						</TouchableOpacity>

						{secondaryLabel && onSecondary ? (
							<TouchableOpacity
								style={styles.secondaryButton}
								onPress={onSecondary}
								activeOpacity={0.7}
								accessibilityRole="button"
								accessibilityLabel={secondaryLabel}
							>
								<Text
									style={[
										styles.secondaryButtonText,
										{ color: isDark ? "#94A3B8" : "#64748B" },
									]}
								>
									{secondaryLabel}
								</Text>
							</TouchableOpacity>
						) : null}
					</Animated.View>
				</Pressable>
			</Pressable>
		</Modal>
	);
}

const styles = StyleSheet.create({
	overlay: {
		flex: 1,
		backgroundColor: "rgba(15, 23, 42, 0.55)",
		justifyContent: "center",
		alignItems: "center",
		paddingHorizontal: 20,
	},
	cardWrapper: {
		width: "100%",
		maxWidth: 400,
	},
	card: {
		width: "100%",
		borderRadius: 24,
		borderWidth: 1,
		paddingHorizontal: 24,
		paddingBottom: 24,
		paddingTop: 0,
		overflow: "hidden",
		alignItems: "center",
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 10 },
		shadowOpacity: 0.18,
		shadowRadius: 24,
		elevation: 10,
	},
	accentBar: {
		width: "130%",
		height: 6,
		backgroundColor: primary,
		marginBottom: 22,
	},
	iconRing: {
		padding: 6,
		borderRadius: 40,
		backgroundColor: "rgba(183, 251, 82, 0.25)",
		marginBottom: 16,
	},
	iconCircle: {
		width: 58,
		height: 58,
		borderRadius: 29,
		justifyContent: "center",
		alignItems: "center",
	},
	title: {
		fontSize: 20,
		fontWeight: "700",
		textAlign: "center",
		marginBottom: 8,
	},
	message: {
		fontSize: 14,
		lineHeight: 20,
		textAlign: "center",
		marginBottom: 18,
	},
	countdownBox: {
		width: "100%",
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 8,
		paddingVertical: 12,
		paddingHorizontal: 14,
		borderRadius: 12,
		borderWidth: 1,
		marginBottom: 20,
	},
	countdownText: {
		fontSize: 14,
		fontWeight: "700",
		fontVariant: ["tabular-nums"],
	},
	primaryButton: {
		width: "100%",
		minHeight: 48,
		backgroundColor: primary,
		borderRadius: 14,
		alignItems: "center",
		justifyContent: "center",
		paddingHorizontal: 16,
		paddingVertical: 13,
	},
	primaryButtonReady: {
		borderWidth: 1.5,
		borderColor: dark_primary,
	},
	primaryButtonText: {
		fontSize: 15,
		fontWeight: "700",
		color: "#0F172A",
	},
	secondaryButton: {
		marginTop: 10,
		minHeight: 44,
		paddingHorizontal: 16,
		justifyContent: "center",
		alignItems: "center",
	},
	secondaryButtonText: {
		fontSize: 14,
		fontWeight: "600",
	},
});
