import RejectionScreenView from "@/components/RejectionScreenView";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useRef } from "react";
import { Animated, Modal, StyleSheet, View } from "react-native";

interface RejectionModalProps {
	visible: boolean;
	countdown: number;
	setCountdown: (cb: (prev: number) => number) => void;
	onClose: () => void;
	showPaymentReceivedCard?: boolean;
}

export default function RejectionModal({
	visible,
	countdown,
	setCountdown,
	onClose,
	showPaymentReceivedCard = true,
}: RejectionModalProps) {
	const router = useRouter();
	const rejectionScaleAnim = useRef(new Animated.Value(0)).current;

	useEffect(() => {
		if (visible) {
			rejectionScaleAnim.setValue(0);
			Animated.spring(rejectionScaleAnim, {
				toValue: 1,
				useNativeDriver: true,
				tension: 50,
				friction: 7,
			}).start();

			const interval = setInterval(() => {
				setCountdown((prev) => {
					if (prev <= 1) {
						clearInterval(interval);
						setTimeout(() => {
							onClose();
							router.replace("/(tabs)");
						}, 0);
						return 0;
					}
					return prev - 1;
				});
			}, 1000);

			return () => clearInterval(interval);
		}
	}, [visible]);

	return (
		<Modal
			visible={visible}
			transparent={true}
			animationType="fade"
			statusBarTranslucent={true}>
			<StatusBar style="light" />
			<View style={styles.modalOverlay}>
				<Animated.View
					style={[
						styles.rejectionModalContent,
						{ transform: [{ scale: rejectionScaleAnim }] },
					]}>
					<RejectionScreenView
						countdown={countdown}
						showPaymentReceivedCard={showPaymentReceivedCard}
						onBackToDashboard={() => {
							onClose();
							router.replace("/(tabs)");
						}}
					/>
				</Animated.View>
			</View>
		</Modal>
	);
}

const styles = StyleSheet.create({
	modalOverlay: {
		flex: 1,
		backgroundColor: "rgba(0,0,0,0.08)",
	},
	rejectionModalContent: {
		flex: 1,
		backgroundColor: "#f5f6fa",
		overflow: "hidden",
	},
});
