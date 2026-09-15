import { Images } from "@/constants/images";
import { useTranslation } from "@/hooks/useTranslation";
import { font, height, width } from "@/utils/dimensions";
import { Image as ExpoImage } from "expo-image";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useState } from "react";
import {
	Image,
	Modal,
	SafeAreaView,
	StyleSheet,
	Text,
	View,
} from "react-native";
import Animated, {
	Easing,
	cancelAnimation,
	useAnimatedStyle,
	useSharedValue,
	withRepeat,
	withTiming,
} from "react-native-reanimated";

interface FiveSecDelayProps {
	visible: boolean;
	onComplete: () => void;
	isPolling?: boolean;
	pollingTextKey?: string;
}

export default function FiveSecDelay({
	visible,
	onComplete,
	isPolling = false,
	pollingTextKey,
}: FiveSecDelayProps) {
	const { t } = useTranslation();
	const [trackWidth, setTrackWidth] = useState(width(88) - width(9));
	const animProgress = useSharedValue(0);
	const ringRotation = useSharedValue(0);

	// Indeterminate looping progress bar animation & rotating logo ring
	useEffect(() => {
		if (visible) {
			animProgress.value = 0;
			animProgress.value = withRepeat(
				withTiming(1, {
					duration: 1400,
					easing: Easing.bezier(0.4, 0, 0.2, 1),
				}),
				-1,
				false
			);

			ringRotation.value = 0;
			ringRotation.value = withRepeat(
				withTiming(360, {
					duration: 1500,
					easing: Easing.linear,
				}),
				-1,
				false
			);
		} else {
			cancelAnimation(animProgress);
			cancelAnimation(ringRotation);
			animProgress.value = 0;
			ringRotation.value = 0;
		}
	}, [visible]);

	const segmentWidth = trackWidth * 0.25;
	const animatedProgressStyle = useAnimatedStyle(() => {
		const totalTravel = trackWidth + segmentWidth;
		const translateX = -segmentWidth + animProgress.value * totalTravel;
		return {
			width: segmentWidth,
			transform: [{ translateX }],
		};
	});

	const ringAnimatedStyle = useAnimatedStyle(() => {
		return {
			transform: [{ rotate: `${ringRotation.value}deg` }],
		};
	});

	// Dynamic status label driven live by pollingTextKey, or default criteria evaluation label
	const statusLabel = pollingTextKey
		? t(pollingTextKey as any, "Verifying details...")
		: t(
				"evaluatingCreditPolicyCriteria" as any,
				"Evaluating credit policy criteria"
			);

	return (
		<Modal
			visible={visible}
			transparent={false}
			animationType="fade"
			statusBarTranslucent={true}>
			<StatusBar style="light" />
			<View style={styles.container}>
				{/* Splash screen dark green radial background */}
				<ExpoImage
					source={Images.LIGHT_GREEN_ELLIPSE}
					style={styles.lightGreenEllipse}
					contentFit="cover"
				/>

				{/* Splash screen wavy line brand pattern */}
				<ExpoImage
					source={Images.LIGHT_WAVES}
					style={styles.lightWaves}
					contentFit="cover"
				/>

				<SafeAreaView style={styles.safeArea}>
					<View style={styles.contentContainer}>
						{/* Centered Logo with smooth rotating ring */}
						<View style={styles.logoWrapper}>
							<Animated.View style={[styles.logoRing, ringAnimatedStyle]} />
							<Image
								source={Images.R_BOX_LOGO}
								style={styles.logo}
								resizeMode="contain"
							/>
						</View>

						{/* Main Heading Message */}
						<Text style={styles.headingText}>
							<Text style={styles.whiteHeading}>{t("weAreReviewing")} </Text>
							<Text style={styles.greenHeading}>{t("reviewingWord")} </Text>
							<Text style={styles.whiteHeading}>{t("applicationWait")}</Text>
						</Text>

						{/* Status Card with Dynamic Label & Progress Bar */}
						<View style={styles.statusCard}>
							<Text style={styles.statusLabel} numberOfLines={2}>
								{statusLabel}
							</Text>
							<View
								style={styles.progressTrack}
								onLayout={(e) => {
									const w = e.nativeEvent.layout.width;
									if (w > 0 && w !== trackWidth) {
										setTrackWidth(w);
									}
								}}>
								<Animated.View
									style={[styles.progressFill, animatedProgressStyle]}
								/>
							</View>
						</View>
					</View>
				</SafeAreaView>
			</View>
		</Modal>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		width: "100%",
		height: "100%",
		backgroundColor: "#000000",
		justifyContent: "center",
		alignItems: "center",
	},
	lightGreenEllipse: {
		position: "absolute",
		top: 0,
		left: 0,
		width: width(100),
		height: height(100),
	},
	lightWaves: {
		position: "absolute",
		top: 0,
		left: 0,
		width: width(100),
		height: width(100),
	},
	safeArea: {
		flex: 1,
		width: "100%",
	},
	contentContainer: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		paddingHorizontal: width(6),
	},
	logoWrapper: {
		width: width(22),
		height: width(22),
		alignItems: "center",
		justifyContent: "center",
		marginBottom: height(6),
		transform: [{ translateY: -height(2.5) }],
	},
	logoRing: {
		position: "absolute",
		width: width(20),
		height: width(20),
		borderRadius: width(10),
		borderWidth: 2,
		borderColor: "#4ADE80",
		borderTopColor: "transparent",
		borderRightColor: "rgba(74, 222, 128, 0.4)",
	},
	logo: {
		width: width(14),
		height: width(14),
		borderRadius: 12,
	},
	headingText: {
		textAlign: "center",
		lineHeight: 34,
		maxWidth: 340,
		paddingHorizontal: width(2),
	},
	whiteHeading: {
		color: "#FFFFFF",
		fontSize: 25,
		fontWeight: "800",
		letterSpacing: -0.3,
	},
	greenHeading: {
		color: "#4ADE80",
		fontSize: 25,
		fontWeight: "800",
		letterSpacing: -0.3,
	},
	statusCard: {
		width: "100%",
		maxWidth: 380,
		backgroundColor: "rgba(4, 18, 9, 0.65)",
		borderWidth: 1,
		borderColor: "rgba(74, 222, 128, 0.1)",
		borderRadius: 18,
		paddingVertical: 18,
		paddingHorizontal: 18,
		marginTop: 32,
	},
	statusLabel: {
		fontSize: 13.5,
		color: "rgba(167, 243, 208, 0.55)",
		fontWeight: "500",
		marginBottom: 13,
		textAlign: "left",
	},
	progressTrack: {
		width: "100%",
		height: 4.5,
		backgroundColor: "rgba(255, 255, 255, 0.05)",
		borderRadius: 3,
		overflow: "hidden",
	},
	progressFill: {
		height: "100%",
		backgroundColor: "#4ADE80",
		borderRadius: 3,
	},
});
