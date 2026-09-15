import { Images } from "@/constants/images";
import { height, width } from "@/utils/dimensions";
import { Image } from "expo-image";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
	Easing,
	runOnJS,
	useAnimatedStyle,
	useSharedValue,
	withDelay,
	withTiming,
} from "react-native-reanimated";

interface AnimatedSplashScreenProps {
	isReady: boolean;
	onAnimationComplete: () => void;
	onNativeSplashHandoff: () => void;
}

export const AnimatedSplashScreen = ({
	isReady,
	onAnimationComplete,
	onNativeSplashHandoff,
}: AnimatedSplashScreenProps) => {
	// Reanimated shared values
	// Start with lockup translated right (+14.15% width) so the 'R' mark alone sits in dead center
	const logoScale = useSharedValue(1.35);
	const lockupTranslateX = useSharedValue(width(14.15));
	const textOpacity = useSharedValue(0);
	const textTranslateX = useSharedValue(width(6));
	const containerOpacity = useSharedValue(1);

	useEffect(() => {
		// Hand off native splash immediately
		onNativeSplashHandoff();

		// Phase 1 (0ms - 650ms): Logo gentle scale settling in exact center
		logoScale.value = withTiming(1.0, {
			duration: 650,
			easing: Easing.bezier(0.25, 0.1, 0.25, 1),
		});

		// Phase 2 (400ms - 1050ms): Unified lockup moves to center as title reveals
		// Since lockup moves as a single unit, spacing between 'R' and wordmark is permanently locked
		lockupTranslateX.value = withDelay(
			400,
			withTiming(0, {
				duration: 650,
				easing: Easing.bezier(0.16, 1, 0.3, 1),
			})
		);

		textOpacity.value = withDelay(
			420,
			withTiming(1, {
				duration: 550,
				easing: Easing.out(Easing.quad),
			})
		);

		textTranslateX.value = withDelay(
			400,
			withTiming(0, {
				duration: 650,
				easing: Easing.bezier(0.16, 1, 0.3, 1),
			})
		);
	}, [logoScale, lockupTranslateX, textOpacity, textTranslateX, onNativeSplashHandoff]);

	// Phase 3 & 4: Steady brand viewing hold (~1.3s) then soft dissolve (450ms)
	useEffect(() => {
		if (isReady) {
			const exitTimer = setTimeout(() => {
				containerOpacity.value = withTiming(
					0,
					{
						duration: 450,
						easing: Easing.inOut(Easing.quad),
					},
					(finished) => {
						if (finished) {
							runOnJS(onAnimationComplete)();
						}
					}
				);
			}, 2400);

			return () => clearTimeout(exitTimer);
		}
	}, [isReady, containerOpacity, onAnimationComplete]);

	// Animated styles
	const lockupAnimatedStyle = useAnimatedStyle(() => ({
		transform: [{ translateX: lockupTranslateX.value }],
	}));

	const logoAnimatedStyle = useAnimatedStyle(() => ({
		transform: [{ scale: logoScale.value }],
	}));

	const textAnimatedStyle = useAnimatedStyle(() => ({
		opacity: textOpacity.value,
		transform: [{ translateX: textTranslateX.value }],
	}));

	const containerAnimatedStyle = useAnimatedStyle(() => ({
		opacity: containerOpacity.value,
	}));

	return (
		<Animated.View style={[styles.container, containerAnimatedStyle]}>
			{/* Exact dark green radial background from reference */}
			<Image
				source={Images.LIGHT_GREEN_ELLIPSE}
				style={styles.lightGreenEllipse}
				contentFit="cover"
			/>

			{/* Exact wavy line brand pattern from reference */}
			<Image
				source={Images.LIGHT_WAVES}
				style={styles.lightWaves}
				contentFit="cover"
			/>

			{/* Center Brand Lockup */}
			<View style={styles.centerContent}>
				<Animated.View style={[styles.lockupRow, lockupAnimatedStyle]}>
					{/* 'R' Logo Mark */}
					<Animated.Image
						source={Images.LOGO_R}
						style={[styles.logo, logoAnimatedStyle]}
						resizeMode="contain"
					/>

					{/* 'apidMoney' Wordmark (zero overlap, natural letter spacing) */}
					<Animated.Image
						source={Images.LOGO_APID_MONEY}
						style={[styles.textLogo, textAnimatedStyle]}
						resizeMode="contain"
					/>
				</Animated.View>
			</View>
		</Animated.View>
	);
};

const styles = StyleSheet.create({
	container: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		backgroundColor: "#000000",
		alignItems: "center",
		justifyContent: "center",
		zIndex: 999999,
		elevation: 999999,
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
	centerContent: {
		alignItems: "center",
		justifyContent: "center",
		zIndex: 2,
	},
	lockupRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
	},
	logo: {
		width: width(9.2),
		height: width(9.2) * (75 / 68),
		aspectRatio: 68 / 75,
	},
	textLogo: {
		height: width(5.7),
		width: width(5.7) * (235 / 46),
		aspectRatio: 235 / 46,
		marginLeft: -width(0.8),
	},
});

export default AnimatedSplashScreen;
