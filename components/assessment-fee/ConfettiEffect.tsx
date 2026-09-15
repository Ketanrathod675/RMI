import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Dimensions, Easing, StyleSheet, View } from "react-native";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface ParticleConfig {
	id: number;
	color: string;
	shape: "rect" | "square" | "circle" | "strip";
	width: number;
	height: number;
	targetX: number;
	targetY: number;
	gravity: number;
	rotation: string;
	start: number;
	burstPeak: number;
	scaleMax: number;
}

const PALETTE = [
	"#FFB800", // Bright Gold
	"#F59E0B", // Amber
	"#10B981", // Emerald Green
	"#059669", // Deep Emerald
	"#3B82F6", // Royal Blue
	"#6366F1", // Indigo
	"#EC4899", // Vivid Pink
	"#EF4444", // Ruby Red
	"#F97316", // Vibrant Orange
	"#8B5CF6", // Purple
	"#06B6D4", // Cyan
];

const SHAPES: ("rect" | "square" | "circle" | "strip")[] = [
	"rect",
	"square",
	"circle",
	"strip",
];

const PARTICLE_COUNT = 64;

function generateParticles(): ParticleConfig[] {
	const particles: ParticleConfig[] = [];

	for (let i = 0; i < PARTICLE_COUNT; i++) {
		// Full 360-degree radial distribution
		const baseAngle = (i / PARTICLE_COUNT) * 2 * Math.PI;
		const angleJitter = (Math.random() - 0.5) * 0.25;
		const angle = baseAngle + angleJitter;

		// Blast distance: inner, mid, and outer radial reach
		let distance: number;
		if (i % 3 === 0) {
			distance = 110 + Math.random() * 45; // 110 - 155 (clears the 80px image radius)
		} else if (i % 3 === 1) {
			distance = 155 + Math.random() * 65; // 155 - 220
		} else {
			distance = 220 + Math.random() * (SCREEN_WIDTH * 0.28); // 220 - 330
		}

		const targetX = Math.cos(angle) * distance;
		const targetY = Math.sin(angle) * distance;
		const gravity = 45 + Math.random() * 65;

		const color = PALETTE[i % PALETTE.length];
		const shape = SHAPES[i % SHAPES.length];

		let w = 8;
		let h = 8;
		if (shape === "rect") {
			w = 11 + Math.random() * 4;
			h = 6 + Math.random() * 2;
		} else if (shape === "strip") {
			w = 14 + Math.random() * 5;
			h = 4 + Math.random() * 2;
		} else if (shape === "circle") {
			w = 8 + Math.random() * 3;
			h = w;
		} else {
			w = 8 + Math.random() * 3;
			h = w;
		}

		const spinDirection = Math.random() > 0.5 ? 1 : -1;
		const totalDeg = spinDirection * (360 + Math.floor(Math.random() * 720));

		// Wave 1 starts immediately at progress 0, Wave 2 at progress 0.12
		const isWave2 = i >= 44;
		const start = isWave2 ? 0.12 : 0;
		const burstPeak = isWave2 ? 0.6 : 0.5;

		particles.push({
			id: i,
			color,
			shape,
			width: Math.round(w),
			height: Math.round(h),
			targetX: Math.round(targetX),
			targetY: Math.round(targetY),
			gravity: Math.round(gravity),
			rotation: `${totalDeg}deg`,
			start,
			burstPeak,
			scaleMax: 1.1 + Math.random() * 0.3,
		});
	}

	return particles;
}

interface ConfettiEffectProps {
	active: boolean;
	originX: number;
	originY: number;
}

export const ConfettiEffect: React.FC<ConfettiEffectProps> = ({
	active,
	originX,
	originY,
}) => {
	const particles = useMemo(() => generateParticles(), []);
	const animProgress = useRef(new Animated.Value(0)).current;

	useEffect(() => {
		if (active) {
			animProgress.setValue(0);
			// 200ms safety timeout to allow React Native Modal window to mount on Android
			const timer = setTimeout(() => {
				Animated.timing(animProgress, {
					toValue: 1,
					duration: 2200,
					easing: Easing.out(Easing.cubic),
					useNativeDriver: true,
				}).start();
			}, 200);

			return () => clearTimeout(timer);
		} else {
			animProgress.setValue(0);
		}
	}, [active, animProgress]);

	if (!active) return null;

	return (
		<View style={StyleSheet.absoluteFill} pointerEvents="none">
			{particles.map((p) => {
				// Translate X
				const translateX = animProgress.interpolate({
					inputRange: [0, p.start, p.burstPeak, 1],
					outputRange: [0, 0, p.targetX, p.targetX * 1.08],
				});

				// Translate Y (burst outward then drift down with gravity)
				const translateY = animProgress.interpolate({
					inputRange: [0, p.start, p.burstPeak, 1],
					outputRange: [0, 0, p.targetY, p.targetY + p.gravity],
				});

				// Scale
				const scale = animProgress.interpolate({
					inputRange: [
						0,
						p.start,
						Math.min(p.start + 0.08, 0.9),
						p.burstPeak,
						1,
					],
					outputRange: [0, 0, p.scaleMax, p.scaleMax * 0.95, 0.4],
				});

				// Opacity
				const opacity = animProgress.interpolate({
					inputRange: [
						0,
						p.start,
						Math.min(p.start + 0.05, 0.9),
						0.65,
						1,
					],
					outputRange: [0, 0, 1, 0.95, 0],
				});

				// Rotate
				const rotate = animProgress.interpolate({
					inputRange: [0, p.start, 1],
					outputRange: ["0deg", "0deg", p.rotation],
				});

				return (
					<Animated.View
						key={p.id}
						style={[
							styles.particle,
							{
								left: originX,
								top: originY,
								width: p.width,
								height: p.height,
								marginLeft: -p.width / 2,
								marginTop: -p.height / 2,
								backgroundColor: p.color,
								borderRadius:
									p.shape === "circle"
										? p.width / 2
										: p.shape === "rect" || p.shape === "strip"
											? 2
											: 1,
								opacity,
								transform: [
									{ translateX },
									{ translateY },
									{ rotate },
									{ scale },
								],
							},
						]}
					/>
				);
			})}
		</View>
	);
};

const styles = StyleSheet.create({
	particle: {
		position: "absolute",
	},
});

export default ConfettiEffect;
