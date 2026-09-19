import React, { useEffect, useState } from "react";
import {
	BackHandler,
	Dimensions,
	StatusBar,
	StyleSheet,
	Text,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import Animated, {
	Easing,
	useAnimatedStyle,
	useSharedValue,
	withRepeat,
	withSequence,
	withTiming,
} from "react-native-reanimated";

import { TranslatedText } from "@/components/TranslatedText";
import { dark, primary } from "@/constants/Colors";
import { Images } from "@/constants/images";
import { useJourneyTracker } from "@/hooks/useJourneyTracker";
import { useTranslation } from "@/hooks/useTranslation";
import { axios, getUserDashboardData, StepHref } from "@/utils/api";
import { height, width } from "@/utils/dimensions";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const RING_SIZE = Math.min(SCREEN_WIDTH * 0.86, 330);
const MID_RING_SIZE = Math.round(RING_SIZE * 0.7);
const INNER_RING_SIZE = Math.round(RING_SIZE * 0.46);
const CENTER_ICON_SIZE = Math.round(INNER_RING_SIZE * 0.65);
const DOT_SIZE = 11;

export default function SearchLoan() {
	const { t } = useTranslation();
	const insets = useSafeAreaInsets();
	const navigation = useNavigation();
	const params = useLocalSearchParams<{ is_repeat_user?: string; next_step?: string }>();
	const isRepeatUser = params.is_repeat_user === "true";

	useJourneyTracker("/search-loan");

	const [showProgress, setShowProgress] = useState(false);
	const [currentStage, setCurrentStage] = useState(0);
	const [isCompleted, setIsCompleted] = useState(false);

	// Three concentric rings rotating in the same clockwise direction at faster speeds:
	// Inner: Fastest (2.2s)
	// Middle: Medium (3.8s)
	// Outer: Slower (5.6s)
	const innerRingRotation = useSharedValue(0);
	const midRingRotation = useSharedValue(0);
	const outerRingRotation = useSharedValue(0);

	// Center image very slow, calm pulse (subtle breathing animation)
	const heartbeatScale = useSharedValue(1);

	// Center image cross-transition fade
	const imageTransitionOpacity = useSharedValue(1);

	// Shimmer opacity for the active progress bar segment
	const shimmerOpacity = useSharedValue(0.3);

	const stageTexts = [
		t("connectingToBureauServer", "Connecting to Bureau Server"),
		t("checkingYourCreditReport", "Checking your credit Report"),
		t("analysingCreditReport", "Analysing Credit Report"),
	];

	// Intercept hardware and gesture back navigation
	useEffect(() => {
		const unsubscribe = navigation.addListener("beforeRemove", (e) => {
			e.preventDefault();
		});

		const backHandler = BackHandler.addEventListener("hardwareBackPress", () => {
			return true;
		});

		return () => {
			unsubscribe();
			backHandler.remove();
		};
	}, [navigation]);

	// Spin inner ring fastest (clockwise, 2.2s per full loop)
	useEffect(() => {
		innerRingRotation.value = withRepeat(
			withTiming(360, { duration: 2200, easing: Easing.linear }),
			-1,
			false
		);
	}, [innerRingRotation]);

	// Spin middle ring (clockwise, 3.8s per full loop)
	useEffect(() => {
		midRingRotation.value = withRepeat(
			withTiming(360, { duration: 3800, easing: Easing.linear }),
			-1,
			false
		);
	}, [midRingRotation]);

	// Spin outer ring (clockwise, 5.6s per full loop)
	useEffect(() => {
		outerRingRotation.value = withRepeat(
			withTiming(360, { duration: 5600, easing: Easing.linear }),
			-1,
			false
		);
	}, [outerRingRotation]);

	// Very slow, calm pulse on the center image (~3.3s cycle)
	useEffect(() => {
		heartbeatScale.value = withRepeat(
			withSequence(
				withTiming(1.07, { duration: 400, easing: Easing.inOut(Easing.ease) }),
				withTiming(1.0, { duration: 400, easing: Easing.inOut(Easing.ease) }),
				withTiming(1.0, { duration: 2500 }) // Long relaxed pause
			),
			-1,
			false
		);
	}, [heartbeatScale]);

	// Trigger smooth fade transition when state/stage changes
	useEffect(() => {
		imageTransitionOpacity.value = 0.4;
		imageTransitionOpacity.value = withTiming(1, { duration: 320 });
	}, [showProgress, currentStage, imageTransitionOpacity]);

	// Repeating shimmer pulse on active progress block
	useEffect(() => {
		shimmerOpacity.value = withRepeat(
			withSequence(
				withTiming(0.85, { duration: 1200, easing: Easing.inOut(Easing.sin) }),
				withTiming(0.25, { duration: 1200, easing: Easing.inOut(Easing.sin) })
			),
			-1,
			false
		);
	}, [shimmerOpacity]);

	// Show initial search phase for 4 seconds, then reveal 3-stage progress
	useEffect(() => {
		const timer = setTimeout(() => {
			setShowProgress(true);
		}, 4000);

		return () => clearTimeout(timer);
	}, []);

	// Background lender approval check
	useEffect(() => {
		const checkLenderApproval = async () => {
			try {
				const response = await axios.post("lender-approval/check-approval");
				console.log("Lender approval check status:", response.status);
			} catch (error: any) {
				console.error("Lender approval check error:", error?.message || error);
			}
		};

		checkLenderApproval();
	}, []);

	// Stage timeline and workflow routing
	useEffect(() => {
		if (showProgress && !isCompleted) {
			setCurrentStage(0);

			const stageTimer1 = setTimeout(() => {
				setCurrentStage(1);
			}, 2500);

			const stageTimer2 = setTimeout(() => {
				setCurrentStage(2);
			}, 5000);

			const completeTimer = setTimeout(async () => {
				setIsCompleted(true);

				try {
					const dashboardData = await getUserDashboardData();
					const workflowProgress = dashboardData?.workflow_progress;
					const currentStep = workflowProgress?.current_step;
					const overallStatus = workflowProgress?.overall_status;

					console.log("Search Loan Completed. Step:", currentStep, "Status:", overallStatus);

					if (
						overallStatus === "rejected" ||
						overallStatus === "application_rejected" ||
						overallStatus === "no_approved_amount"
					) {
						router.push("/(tabs)");
						return;
					}

					if (currentStep) {
						if (currentStep === "selfie_match") {
							router.push({
								pathname: "/ckyc-instructions",
								params: { startSelfie: "true" },
							});
							return;
						}

						if (currentStep === "address_submission") {
							router.push({
								pathname: "/aadhaar-kyc",
								params: { startFromAddress: "true" },
							});
							return;
						}

						let targetStep = currentStep;
						if (targetStep === "credit_queue" && isRepeatUser) {
							targetStep =
								params.next_step ||
								workflowProgress?.next_required_step ||
								"loan_application";
						}

						if (targetStep === "digilocker") {
							router.push({
								pathname: "/aadhaar-kyc",
								params: { nextStep: "digilocker" },
							});
							return;
						}

						const nextRoute = StepHref[targetStep as keyof typeof StepHref];
						if (nextRoute) {
							router.push(nextRoute as any);
						} else {
							console.warn("Unknown step in search-loan:", targetStep);
							router.push("/(tabs)");
						}
					} else {
						router.push("/(tabs)");
					}
				} catch (error) {
					console.error("Error fetching dashboard data in search-loan:", error);
					router.push("/(tabs)");
				}
			}, 8000);

			return () => {
				clearTimeout(stageTimer1);
				clearTimeout(stageTimer2);
				clearTimeout(completeTimer);
			};
		}
	}, [showProgress, isCompleted, isRepeatUser, params.next_step]);

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
		opacity: imageTransitionOpacity.value,
		transform: [{ scale: heartbeatScale.value }],
	}));

	const shimmerStyle = useAnimatedStyle(() => ({
		opacity: shimmerOpacity.value,
	}));

	// Determine active center image based on state
	const getActiveCenterImage = () => {
		if (!showProgress) return Images.SEARCH_ICON;
		if (currentStage === 0) return Images.BUREAU_ICON;
		if (currentStage === 1) return Images.CHECKING_CREDIT_ICON;
		return Images.ANALYSING_CREDIT_ICON;
	};

	return (
		<View style={[styles.container, { paddingTop: Math.max(insets.top, 24) }]}>
			<StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

			{/* Upper: 3 Multi-Speed Rings Rotating in Same Direction with Dots & Center Icon */}
			<View style={styles.ringWrapper}>
				<View style={styles.ringContainer}>
					{/* Outer Ring with Dot (Clockwise, 5.6s) */}
					<Animated.View style={[styles.ring, styles.outerRing, outerRingAnimatedStyle]}>
						<View style={[styles.dot, styles.outerDot]} />
					</Animated.View>

					{/* Middle Ring with Dot (Clockwise, 3.8s) */}
					<Animated.View style={[styles.ring, styles.midRing, midRingAnimatedStyle]}>
						<View style={[styles.dot, styles.midDot]} />
					</Animated.View>

					{/* Inner Ring with Dot (Clockwise, 2.2s) */}
					<Animated.View style={[styles.ring, styles.innerRing, innerRingAnimatedStyle]}>
						<View style={[styles.dot, styles.innerDot]} />
					</Animated.View>

					{/* Center Icon with Slow Calm Pulse */}
					<View style={styles.centerIconWrapper} pointerEvents="none">
						<Animated.Image
							source={getActiveCenterImage()}
							style={[styles.centerIcon, centerImageAnimatedStyle]}
							resizeMode="contain"
						/>
					</View>
				</View>
			</View>

			{/* Lower: Progress Bar & Status Text */}
			<View style={[styles.bottomWrapper, { paddingBottom: Math.max(insets.bottom, 40) }]}>
				{!showProgress ? (
					/* Initial Search Phase */
					<View style={styles.initialTextContainer}>
						<TranslatedText
							style={styles.searchingText}
							translationKey="searchingForBestLoanOffers"
						/>
					</View>
				) : (
					/* 3-Stage Progress Phase */
					<View style={styles.progressContainer}>
						{/* 3 Segmented Progress Blocks */}
						<View style={styles.progressTrack}>
							{[0, 1, 2].map((idx) => {
								const isCurrent = currentStage === idx;
								const isDone = currentStage > idx;
								const isActive = isDone || isCurrent;

								return (
									<View
										key={idx}
										style={[
											styles.progressBlock,
											{ backgroundColor: isActive ? primary : "#E5E7EB" },
										]}
									>
										{isCurrent && (
											<Animated.View style={[styles.shimmer, shimmerStyle]} />
										)}
									</View>
								);
							})}
						</View>

						{/* Stage Heading */}
						<Text style={styles.connectingText}>{stageTexts[currentStage]}</Text>

						{/* Stage Subtext */}
						<Text style={styles.takeWhileText}>
							{t("thisMayTakeAWhile", "This may take a")}{" "}
							<Text style={styles.whileText}>{t("while", "While")}</Text>
						</Text>
					</View>
				)}
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#FFFFFF",
		justifyContent: "space-between",
		alignItems: "center",
		width: "100%",
	},
	ringWrapper: {
		flex: 1.2,
		width: "100%",
		justifyContent: "center",
		alignItems: "center",
		marginTop: height(4),
	},
	ringContainer: {
		width: RING_SIZE,
		height: RING_SIZE,
		justifyContent: "center",
		alignItems: "center",
		position: "relative",
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
	bottomWrapper: {
		flex: 0.9,
		width: "100%",
		paddingHorizontal: width(6),
		alignItems: "center",
		justifyContent: "center",
	},
	initialTextContainer: {
		width: "100%",
		alignItems: "center",
		justifyContent: "center",
		paddingHorizontal: width(4),
	},
	searchingText: {
		fontSize: width(5.6),
		color: "#1F2937",
		fontWeight: "600",
		textAlign: "center",
		lineHeight: width(8.2),
		maxWidth: 300,
	},
	progressContainer: {
		width: "100%",
		alignItems: "center",
		justifyContent: "center",
	},
	progressTrack: {
		width: "100%",
		height: 6,
		flexDirection: "row",
		justifyContent: "space-between",
		gap: 12,
		marginBottom: height(4.5),
	},
	progressBlock: {
		flex: 1,
		height: "100%",
		borderRadius: 3,
		position: "relative",
		overflow: "hidden",
	},
	shimmer: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		backgroundColor: "rgba(255, 255, 255, 0.45)",
		borderRadius: 3,
	},
	connectingText: {
		fontSize: width(6.2),
		color: "#1F2937",
		fontWeight: "800",
		textAlign: "center",
		lineHeight: width(8),
		maxWidth: 290,
		marginBottom: 12,
	},
	takeWhileText: {
		fontSize: width(4.2),
		color: "#374151",
		fontWeight: "500",
		textAlign: "center",
	},
	whileText: {
		color: "#4D43FE",
		fontWeight: "700",
	},
});
