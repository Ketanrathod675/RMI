import React, { useCallback, useEffect, useRef, useState } from "react";
import {
	ActivityIndicator,
	Animated,
	BackHandler,
	Dimensions,
	Easing,
	FlatList,
	Image,
	LayoutChangeEvent,
	NativeScrollEvent,
	NativeSyntheticEvent,
	Platform,
	Pressable,
	StatusBar as RNStatusBar,
	StyleSheet,
	Text,
	TouchableOpacity,
	useWindowDimensions,
	View,
	ViewToken,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { VideoView, useVideoPlayer } from "expo-video";
import { useEventListener } from "expo";
import { VIDEO_TUTORIALS, VideoTutorialItem } from "@/constants/videoTutorials";

// ─── Looped Reel Data Definition ──────────────────────────────────────────────
export const TOTAL_BASE_ITEMS = VIDEO_TUTORIALS.length; // 3

export interface ReelLoopItem extends VideoTutorialItem {
	loopIndex: number;
	originalIndex: number;
	isLoopClone?: boolean;
}

// Exactly 4 items: [V1, V2, V3, V1_loop]
// Swiping past V3 moves naturally to V1_loop, where it bursts and seamlessly resets
// back to Index 0 (so the user CANNOT scroll back to the last video).
export const REEL_DATA: ReelLoopItem[] = [
	...VIDEO_TUTORIALS.map((item, idx) => ({
		...item,
		loopIndex: idx,
		originalIndex: idx,
		isLoopClone: false,
	})),
	{
		...VIDEO_TUTORIALS[0],
		id: `${VIDEO_TUTORIALS[0].id}_loop`,
		loopIndex: TOTAL_BASE_ITEMS,
		originalIndex: 0,
		isLoopClone: true,
	},
];

// ─── ReelPlayerView: Mounts VideoView and useVideoPlayer for active/near items ────
interface ReelPlayerViewProps {
	item: VideoTutorialItem;
	isActive: boolean;
	itemWidth: number;
	itemHeight: number;
}

const ReelPlayerView: React.FC<ReelPlayerViewProps> = ({
	item,
	isActive,
	itemWidth,
	itemHeight,
}) => {
	const [isManuallyPaused, setIsManuallyPaused] = useState(false);
	const [isLoading, setIsLoading] = useState(true);

	// Each mounted reel item instantiates its own useVideoPlayer hook
	const player = useVideoPlayer(item.videoUrl, (p) => {
		p.loop = true;
		p.pause(); // Initialize paused; playback is driven by isActive
	});

	// Listen for player status transitions to toggle the buffering spinner
	useEventListener(player, "statusChange", ({ status }) => {
		if (status === "readyToPlay" || status === "idle") {
			setIsLoading(false);
		} else if (status === "loading") {
			setIsLoading(true);
		}
	});

	// Single-active-player enforcement:
	// ONLY the currently visible item's player plays; every other player pauses.
	useEffect(() => {
		if (isActive && !isManuallyPaused) {
			player.play();
		} else {
			player.pause();
		}
	}, [isActive, isManuallyPaused, player]);

	// Reset manual pause toggle whenever this item scrolls away
	useEffect(() => {
		if (!isActive) {
			setIsManuallyPaused(false);
		}
	}, [isActive]);

	// Cleanup on component unmount: explicitly pause to prevent lingering decoders
	useEffect(() => {
		return () => {
			try {
				player.pause();
			} catch (_) {}
		};
	}, [player]);

	const togglePlayPause = () => {
		if (!isActive) return;
		setIsManuallyPaused((prev) => !prev);
	};

	return (
		<Pressable
			style={[styles.playerContainer, { width: itemWidth, height: itemHeight }]}
			onPress={togglePlayPause}>
			<VideoView
				player={player}
				style={StyleSheet.absoluteFill}
				contentFit="contain"
				nativeControls={false}
			/>

			{/* Buffering Activity Indicator */}
			{isLoading && (
				<View style={styles.loadingOverlay} pointerEvents="none">
					<ActivityIndicator size="large" color="#FFFFFF" />
				</View>
			)}

			{/* User Paused Indicator */}
			{isManuallyPaused && (
				<View style={styles.pauseIndicatorContainer} pointerEvents="none">
					<View style={styles.pauseIconCircle}>
						<MaterialCommunityIcons name="play" size={42} color="#FFFFFF" style={{ marginLeft: 3 }} />
					</View>
				</View>
			)}
		</Pressable>
	);
};

// ─── ReelThumbnailView: Lightweight fallback for off-screen items ──────────────
interface ReelThumbnailViewProps {
	item: VideoTutorialItem;
	itemWidth: number;
	itemHeight: number;
}

const ReelThumbnailView: React.FC<ReelThumbnailViewProps> = ({
	item,
	itemWidth,
	itemHeight,
}) => {
	return (
		<View style={[styles.playerContainer, { width: itemWidth, height: itemHeight }]}>
			<Image
				source={item.thumbnail}
				style={StyleSheet.absoluteFill}
				resizeMode="cover"
			/>
			<View style={styles.thumbnailDarkOverlay} />
		</View>
	);
};

// ─── BurstingBubble: Floats from downward, bursts with particles on reaching next video
const PARTICLE_COUNT = 8;
const PARTICLE_COLORS = [
	"#22C55E", // Emerald
	"#38BDF8", // Sky Blue
	"#A855F7", // Purple
	"#FBBF24", // Amber
	"#10B981", // Teal
	"#EC4899", // Pink
	"#3B82F6", // Blue
	"#34D399", // Mint
];

export type BubbleState = "hidden" | "rising" | "bursting";

interface BurstingBubbleProps {
	state: BubbleState;
	onBurstComplete: () => void;
	insets: { bottom: number };
}

const BurstingBubble: React.FC<BurstingBubbleProps> = ({
	state,
	onBurstComplete,
	insets,
}) => {
	const bubbleY = useRef(new Animated.Value(140)).current;
	const bubbleScale = useRef(new Animated.Value(0.4)).current;
	const bubbleOpacity = useRef(new Animated.Value(0)).current;
	const burstScale = useRef(new Animated.Value(0.8)).current;
	const burstOpacity = useRef(new Animated.Value(0)).current;
	const particleDist = useRef(new Animated.Value(0)).current;

	useEffect(() => {
		if (state === "rising") {
			// Reset burst values and float up with organic bounce
			burstScale.setValue(0.8);
			burstOpacity.setValue(0);
			particleDist.setValue(0);

			Animated.parallel([
				Animated.timing(bubbleY, {
					toValue: 0,
					duration: 320,
					easing: Easing.out(Easing.back(1.4)),
					useNativeDriver: true,
				}),
				Animated.timing(bubbleScale, {
					toValue: 1.05,
					duration: 320,
					useNativeDriver: true,
				}),
				Animated.timing(bubbleOpacity, {
					toValue: 1,
					duration: 200,
					useNativeDriver: true,
				}),
			]).start();
		} else if (state === "bursting") {
			// Pop & Burst: shockwave ring expands + 8 sparkle particles fly outward
			Animated.parallel([
				Animated.timing(bubbleScale, {
					toValue: 1.5,
					duration: 180,
					easing: Easing.out(Easing.quad),
					useNativeDriver: true,
				}),
				Animated.timing(bubbleOpacity, {
					toValue: 0,
					duration: 140,
					useNativeDriver: true,
				}),
				Animated.timing(burstScale, {
					toValue: 2.3,
					duration: 250,
					useNativeDriver: true,
				}),
				Animated.timing(burstOpacity, {
					toValue: 1,
					duration: 40,
					useNativeDriver: true,
				}),
				Animated.timing(particleDist, {
					toValue: 1,
					duration: 250,
					easing: Easing.out(Easing.quad),
					useNativeDriver: true,
				}),
			]).start(() => {
				onBurstComplete();
			});
		} else if (state === "hidden") {
			Animated.parallel([
				Animated.timing(bubbleOpacity, {
					toValue: 0,
					duration: 150,
					useNativeDriver: true,
				}),
				Animated.timing(bubbleY, {
					toValue: 140,
					duration: 150,
					useNativeDriver: true,
				}),
			]).start();
		}
	}, [state]);

	if (state === "hidden") return null;

	const ringOpacity = burstScale.interpolate({
		inputRange: [0.8, 1.1, 2.3],
		outputRange: [0.95, 0.7, 0],
	});

	const particleOpacity = particleDist.interpolate({
		inputRange: [0, 0.6, 1],
		outputRange: [1, 0.9, 0],
	});

	const particleScale = particleDist.interpolate({
		inputRange: [0, 0.4, 1],
		outputRange: [1, 0.8, 0],
	});

	return (
		<View
			pointerEvents="none"
			style={[
				styles.burstBubbleContainer,
				{ bottom: insets.bottom + 140 },
			]}>
			{/* Shockwave Burst Ring */}
			<Animated.View
				style={[
					styles.burstRing,
					{
						transform: [{ scale: burstScale }],
						opacity: ringOpacity,
					},
				]}
			/>

			{/* Burst Sparkle Particles */}
			{Array.from({ length: PARTICLE_COUNT }).map((_, i) => {
				const angle = (i * 2 * Math.PI) / PARTICLE_COUNT;
				const tx = particleDist.interpolate({
					inputRange: [0, 1],
					outputRange: [0, Math.cos(angle) * 70],
				});
				const ty = particleDist.interpolate({
					inputRange: [0, 1],
					outputRange: [0, Math.sin(angle) * 70],
				});

				return (
					<Animated.View
						key={i}
						style={[
							styles.burstParticle,
							{
								backgroundColor: PARTICLE_COLORS[i % PARTICLE_COLORS.length],
								transform: [{ translateX: tx }, { translateY: ty }, { scale: particleScale }],
								opacity: particleOpacity,
							},
						]}
					/>
				);
			})}

			{/* The Floating Bubble */}
			<Animated.View
				style={[
					styles.bubbleBody,
					{
						transform: [{ translateY: bubbleY }, { scale: bubbleScale }],
						opacity: bubbleOpacity,
					},
				]}>
				<LinearGradient
					colors={["#10B981", "#059669"]}
					start={{ x: 0, y: 0 }}
					end={{ x: 1, y: 1 }}
					style={styles.bubbleGradient}>
					{/* Bubble Glass Top Sheen */}
					<View style={styles.bubbleGlassSheen} />
					<MaterialCommunityIcons name="check-decagram" size={22} color="#FFFFFF" style={{ marginRight: 8 }} />
					<Text style={styles.bubbleText}>Seen all the videos</Text>
				</LinearGradient>
			</Animated.View>
		</View>
	);
};

// ─── ReelItem: Single Reel Card with Overlays ──────────────────────────────────
interface ReelItemProps {
	item: ReelLoopItem;
	index: number;
	activeIndex: number;
	itemWidth: number;
	itemHeight: number;
	insets: { top: number; bottom: number };
	onClose: () => void;
	onLoopToStart: () => void;
}

const ReelItem: React.FC<ReelItemProps> = ({
	item,
	index,
	activeIndex,
	itemWidth,
	itemHeight,
	insets,
	onClose,
	onLoopToStart,
}) => {
	const isActive = index === activeIndex;
	// Windowing optimization: mount active item, adjacent neighbors,
	// and keep index 0 mounted when approaching the loop transition so loop-jump is instant.
	const shouldMountPlayer =
		Math.abs(index - activeIndex) <= 1 ||
		(activeIndex >= TOTAL_BASE_ITEMS - 1 && index === 0);

	const originalIndex = item.originalIndex;
	const isLastVideo = index === TOTAL_BASE_ITEMS - 1;

	return (
		<View style={[styles.reelItemContainer, { width: itemWidth, height: itemHeight }]}>
			{shouldMountPlayer ? (
				<ReelPlayerView
					item={item}
					isActive={isActive}
					itemWidth={itemWidth}
					itemHeight={itemHeight}
				/>
			) : (
				<ReelThumbnailView
					item={item}
					itemWidth={itemWidth}
					itemHeight={itemHeight}
				/>
			)}

			{/* Top Vignette Gradient */}
			<LinearGradient
				colors={["rgba(0,0,0,0.8)", "rgba(0,0,0,0.3)", "transparent"]}
				locations={[0, 0.5, 1]}
				style={[styles.topGradient, { height: insets.top + 90 }]}
				pointerEvents="none"
			/>

			{/* Bottom Vignette Gradient */}
			<LinearGradient
				colors={["transparent", "rgba(0,0,0,0.4)", "rgba(0,0,0,0.92)"]}
				locations={[0, 0.4, 1]}
				style={[styles.bottomGradient, { height: insets.bottom + 170 }]}
				pointerEvents="none"
			/>

			{/* Top Header Bar */}
			<View style={[styles.topHeaderRow, { top: insets.top + (Platform.OS === "android" ? 12 : 8) }]}>
				<TouchableOpacity
					activeOpacity={0.7}
					style={styles.closeButton}
					onPress={onClose}
					hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
					<MaterialCommunityIcons name="close" size={24} color="#FFFFFF" />
				</TouchableOpacity>

				<View style={styles.counterBadge}>
					<Text style={styles.counterText}>
						{originalIndex + 1} / {TOTAL_BASE_ITEMS}
					</Text>
				</View>
			</View>

			{/* Bottom Info Section */}
			<View style={[styles.bottomInfoContainer, { bottom: insets.bottom + 20 }]}>
				<View style={styles.durationPill}>
					<MaterialCommunityIcons name="clock-outline" size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
					<Text style={styles.durationText}>{item.duration}</Text>
				</View>

				<Text style={styles.videoTitle}>{item.title}</Text>

				{item.description ? (
					<Text style={styles.videoDescription} numberOfLines={2}>
						{item.description}
					</Text>
				) : null}

				{/* Hint on first video */}
				{originalIndex === 0 && (
					<View style={styles.swipeHintRow}>
						<MaterialCommunityIcons name="chevron-double-up" size={16} color="rgba(255,255,255,0.7)" />
						<Text style={styles.swipeHintText}>Swipe up for next video</Text>
					</View>
				)}

				{/* Last video: NO static 'seen' bubble. Only a clean swipe hint to loop back to start. */}
				{isLastVideo && (
					<TouchableOpacity
						activeOpacity={0.8}
						onPress={onLoopToStart}
						style={styles.allUpdatesContainer}>
						<View style={styles.swipeHintRow}>
							<MaterialCommunityIcons name="chevron-double-up" size={18} color="rgba(255,255,255,0.85)" />
							<Text style={styles.swipeHintText}>Swipe up to return to first video</Text>
						</View>
					</TouchableOpacity>
				)}
			</View>
		</View>
	);
};

// ─── Main Screen: ReelPlayerScreen ─────────────────────────────────────────────
export default function ReelPlayerScreen() {
	const insets = useSafeAreaInsets();
	const { height: windowHeight, width: windowWidth } = useWindowDimensions();
	const params = useLocalSearchParams<{ initialIndex?: string }>();

	// Measure exact container layout height to prevent Android status bar / modal height drift
	const initialHeight =
		Platform.OS === "android"
			? Dimensions.get("screen").height
			: Dimensions.get("window").height;
	const initialWidth = Dimensions.get("window").width;

	const [containerDimensions, setContainerDimensions] = useState({
		width: initialWidth || windowWidth,
		height: initialHeight || windowHeight,
	});

	const onContainerLayout = useCallback(
		(e: LayoutChangeEvent) => {
			const { width, height } = e.nativeEvent.layout;
			if (height > 0 && Math.abs(height - containerDimensions.height) > 0.5) {
				setContainerDimensions({ width, height });
			}
		},
		[containerDimensions.height]
	);

	const activeHeight = containerDimensions.height;
	const activeWidth = containerDimensions.width;

	const parsedIndex = params.initialIndex ? parseInt(params.initialIndex, 10) : 0;
	const startIndex = isNaN(parsedIndex)
		? 0
		: Math.max(0, Math.min(parsedIndex, TOTAL_BASE_ITEMS - 1));

	const [activeIndex, setActiveIndex] = useState<number>(startIndex);
	const [bubbleState, setBubbleState] = useState<BubbleState>("hidden");
	const flatListRef = useRef<FlatList<ReelLoopItem>>(null);

	const isUserDragging = useRef<boolean>(false);
	const dragStartY = useRef<number>(0);

	// Hardware back press & status bar setup
	useFocusEffect(
		useCallback(() => {
			RNStatusBar.setBarStyle("light-content");
			if (Platform.OS === "android") {
				RNStatusBar.setBackgroundColor("transparent");
				RNStatusBar.setTranslucent(true);
			}

			const onBackPress = () => {
				router.back();
				return true;
			};

			const subscription = BackHandler.addEventListener("hardwareBackPress", onBackPress);
			return () => subscription.remove();
		}, [])
	);

	const handleClose = () => {
		router.back();
	};

	// ─── Viewability Config for Single Active Player ──────────────────────────────
	const viewabilityConfig = useRef({
		itemVisiblePercentThreshold: 80,
	}).current;

	const onViewableItemsChanged = useRef(
		({ viewableItems }: { viewableItems: ViewToken[] }) => {
			if (viewableItems && viewableItems.length > 0) {
				const visibleItem = viewableItems[0];
				if (typeof visibleItem.index === "number" && visibleItem.index !== null) {
					const newIdx = visibleItem.index;
					if (newIdx < TOTAL_BASE_ITEMS) {
						setActiveIndex(newIdx);
					}
				}
			}
		}
	).current;

	// ─── Drag Detection: Bubble appears ONLY when user actively drags up from the last video ───
	const handleScrollBeginDrag = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
		dragStartY.current = event.nativeEvent.contentOffset.y;
		isUserDragging.current = true;
	};

	const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
		const offsetY = event.nativeEvent.contentOffset.y;

		// The bubble ONLY rises if the user is sitting on the LAST video and actively drags UPWARDS
		if (isUserDragging.current && activeIndex === TOTAL_BASE_ITEMS - 1) {
			const dragDelta = offsetY - dragStartY.current;
			// Trigger only after user has dragged upward by at least 35px towards the first video
			if (dragDelta > 35 && bubbleState === "hidden") {
				setBubbleState("rising");
			} else if (dragDelta <= 10 && bubbleState === "rising") {
				// User pulled back down to cancel swipe: dismiss bubble
				setBubbleState("hidden");
			}
		}
	};

	const handleScrollEndDrag = () => {
		isUserDragging.current = false;
	};

	const handleMomentumScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
		isUserDragging.current = false;
		const offsetY = event.nativeEvent.contentOffset.y;
		const newIndex = Math.round(offsetY / activeHeight);

		if (newIndex === TOTAL_BASE_ITEMS) {
			// Landed on the looped first video (Index 3)
			setBubbleState("bursting");

			// Instantly reset to Index 0 without animation.
			// Because Index 0 and Index 3 are both Video 1, there is ZERO visual glitch,
			// AND at Index 0 the user CANNOT scroll back up to the last video!
			setTimeout(() => {
				flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
				setActiveIndex(0);
			}, 30);
		} else {
			if (newIndex >= 0 && newIndex < TOTAL_BASE_ITEMS) {
				setActiveIndex(newIndex);
			}
			if (bubbleState === "rising") {
				setBubbleState("hidden");
			}
		}
	};

	// Tapping the bottom prompt on the last video triggers smooth scroll & burst
	const handleLoopToStart = () => {
		if (bubbleState !== "hidden") return;
		setBubbleState("rising");
		flatListRef.current?.scrollToIndex({
			index: TOTAL_BASE_ITEMS,
			animated: true,
		});
		setTimeout(() => {
			setBubbleState("bursting");
		}, 300);
	};

	const handleBurstComplete = () => {
		setBubbleState("hidden");
	};

	return (
		<View style={styles.container} onLayout={onContainerLayout}>
			<StatusBar style="light" />

			<FlatList
				ref={flatListRef}
				data={REEL_DATA}
				keyExtractor={(item) => item.id}
				renderItem={({ item, index }) => (
					<ReelItem
						item={item}
						index={index}
						activeIndex={activeIndex}
						itemWidth={activeWidth}
						itemHeight={activeHeight}
						insets={insets}
						onClose={handleClose}
						onLoopToStart={handleLoopToStart}
					/>
				)}
				/* Effortless 1-video paging: smooth natural flick with native 1-page locking */
				pagingEnabled={true}
				snapToInterval={Platform.OS === "android" ? undefined : activeHeight}
				snapToAlignment={Platform.OS === "android" ? undefined : "start"}
				decelerationRate="normal"
				disableIntervalMomentum={Platform.OS === "ios"}
				showsVerticalScrollIndicator={false}
				initialScrollIndex={startIndex}
				getItemLayout={(_, index) => ({
					length: activeHeight,
					offset: activeHeight * index,
					index,
				})}
				onScrollToIndexFailed={(info) => {
					setTimeout(() => {
						flatListRef.current?.scrollToIndex({ index: info.index, animated: false });
					}, 50);
				}}
				viewabilityConfig={viewabilityConfig}
				onViewableItemsChanged={onViewableItemsChanged}
				onScrollBeginDrag={handleScrollBeginDrag}
				onScroll={handleScroll}
				onScrollEndDrag={handleScrollEndDrag}
				onMomentumScrollEnd={handleMomentumScrollEnd}
				scrollEventThrottle={16}
				bounces={false}
				overScrollMode="never"
				windowSize={4}
				style={{ flex: 1, width: activeWidth, height: activeHeight }}
			/>

			{/* Bursting Bubble: Pops from downward saying "Seen all the videos" ONLY when swiping past the last video */}
			<BurstingBubble
				state={bubbleState}
				onBurstComplete={handleBurstComplete}
				insets={insets}
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#000000",
	},
	reelItemContainer: {
		position: "relative",
		backgroundColor: "#000000",
		justifyContent: "center",
		alignItems: "center",
		overflow: "hidden",
	},
	playerContainer: {
		position: "absolute",
		top: 0,
		left: 0,
		backgroundColor: "#000000",
		justifyContent: "center",
		alignItems: "center",
	},
	loadingOverlay: {
		...StyleSheet.absoluteFill,
		backgroundColor: "rgba(0, 0, 0, 0.4)",
		justifyContent: "center",
		alignItems: "center",
	},
	thumbnailDarkOverlay: {
		...StyleSheet.absoluteFill,
		backgroundColor: "rgba(0, 0, 0, 0.3)",
	},
	pauseIndicatorContainer: {
		...StyleSheet.absoluteFill,
		justifyContent: "center",
		alignItems: "center",
	},
	pauseIconCircle: {
		width: 72,
		height: 72,
		borderRadius: 36,
		backgroundColor: "rgba(0, 0, 0, 0.6)",
		borderWidth: 1.5,
		borderColor: "rgba(255, 255, 255, 0.3)",
		justifyContent: "center",
		alignItems: "center",
	},
	topGradient: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
	},
	bottomGradient: {
		position: "absolute",
		bottom: 0,
		left: 0,
		right: 0,
	},
	topHeaderRow: {
		position: "absolute",
		left: 16,
		right: 16,
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		zIndex: 20,
	},
	closeButton: {
		width: 40,
		height: 40,
		borderRadius: 20,
		backgroundColor: "rgba(0, 0, 0, 0.55)",
		borderWidth: 1,
		borderColor: "rgba(255, 255, 255, 0.2)",
		justifyContent: "center",
		alignItems: "center",
	},
	counterBadge: {
		paddingHorizontal: 12,
		paddingVertical: 6,
		borderRadius: 16,
		backgroundColor: "rgba(0, 0, 0, 0.55)",
		borderWidth: 1,
		borderColor: "rgba(255, 255, 255, 0.2)",
	},
	counterText: {
		fontSize: 13,
		fontWeight: "600",
		color: "#FFFFFF",
		letterSpacing: 0.5,
	},
	bottomInfoContainer: {
		position: "absolute",
		left: 18,
		right: 18,
		zIndex: 20,
	},
	durationPill: {
		flexDirection: "row",
		alignItems: "center",
		alignSelf: "flex-start",
		backgroundColor: "rgba(0, 0, 0, 0.65)",
		paddingHorizontal: 10,
		paddingVertical: 4,
		borderRadius: 12,
		borderWidth: 1,
		borderColor: "rgba(255, 255, 255, 0.15)",
		marginBottom: 8,
	},
	durationText: {
		fontSize: 12,
		fontWeight: "600",
		color: "#FFFFFF",
	},
	videoTitle: {
		fontSize: 18,
		fontWeight: "700",
		color: "#FFFFFF",
		lineHeight: 24,
		marginBottom: 4,
		textShadowColor: "rgba(0, 0, 0, 0.75)",
		textShadowOffset: { width: 0, height: 1 },
		textShadowRadius: 3,
	},
	videoDescription: {
		fontSize: 13,
		color: "rgba(255, 255, 255, 0.85)",
		lineHeight: 18,
		textShadowColor: "rgba(0, 0, 0, 0.75)",
		textShadowOffset: { width: 0, height: 1 },
		textShadowRadius: 2,
	},
	swipeHintRow: {
		flexDirection: "row",
		alignItems: "center",
		marginTop: 8,
	},
	swipeHintText: {
		fontSize: 12,
		color: "rgba(255, 255, 255, 0.8)",
		marginLeft: 4,
	},
	allUpdatesContainer: {
		marginTop: 8,
	},

	// ─── Bursting Bubble Styles ──────────────────────────────────────────────
	burstBubbleContainer: {
		position: "absolute",
		left: 0,
		right: 0,
		alignItems: "center",
		justifyContent: "center",
		zIndex: 999,
	},
	bubbleBody: {
		shadowColor: "#10B981",
		shadowOffset: { width: 0, height: 6 },
		shadowOpacity: 0.55,
		shadowRadius: 18,
		elevation: 12,
	},
	bubbleGradient: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: 22,
		paddingVertical: 13,
		borderRadius: 30,
		borderWidth: 2,
		borderColor: "rgba(255, 255, 255, 0.7)",
		overflow: "hidden",
		position: "relative",
	},
	bubbleGlassSheen: {
		position: "absolute",
		top: 2,
		left: 14,
		right: 14,
		height: 10,
		borderRadius: 5,
		backgroundColor: "rgba(255, 255, 255, 0.32)",
	},
	bubbleText: {
		fontSize: 16,
		fontWeight: "800",
		color: "#FFFFFF",
		letterSpacing: 0.4,
		textShadowColor: "rgba(0, 0, 0, 0.25)",
		textShadowOffset: { width: 0, height: 1 },
		textShadowRadius: 3,
	},
	burstRing: {
		position: "absolute",
		width: 80,
		height: 80,
		borderRadius: 40,
		borderWidth: 3,
		borderColor: "#34D399",
	},
	burstParticle: {
		position: "absolute",
		width: 10,
		height: 10,
		borderRadius: 5,
		shadowColor: "#22C55E",
		shadowOffset: { width: 0, height: 0 },
		shadowOpacity: 0.8,
		shadowRadius: 6,
		elevation: 4,
	},
});
