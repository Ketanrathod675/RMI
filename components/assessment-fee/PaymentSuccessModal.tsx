import { TranslatedText } from "@/components/TranslatedText";
import { Images } from "@/constants/images";
import { height, width } from "@/utils/dimensions";
import React, { useEffect, useRef, useState } from "react";
import { Animated, Dimensions, Modal, StyleSheet, View } from "react-native";
import { ConfettiEffect } from "./ConfettiEffect";

interface PaymentSuccessModalProps {
	visible: boolean;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const IMAGE_SIZE = width(40);

export const PaymentSuccessModal: React.FC<PaymentSuccessModalProps> = ({ visible }) => {
	const scaleAnim = useRef(new Animated.Value(0)).current;
	const [imageCenter, setImageCenter] = useState({
		x: SCREEN_WIDTH / 2,
		y: SCREEN_HEIGHT * 0.42,
	});

	useEffect(() => {
		if (visible) {
			scaleAnim.setValue(0);
			const timeout = setTimeout(() => {
				Animated.spring(scaleAnim, {
					toValue: 1,
					tension: 60,
					friction: 6,
					useNativeDriver: true,
				}).start();
			}, 300);

			return () => clearTimeout(timeout);
		}
	}, [visible, scaleAnim]);

	return (
		<Modal
			visible={visible}
			transparent={true}
			animationType="none"
			statusBarTranslucent={true}>
			<View style={styles.modalOverlay}>
				<View style={styles.modalContent}>
					{/* Confetti bursts from behind the image across the entire modal */}
					<ConfettiEffect
						active={visible}
						originX={imageCenter.x}
						originY={imageCenter.y}
					/>

					<View
						style={styles.imageWrapper}
						onLayout={(e) => {
							const { x, y, width: w, height: h } = e.nativeEvent.layout;
							if (w > 0 && h > 0) {
								setImageCenter({ x: x + w / 2, y: y + h / 2 });
							}
						}}>
						<Animated.Image
							source={Images.SUCCESS_ICON}
							style={[styles.successImage, { transform: [{ scale: scaleAnim }] }]}
							resizeMode="contain"
						/>
					</View>
					<TranslatedText
						style={styles.successTitle}
						translationKey="paymentSuccessful"
					/>
					<TranslatedText
						style={styles.successSubtitle}
						translationKey="congratulationsAssessmentFeePaid"
					/>
				</View>
			</View>
		</Modal>
	);
};

const styles = StyleSheet.create({
	modalOverlay: {
		position: "absolute",
		top: -height(20),
		left: 0,
		right: 0,
		bottom: -height(20),
		width: "100%",
		height: height(140),
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
		alignItems: "center",
		justifyContent: "center",
		paddingHorizontal: width(6),
	},
	imageWrapper: {
		width: IMAGE_SIZE,
		height: IMAGE_SIZE,
		alignItems: "center",
		justifyContent: "center",
		marginBottom: height(4),
		position: "relative",
		overflow: "visible",
	},
	successImage: {
		width: IMAGE_SIZE,
		height: IMAGE_SIZE,
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
		color: "#666",
		textAlign: "center",
		marginTop: 0,
		lineHeight: 20,
	},
});

export default PaymentSuccessModal;
