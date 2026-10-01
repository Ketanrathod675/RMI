import { Images } from "@/constants/images";
import { JAKARTA } from "@/constants/typography";
import { useTranslation } from "@/hooks/useTranslation";
import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
	LayoutChangeEvent,
	Modal,
	StyleSheet,
	Text as RNText,
	TextProps,
	useWindowDimensions,
	View,
} from "react-native";
import Animated, {
	cancelAnimation,
	Easing,
	useAnimatedProps,
	useAnimatedStyle,
	useReducedMotion,
	useSharedValue,
	withRepeat,
	withSequence,
	withSpring,
	withTiming,
} from "react-native-reanimated";
import {
	SafeAreaProvider,
	useSafeAreaInsets,
} from "react-native-safe-area-context";
import Svg, { Circle, Path, Polyline } from "react-native-svg";
import {
	getLoaderMetrics,
	ROW_GAP,
	ROW_H,
	ROW_H_ACTIVE,
} from "./verificationLoaderMetrics";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// Users with a large system font must not break the fixed-height rows,
// so every Text in the loader is capped at 1.1x.
const FONT_SCALE_CAP = 1.1;
function Text(props: TextProps) {
	return <RNText maxFontSizeMultiplier={FONT_SCALE_CAP} {...props} />;
}

const ANIM_MS = 340;
const ANIM_EASING = Easing.bezier(0.25, 0.1, 0.25, 1);

export const TOKENS = {
	emerald: "#09A143",
	emeraldText: "#047857",
	mint: "#ECFDF5",
	lime: "#B7FB52",
	activeBg: "#F3FDE0",
	activeBorder: "#D5F59C",
	text: "#1E293B",
	body: "#64748B",
	bodyStrong: "#334155",
	subtle: "#94A3B8",
	outline: "#CBD5E1",
	pendingDot: "#E2E8F0",
	track: "#E5E7EB",
	connector: "#F1F5F9",
	pillBg: "#F8FAFC",
	pillBorder: "#F1F5F9",
	footerBorder: "#F1F5F9",
	white: "#FFFFFF",
	failedBg: "#FEF2F2",
	failedBorder: "#FECACA",
	failedRed: "#EF4444",
	failedText: "#DC2626",
	failedPillBg: "#FEE2E2",
} as const;

export interface VerificationLoaderStep {
	id: string;
	title: string;
	subtitle?: string;
}

export interface VerificationLoaderProps {
	visible: boolean;
	steps: VerificationLoaderStep[];
	completedIds: string[];
	activeId: string | null;
	failedId?: string | null;
	progressPercent: number;
	headingText?: string;
	slaText?: string | null;
}

export interface VerificationLoaderContentProps
	extends Omit<VerificationLoaderProps, "visible"> { }

// Animated 3-dot Ellipsis (Wave loop staggered by 200ms, 1200ms cycle)
function AnimatedEllipsis() {
	const reducedMotion = useReducedMotion();
	const op1 = useSharedValue(0.25);
	const op2 = useSharedValue(0.25);
	const op3 = useSharedValue(0.25);

	useEffect(() => {
		if (reducedMotion) {
			op1.value = 1;
			op2.value = 1;
			op3.value = 1;
			return;
		}

		op1.value = withRepeat(
			withSequence(
				withTiming(1, { duration: 400, easing: Easing.inOut(Easing.ease) }),
				withTiming(0.25, { duration: 800, easing: Easing.inOut(Easing.ease) })
			),
			-1
		);

		const t1 = setTimeout(() => {
			op2.value = withRepeat(
				withSequence(
					withTiming(1, { duration: 400, easing: Easing.inOut(Easing.ease) }),
					withTiming(0.25, { duration: 800, easing: Easing.inOut(Easing.ease) })
				),
				-1
			);
		}, 200);

		const t2 = setTimeout(() => {
			op3.value = withRepeat(
				withSequence(
					withTiming(1, { duration: 400, easing: Easing.inOut(Easing.ease) }),
					withTiming(0.25, { duration: 800, easing: Easing.inOut(Easing.ease) })
				),
				-1
			);
		}, 400);

		return () => {
			clearTimeout(t1);
			clearTimeout(t2);
			cancelAnimation(op1);
			cancelAnimation(op2);
			cancelAnimation(op3);
		};
	}, [reducedMotion, op1, op2, op3]);

	const animStyle1 = useAnimatedStyle(() => ({ opacity: op1.value }));
	const animStyle2 = useAnimatedStyle(() => ({ opacity: op2.value }));
	const animStyle3 = useAnimatedStyle(() => ({ opacity: op3.value }));

	return (
		<View style={styles.ellipsisRow}>
			<Animated.Text
				maxFontSizeMultiplier={FONT_SCALE_CAP}
				style={[styles.headingTitle, animStyle1]}>
				.
			</Animated.Text>
			<Animated.Text
				maxFontSizeMultiplier={FONT_SCALE_CAP}
				style={[styles.headingTitle, animStyle2]}>
				.
			</Animated.Text>
			<Animated.Text
				maxFontSizeMultiplier={FONT_SCALE_CAP}
				style={[styles.headingTitle, animStyle3]}>
				.
			</Animated.Text>
		</View>
	);
}

