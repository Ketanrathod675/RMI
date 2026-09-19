import React, { useEffect, useRef, useState } from "react";
import {
	Animated,
	Dimensions,
	Modal,
	StatusBar,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ConfettiEffect } from "@/components/assessment-fee/ConfettiEffect";
import { primary } from "@/constants/Colors";
import { Images } from "@/constants/images";
import { useTranslation } from "@/hooks/useTranslation";
import { width } from "@/utils/dimensions";

interface KycSuccessModalProps {
	visible: boolean;
	onContinue: () => void;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const IMAGE_SIZE = Math.min(width(50), 205);

export const KycSuccessModal: React.FC<KycSuccessModalProps> = ({
	visible,
	onContinue,
}) => {
	const { t } = useTranslation();
	const insets = useSafeAreaInsets();
	const scaleAnim = useRef(new Animated.Value(0)).current;
	const fadeAnim = useRef(new Animated.Value(0)).current;
	const hasContinued = useRef(false);

	const [imageCenter, setImageCenter] = useState({
		x: SCREEN_WIDTH / 2,
		y: SCREEN_HEIGHT * 0.36,
	});

	const handleContinue = () => {
		if (hasContinued.current) return;
		hasContinued.current = true;
		onContinue();
	};

	useEffect(() => {
		if (visible) {
			hasContinued.current = false;
			scaleAnim.setValue(0);
			fadeAnim.setValue(0);

			const springTimer = setTimeout(() => {
				Animated.parallel([
					Animated.spring(scaleAnim, {
						toValue: 1,
						tension: 55,
						friction: 6,
						useNativeDriver: true,
					}),
					Animated.timing(fadeAnim, {
						toValue: 1,
						duration: 350,
						useNativeDriver: true,
					}),
				]).start();
			}, 200);

			// Auto-continue safety fallback after 6 seconds if user hasn't pressed the button
			const autoTimer = setTimeout(() => {
				handleContinue();
			}, 6000);

			return () => {
				clearTimeout(springTimer);
				clearTimeout(autoTimer);
			};
		}
	}, [visible]);

	return (
		<Modal
			visible={visible}
			transparent={true}
			animationType="fade"
			statusBarTranslucent={true}
			onRequestClose={handleContinue}
		>
			<View style={styles.modalOverlay}>
				<StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

				{/* Celebratory confetti burst */}
				<ConfettiEffect
					active={visible}
					originX={imageCenter.x}
					originY={imageCenter.y}
				/>

				{/* Main Content Area */}
				<View style={styles.contentContainer}>
					<View
						style={styles.imageWrapper}
						onLayout={(e) => {
							const { x, y, width: w, height: h } = e.nativeEvent.layout;
							if (w > 0 && h > 0) {
								setImageCenter({ x: x + w / 2, y: y + h / 2 });
							}
						}}
					>
						<Animated.Image
							source={Images.SUCCESS_ICON}
							style={[
								styles.successImage,
								{
									transform: [{ scale: scaleAnim }],
								},
							]}
							resizeMode="contain"
						/>
					</View>

					<Animated.Text style={[styles.successTitle, { opacity: fadeAnim }]}>
						{t("kycSuccess", "KYC Success")}
					</Animated.Text>

					<Animated.Text style={[styles.successSubtitle, { opacity: fadeAnim }]}>
						{t(
							"kycSuccessSubtitle",
							"Congratulations! Your KYC verification\nwas successful."
						)}
					</Animated.Text>
				</View>

				{/* Bottom Action Area */}
				<View
					style={[
						styles.bottomContainer,
						{ paddingBottom: Math.max(insets.bottom, 24) },
					]}
				>
					<TouchableOpacity
						style={styles.continueButton}
						onPress={handleContinue}
						activeOpacity={0.85}
						testID="kyc-success-continue-button"
					>
						<Text style={styles.continueButtonText}>
							{t("continueToProcess", "Continue to process")}
						</Text>
					</TouchableOpacity>
				</View>
			</View>
		</Modal>
	);
};

const styles = StyleSheet.create({
	modalOverlay: {
		flex: 1,
		backgroundColor: "#FFFFFF",
		justifyContent: "space-between",
		alignItems: "center",
		width: "100%",
		height: "100%",
	},
	contentContainer: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		paddingHorizontal: 24,
		width: "100%",
		marginTop: -20, // Balances upper visual weight matching screenshot
	},
	imageWrapper: {
		width: IMAGE_SIZE,
		height: IMAGE_SIZE,
		alignItems: "center",
		justifyContent: "center",
		marginBottom: 32,
		position: "relative",
	},
	successImage: {
		width: IMAGE_SIZE,
		height: IMAGE_SIZE,
	},
	successTitle: {
		fontSize: 24,
		fontWeight: "800",
		color: "#1F2937",
		textAlign: "center",
		marginBottom: 10,
		letterSpacing: -0.3,
	},
	successSubtitle: {
		fontSize: 15,
		color: "#4B5563",
		textAlign: "center",
		lineHeight: 22,
		maxWidth: 290,
	},
	bottomContainer: {
		width: "100%",
		paddingHorizontal: 20,
		paddingTop: 12,
		backgroundColor: "#FFFFFF",
	},
	continueButton: {
		backgroundColor: primary,
		height: 56,
		borderRadius: 28,
		justifyContent: "center",
		alignItems: "center",
		width: "100%",
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.06,
		shadowRadius: 4,
		elevation: 2,
	},
	continueButtonText: {
		fontSize: 16,
		fontWeight: "700",
		color: "#111827",
		textAlign: "center",
		letterSpacing: -0.2,
	},
});

export default KycSuccessModal;
