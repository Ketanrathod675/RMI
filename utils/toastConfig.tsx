import React, { memo, useEffect } from "react";
import {
	Dimensions,
	PanResponder,
	Platform,
	Pressable,
	StyleSheet,
	Text,
	View,
} from "react-native";
import Toast, {
	type ToastConfig,
	type ToastConfigParams,
} from "react-native-toast-message";
import Svg, { Path } from "react-native-svg";
import Animated, {
	cancelAnimation,
	Easing,
	FadeInDown,
	useAnimatedStyle,
	useReducedMotion,
	useSharedValue,
	withRepeat,
	withTiming,
} from "react-native-reanimated";
import { getSyncTranslation } from "@/utils/toast_translations";

export type RapidToastVariant =
	| "success"
	| "error"
	| "info"
	| "warning"
	| "loading";

export const SHOW_PROGRESS_LINE = true;

const GENERIC_TITLES = new Set([
	"error",
	"success",
	"info",
	"warning",
	"alert",
	"oops",
	"failed",
	"failure",
	"done",
	"notice",
]);

/**
 * Checks whether text1 is a generic title like "Error", "Success", "Failed", etc.
 */
export function isGenericTitle(text?: string | null): boolean {
	if (!text) return false;
	const trimmed = text.trim().toLowerCase();
	if (GENERIC_TITLES.has(trimmed)) return true;

	try {
		const syncErr = getSyncTranslation("error" as any)?.trim().toLowerCase();
		if (syncErr && trimmed === syncErr) return true;
	} catch {}

	try {
		const syncSuccess = getSyncTranslation("success" as any)?.trim().toLowerCase();
		if (syncSuccess && trimmed === syncSuccess) return true;
	} catch {}

	return false;
}

/**
 * Normalizes text1 and text2 into primary and secondary messages.
 * Generic titles like "Error" / "Success" are dropped if a detailed message exists in text2.
 */
export function pickMessages(
	text1?: string | null,
	text2?: string | null,
): { primary: string; secondary?: string } {
	const t1 = typeof text1 === "string" ? text1.trim() : "";
	const t2 = typeof text2 === "string" ? text2.trim() : "";

	const t1IsGeneric = isGenericTitle(t1);

	// If text1 is a generic title AND text2 exists: primary = text2, secondary = none
	if (t1IsGeneric && t2) {
		return { primary: t2 };
	}

	// Else if both exist
	if (t1 && t2) {
		return { primary: t1, secondary: t2 };
	}

	// Else primary = text1 || text2
	return { primary: t1 || t2 || "" };
}

const BADGE_BG_COLORS: Record<RapidToastVariant, string> = {
	success: "#8FE000",
	error: "#FF7A6B",
	info: "#7FB2FF",
	warning: "#FFC24D",
	loading: "transparent",
};

const PROGRESS_FILL_COLORS: Record<RapidToastVariant, string> = {
	success: "rgba(143, 224, 0, 0.8)",
	error: "rgba(255, 122, 107, 0.8)",
	info: "rgba(127, 178, 255, 0.8)",
	warning: "rgba(255, 194, 77, 0.8)",
	loading: "rgba(143, 224, 0, 0.20)",
};

function LoadingSpinner({ reducedMotion }: { reducedMotion: boolean }) {
	const rotation = useSharedValue(0);

	useEffect(() => {
		if (reducedMotion) return;
		rotation.value = withRepeat(
			withTiming(360, { duration: 900, easing: Easing.linear }),
			-1,
			false,
		);
		return () => {
			cancelAnimation(rotation);
		};
	}, [reducedMotion]);

	const animatedStyle = useAnimatedStyle(() => ({
		transform: [{ rotate: `${rotation.value}deg` }],
	}));

	return (
		<View style={styles.spinnerWrapper}>
			<Animated.View style={[styles.spinnerRing, animatedStyle]} />
		</View>
	);
}

function ToastIconBadge({
	variant,
	reducedMotion,
}: {
	variant: RapidToastVariant;
	reducedMotion: boolean;
}) {
	if (variant === "loading") {
		return <LoadingSpinner reducedMotion={reducedMotion} />;
	}

	const badgeBg = BADGE_BG_COLORS[variant] || BADGE_BG_COLORS.info;

	return (
		<View style={[styles.iconBadge, { backgroundColor: badgeBg }]}>
			{variant === "success" && (
				<Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
					<Path
						d="M4.5 12.75l6 6 9-13.5"
						stroke="#0D3800"
						strokeWidth={3}
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
				</Svg>
			)}
			{variant === "error" && (
				<Text style={styles.errorIconText}>!</Text>
			)}
			{variant === "info" && (
				<Text style={styles.infoIconText}>i</Text>
			)}
			{variant === "warning" && (
				<Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
					<Path
						d="M12 3.5L2.5 20h19L12 3.5z"
						fill="#281A00"
					/>
					<Path
						d="M12 9v5m0 3v.5"
						stroke="#FFC24D"
						strokeWidth={2.2}
						strokeLinecap="round"
					/>
				</Svg>
			)}
		</View>
	);
}