// 28x28 Active Spinner Icon: 20x20 Lime disc + Pulsing dot + Rotating outer arc
function ActiveSpinnerIcon() {
	const reducedMotion = useReducedMotion();
	const rotation = useSharedValue(0);
	const dotScale = useSharedValue(0.85);

	useEffect(() => {
		if (reducedMotion) {
			rotation.value = 0;
			dotScale.value = 1;
			return;
		}

		rotation.value = withRepeat(
			withTiming(360, {
				duration: 1000,
				easing: Easing.linear,
			}),
			-1,
			false
		);

		dotScale.value = withRepeat(
			withSequence(
				withTiming(1.1, {
					duration: 450,
					easing: Easing.inOut(Easing.ease),
				}),
				withTiming(0.85, {
					duration: 450,
					easing: Easing.inOut(Easing.ease),
				})
			),
			-1,
			true
		);

		return () => {
			cancelAnimation(rotation);
			cancelAnimation(dotScale);
		};
	}, [reducedMotion, rotation, dotScale]);

	const animRotation = useAnimatedStyle(() => ({
		transform: [{ rotate: `${rotation.value}deg` }],
	}));

	const animDot = useAnimatedStyle(() => ({
		transform: [{ scale: dotScale.value }],
	}));

	return (
		<View style={styles.activeIconContainer} accessibilityElementsHidden={true} importantForAccessibility="no">
			{/* Inner Lime Disc with Pulsing Emerald Dot */}
			<View style={styles.activeLimeDisc}>
				<Animated.View style={[styles.activeCenterDot, animDot]} />
			</View>

			{/* Outer Rotating Arc: r=12.75, width=2.5, circumference ≈ 80.11, quarter ≈ 20.03 */}
			<Animated.View style={[StyleSheet.absoluteFill, animRotation]}>
				<Svg width={28} height={28} viewBox="0 0 28 28">
					<Circle
						cx={14}
						cy={14}
						r={12.75}
						stroke={TOKENS.emerald}
						strokeWidth={2.5}
						strokeDasharray="20.03 60.08"
						strokeLinecap="round"
						fill="none"
					/>
				</Svg>
			</Animated.View>
		</View>
	);
}

// 28x28 Completed Checkmark with Spring Pop-In & SVG Check
function CompletedCheckmark() {
	const reducedMotion = useReducedMotion();
	const scale = useSharedValue(reducedMotion ? 1 : 0.6);

	useEffect(() => {
		if (!reducedMotion) {
			scale.value = withSpring(1, { damping: 12, stiffness: 220 });
		}
	}, [reducedMotion, scale]);

	const animStyle = useAnimatedStyle(() => ({
		transform: [{ scale: scale.value }],
	}));

	return (
		<Animated.View style={[styles.completedIconCircle, animStyle]} accessibilityElementsHidden={true} importantForAccessibility="no">
			<Svg width={16} height={16} viewBox="0 0 16 16">
				<Polyline
					points="3.5,8.5 6.5,11.5 12.5,5"
					fill="none"
					stroke={TOKENS.white}
					strokeWidth={2}
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
			</Svg>
		</Animated.View>
	);
}

// 28x28 Pending Icon: White circle with 2px outline and 6x6 dot
function PendingIcon() {
	return (
		<View style={styles.pendingIconCircle} accessibilityElementsHidden={true} importantForAccessibility="no">
			<View style={styles.pendingCenterDot} />
		</View>
	);
}

