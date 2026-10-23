import React, { useCallback, useEffect, useRef, useState } from "react";
import {
	BackHandler,
	Dimensions,
	Modal,
	StatusBar,
	StyleSheet,
	Text,
	TouchableOpacity,
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
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { TranslatedText } from "@/components/TranslatedText";
import { dark } from "@/constants/Colors";
import { Images } from "@/constants/images";
import { useTranslation } from "@/hooks/useTranslation";
import { getUserDashboardData, StepHref } from "@/utils/api";
import { getBankAccounts } from "@/utils/api/bank";
import { font, height, width } from "@/utils/dimensions";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const RING_SIZE = Math.min(SCREEN_WIDTH * 0.86, 330);
const MID_RING_SIZE = Math.round(RING_SIZE * 0.7);
const INNER_RING_SIZE = Math.round(RING_SIZE * 0.46);
const CENTER_ICON_SIZE = Math.round(INNER_RING_SIZE * 0.65);
const DOT_SIZE = 11;

/**
 * Feature flag: whether backend bank verification status endpoint/fields are live.
 * Default is false. When false, the app will never claim "verified" without real backend verification status,
 * and will show the timeout modal once the polling window expires.
 */
export const BANK_VERIFICATION_STATUS_AVAILABLE = false;

export default function VerifyingBank() {
	const { t } = useTranslation();
	const insets = useSafeAreaInsets();
	const router = useRouter();
	const navigation = useNavigation();

	const [status, setStatus] = useState<"verifying" | "verified" | "failed" | "timeout">("verifying");
	const [errorMessage, setErrorMessage] = useState("");
	const [modalVisible, setModalVisible] = useState(false);
	const [errorModalVisible, setErrorModalVisible] = useState(false);
	const [allowNavigation, setAllowNavigation] = useState(false);

	const mountedRef = useRef(true);
	const isPollingRef = useRef(false);
	const startTimeRef = useRef(0);
	const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const navigationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const tRef = useRef(t);
	useEffect(() => {
		tRef.current = t;
	}, [t]);

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

	const clearTimers = () => {
		isPollingRef.current = false;
		if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
		if (navigationTimerRef.current) clearTimeout(navigationTimerRef.current);
	};

	useEffect(() => {
		mountedRef.current = true;
		return () => {
			mountedRef.current = false;
			clearTimers();
		};
	}, []);

	// Real status check against the backend's bank verification status
	const startVerification = useCallback(async () => {
		clearTimers();
		if (isPollingRef.current) return;
		isPollingRef.current = true;
		startTimeRef.current = Date.now();

		setStatus("verifying");
		setErrorModalVisible(false);
		setModalVisible(false);

		const MAX_POLL_TIME = 16000;
		const INTERVAL = 2000;

		const poll = async () => {
			if (!mountedRef.current) {
				isPollingRef.current = false;
				return;
			}

			try {
				const [accounts, dashboard]: [any, any] = await Promise.all([
					getBankAccounts().catch(() => null),
					getUserDashboardData().catch(() => null),
				]);

				if (!mountedRef.current) {
					isPollingRef.current = false;
					return;
				}

				const hasAccount = Array.isArray(accounts) && accounts.length > 0;
				const currentStep = String(
					dashboard?.workflow_progress?.current_step || dashboard?.current_step || "",
				).toLowerCase().trim();

				if (hasAccount) {
					// 1. Explicit failure check
					const failedAccount = accounts.find(
						(a: any) =>
							a.verification_status === "failed" ||
							a.verification_status === "rejected" ||
							a.verified === false,
					);
					if (failedAccount) {
						isPollingRef.current = false;
						setStatus("failed");
						setErrorMessage(
							failedAccount.verification_failure_reason ||
							failedAccount.rejection_reason ||
							tRef.current("bankVerificationFailed"),
						);
						setErrorModalVisible(true);
						return;
					}

					// 2. Verified check:
					// Passes if:
					// - Explicit verified status returned by backend (verification_status === "verified" or verified === true)
					// - OR workflow has progressed past bank_details (backend completed the bank_details step)
					// - OR BANK_VERIFICATION_STATUS_AVAILABLE flag is active
					const verifiedAccount = accounts.find(
						(a: any) => a.verification_status === "verified" || a.verified === true,
					);
					const isStepAdvanced =
						currentStep &&
						currentStep !== "bank_details" &&
						currentStep !== "verify_bank_details";

					if (verifiedAccount || isStepAdvanced || BANK_VERIFICATION_STATUS_AVAILABLE) {
						isPollingRef.current = false;
						setStatus("verified");
						modalScale.value = 0;
						setModalVisible(true);
						modalScale.value = withTiming(1, {
							duration: 400,
							easing: Easing.out(Easing.back(1.5)),
						});

						setAllowNavigation(true);
						navigationTimerRef.current = setTimeout(() => {
							if (!mountedRef.current) return;
							const href = currentStep && StepHref[currentStep as keyof typeof StepHref]
								? StepHref[currentStep as keyof typeof StepHref]
								: "/sanction-letter";
							router.replace(href !== "/verify-bank-details" && href !== "/verifying-bank" ? (href as any) : "/sanction-letter");
						}, 2400);
						return;
					}
				}

				if (Date.now() - startTimeRef.current >= MAX_POLL_TIME) {
					// Bounded window elapsed without verified confirmation
					isPollingRef.current = false;
					setStatus("timeout");
					setErrorMessage(tRef.current("stepTakingLonger"));
					setErrorModalVisible(true);
					return;
				}

				pollTimerRef.current = setTimeout(poll, INTERVAL);
			} catch (err: any) {
				if (!mountedRef.current) {
					isPollingRef.current = false;
					return;
				}
				if (Date.now() - startTimeRef.current >= MAX_POLL_TIME) {
					isPollingRef.current = false;
					setStatus("failed");
					setErrorMessage(err?.message || tRef.current("bankVerificationFailed"));
					setErrorModalVisible(true);
				} else {
					pollTimerRef.current = setTimeout(poll, INTERVAL);
				}
			}
		};

		poll();
	}, [modalScale, router]);

	useEffect(() => {
		startVerification();
		return () => clearTimers();
	}, []);

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
					<Text style={styles.verifyingTitle}>{BANK_VERIFICATION_STATUS_AVAILABLE ? t("verifyingYourBankDetails") : t("bankDetailsSavingTitle", "Saving your bank details")}</Text>
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
				animationType="fade"
				onRequestClose={() => {}}>
				<View style={styles.modalOverlay}>
					<View style={styles.modalContent}>
						<Animated.Image
							source={Images.SUCCESS_ICON}
							style={[styles.successImage, modalAnimatedStyle]}
							resizeMode="contain"
						/>
						<Text style={styles.successTitle}>{BANK_VERIFICATION_STATUS_AVAILABLE ? t("bankDetailsVerifiedSuccessfully") : t("bankDetailsSavedTitle", "Your bank details have been saved")}</Text>
						{BANK_VERIFICATION_STATUS_AVAILABLE && <TranslatedText style={styles.successSubtitle} translationKey="yourBankDetailsHasBeenVerified" />}
					</View>
				</View>
			</Modal>

			{/* Bank Verification Failure / Timeout Modal */}
			<Modal
				visible={errorModalVisible}
				transparent={true}
				animationType="fade"
				onRequestClose={() => {}}>
				<View style={styles.errorOverlay}>
					<View style={styles.errorCard}>
						<MaterialIcons name="error-outline" size={56} color={status === "timeout" ? "#D97706" : "#DC2626"} style={{ marginBottom: 14 }} />
						<Text style={styles.errorTitle}>
							{status === "timeout" ? t("stepTakingLonger") : t("bankVerificationFailed")}
						</Text>
						<Text style={styles.errorSubtitle}>
							{errorMessage || (status === "timeout" ? t("stepTakingLonger") : t("bankVerificationFailed"))}
						</Text>
						<View style={styles.errorBtnContainer}>
							<TouchableOpacity
								style={styles.retryBtn}
								onPress={() => startVerification()}
								activeOpacity={0.85}>
								<Text style={styles.retryBtnText}>{t("tryAgain")}</Text>
							</TouchableOpacity>
							<TouchableOpacity
								style={styles.editBtn}
								onPress={() => {
									setAllowNavigation(true);
									router.replace("/verify-bank-details");
								}}
								activeOpacity={0.85}>
								<Text style={styles.editBtnText}>{t("editBankDetails")}</Text>
							</TouchableOpacity>
						</View>
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
	errorOverlay: {
		flex: 1,
		backgroundColor: "rgba(0,0,0,0.55)",
		justifyContent: "center",
		alignItems: "center",
		paddingHorizontal: width(6),
	},
	errorCard: {
		width: "100%",
		maxWidth: 380,
		backgroundColor: "#FFFFFF",
		borderRadius: 24,
		padding: 24,
		alignItems: "center",
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.15,
		shadowRadius: 12,
		elevation: 6,
	},
	errorTitle: {
		fontSize: font(2.2),
		fontWeight: "700",
		color: "#1F2937",
		textAlign: "center",
		marginBottom: 8,
	},
	errorSubtitle: {
		fontSize: font(1.6),
		color: "#6B7280",
		textAlign: "center",
		lineHeight: font(2.2),
		marginBottom: 24,
	},
	errorBtnContainer: {
		width: "100%",
		gap: 12,
	},
	retryBtn: {
		width: "100%",
		backgroundColor: "#4D43FE",
		borderRadius: 14,
		paddingVertical: 14,
		alignItems: "center",
		justifyContent: "center",
	},
	retryBtnText: {
		fontSize: font(1.7),
		fontWeight: "700",
		color: "#FFFFFF",
	},
	editBtn: {
		width: "100%",
		borderWidth: 1.5,
		borderColor: "#4D43FE",
		borderRadius: 14,
		paddingVertical: 13,
		alignItems: "center",
		justifyContent: "center",
	},
	editBtnText: {
		fontSize: font(1.6),
		fontWeight: "600",
		color: "#4D43FE",
	},
});
