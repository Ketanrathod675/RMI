import React, { useEffect, useRef, useState } from "react";
import {
	ImageSourcePropType,
	NativeScrollEvent,
	NativeSyntheticEvent,
	ScrollView,
	StyleSheet,
	View,
} from "react-native";
import TestimonialCard from "./TestimonialCard";

interface Testimonial {
	id: string;
	text: string;
	name: string;
	title: string;
	rating: number;
	image: ImageSourcePropType;
}

interface TestimonialCarouselProps {
	testimonials: Testimonial[];
}

const CARD_WIDTH = 305;
const CARD_GAP = 14;
const SNAP_INTERVAL = CARD_WIDTH + CARD_GAP;

const TestimonialCarousel: React.FC<TestimonialCarouselProps> = ({ testimonials }) => {
	const [currentIndex, setCurrentIndex] = useState(0);
	const scrollRef = useRef<ScrollView>(null);

	useEffect(() => {
		if (testimonials.length <= 1) {
			return;
		}

		const interval = setInterval(() => {
			const nextIndex = (currentIndex + 1) % testimonials.length;
			scrollRef.current?.scrollTo({
				x: nextIndex * SNAP_INTERVAL,
				animated: true,
			});
			setCurrentIndex(nextIndex);
		}, 6000); // Auto-scroll every 6 seconds

		return () => clearInterval(interval);
	}, [currentIndex, testimonials.length]);

	const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
		const contentOffsetX = event.nativeEvent.contentOffset.x;
		const index = Math.round(contentOffsetX / SNAP_INTERVAL);
		if (index !== currentIndex && index >= 0 && index < testimonials.length) {
			setCurrentIndex(index);
		}
	};

	if (!testimonials || testimonials.length === 0) {
		return null;
	}

	return (
		<View style={styles.carouselContainer}>
			<ScrollView
				ref={scrollRef}
				horizontal
				pagingEnabled={false}
				showsHorizontalScrollIndicator={false}
				onMomentumScrollEnd={handleScroll}
				scrollEventThrottle={16}
				style={styles.scrollViewContainer}
				contentContainerStyle={styles.scrollContentContainer}
				decelerationRate="fast"
				snapToInterval={SNAP_INTERVAL}
				snapToAlignment="start">
				{testimonials.map((testimonial) => (
					<TestimonialCard
						key={testimonial.id}
						text={testimonial.text}
						name={testimonial.name}
						title={testimonial.title}
						rating={testimonial.rating}
						image={testimonial.image}
					/>
				))}
			</ScrollView>
		</View>
	);
};

const styles = StyleSheet.create({
	carouselContainer: {
		overflow: "visible",
	},
	scrollViewContainer: {
		width: "100%",
	},
	scrollContentContainer: {
		paddingHorizontal: 16,
		gap: CARD_GAP,
		paddingVertical: 8,
		flexGrow: 0,
	},
});

export default TestimonialCarousel;
