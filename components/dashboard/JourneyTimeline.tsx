import React, { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
	ActivityIndicator,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
	type LayoutChangeEvent,
	type StyleProp,
	type ViewStyle,
} from "react-native";
import Svg, { Line, Path } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
	Easing,
	FadeIn,
	LinearTransition,
	cancelAnimation,
	useAnimatedStyle,
	useReducedMotion,
	useSharedValue,
	withRepeat,
	withSequence,
	withTiming,
} from "react-native-reanimated";
import {
	TIMELINE_GROUPS,
	resolveTimelineState,
	type TimelineGroupId,
} from "@/constants/journeyTimeline";
import { useTranslation } from "@/hooks/useTranslation";

export interface JourneyTimelineProps {
	currentStep: string | null | undefined;
	overallStatus: string | null | undefined;
	isLoading?: boolean;
	onContinue: () => void;
	style?: StyleProp<ViewStyle>;
}

// Visual design tokens
const COLORS = {
	forest: "#134e13",
	dark: "#0e380e",
	deep: "#0a290a",
	lime: "#8fe000",
	limeHover: "#81cb00",
	limeLight: "#f2fce4",
	limeBorder: "#c3f084",
	surface: "#f4f6f1",
	greyLine: "#d1d5db",
	mutedText: "#9ca3af",
	darkText: "#111827",
	cardBorder: "#f3f4f6",
	// Orange accent for current progress per user requirement
	orangePrimary: "#f97316",
	orangeDark: "#ea580c",
	orangeLight: "#ffedd5",
	orangeBorder: "#fed7aa",
	orangeGlow: "rgba(249, 115, 22, 0.45)",
};

const NODE_SIZE = 20;

/**
 * Loading skeleton matching the exact dimensions of the loaded card to prevent layout shift.
 */
function JourneyTimelineSkeleton({ style }: { style?: StyleProp<ViewStyle> }) {
	return (
		<View style={[styles.cardContainer, style]} testID="journey-timeline-skeleton">
			{/* Header skeleton */}
			<View style={styles.headerRow}>
				<View style={styles.skeletonTitle} />
				<View style={styles.skeletonPill} />
			</View>

			{/* Timeline row skeleton */}
			<View style={styles.timelineRowContainer}>
				<View style={styles.skeletonTrack} />
				<View style={styles.nodesRow}>
					{[0, 1, 2, 3].map((idx) => (
						<View key={idx} style={styles.nodeColumn}>
							<View style={styles.skeletonNodeCircle} />
							<View style={styles.skeletonLabel} />
						</View>
					))}
				</View>
			</View>

			{/* Branch card skeleton */}
			<View style={styles.branchContainer}>
				<View style={styles.skeletonBranchCard} />
			</View>
		</View>
	);
}

/**
 * Horizontal Journey Timeline component.
 * Displays 4-step progress: Profile -> KYC -> Bank -> Payout
 * with an elbow connector branching to the active step's card.
 */
