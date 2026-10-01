import React, { useEffect, useState } from "react";
import {
	BackHandler,
	Dimensions,
	Modal,
	StatusBar,
	StyleSheet,
	Text,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useNavigation } from "expo-router";
import Animated, {
	Easing,
	useAnimatedStyle,
	useSharedValue,
	withRepeat,
	withSequence,
	withTiming,
} from "react-native-reanimated";

import { TranslatedText } from "@/components/TranslatedText";
import { dark } from "@/constants/Colors";
import { Images } from "@/constants/images";
import { useTranslation } from "@/hooks/useTranslation";
import { height, width } from "@/utils/dimensions";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const RING_SIZE = Math.min(SCREEN_WIDTH * 0.86, 330);
const MID_RING_SIZE = Math.round(RING_SIZE * 0.7);
const INNER_RING_SIZE = Math.round(RING_SIZE * 0.46);
const CENTER_ICON_SIZE = Math.round(INNER_RING_SIZE * 0.65);
const DOT_SIZE = 11;

export default function VerifyingBank() {
	const { t } = useTranslation();
	const insets = useSafeAreaInsets();
	const router = useRouter();
	const navigation = useNavigation();

	const [modalVisible, setModalVisible] = useState(false);
	const [allowNavigation, setAllowNavigation] = useState(false);

	// Three concentric rings rotating in the same clockwise direction:
	// Inner: Fastest (2.2s)
	// Middle: Medium (3.8s)
	// Outer: Slower (5.6s)
	const innerRingRotation = useSharedValue(0);
	const midRingRotation = useSharedValue(0);
	const outerRingRotation = useSharedValue(0);

	// Center icon very slow, calm pulse
	const heartbeatScale = useSharedValue(1);

	// Modal scale animation
	const modalScale = useSharedValue(0);

	// Prevent hardware and gesture back navigation
	useEffect(() => {
		const unsubscribe = navigation.addListener("beforeRemove", (e) => {
			if (!allowNavigation) {
				e.preventDefault();
			}
		});

		const backHandler = BackHandler.addEventListener(
			"hardwareBackPress",
			() => {
				return true;
			},
		);

		return () => {
			unsubscribe();
			backHandler.remove();
		};
	}, [navigation, allowNavigation]);

	// Spin inner ring (clockwise, 2.2s)
	useEffect(() => {
		innerRingRotation.value = withRepeat(
			withTiming(360, { duration: 2200, easing: Easing.linear }),
			-1,
			false,
		);
	}, [innerRingRotation]);

	// Spin middle ring (clockwise, 3.8s)
	useEffect(() => {
		midRingRotation.value = withRepeat(
			withTiming(360, { duration: 3800, easing: Easing.linear }),
			-1,
			false,
		);
	}, [midRingRotation]);

	// Spin outer ring (clockwise, 5.6s)
	useEffect(() => {
		outerRingRotation.value = withRepeat(
			withTiming(360, { duration: 5600, easing: Easing.linear }),
			-1,
			false,
		);
	}, [outerRingRotation]);

	// Calm pulse on center icon (~3.3s cycle)
	useEffect(() => {
		heartbeatScale.value = withRepeat(
			withSequence(
				withTiming(1.07, {
					duration: 400,
					easing: Easing.inOut(Easing.ease),
				}),
				withTiming(1.0, {
					duration: 400,
					easing: Easing.inOut(Easing.ease),
				}),
				withTiming(1.0, { duration: 2500 }),
			),
			-1,
			false,
		);
	}, [heartbeatScale]);

	// Single verification timer: runs for ~4.5s then shows the verified success modal
	useEffect(() => {
		const timer = setTimeout(() => {
			modalScale.value = 0;
			setModalVisible(true);
			modalScale.value = withTiming(1, {
				duration: 400,
				easing: Easing.out(Easing.back(1.5)),
			});

			setAllowNavigation(true);
			setTimeout(() => {
				router.replace("/sanction-letter");
			}, 2600);
		}, 4500);

		return () => clearTimeout(timer);
	}, [modalScale, router]);

	const innerRingAnimatedStyle = useAnimatedStyle(() => ({
		transform: [{ rotate: `${innerRingRotation.value}deg` }],
	}));

	const midRingAnimatedStyle = useAnimatedStyle(() => ({
		transform: [{ rotate: `${midRingRotation.value}deg` }],
	}));

	const outerRingAnimatedStyle = useAnimatedStyle(() => ({
		transform: [{ rotate: `${outerRingRotation.value}deg` }],
	}));

	const centerImageAnimatedStyle = useAnimatedStyle(() => ({
		transform: [{ scale: heartbeatScale.value }],
	}));

	const modalAnimatedStyle = useAnimatedStyle(() => ({
		transform: [{ scale: modalScale.value }],
	}));

	return (
		<View
			style={[
				styles.container,
				{
					paddingTop: Math.max(insets.top, 24),
					paddingBottom: Math.max(insets.bottom, 24),
				},
			]}>
			<StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

			{/* Centered Content: Concentric Rings + Text directly below */}
			<View style={styles.contentWrapper}>
				{/* Concentric Rotating Rings with Orbiting Dots & Center Bank Icon */}
				<View style={styles.ringContainer}>
					{/* Outer Ring with Dot (Clockwise, 5.6s) */}
					<Animated.View
						style={[
							styles.ring,
							styles.outerRing,
							outerRingAnimatedStyle,
						]}>
						<View style={[styles.dot, styles.outerDot]} />
					</Animated.View>

					{/* Middle Ring with Dot (Clockwise, 3.8s) */}
					<Animated.View
						style={[styles.ring, styles.midRing, midRingAnimatedStyle]}>
						<View style={[styles.dot, styles.midDot]} />
					</Animated.View>

					{/* Inner Ring with Dot (Clockwise, 2.2s) */}
					<Animated.View
						style={[
							styles.ring,
							styles.innerRing,
							innerRingAnimatedStyle,
						]}>
						<View style={[styles.dot, styles.innerDot]} />
					</Animated.View>

					{/* Center Bank Icon with Gentle Pulse */}
					<View style={styles.centerIconWrapper} pointerEvents="none">
						<Animated.Image
							source={Images.BANK}
							style={[styles.centerIcon, centerImageAnimatedStyle]}
							resizeMode="contain"
						/>
					</View>
				</View>

				{/* Single Loading Text directly below loader */}
				<View style={styles.textContainer}>
					<TranslatedText
						style={styles.verifyingTitle}
						translationKey="verifyingYourBankDetails"
					/>
					<Text style={styles.takeWhileText}>
						{t("thisMayTakeAWhile", "This may take a")}{" "}
						<Text style={styles.whileText}>
							{t("while", "While")}
						</Text>
					</Text>
				</View>
			</View>

			{/* Bank Details Verified Success Modal */}
			<Modal
				visible={modalVisible}
				transparent={true}
				animationType="fade">
				<View style={styles.modalOverlay}>
					<View style={styles.modalContent}>
						<Animated.Image
							source={Images.SUCCESS_ICON}
							style={[styles.successImage, modalAnimatedStyle]}
							resizeMode="contain"
						/>
						<TranslatedText
							style={styles.successTitle}
							translationKey="bankDetailsVerifiedSuccessfully"
						/>
						<TranslatedText
							style={styles.successSubtitle}
							translationKey="yourBankDetailsHasBeenVerified"
						/>
					</View>
				</View>
			</Modal>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#FFFFFF",
		justifyContent: "center",
		alignItems: "center",
		width: "100%",
	},
	contentWrapper: {
		width: "100%",
		alignItems: "center",
		justifyContent: "center",
		paddingHorizontal: width(6),
	},
	ringContainer: {
		width: RING_SIZE,
		height: RING_SIZE,
		justifyContent: "center",
		alignItems: "center",
		position: "relative",
		marginBottom: height(4.5),
	},
	ring: {
		position: "absolute",
		borderWidth: 1,
		borderColor: "#E5E7EB",
		justifyContent: "center",
		alignItems: "center",
	},
	outerRing: {
		width: RING_SIZE,
		height: RING_SIZE,
		borderRadius: RING_SIZE / 2,
	},
	midRing: {
		width: MID_RING_SIZE,
		height: MID_RING_SIZE,
		borderRadius: MID_RING_SIZE / 2,
	},
	innerRing: {
		width: INNER_RING_SIZE,
		height: INNER_RING_SIZE,
		borderRadius: INNER_RING_SIZE / 2,
	},
	dot: {
		position: "absolute",
		width: DOT_SIZE,
		height: DOT_SIZE,
		borderRadius: DOT_SIZE / 2,
		backgroundColor: "#4D43FE",
		shadowColor: "#4D43FE",
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.35,
		shadowRadius: 3,
		elevation: 2,
	},
	outerDot: {
		top: -DOT_SIZE / 2,
		left: RING_SIZE / 2 - DOT_SIZE / 2,
	},
	midDot: {
		bottom: -DOT_SIZE / 2,
		left: MID_RING_SIZE / 2 - DOT_SIZE / 2,
	},
	innerDot: {
		right: -DOT_SIZE / 2,
		top: INNER_RING_SIZE / 2 - DOT_SIZE / 2,
	},
	centerIconWrapper: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		justifyContent: "center",
		alignItems: "center",
	},
	centerIcon: {
		width: CENTER_ICON_SIZE,
		height: CENTER_ICON_SIZE,
	},
	textContainer: {
		alignItems: "center",
		justifyContent: "center",
		paddingHorizontal: width(4),
	},
	verifyingTitle: {
		fontSize: width(5.2),
		fontWeight: "700",
		color: dark,
		textAlign: "center",
		marginBottom: height(1.2),
		lineHeight: width(7),
	},
	takeWhileText: {
		fontSize: width(3.8),
		color: "#6B7280",
		textAlign: "center",
		fontWeight: "400",
	},
	whileText: {
		fontWeight: "700",
		color: "#4D43FE",
	},
	modalOverlay: {
		position: "absolute",
		top: -height(10),
		left: 0,
		right: 0,
		bottom: 0,
		width: "100%",
		height: height(110),
		backgroundColor: "rgba(0,0,0,0.08)",
		justifyContent: "center",
		alignItems: "center",
	},
	modalContent: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		width: "100%",
		height: "100%",
		backgroundColor: "white",
		borderRadius: 0,
		alignItems: "center",
		justifyContent: "center",
	},
	successImage: {
		width: width(40),
		height: width(40),
		marginBottom: height(4),
	},
	successTitle: {
		fontSize: 22,
		fontWeight: "700",
		color: "#333",
		textAlign: "center",
		marginBottom: height(2),
		lineHeight: 30,
	},
	successSubtitle: {
		fontSize: 14,
		color: "#333",
		textAlign: "center",
		marginTop: 0,
	},
});
