import RejectionScreenView from "@/components/RejectionScreenView";
import { useJourneyTracker } from "@/hooks/useJourneyTracker";
import { shouldShowFeeReceivedOnRejection } from "@/utils/applicationRejection";
import { getStorageItem, setStorageItem, STORAGE_KEYS } from "@/utils/storage";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { BackHandler, StyleSheet, View } from "react-native";

const REJECT_REDIRECT_SECONDS = 15;

export default function NoApprovedAmount() {
	const router = useRouter();
	const [countdown, setCountdown] = useState(REJECT_REDIRECT_SECONDS);
	const [showPaymentReceivedCard, setShowPaymentReceivedCard] = useState(false);
	const hasNavigatedRef = useRef(false);

	// Track this screen in the journey
	useJourneyTracker("/no-approved-amount");

	useEffect(() => {
		let isMounted = true;
		(async () => {
			try {
				const [latestFeeTxnId, afFlag] = await Promise.all([
					getStorageItem(STORAGE_KEYS["@latest-assessment-fee-txnid"]).catch(() => null),
					getStorageItem(STORAGE_KEYS["@af-flag"]).catch(() => null),
				]);
				if (!isMounted) return;
				setShowPaymentReceivedCard(
					shouldShowFeeReceivedOnRejection({ latestFeeTxnId, afFlag }),
				);
			} catch {
				// Default false so fee-refund text never appears if unknown
			}
		})();
		return () => {
			isMounted = false;
		};
	}, []);

	const handleBackToDashboard = useCallback(async () => {
		if (hasNavigatedRef.current) return;
		hasNavigatedRef.current = true;
		// Set flag to indicate user came from rejection screen before returning to Dashboard
		await setStorageItem(STORAGE_KEYS["@no-approved-amount-flag"], "true").catch(() => {});
		router.replace("/(tabs)");
	}, [router]);

	useEffect(() => {
		const interval = setInterval(() => {
			setCountdown((prev) => {
				if (prev <= 1) {
					clearInterval(interval);
					setTimeout(() => {
						void handleBackToDashboard();
					}, 0);
					return 0;
				}
				return prev - 1;
			});
		}, 1000);

		return () => clearInterval(interval);
	}, [handleBackToDashboard]);

	useEffect(() => {
		const sub = BackHandler.addEventListener("hardwareBackPress", () => {
			void handleBackToDashboard();
			return true;
		});
		return () => sub.remove();
	}, [handleBackToDashboard]);

	return (
		<View style={styles.container}>
			<StatusBar style="light" />
			<RejectionScreenView
				countdown={countdown}
				showPaymentReceivedCard={showPaymentReceivedCard}
				onBackToDashboard={() => {
					void handleBackToDashboard();
				}}
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#f5f6fa",
	},
});