function JourneyTimelineComponent({
	currentStep,
	overallStatus,
	isLoading = false,
	onContinue,
	style,
}: JourneyTimelineProps) {
	const { t, tWithValues } = useTranslation();
	const reducedMotion = useReducedMotion();

	// Measure row and node centers dynamically for responsiveness across screen widths & font scales
	const [rowWidth, setRowWidth] = useState(0);
	const [nodeCenters, setNodeCenters] = useState<number[]>([30, 110, 190, 270]);

	// Derive state from currentStep and overallStatus
	const timelineState = useMemo(() => {
		return resolveTimelineState({
			current_step: currentStep,
			overall_status: overallStatus,
		});
	}, [currentStep, overallStatus]);

	const {
		activeIndex,
		allComplete,
		isDisbursing,
		groupProgress,
		groupId,
		currentGroup,
		subtitleKey,
	} = timelineState;

	const isWaitingStep = currentStep === "pdq_check" || currentStep === "credit_queue";

	// Halo pulse animation for the active node
	const haloScale = useSharedValue(1);
	const haloOpacity = useSharedValue(0.6);

	useEffect(() => {
		if (reducedMotion || allComplete) {
			haloScale.value = 1;
			haloOpacity.value = 0;
			return;
		}

		haloScale.value = withRepeat(
			withSequence(
				withTiming(1.8, { duration: 1400 }),
				withTiming(1, { duration: 0 }),
			),
			-1,
			false,
		);
		haloOpacity.value = withRepeat(
			withSequence(
				withTiming(0, { duration: 1400 }),
				withTiming(0.6, { duration: 0 }),
			),
			-1,
			false,
		);

		return () => {
			cancelAnimation(haloScale);
			cancelAnimation(haloOpacity);
		};
	}, [reducedMotion, allComplete, activeIndex]);

	const animatedHaloStyle = useAnimatedStyle(() => ({
		transform: [{ scale: haloScale.value }],
		opacity: haloOpacity.value,
	}));

	// Animate progress bar width smoothly without resetting on refetch
	const progressWidth = useSharedValue(groupProgress);

	useEffect(() => {
		if (reducedMotion) {
			progressWidth.value = groupProgress;
		} else {
			progressWidth.value = withTiming(groupProgress, {
				duration: 600,
				easing: Easing.out(Easing.cubic),
			});
		}
	}, [groupProgress, reducedMotion]);

	const animatedProgressStyle = useAnimatedStyle(() => ({
		width: `${progressWidth.value}%`,
	}));

	// Animate timeline solid line fill
	const startX = nodeCenters[0] ?? 25;
	const endX = nodeCenters[3] ?? (rowWidth ? rowWidth - 25 : 275);
	const totalTrackWidth = Math.max(0, endX - startX);

	const targetFillWidth = useMemo(() => {
		if (allComplete) return totalTrackWidth;
		const currentX = nodeCenters[activeIndex] ?? startX;
		return Math.max(0, currentX - startX);
	}, [allComplete, totalTrackWidth, nodeCenters, activeIndex, startX]);

	const lineFillWidth = useSharedValue(targetFillWidth);

	useEffect(() => {
		if (reducedMotion) {
			lineFillWidth.value = targetFillWidth;
		} else {
			lineFillWidth.value = withTiming(targetFillWidth, {
				duration: 500,
				easing: Easing.out(Easing.cubic),
			});
		}
	}, [targetFillWidth, reducedMotion]);

	const animatedLineStyle = useAnimatedStyle(() => ({
		width: lineFillWidth.value,
	}));

	// Handle row layout measurement
	const handleRowLayout = useCallback((e: LayoutChangeEvent) => {
		const w = e.nativeEvent.layout.width;
		setRowWidth(w);
	}, []);

	// Handle individual node layout measurement
	const handleNodeLayout = useCallback((index: number, e: LayoutChangeEvent) => {
		const { x, width } = e.nativeEvent.layout;
		const center = x + width / 2;
		setNodeCenters((prev) => {
			const updated = [...prev];
			if (Math.abs((updated[index] ?? 0) - center) > 1) {
				updated[index] = center;
				return updated;
			}
			return prev;
		});
	}, []);

	if (isLoading) {
		return <JourneyTimelineSkeleton style={style} />;
	}

	const activeCenterX = nodeCenters[activeIndex] ?? (rowWidth ? rowWidth * ((activeIndex + 0.5) / 4) : 106);

	// Accessibility label for the card
	const stepPillText = allComplete
		? t("journeyStepOf", "Step 4 of 4").replace("{{current}}", "4").replace("{{total}}", "4")
		: tWithValues("journeyStepOf", { current: activeIndex + 1, total: 4 }, `Step ${activeIndex + 1} of 4`);

	const cardAccessibilityLabel = `${t("journeyTitle")}, ${stepPillText}, ${t(currentGroup.titleKey)}`;

	// Branch card title & subtitle resolution
	let branchTitle = t(currentGroup.titleKey);
	let branchSubtitle = t(subtitleKey);

	if (allComplete) {
		branchTitle = t("journeyLoanReady");
		branchSubtitle = t(currentGroup.subtitleKey);
	} else if (isDisbursing) {
		branchTitle = t("journeyReadyDisbursal");
		branchSubtitle = t("journeyStepDisbursementSubtitle");
	} else if (isWaitingStep) {
		branchSubtitle = t("journeyVerifying");
	}

	return (
		<View
			style={[styles.cardContainer, style]}
			accessible={true}
			accessibilityLabel={cardAccessibilityLabel}
		>
			{/* Header Row: Title & Step Pill */}
			<View style={styles.headerRow}>
				<Text style={styles.headerTitle}>{t("journeyTitle")}</Text>
				<View style={styles.stepPill}>
					<Text style={styles.stepPillText}>{stepPillText}</Text>
				</View>
			</View>

			{/* Timeline Row (4 nodes + connecting lines) */}
			<View style={styles.timelineRowContainer} onLayout={handleRowLayout}>
				{/* Background Dashed Grey Line */}
				{rowWidth > 0 && totalTrackWidth > 0 && (
					<Svg
						style={[
							styles.trackSvg,
							{ left: startX, width: totalTrackWidth },
						]}
						height={NODE_SIZE}
					>
						<Line
							x1={0}
							y1={NODE_SIZE / 2}
							x2={totalTrackWidth}
							y2={NODE_SIZE / 2}
							stroke={COLORS.greyLine}
							strokeWidth={2}
							strokeDasharray="4 3"
						/>
					</Svg>
				)}

				{/* Animated Completed Green Line Fill */}
				{rowWidth > 0 && (
					<Animated.View
						style={[
							styles.completedLineFill,
							{ left: startX, top: NODE_SIZE / 2 - 1 },
							animatedLineStyle,
						]}
					/>
				)}

				{/* 4 Nodes */}
				<View style={styles.nodesRow}>
					{TIMELINE_GROUPS.map((group, index) => {
						const isCompleted = index < activeIndex || allComplete;
						const isCurrent = index === activeIndex && !allComplete;
						const isUpcoming = index > activeIndex && !allComplete;

						return (
							<View
								key={group.id}
								style={styles.nodeColumn}
								onLayout={(e) => handleNodeLayout(index, e)}
							>
								{/* Node Circle */}
								<View style={styles.nodeCircleWrapper}>
									{/* Halo pulse on current node */}
									{isCurrent && (
										<Animated.View
											style={[styles.nodeHalo, animatedHaloStyle]}
										/>
									)}

									{/* Completed State (Lime/Green circle + dark check) */}
									{isCompleted && (
										<View style={styles.nodeCompletedCircle}>
											{allComplete && index === 3 ? (
												// Trophy/Rupee check badge for final completion
												<Svg width={11} height={11} viewBox="0 0 24 24" fill="none">
													<Path
														d="M4.5 12.75l6 6 9-13.5"
														stroke={COLORS.dark}
														strokeWidth={3.5}
														strokeLinecap="round"
														strokeLinejoin="round"
													/>
												</Svg>
											) : (
												<Svg width={10} height={10} viewBox="0 0 24 24" fill="none">
													<Path
														d="M4.5 12.75l6 6 9-13.5"
														stroke={COLORS.dark}
														strokeWidth={3}
														strokeLinecap="round"
														strokeLinejoin="round"
													/>
												</Svg>
											)}
										</View>
									)}

									{/* Current State (Orange circle + white ring + center dot) */}
									{isCurrent && (
										<View style={styles.nodeCurrentOuterRing}>
											<View style={styles.nodeCurrentCircle}>
												<View style={styles.nodeCurrentCenterDot} />
											</View>
										</View>
									)}

									{/* Upcoming State (White circle + grey border + small grey dot) */}
									{isUpcoming && (
										<View style={styles.nodeUpcomingCircle}>
											<View style={styles.nodeUpcomingCenterDot} />
										</View>
									)}
								</View>

								{/* Label under node */}
								<Text
									style={[
										styles.nodeLabel,
										isCompleted && styles.nodeLabelCompleted,
										isCurrent && styles.nodeLabelCurrent,
										isUpcoming && styles.nodeLabelUpcoming,
									]}
									numberOfLines={1}
								>
									{t(group.labelKey)}
								</Text>
							</View>
						);
					})}
				</View>
			</View>

			{/* Git-branch Elbow Connector & Compact Branch Card */}
			<View style={styles.branchContainer}>
				{/* Elbow Connector under the active node */}
				{!allComplete && (
					<View
						style={[
							styles.elbowWrapper,
							{ left: Math.max(12, activeCenterX - 2) },
						]}
						pointerEvents="none"
					>
						<Svg width={16} height={12} viewBox="0 0 16 12">
							<Path
								d="M 2 0 L 2 5 Q 2 10 7 10 L 16 10"
								stroke={COLORS.lime}
								strokeWidth={2}
								strokeLinecap="round"
								fill="none"
							/>
						</Svg>
					</View>
				)}

				{/* Branch Card - Keyed by groupId so it only animates on group change */}
				<Animated.View
					key={groupId}
					entering={reducedMotion ? undefined : FadeIn.duration(250)}
					layout={reducedMotion ? undefined : LinearTransition.duration(250)}
					style={styles.branchCardWrapper}
				>
					<LinearGradient
						colors={[COLORS.limeLight, "#edf9da"]}
						start={{ x: 0, y: 0 }}
						end={{ x: 1, y: 1 }}
						style={styles.branchCardGradient}
					>
						{/* Left: Step details & progress bar */}
						<View style={styles.branchLeftContent}>
							<View style={styles.branchTitleRow}>
								<Text style={styles.branchTitle} numberOfLines={1}>
									{branchTitle}
								</Text>
								{/* Percent Chip (Hidden in isDisbursing and allComplete) */}
								{!allComplete && !isDisbursing && (
									<View style={styles.percentChip}>
										<Text style={styles.percentChipText}>
											{groupProgress}%
										</Text>
									</View>
								)}
							</View>

							{/* One-line subtitle */}
							<Text style={styles.branchSubtitle} numberOfLines={1}>
								{branchSubtitle}
							</Text>

							{/* Thin Progress Bar (Height 6, orange fill) */}
							<View style={styles.progressBarTrack}>
								<Animated.View
									style={[styles.progressBarFill, animatedProgressStyle]}
								/>
							</View>
						</View>

						{/* Right: Action Area */}
						{!allComplete && !isDisbursing && (
							<View style={styles.branchActionContainer}>
								{isWaitingStep ? (
									// Waiting step: ActivityIndicator + "View status"
									<TouchableOpacity
										activeOpacity={0.7}
										onPress={onContinue}
										style={styles.viewStatusButton}
										accessibilityRole="button"
										accessibilityLabel={t("journeyViewStatus")}
									>
										<ActivityIndicator
											size="small"
											color={COLORS.orangePrimary}
											style={styles.waitingSpinner}
										/>
										<Text style={styles.viewStatusButtonText}>
											{t("journeyViewStatus")}
										</Text>
									</TouchableOpacity>
								) : (
									// Normal in-progress: Lime Continue button
									<TouchableOpacity
										activeOpacity={0.85}
										onPress={onContinue}
										style={styles.continueButton}
										accessibilityRole="button"
										accessibilityLabel={`${t("journeyContinue")} ${branchTitle}`}
									>
										<Text style={styles.continueButtonText}>
											{t("journeyContinue")}
										</Text>
										<Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
											<Path
												d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
												stroke={COLORS.deep}
												strokeWidth={2.5}
												strokeLinecap="round"
												strokeLinejoin="round"
											/>
										</Svg>
									</TouchableOpacity>
								)}
							</View>
						)}
					</LinearGradient>
				</Animated.View>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	// Main Card
	cardContainer: {
		backgroundColor: "#ffffff",
		borderRadius: 18,
		padding: 14,
		borderWidth: 1,
		borderColor: COLORS.cardBorder,
		shadowColor: "#000000",
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.08,
		shadowRadius: 16,
		elevation: 4,
		zIndex: 10,
		marginHorizontal: 16,
		marginTop: -64,
		marginBottom: 4,
		minHeight: 150,
	},

	// Header
	headerRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		marginBottom: 12,
	},
	headerTitle: {
		fontSize: 15,
		fontWeight: "800",
		color: COLORS.darkText,
		letterSpacing: -0.2,
		lineHeight: 18,
	},
	stepPill: {
		backgroundColor: COLORS.limeLight,
		borderColor: COLORS.limeBorder,
		borderWidth: 1,
		paddingHorizontal: 8,
		paddingVertical: 2,
		borderRadius: 12,
	},
	stepPillText: {
		fontSize: 10,
		fontWeight: "700",
		color: COLORS.dark,
	},

	// Timeline Row
	timelineRowContainer: {
		position: "relative",
		paddingTop: 2,
		paddingBottom: 6,
	},
	trackSvg: {
		position: "absolute",
		top: 2,
		zIndex: 0,
	},
	completedLineFill: {
		position: "absolute",
		height: 2,
		backgroundColor: COLORS.lime,
		zIndex: 1,
	},
	nodesRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "flex-start",
		zIndex: 2,
	},
	nodeColumn: {
		alignItems: "center",
		width: 56,
	},
	nodeCircleWrapper: {
		width: NODE_SIZE,
		height: NODE_SIZE,
		alignItems: "center",
		justifyContent: "center",
		position: "relative",
	},

	// Active Node Halo Pulse
	nodeHalo: {
		position: "absolute",
		width: NODE_SIZE,
		height: NODE_SIZE,
		borderRadius: NODE_SIZE / 2,
		backgroundColor: COLORS.orangeGlow,
		zIndex: -1,
	},

	// Completed Node (Green)
	nodeCompletedCircle: {
		width: NODE_SIZE,
		height: NODE_SIZE,
		borderRadius: NODE_SIZE / 2,
		backgroundColor: COLORS.lime,
		alignItems: "center",
		justifyContent: "center",
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.1,
		shadowRadius: 2,
		elevation: 1,
	},

	// Current Node (Orange)
	nodeCurrentOuterRing: {
		width: NODE_SIZE,
		height: NODE_SIZE,
		borderRadius: NODE_SIZE / 2,
		borderWidth: 2,
		borderColor: COLORS.orangePrimary,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: "#ffffff",
		shadowColor: COLORS.orangePrimary,
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.25,
		shadowRadius: 4,
		elevation: 2,
	},
	nodeCurrentCircle: {
		width: NODE_SIZE - 4,
		height: NODE_SIZE - 4,
		borderRadius: (NODE_SIZE - 4) / 2,
		backgroundColor: COLORS.orangePrimary,
		alignItems: "center",
		justifyContent: "center",
	},
	nodeCurrentCenterDot: {
		width: 5,
		height: 5,
		borderRadius: 2.5,
		backgroundColor: "#ffffff",
	},

	// Upcoming Node (Grey)
	nodeUpcomingCircle: {
		width: NODE_SIZE,
		height: NODE_SIZE,
		borderRadius: NODE_SIZE / 2,
		backgroundColor: "#ffffff",
		borderWidth: 2,
		borderColor: COLORS.greyLine,
		alignItems: "center",
		justifyContent: "center",
	},
	nodeUpcomingCenterDot: {
		width: 6,
		height: 6,
		borderRadius: 3,
		backgroundColor: COLORS.greyLine,
	},

	// Labels
	nodeLabel: {
		marginTop: 4,
		fontSize: 12,
		lineHeight: 14,
		textAlign: "center",
	},
	nodeLabelCompleted: {
		fontWeight: "500",
		color: "#374151",
	},
	nodeLabelCurrent: {
		fontWeight: "800",
		color: COLORS.darkText,
	},
	nodeLabelUpcoming: {
		fontWeight: "500",
		color: COLORS.mutedText,
	},

	// Branch & Connector
	branchContainer: {
		position: "relative",
		marginTop: 4,
	},
	elbowWrapper: {
		position: "absolute",
		top: -7,
		zIndex: 5,
	},
	branchCardWrapper: {
		width: "100%",
	},
	branchCardGradient: {
		borderWidth: 1,
		borderColor: COLORS.limeBorder,
		borderRadius: 12,
		padding: 10,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: 8,
	},
	branchLeftContent: {
		flex: 1,
		minWidth: 0,
	},
	branchTitleRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
	},
	branchTitle: {
		fontSize: 12,
		fontWeight: "800",
		color: COLORS.darkText,
		letterSpacing: -0.1,
	},
	percentChip: {
		backgroundColor: COLORS.lime,
		paddingHorizontal: 6,
		paddingVertical: 1,
		borderRadius: 4,
	},
	percentChipText: {
		fontSize: 9,
		fontWeight: "800",
		color: COLORS.dark,
	},
	branchSubtitle: {
		fontSize: 10,
		fontWeight: "500",
		color: "#4b5563",
		marginTop: 2,
	},

	// Progress Bar (Green fill like primary color)
	progressBarTrack: {
		width: "100%",
		height: 6,
		borderRadius: 3,
		backgroundColor: "rgba(195, 240, 132, 0.6)",
		marginTop: 6,
		overflow: "hidden",
	},
	progressBarFill: {
		height: "100%",
		borderRadius: 3,
		backgroundColor: COLORS.lime,
	},

	// Buttons
	branchActionContainer: {
		flexShrink: 0,
	},
	continueButton: {
		minHeight: 44,
		minWidth: 44,
		paddingHorizontal: 12,
		paddingVertical: 8,
		backgroundColor: COLORS.lime,
		borderRadius: 8,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 4,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.1,
		shadowRadius: 2,
		elevation: 1,
	},
	continueButtonText: {
		fontSize: 11,
		fontWeight: "800",
		color: COLORS.deep,
		letterSpacing: 0.1,
	},
	viewStatusButton: {
		minHeight: 44,
		paddingHorizontal: 10,
		paddingVertical: 8,
		borderRadius: 8,
		backgroundColor: "#ffffff",
		borderWidth: 1,
		borderColor: COLORS.orangeBorder,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
	},
	waitingSpinner: {
		marginRight: 6,
	},
	viewStatusButtonText: {
		fontSize: 11,
		fontWeight: "700",
		color: COLORS.orangeDark,
	},

	// Skeleton Styles
	skeletonTitle: {
		width: 120,
		height: 16,
		borderRadius: 4,
		backgroundColor: "#e5e7eb",
	},
	skeletonPill: {
		width: 64,
		height: 16,
		borderRadius: 8,
		backgroundColor: "#e5e7eb",
	},
	skeletonTrack: {
		position: "absolute",
		top: 10,
		left: 30,
		right: 30,
		height: 2,
		backgroundColor: "#e5e7eb",
	},
	skeletonNodeCircle: {
		width: NODE_SIZE,
		height: NODE_SIZE,
		borderRadius: NODE_SIZE / 2,
		backgroundColor: "#e5e7eb",
	},
	skeletonLabel: {
		marginTop: 4,
		width: 36,
		height: 10,
		borderRadius: 3,
		backgroundColor: "#f3f4f6",
	},
	skeletonBranchCard: {
		height: 52,
		borderRadius: 12,
		backgroundColor: "#f3f4f6",
		borderWidth: 1,
		borderColor: "#e5e7eb",
	},
});

export const JourneyTimeline = memo(JourneyTimelineComponent);
export default JourneyTimeline;