function AnimatedProgressBar({
	variant,
	duration,
	toastKey,
	reducedMotion,
}: {
	variant: RapidToastVariant;
	duration: number;
	toastKey?: string;
	reducedMotion: boolean;
}) {
	const progress = useSharedValue(100);

	useEffect(() => {
		if (reducedMotion) {
			progress.value = 0;
			return;
		}
		progress.value = 100;
		progress.value = withTiming(0, {
			duration: Math.max(100, duration),
			easing: Easing.linear,
		});
		return () => {
			cancelAnimation(progress);
		};
	}, [duration, toastKey, reducedMotion]);

	const animatedStyle = useAnimatedStyle(() => ({
		width: `${progress.value}%`,
	}));

	const fillColor = PROGRESS_FILL_COLORS[variant] || PROGRESS_FILL_COLORS.info;

	return (
		<View style={styles.progressTrack}>
			<Animated.View
				style={[styles.progressFill, { backgroundColor: fillColor }, animatedStyle]}
			/>
		</View>
	);
}

function ToastProgressBar({
	variant,
	duration,
	toastKey,
	reducedMotion,
}: {
	variant: RapidToastVariant;
	duration: number;
	toastKey?: string;
	reducedMotion: boolean;
}) {
	if (!SHOW_PROGRESS_LINE) return null;

	if (variant === "loading") {
		return (
			<View style={styles.progressTrack}>
				<View
					style={[
						styles.progressFill,
						{ width: "100%", backgroundColor: PROGRESS_FILL_COLORS.loading },
					]}
				/>
			</View>
		);
	}

	return (
		<AnimatedProgressBar
			variant={variant}
			duration={duration}
			toastKey={toastKey}
			reducedMotion={reducedMotion}
		/>
	);
}

export interface RapidToastProps extends ToastConfigParams<any> {
	variant: RapidToastVariant;
}

const RapidToastComponent: React.FC<RapidToastProps> = ({
	variant,
	text1,
	text2,
	onPress,
	props,
}) => {
	const reducedMotion = useReducedMotion();
	const { primary, secondary } = pickMessages(text1, text2);

	const duration = typeof props?.duration === "number" ? props.duration : 2500;
	const toastKey = props?.toastKey as string | undefined;

	const accessibilityLabel = secondary ? `${primary}. ${secondary}` : primary;
	const accessibilityLiveRegion =
		variant === "error" || variant === "warning" ? "assertive" : "polite";

	const responder = React.useMemo(
		() =>
			PanResponder.create({
				onStartShouldSetPanResponder: () => false,
				onMoveShouldSetPanResponder: (_event, gesture) =>
					gesture.dy > 8 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
				onPanResponderRelease: (_event, gesture) => {
					if (gesture.dy > 40) {
						Toast.hide();
					}
				},
			}),
		[],
	);

	return (
		<View
			{...responder.panHandlers}
			accessible={true}
			accessibilityRole="alert"
			accessibilityLiveRegion={accessibilityLiveRegion}
			accessibilityLabel={accessibilityLabel}
			style={styles.containerWrapper}
		>
			<Animated.View
				key={toastKey}
				entering={
					reducedMotion
						? undefined
						: FadeInDown.duration(220).withInitialValues({
								transform: [{ translateY: 16 }],
							})
				}
				style={styles.cardContainer}
			>
				<Pressable
					onPress={() => {
						if (onPress) {
							onPress();
						} else {
							Toast.hide();
						}
					}}
					style={styles.touchableContent}
				>
					<View style={styles.contentRow}>
						<ToastIconBadge variant={variant} reducedMotion={Boolean(reducedMotion)} />

						<View style={styles.textContainer}>
							<Text
								style={styles.primaryText}
								numberOfLines={secondary ? 1 : 2}
								ellipsizeMode="tail"
							>
								{primary}
							</Text>
							{Boolean(secondary) && (
								<Text
									style={styles.secondaryText}
									numberOfLines={1}
									ellipsizeMode="tail"
								>
									{secondary}
								</Text>
							)}
						</View>
					</View>

					<ToastProgressBar
						variant={variant}
						duration={duration}
						toastKey={toastKey}
						reducedMotion={Boolean(reducedMotion)}
					/>
				</Pressable>
			</Animated.View>
		</View>
	);
};

export const RapidToast = memo(RapidToastComponent);

export const toastConfig: ToastConfig = {
	success: (props) => <RapidToast {...props} variant="success" />,
	error: (props) => <RapidToast {...props} variant="error" />,
	info: (props) => <RapidToast {...props} variant="info" />,
	warning: (props) => <RapidToast {...props} variant="warning" />,
	loading: (props) => <RapidToast {...props} variant="loading" />,
};

let installed = false;
let isToastVisible = false;

