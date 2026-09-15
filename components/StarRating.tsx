import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { memo, useMemo } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";

export interface StarRatingProps {
	rating: number;
	size?: number;
	filledColor?: string;
	emptyColor?: string;
	style?: ViewStyle;
	outline?: boolean;
}

const TOTAL_STARS = 5;

const StarRating = ({
	rating,
	size = 20,
	filledColor = "#FFC107",
	emptyColor = "#D3D3D3",
	style,
	outline = false,
}: StarRatingProps) => {
	const stars = useMemo(() => {
		const normalizedRating = Math.min(TOTAL_STARS, Math.max(0, rating));
		const fullStars = Math.floor(normalizedRating);
		const hasHalfStar = normalizedRating % 1 !== 0;

		return Array.from({ length: TOTAL_STARS }, (_, index): {
			color: string;
			name: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
		} => {
			if (index < fullStars) {
				return { color: filledColor, name: outline ? "star-outline" : "star" };
			}

			if (index === fullStars && hasHalfStar) {
				return { color: filledColor, name: outline ? "star-outline" : "star-half-full" };
			}

			return { color: emptyColor, name: "star-outline" };
		});
	}, [emptyColor, filledColor, rating, outline]);

	return (
		<View
			accessibilityLabel={`${Math.min(TOTAL_STARS, Math.max(0, rating))} out of ${TOTAL_STARS} stars`}
			accessibilityRole="image"
			pointerEvents="none"
			style={[styles.container, style]}>
			{stars.map((star, index) => (
				<MaterialCommunityIcons
					color={star.color}
					key={index}
					name={star.name}
					size={size}
				/>
			))}
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		flexDirection: "row",
		gap: 3,
	},
});

export default memo(StarRating);