// 28x28 Failed Icon with SVG Cross
function FailedIcon() {
	return (
		<View style={styles.failedIconCircle} accessibilityElementsHidden={true} importantForAccessibility="no">
			<Svg width={14} height={14} viewBox="0 0 14 14">
				<Path
					d="M3 3L11 11M11 3L3 11"
					stroke={TOKENS.white}
					strokeWidth={2}
					strokeLinecap="round"
				/>
			</Svg>
		</View>
	);
}

// Strikethrough Text with 320ms animated underline/strike
function StrikethroughText({ text }: { text: string }) {
	const reducedMotion = useReducedMotion();
	const lineWidth = useSharedValue(reducedMotion ? 1 : 0);

	useEffect(() => {
		if (!reducedMotion) {
			lineWidth.value = withTiming(1, {
				duration: 320,
				easing: Easing.out(Easing.cubic),
			});
		}
	}, [reducedMotion, lineWidth]);

	const animLineStyle = useAnimatedStyle(() => ({
		width: `${lineWidth.value * 100}%`,
	}));

	return (
		<View style={styles.strikeTextWrapper}>
			<Text
				style={styles.completedTitleText}
				numberOfLines={1}
				adjustsFontSizeToFit
				minimumFontScale={0.85}>
				{text}
			</Text>
			<Animated.View style={[styles.strikeLine, animLineStyle]} />
		</View>
	);
}

// Active Right Badge with 6px Pulsing Dot + "ACTIVE" text
function ActiveBadge({ label }: { label: string }) {
	const reducedMotion = useReducedMotion();
	const dotOpacity = useSharedValue(1);

	useEffect(() => {
		if (reducedMotion) {
			dotOpacity.value = 1;
			return;
		}

		dotOpacity.value = withRepeat(
			withSequence(
				withTiming(0.35, {
					duration: 450,
					easing: Easing.inOut(Easing.ease),
				}),
				withTiming(1, {
					duration: 450,
					easing: Easing.inOut(Easing.ease),
				})
			),
			-1,
			true
		);

		return () => {
			cancelAnimation(dotOpacity);
		};
	}, [reducedMotion, dotOpacity]);

	const animDotStyle = useAnimatedStyle(() => ({
		opacity: dotOpacity.value,
	}));

	return (
		<View style={styles.activeBadgeContainer}>
			<Animated.View style={[styles.activeBadgeDot, animDotStyle]} />
			<Text style={styles.activeBadgeText}>{label.toUpperCase()}</Text>
		</View>
	);
}

// Row shell: its height animates 48 <-> 57 so rows never "jump" when a step
// becomes active / completed.
function RowSlot({
	height,
	children,
}: {
	height: number;
	children: React.ReactNode;
}) {
	const h = useSharedValue(height);

	useEffect(() => {
		h.value = withTiming(height, { duration: ANIM_MS, easing: ANIM_EASING });
	}, [height, h]);

	const animStyle = useAnimatedStyle(() => ({ height: h.value }));

	return <Animated.View style={[styles.rowSlot, animStyle]}>{children}</Animated.View>;
}

