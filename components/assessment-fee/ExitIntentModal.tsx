import { useTranslation } from "@/hooks/useTranslation";
import { font, height, width } from "@/utils/dimensions";
import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import {
	Animated,
	Easing,
	Modal,
	Pressable,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface ExitIntentModalProps {
	visible: boolean;
	onClose: () => void;
	onConfirmExit: () => void;
}

const LIME_PRIMARY = "#B7FB52";

export const ExitIntentModal: React.FC<ExitIntentModalProps> = ({
	visible,
	onClose,
	onConfirmExit,
}) => {
	const insets = useSafeAreaInsets();
	const { isHindi } = useTranslation();

	const translateY = useRef(new Animated.Value(450)).current;
	const backdropOpacity = useRef(new Animated.Value(0)).current;

	useEffect(() => {
		if (visible) {
			translateY.setValue(450);
			backdropOpacity.setValue(0);
			Animated.parallel([
				Animated.timing(backdropOpacity, {
					toValue: 1,
					duration: 220,
					useNativeDriver: true,
				}),
				Animated.timing(translateY, {
					toValue: 0,
					duration: 260,
					easing: Easing.out(Easing.cubic),
					useNativeDriver: true,
				}),
			]).start();
		}
	}, [visible, translateY, backdropOpacity]);

	const handleClose = () => {
		Animated.parallel([
			Animated.timing(backdropOpacity, {
				toValue: 0,
				duration: 180,
				useNativeDriver: true,
			}),
			Animated.timing(translateY, {
				toValue: 450,
				duration: 200,
				easing: Easing.in(Easing.cubic),
				useNativeDriver: true,
			}),
		]).start(() => {
			onClose();
		});
	};

	const handleConfirmExit = () => {
		Animated.parallel([
			Animated.timing(backdropOpacity, {
				toValue: 0,
				duration: 150,
				useNativeDriver: true,
			}),
			Animated.timing(translateY, {
				toValue: 450,
				duration: 180,
				useNativeDriver: true,
			}),
		]).start(() => {
			onConfirmExit();
		});
	};

	const getExitModalText = (key: string, defaultText: string): string => {
		if (isHindi) {
			switch (key) {
				case "title":
					return "क्या आप वाकई बाहर निकलना चाहते हैं?";
				case "subtitle":
					return "आप अपना ऋण आवेदन पूरा करने के करीब हैं। अपने लिए ऋण ऑफ़र अनलॉक करने के लिए अपना विवरण जमा करें।";
				case "secured":
					return "आपका डेटा पूरी तरह से एन्क्रिप्टेड और 100% सुरक्षित है";
				case "continue":
					return "ऋण आवेदन जारी रखें";
				case "goBackAnyway":
					return "वापस जाएं";
				default:
					return defaultText;
			}
		}
		return defaultText;
	};

	return (
		<Modal
			visible={visible}
			transparent={true}
			animationType="none"
			onRequestClose={handleClose}
			statusBarTranslucent={true}>
			<View style={styles.exitModalOverlay}>
				{/* Fading Backdrop (Fades in place - does NOT slide up with modal) */}
				<Animated.View
					style={[
						StyleSheet.absoluteFill,
						styles.backdrop,
						{ opacity: backdropOpacity },
					]}>
					<Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
				</Animated.View>

				{/* Bottom Sheet that slides up independently from bottom */}
				<Animated.View
					style={[
						styles.exitModalContent,
						{
							transform: [{ translateY }],
							paddingBottom: Math.max(insets.bottom + height(1.5), height(3.5)),
						},
					]}>
					{/* Dark Grab Handle matching screenshot */}
					<View style={styles.exitModalHandle} />

					{/* Title matching screenshot */}
					<Text style={styles.exitModalTitle}>
						{getExitModalText("title", "Are you sure you want to exit?")}
					</Text>

					{/* Subtitle matching screenshot */}
					<Text style={styles.exitModalSubtitle}>
						{getExitModalText(
							"subtitle",
							"You are close to completing your loan application.\nSubmit your details to unlock loan offers for you.",
						)}
					</Text>

					{/* Security row with blue lock icon */}
					<View style={styles.exitSecurityRow}>
						<MaterialCommunityIcons name="lock" size={18} color="#2F80ED" />
						<Text style={styles.exitSecurityText}>
							{getExitModalText(
								"secured",
								"Your data is fully encrypted and 100% secured",
							)}
						</Text>
					</View>

					{/* Primary Lime Button matching screenshot */}
					<TouchableOpacity
						style={styles.exitPrimaryBtn}
						onPress={handleClose}
						activeOpacity={0.85}>
						<View style={styles.exitPrimaryBtnContent}>
							<Text style={styles.exitPrimaryBtnText}>
								{getExitModalText("continue", "Continue loan application")}
							</Text>
							<MaterialIcons name="arrow-forward" size={20} color="#000" />
						</View>
					</TouchableOpacity>

					{/* Secondary White/Lime Border Button matching screenshot */}
					<TouchableOpacity
						style={styles.exitSecondaryBtn}
						onPress={handleConfirmExit}
						activeOpacity={0.85}>
						<Text style={styles.exitSecondaryBtnText}>
							{getExitModalText("goBackAnyway", "Go back,anyway")}
						</Text>
					</TouchableOpacity>
				</Animated.View>
			</View>
		</Modal>
	);
};

const styles = StyleSheet.create({
	exitModalOverlay: {
		flex: 1,
		justifyContent: "flex-end",
	},
	backdrop: {
		backgroundColor: "rgba(0, 0, 0, 0.5)",
	},
	exitModalContent: {
		backgroundColor: "#FFFFFF",
		borderTopLeftRadius: 24,
		borderTopRightRadius: 24,
		paddingHorizontal: width(6),
		paddingTop: height(1.8),
	},
	exitModalHandle: {
		width: 44,
		height: 4,
		borderRadius: 2,
		backgroundColor: "#000000",
		alignSelf: "center",
		marginBottom: height(2.5),
	},
	exitModalTitle: {
		fontSize: font(2.5),
		fontWeight: "700",
		color: "#000000",
		marginBottom: height(1.2),
		textAlign: "left",
	},
	exitModalSubtitle: {
		fontSize: font(1.65),
		color: "#000000",
		lineHeight: 22,
		marginBottom: height(2.2),
		textAlign: "left",
	},
	exitSecurityRow: {
		flexDirection: "row",
		alignItems: "center",
		marginBottom: height(3.5),
		gap: width(2),
	},
	exitSecurityText: {
		fontSize: font(1.5),
		color: "#000000",
		fontWeight: "400",
	},
	exitPrimaryBtn: {
		backgroundColor: LIME_PRIMARY,
		borderRadius: 100,
		paddingVertical: height(1.8),
		alignItems: "center",
		justifyContent: "center",
		marginBottom: height(1.8),
	},
	exitPrimaryBtnContent: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: width(2),
	},
	exitPrimaryBtnText: {
		color: "#000000",
		fontWeight: "700",
		fontSize: font(1.9),
	},
	exitSecondaryBtn: {
		backgroundColor: "#FFFFFF",
		borderRadius: 100,
		paddingVertical: height(1.8),
		alignItems: "center",
		justifyContent: "center",
		borderWidth: 1.5,
		borderColor: LIME_PRIMARY,
	},
	exitSecondaryBtnText: {
		color: "#000000",
		fontWeight: "700",
		fontSize: font(1.9),
	},
});

export default ExitIntentModal;