export function installToastDefaults() {
	if (installed) return;
	installed = true;
	const originalShow = Toast.show.bind(Toast);
	let previousKey = "";
	let previousAt = 0;

	(Toast as any).show = (input: any) => {
		const config = { ...(input ?? {}) };
		const type = (String(config.type ?? "info") as RapidToastVariant);
		const text1 = typeof config.text1 === "string" ? config.text1.trim() : "";
		const text2 = typeof config.text2 === "string" ? config.text2.trim() : "";
		const combined = [text1, text2].filter(Boolean).join("  ");

		// Strict stack-trace / technical text matching
		const containsTechnicalText =
			/traceback|exception|\bsql\b|psycopg|keyerror|<html|request failed with status code|network error|\bat\s+[\w$.<>]+\s+\([^)]*:\d+:\d+\)/i.test(
				combined,
			);
		if (containsTechnicalText) {
			config.text1 = getSyncTranslation(
				"errGeneric",
				"Something went wrong. Please try again.",
			);
			config.text2 = undefined;
		}

		// Suppress specific noise success toasts
		if (
			type === "success" &&
			/proceeding to the next step|details submitted successfully|application submitted successfully/i.test(
				combined,
			)
		) {
			return;
		}

		// 2500ms de-duplication of identical type|message
		const key = `${type}|${combined}`;
		const now = Date.now();
		if (key === previousKey && now - previousAt < 2500) {
			return;
		}
		previousKey = key;
		previousAt = now;

		// Force bottom position
		config.position = "bottom";

		// Duration calculation
		let duration = 2500;
		if (type === "loading") {
			config.autoHide = false;
			duration = 0;
		} else {
			if (config.visibilityTime !== undefined) {
				duration = Math.min(6000, Math.max(1000, Number(config.visibilityTime)));
			} else if (type === "error" || type === "warning") {
				duration = 4000;
			} else if (combined.length > 55) {
				duration = 4000;
			} else {
				duration = 2500;
			}
			config.visibilityTime = duration;
		}

		// Pass duration and unique animation key into config.props
		config.props = {
			...(config.props || {}),
			duration,
			toastKey: `${type}|${combined}|${now}`,
		};

		// Single-instance rule: replace active toast instead of stacking
		if (isToastVisible) {
			Toast.hide();
		}
		isToastVisible = true;

		const userOnHide = config.onHide;
		config.onHide = () => {
			isToastVisible = false;
			userOnHide?.();
		};

		originalShow(config);
	};
}

export function showLoadingToast(message: string) {
	Toast.show({ type: "loading", text1: message });
}

export function hideToast() {
	Toast.hide();
}

const screenWidth = Dimensions.get("window").width;
const TOAST_WIDTH = Math.min(screenWidth - 32, 420);

const styles = StyleSheet.create({
	containerWrapper: {
		width: "100%",
		alignItems: "center",
		justifyContent: "center",
	},
	cardContainer: {
		width: TOAST_WIDTH,
		maxWidth: 420,
		minHeight: 48,
		borderRadius: 16,
		overflow: "hidden",
		backgroundColor: "rgba(16, 32, 15, 0.96)",
		borderWidth: 1,
		borderColor: "rgba(255, 255, 255, 0.10)",
		shadowColor: "#061107",
		shadowOffset: { width: 0, height: 8 },
		shadowOpacity: 0.35,
		shadowRadius: 20,
		elevation: 12,
	},
	touchableContent: {
		width: "100%",
	},
	contentRow: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: 14,
		paddingVertical: 12,
		gap: 12,
	},
	iconBadge: {
		width: 28,
		height: 28,
		borderRadius: 14,
		alignItems: "center",
		justifyContent: "center",
		flexShrink: 0,
	},
	errorIconText: {
		color: "#FFFFFF",
		fontSize: 16,
		fontWeight: "900",
		lineHeight: 18,
		textAlign: "center",
		includeFontPadding: false,
	},
	infoIconText: {
		color: "#061833",
		fontSize: 15,
		fontWeight: "800",
		fontStyle: "italic",
		textAlign: "center",
		includeFontPadding: false,
		fontFamily: Platform.select({ ios: "Georgia", android: "serif" }),
	},
	spinnerWrapper: {
		width: 28,
		height: 28,
		alignItems: "center",
		justifyContent: "center",
		flexShrink: 0,
	},
	spinnerRing: {
		width: 24,
		height: 24,
		borderRadius: 12,
		borderWidth: 2,
		borderColor: "rgba(143, 224, 0, 0.20)",
		borderTopColor: "#8FE000",
	},
	textContainer: {
		flex: 1,
		minWidth: 0,
		justifyContent: "center",
	},
	primaryText: {
		fontSize: 13,
		fontWeight: "500",
		color: "#FFFFFF",
		lineHeight: 18,
		letterSpacing: -0.1,
	},
	secondaryText: {
		fontSize: 12,
		fontWeight: "400",
		color: "rgba(255, 255, 255, 0.70)",
		lineHeight: 16,
		marginTop: 2,
	},
	progressTrack: {
		height: 2,
		width: "100%",
		backgroundColor: "rgba(255, 255, 255, 0.10)",
		overflow: "hidden",
	},
	progressFill: {
		height: "100%",
	},
});

export default toastConfig;