// Pure Presentation Content Component (No Modal)
export function VerificationLoaderContent({
	steps,
	completedIds,
	activeId,
	failedId,
	progressPercent,
	headingText,
	slaText,
}: VerificationLoaderContentProps) {
	const { t } = useTranslation();
	const insets = useSafeAreaInsets();
	const win = useWindowDimensions();

	// Measure the real container (inside a Modal, window metrics differ between
	// iOS / Android / edge-to-edge). Falls back to window size on first frame.
	const [box, setBox] = useState<{ w: number; h: number } | null>(null);
	const onRootLayout = useCallback((e: LayoutChangeEvent) => {
		const { width, height } = e.nativeEvent.layout;
		setBox((prev) =>
			prev && prev.w === width && prev.h === height ? prev : { w: width, h: height }
		);
	}, []);

	const m = useMemo(
		() =>
			getLoaderMetrics(
				box?.w ?? win.width,
				box?.h ?? win.height,
				insets.top,
				insets.bottom
			),
		[box, win.width, win.height, insets.top, insets.bottom]
	);

	// ---- ring ----
	const circleRadius = 42; // in the 96 x 96 viewBox
	const circumference = 2 * Math.PI * circleRadius;
	const ringScale = m.ringSize / 96;

	const animProgress = useSharedValue(progressPercent);
	useEffect(() => {
		animProgress.value = withTiming(progressPercent, {
			duration: 450,
			easing: Easing.out(Easing.cubic),
		});
	}, [progressPercent, animProgress]);

	const animatedCircleProps = useAnimatedProps(() => ({
		strokeDashoffset: circumference - (animProgress.value / 100) * circumference,
	}));

	// ---- title (strip trailing dots, we draw animated ones) ----
	const rawTitle =
		headingText || t("verifyingYourDetails", "Verifying your details ...");
	const cleanedTitle = useMemo(
		() => rawTitle.replace(/[\s.\u2026]+$/, ""),
		[rawTitle]
	);

	// ---- list geometry ----
	const { rowTops, rowHeights, totalListHeight, activeIndex } = useMemo(() => {
		let top = 0;
		const tops: number[] = [];
		const heights: number[] = [];
		let activeIdx = -1;

		steps.forEach((step, idx) => {
			const isActiveRow =
				(activeId === step.id && !completedIds.includes(step.id)) ||
				failedId === step.id;
			if (isActiveRow && activeIdx === -1) activeIdx = idx;
			const h = isActiveRow ? ROW_H_ACTIVE : ROW_H;
			tops.push(top);
			heights.push(h);
			top += h + ROW_GAP;
		});

		return {
			rowTops: tops,
			rowHeights: heights,
			totalListHeight: Math.max(0, top - ROW_GAP),
			activeIndex: activeIdx,
		};
	}, [steps, activeId, failedId, completedIds]);

	// Keep the active row in the 3rd slot (5 rows) or 2nd slot (3-4 rows)
	const centerSlot = m.visibleRows >= 5 ? 2 : 1;
	const translateY = useSharedValue(0);

	useEffect(() => {
		if (steps.length === 0) {
			translateY.value = 0;
			return;
		}
		let target = activeIndex;
		if (target < 0) {
			target = steps.findIndex((s) => !completedIds.includes(s.id));
			if (target < 0) target = steps.length - 1;
		}
		const wanted = (rowTops[target] ?? 0) - centerSlot * (ROW_H + ROW_GAP);
		const maxOffset = Math.max(0, totalListHeight - m.windowHeight);
		const offset = Math.max(0, Math.min(maxOffset, wanted));
		translateY.value = withTiming(-offset, {
			duration: ANIM_MS,
			easing: ANIM_EASING,
		});
	}, [
		activeIndex,
		steps,
		completedIds,
		rowTops,
		totalListHeight,
		m.windowHeight,
		centerSlot,
		translateY,
	]);

	const animatedListStyle = useAnimatedStyle(() => ({
		transform: [{ translateY: translateY.value }],
	}));

	// ---- connector (centred on the 28px icons: 10px padding + 14px radius) ----
	const firstIconCenter = (rowHeights[0] ?? ROW_H) / 2;
	const lastIndex = steps.length - 1;
	const lastIconCenter =
		lastIndex >= 0
			? (rowTops[lastIndex] ?? 0) + (rowHeights[lastIndex] ?? ROW_H) / 2
			: 0;
	const trackHeight = Math.max(0, lastIconCenter - firstIconCenter);

	const targetFillHeight = useMemo(() => {
		if (activeIndex < 0) return trackHeight; // everything done
		if (activeIndex === 0) return 0;
		return Math.max(0, (rowTops[activeIndex] ?? 0) - firstIconCenter);
	}, [activeIndex, rowTops, firstIconCenter, trackHeight]);

	const fillHeight = useSharedValue(targetFillHeight);
	useEffect(() => {
		fillHeight.value = withTiming(targetFillHeight, {
			duration: ANIM_MS,
			easing: ANIM_EASING,
		});
	}, [targetFillHeight, fillHeight]);

	const animatedFillStyle = useAnimatedStyle(() => ({ height: fillHeight.value }));

	return (
		<View
			style={[
				styles.screen,
				{
					paddingTop: insets.top + m.topPad + m.extraTop,
					paddingBottom: insets.bottom + m.bottomPad,
					paddingHorizontal: m.sidePad,
				},
			]}
			onLayout={onRootLayout}
			accessibilityLiveRegion="polite"
			accessibilityViewIsModal>
			<View style={[styles.main, { gap: m.gap }]}>
				{/* A) RING */}
				<View
					style={{ width: m.ringSize, height: m.ringBlockHeight }}
					accessibilityRole="progressbar"
					accessibilityValue={{
						min: 0,
						max: 100,
						now: Math.round(progressPercent),
					}}>
					<View style={{ width: m.ringSize, height: m.ringSize }}>
						<Svg
							width={m.ringSize}
							height={m.ringSize}
							viewBox="0 0 96 96">
							<Circle
								cx={48}
								cy={48}
								r={circleRadius}
								stroke={TOKENS.track}
								strokeWidth={4.5}
								fill="none"
							/>
							<AnimatedCircle
								cx={48}
								cy={48}
								r={circleRadius}
								stroke={TOKENS.emerald}
								strokeWidth={4.5}
								strokeDasharray={`${circumference}`}
								strokeLinecap="round"
								fill="none"
								transform="rotate(-90 48 48)"
								animatedProps={animatedCircleProps}
							/>
						</Svg>

						<View
							style={[
								styles.ringDisc,
								{
									width: 48 * ringScale,
									height: 48 * ringScale,
									marginLeft: -24 * ringScale,
									marginTop: -24 * ringScale,
								},
							]}>
							<ExpoImage
								source={Images.R_BOX_LOGO}
								style={{ width: 24 * ringScale, height: 24 * ringScale }}
								contentFit="contain"
							/>
						</View>

						<View style={styles.badgeAnchor} pointerEvents="none">
							<View style={styles.percentBadge}>
								<Text style={styles.percentBadgeText}>
									{Math.round(progressPercent)}%
								</Text>
							</View>
						</View>
					</View>
				</View>

				{/* B) HEADING */}
				<View style={[styles.headingBlock, { paddingBottom: m.headingPadBottom }]}>
					<View style={styles.headingTitleRow}>
						<Text
							style={styles.headingTitle}
							numberOfLines={2}
							adjustsFontSizeToFit
							minimumFontScale={0.8}>
							{cleanedTitle}
						</Text>
						<AnimatedEllipsis />
					</View>
					<View style={styles.headingBody}>
						<Text style={styles.headingBodyLine1}>
							{t("thisMayTakeALittleWhile", "This may take a little while.")}
						</Text>
						<Text style={styles.headingBodyLine2}>
							{t(
								"pleaseDontCloseOrRefresh",
								"Please don't close or refresh the app."
							)}
						</Text>
					</View>
				</View>

				{/* C) CHECKLIST CARD */}
				<View style={[styles.card, { width: m.cardWidth }]}>
					<View style={{ height: m.windowHeight, overflow: "hidden" }}>
						<Animated.View style={[styles.stepsContainer, animatedListStyle]}>
							{steps.length > 1 && (
								<View
									pointerEvents="none"
									style={[
										styles.connectorTrack,
										{ top: firstIconCenter, height: trackHeight },
									]}>
									<Animated.View style={[styles.connectorFill, animatedFillStyle]} />
								</View>
							)}

							{steps.map((step, idx) => {
								const isCompleted = completedIds.includes(step.id);
								const isFailed = failedId === step.id;
								const isActive = activeId === step.id && !isCompleted && !isFailed;
								const slotHeight = isActive || isFailed ? ROW_H_ACTIVE : ROW_H;

								const a11yLabel = isCompleted
									? `${step.title}, completed`
									: isActive
										? `${step.title}, in progress`
										: isFailed
											? `${step.title}, failed`
											: `${step.title}, pending`;

								let row: React.ReactNode;

								if (isActive) {
									row = (
										<View style={styles.activeRow} accessible accessibilityLabel={a11yLabel}>
											<View style={styles.rowLeft}>
												<ActiveSpinnerIcon />
												<View style={styles.rowText}>
													<Text
														style={styles.activeTitleText}
														numberOfLines={1}
														adjustsFontSizeToFit
														minimumFontScale={0.85}>
														{step.title}
													</Text>
													{step.subtitle ? (
														<Text style={styles.activeSubtitleText} numberOfLines={1}>
															{step.subtitle}
														</Text>
													) : null}
												</View>
											</View>
											<ActiveBadge label={t("stepActive", "ACTIVE")} />
										</View>
									);
								} else if (isFailed) {
									row = (
										<View style={styles.failedRow} accessible accessibilityLabel={a11yLabel}>
											<View style={styles.rowLeft}>
												<FailedIcon />
												<View style={styles.rowText}>
													<Text style={styles.failedTitleText} numberOfLines={1}>
														{step.title}
													</Text>
												</View>
											</View>
											<View style={styles.failedBadge}>
												<Text style={styles.failedBadgeText}>
													{t("stepFailed", "Failed")}
												</Text>
											</View>
										</View>
									);
								} else {
									row = (
										<View
											style={[styles.regularRow, !isCompleted && styles.pendingRow]}
											accessible
											accessibilityLabel={a11yLabel}>
											<View style={styles.rowLeft}>
												{isCompleted ? <CompletedCheckmark /> : <PendingIcon />}
												<View style={styles.rowText}>
													{isCompleted ? (
														<StrikethroughText text={step.title} />
													) : (
														<Text
															style={styles.pendingTitleText}
															numberOfLines={1}
															adjustsFontSizeToFit
															minimumFontScale={0.85}>
															{step.title}
														</Text>
													)}
												</View>
											</View>
											{isCompleted ? (
												<View style={styles.donePill}>
													<Text style={styles.donePillText}>{t("stepDone", "Done")}</Text>
												</View>
											) : (
												<Text style={styles.pendingPillText}>
													{t("stepPending", "Pending")}
												</Text>
											)}
										</View>
									);
								}

								return (
									<RowSlot key={step.id} height={slotHeight}>
										{row}
									</RowSlot>
								);
							})}
						</Animated.View>
					</View>
				</View>

				{/* D) SLA PILL (hidden on short screens or when slaText === null) */}
				{m.showPill && slaText !== null && (
					<View style={[styles.slaPill, { maxWidth: m.cardWidth }]}>
						<Ionicons name="flash" size={14} color={TOKENS.emerald} />
						<Text style={styles.slaPillText} numberOfLines={1}>
							{slaText !== undefined
								? slaText
								: t(
									"instantSanctionSubtext",
									"Instant sanction in under 90 seconds"
								)}
						</Text>
					</View>
				)}
			</View>

			{/* E) FOOTER */}
			<View style={styles.footer}>
				<View style={styles.footerRow}>
					<Ionicons name="lock-closed" size={14} color={TOKENS.emerald} />
					<Text style={styles.footerText} numberOfLines={1}>
						{t("yourDataIs", "Your data is")}{" "}
						<Text style={styles.footerStrong}>
							{t("secureEncrypted", "100% secure & encrypted")}
						</Text>
					</Text>
				</View>
				<Text style={styles.footerSub} numberOfLines={1}>
					{t("rbiRegulatedPartners", "RBI regulated NBFC lending partners")}
				</Text>
			</View>
		</View>
	);
}

