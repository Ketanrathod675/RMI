import StarRating from "@/components/StarRating";
import React from "react";
import { Image, ImageSourcePropType, Platform, StyleSheet, Text, View } from "react-native";

interface TestimonialCardProps {
	text: string;
	name: string;
	title: string;
	rating: number;
	image: ImageSourcePropType;
}

const TestimonialCard: React.FC<TestimonialCardProps> = ({
	text,
	name,
	title,
	rating,
	image,
}) => {
	return (
		<View style={styles.cardContainer}>
			<View style={styles.ratingRow}>
				<StarRating rating={rating} size={18} filledColor="#F59E0B" emptyColor="#E5E7EB" outline={true} />
			</View>

			<Text style={styles.reviewText} numberOfLines={4} ellipsizeMode="tail">
				"{text}"
			</Text>

			<View style={styles.authorRow}>
				<Image source={image} style={styles.authorAvatar} />
				<View style={styles.authorInfo}>
					<Text style={styles.authorName} numberOfLines={1}>
						{name}
					</Text>
					<Text style={styles.authorRole} numberOfLines={1}>
						{title}
					</Text>
				</View>
			</View>
		</View>
	);
};

const styles = StyleSheet.create({
	cardContainer: {
		width: 305,
		minHeight: 185,
		backgroundColor: "#FFFFFF",
		borderWidth: 1,
		borderColor: "#E2ECE0",
		borderRadius: 24,
		padding: 20,
		justifyContent: "space-between",
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.03,
		shadowRadius: 8,
		elevation: 1,
	},
	ratingRow: {
		flexDirection: "row",
		alignItems: "center",
		marginBottom: 12,
	},
	reviewText: {
		fontSize: 13.5,
		color: "#3F4E44",
		lineHeight: 20.5,
		fontFamily: Platform.select({ ios: "System", android: "sans-serif" }),
		marginBottom: 16,
	},
	authorRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
	},
	authorAvatar: {
		width: 42,
		height: 42,
		borderRadius: 21,
		resizeMode: "cover",
	},
	authorInfo: {
		flex: 1,
		justifyContent: "center",
	},
	authorName: {
		fontSize: 15,
		fontWeight: "700",
		color: "#14201A",
		fontFamily: Platform.select({ ios: "System", android: "sans-serif" }),
	},
	authorRole: {
		fontSize: 12,
		color: "#6B7F6B",
		marginTop: 2,
		fontFamily: Platform.select({ ios: "System", android: "sans-serif" }),
	},
});

export default TestimonialCard;