const noop = () => { };

// Default export: full-screen Modal wrapper. Modal content is a separate native
// root, so it needs its own SafeAreaProvider to get correct insets on Android.
export default function VerificationLoader({
	visible,
	steps,
	completedIds,
	activeId,
	failedId,
	progressPercent,
	headingText,
	slaText,
}: VerificationLoaderProps) {
	return (
		<Modal
			visible={visible}
			transparent={false}
			animationType="fade"
			statusBarTranslucent
			navigationBarTranslucent
			supportedOrientations={["portrait"]}
			onRequestClose={noop}>
			<StatusBar style="dark" />
			<SafeAreaProvider>
				<VerificationLoaderContent
					steps={steps}
					completedIds={completedIds}
					activeId={activeId}
					failedId={failedId}
					progressPercent={progressPercent}
					headingText={headingText}
					slaText={slaText}
				/>
			</SafeAreaProvider>
		</Modal>
	);
}

const SOFT_SHADOW = "0px 1px 2px rgba(0, 0, 0, 0.05)";

const styles = StyleSheet.create({
	screen: {
		flex: 1,
		backgroundColor: TOKENS.white,
	},
	main: {
		flex: 1,
		alignItems: "center",
	},

	// A) ring
	ringDisc: {
		position: "absolute",
		left: "50%",
		top: "50%",
		borderRadius: 9999,
		backgroundColor: TOKENS.mint,
		alignItems: "center",
		justifyContent: "center",
	},
	badgeAnchor: {
		position: "absolute",
		left: 0,
		right: 0,
		bottom: -6,
		alignItems: "center",
	},
	percentBadge: {
		height: 19,
		paddingHorizontal: 8,
		borderRadius: 9999,
		backgroundColor: TOKENS.emerald,
		alignItems: "center",
		justifyContent: "center",
		boxShadow: SOFT_SHADOW,
	},
	percentBadgeText: {
		fontFamily: JAKARTA.bold,
		fontSize: 10,
		lineHeight: 15,
		letterSpacing: 0.5,
		color: TOKENS.white,
	},

	// B) heading
	headingBlock: {
		width: "100%",
		alignItems: "center",
		paddingHorizontal: 16,
		gap: 5,
	},
	headingTitleRow: {
		flexDirection: "row",
		alignItems: "flex-end",
		justifyContent: "center",
		gap: 4,
		maxWidth: "100%",
	},
	headingTitle: {
		flexShrink: 1,
		fontFamily: JAKARTA.bold,
		fontSize: 20,
		lineHeight: 28,
		letterSpacing: -0.5,
		color: TOKENS.text,
		textAlign: "center",
	},
	ellipsisRow: {
		flexDirection: "row",
		alignItems: "center",
	},
	headingBody: {
		maxWidth: 280,
		alignItems: "center",
	},
	headingBodyLine1: {
		fontFamily: JAKARTA.regular,
		fontSize: 13,
		lineHeight: 21,
		color: TOKENS.body,
		textAlign: "center",
	},
	headingBodyLine2: {
		fontFamily: JAKARTA.medium,
		fontSize: 13,
		lineHeight: 21,
		color: TOKENS.bodyStrong,
		textAlign: "center",
	},

	// C) card (two soft layers, exactly like the CSS export; no Android elevation)
	card: {
		borderRadius: 20,
		backgroundColor: TOKENS.white,
		paddingTop: 16,
		paddingHorizontal: 14,
		paddingBottom: 14,
		boxShadow:
			"0px 4px 20px -2px rgba(15, 23, 42, 0.05), 0px 2px 6px -1px rgba(15, 23, 42, 0.02)",
	},
	stepsContainer: {
		width: "100%",
	},
	connectorTrack: {
		position: "absolute",
		left: 23, // 10px row padding + 14px icon radius - 1px (half of 2px line)
		width: 2,
		borderRadius: 9999,
		backgroundColor: TOKENS.connector,
	},
	connectorFill: {
		width: 2,
		borderRadius: 9999,
		backgroundColor: TOKENS.emerald,
	},

	// rows
	rowSlot: {
		marginBottom: ROW_GAP,
	},
	rowLeft: {
		flex: 1,
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
	},
	rowText: {
		flex: 1,
		justifyContent: "center",
	},
	// transparent background so the connector line stays visible between icons
	regularRow: {
		flex: 1,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: 10,
		borderRadius: 12,
		gap: 8,
	},
	pendingRow: {
		opacity: 0.6,
	},

	// completed
	completedIconCircle: {
		width: 28,
		height: 28,
		borderRadius: 14,
		backgroundColor: TOKENS.emerald,
		alignItems: "center",
		justifyContent: "center",
		boxShadow: SOFT_SHADOW,
	},
	strikeTextWrapper: {
		alignSelf: "flex-start",
		maxWidth: "100%",
		justifyContent: "center",
	},
	completedTitleText: {
		fontFamily: JAKARTA.medium,
		fontSize: 14,
		lineHeight: 20,
		color: TOKENS.subtle,
	},
	strikeLine: {
		position: "absolute",
		left: 0,
		top: "50%",
		height: 1.5,
		backgroundColor: TOKENS.subtle,
		transform: [{ translateY: 0.75 }],
	},
	donePill: {
		backgroundColor: TOKENS.mint,
		borderRadius: 6,
		paddingVertical: 2,
		paddingHorizontal: 8,
	},
	donePillText: {
		fontFamily: JAKARTA.semibold,
		fontSize: 11,
		lineHeight: 16,
		color: TOKENS.emerald,
	},

	// pending
	pendingIconCircle: {
		width: 28,
		height: 28,
		borderRadius: 14,
		backgroundColor: TOKENS.white,
		borderWidth: 2,
		borderColor: TOKENS.outline,
		alignItems: "center",
		justifyContent: "center",
	},
	pendingCenterDot: {
		width: 6,
		height: 6,
		borderRadius: 3,
		backgroundColor: TOKENS.pendingDot,
	},
	pendingTitleText: {
		fontFamily: JAKARTA.medium,
		fontSize: 14,
		lineHeight: 20,
		color: TOKENS.subtle,
	},
	pendingPillText: {
		fontFamily: JAKARTA.regular,
		fontSize: 11,
		lineHeight: 16,
		color: TOKENS.subtle,
	},

	// active (paddingHorizontal 9 + 1px border keeps the icon on the same x as the others)
	activeRow: {
		flex: 1,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: 9,
		borderRadius: 12,
		backgroundColor: TOKENS.activeBg,
		borderWidth: 1,
		borderColor: TOKENS.activeBorder,
		gap: 8,
		boxShadow: SOFT_SHADOW,
	},
	activeIconContainer: {
		width: 28,
		height: 28,
		alignItems: "center",
		justifyContent: "center",
	},
	activeLimeDisc: {
		width: 20,
		height: 20,
		borderRadius: 10,
		backgroundColor: TOKENS.lime,
		alignItems: "center",
		justifyContent: "center",
	},
	activeCenterDot: {
		width: 8,
		height: 8,
		borderRadius: 4,
		backgroundColor: TOKENS.emerald,
	},
	activeTitleText: {
		fontFamily: JAKARTA.bold,
		fontSize: 14,
		lineHeight: 20,
		color: TOKENS.text,
	},
	activeSubtitleText: {
		fontFamily: JAKARTA.semibold,
		fontSize: 10,
		lineHeight: 15,
		letterSpacing: 0.25,
		color: TOKENS.emeraldText,
	},
	activeBadgeContainer: {
		flexDirection: "row",
		alignItems: "center",
		gap: 4,
		paddingVertical: 2,
		paddingHorizontal: 8,
		borderRadius: 6,
		backgroundColor: "rgba(255, 255, 255, 0.8)",
		borderWidth: 1,
		borderColor: "rgba(9, 161, 67, 0.2)",
	},
	activeBadgeDot: {
		width: 6,
		height: 6,
		borderRadius: 3,
		backgroundColor: TOKENS.emerald,
	},
	activeBadgeText: {
		fontFamily: JAKARTA.bold,
		fontSize: 10,
		lineHeight: 15,
		letterSpacing: 0.5,
		color: TOKENS.emerald,
	},

	// failed
	failedRow: {
		flex: 1,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: 9,
		borderRadius: 12,
		backgroundColor: TOKENS.failedBg,
		borderWidth: 1,
		borderColor: TOKENS.failedBorder,
		gap: 8,
	},
	failedIconCircle: {
		width: 28,
		height: 28,
		borderRadius: 14,
		backgroundColor: TOKENS.failedRed,
		alignItems: "center",
		justifyContent: "center",
	},
	failedTitleText: {
		fontFamily: JAKARTA.semibold,
		fontSize: 14,
		lineHeight: 20,
		color: TOKENS.failedText,
	},
	failedBadge: {
		backgroundColor: TOKENS.failedPillBg,
		borderRadius: 6,
		paddingVertical: 2,
		paddingHorizontal: 8,
	},
	failedBadgeText: {
		fontFamily: JAKARTA.semibold,
		fontSize: 11,
		lineHeight: 16,
		color: TOKENS.failedText,
	},

	// D) pill
	slaPill: {
		flexDirection: "row",
		alignItems: "center",
		alignSelf: "center",
		gap: 8,
		paddingVertical: 6,
		paddingHorizontal: 12,
		borderRadius: 9999,
		borderWidth: 1,
		borderColor: TOKENS.pillBorder,
		backgroundColor: TOKENS.pillBg,
		marginTop: 0,
	},
	slaPillText: {
		flexShrink: 1,
		fontFamily: JAKARTA.medium,
		fontSize: 11,
		lineHeight: 16,
		color: TOKENS.body,
	},

	// E) footer
	footer: {
		width: "100%",
		alignItems: "center",
		borderTopWidth: 1,
		borderTopColor: TOKENS.footerBorder,
		paddingTop: 12,
		paddingBottom: 4,
	},
	footerRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
		maxWidth: "100%",
	},
	footerText: {
		flexShrink: 1,
		fontFamily: JAKARTA.medium,
		fontSize: 12,
		lineHeight: 16,
		color: TOKENS.subtle,
	},
	footerStrong: {
		fontFamily: JAKARTA.bold,
		color: TOKENS.bodyStrong,
	},
	footerSub: {
		fontFamily: JAKARTA.regular,
		fontSize: 10,
		lineHeight: 15,
		color: TOKENS.subtle,
		marginTop: 2,
	},
});