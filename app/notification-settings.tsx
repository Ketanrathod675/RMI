import { TranslatedText } from "@/components/TranslatedText";
import { dark, primary, white } from "@/constants/Colors";
import { type TranslationKey } from "@/constants/translations";
import { useJourneyTracker } from "@/hooks/useJourneyTracker";
import { useTranslation } from "@/hooks/useTranslation";
import { font, height, width } from "@/utils/dimensions";
import { router, Stack, useFocusEffect } from "expo-router";
import React, { useState } from "react";
import { BackHandler, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";

interface NotificationSetting {
	id: string;
	titleKey: TranslationKey;
	isEnabled: boolean;
}

export default function NotificationSettings() {
	useJourneyTracker("/notification-settings");
	const { t } = useTranslation();

	// Handle hardware back press on Android
	useFocusEffect(
		React.useCallback(() => {
			const onBackPress = () => {
				router.back();
				return true;
			};

			const subscription = BackHandler.addEventListener(
				"hardwareBackPress",
				onBackPress
			);

			return () => subscription.remove();
		}, [])
	);

	const [settings, setSettings] = useState<NotificationSetting[]>([
		{ id: "general", titleKey: "generalNotification", isEnabled: false },
		{ id: "security", titleKey: "securityAlerts", isEnabled: true },
		{ id: "loanStatus", titleKey: "loanApplicationStatus", isEnabled: true },
		{ id: "payment", titleKey: "paymentConfirmation", isEnabled: true },
		{ id: "disbursement", titleKey: "loanDisbursement", isEnabled: false },
		{ id: "paymentReminders", titleKey: "upcomingPaymentReminders", isEnabled: false },
		{ id: "rewards", titleKey: "rewardGamification", isEnabled: false },
		{ id: "coupons", titleKey: "redeemableCoupons", isEnabled: false },
		{ id: "referral", titleKey: "referralBonus", isEnabled: false },
		{ id: "offers", titleKey: "specialOffers", isEnabled: false },
		{ id: "survey", titleKey: "surveyFeedbackRequests", isEnabled: false },
		{ id: "announcements", titleKey: "importantAnnouncements", isEnabled: false },
		{ id: "tips", titleKey: "appTipsTutorials", isEnabled: false },
	]);

	const toggleSetting = (id: string) => {
		setSettings((prev) =>
			prev.map((setting) =>
				setting.id === id ? { ...setting, isEnabled: !setting.isEnabled } : setting,
			),
		);
	};

	const ToggleSwitch = ({
		isEnabled,
		onToggle,
	}: {
		isEnabled: boolean;
		onToggle: () => void;
	}) => {
		return (
			<TouchableOpacity
				style={[
					styles.switchContainer,
					{ backgroundColor: isEnabled ? primary : "#E5E5E5" },
				]}
				onPress={onToggle}
				activeOpacity={0.7}>
				<View
					style={[
						styles.switchThumb,
						{
							transform: [{ translateX: isEnabled ? width(6) : width(0.5) }],
						},
					]}
				/>
			</TouchableOpacity>
		);
	};

	const NotificationRow = ({ setting }: { setting: NotificationSetting }) => {
		return (
			<View style={styles.notificationRow}>
				<TranslatedText style={styles.notificationText} translationKey={setting.titleKey} />
				<ToggleSwitch
					isEnabled={setting.isEnabled}
					onToggle={() => toggleSetting(setting.id)}
				/>
			</View>
		);
	};

	return (
		<ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
			<Stack.Screen options={{ headerShown: true, title: t("notification") }} />
			<View style={styles.content}>
				{settings.map((setting) => (
					<NotificationRow key={setting.id} setting={setting} />
				))}
			</View>
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: white,
	},
	content: {
		padding: width(5),
		marginBottom: height(5),
	},
	notificationRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingVertical: height(2.5),
		paddingHorizontal: width(2),
		borderBottomWidth: 0.5,
		borderBottomColor: "#F0F0F0",
	},
	notificationText: {
		fontSize: font(2.2),
		color: dark,
		fontWeight: "400",
		flex: 1,
	},
	switchContainer: {
		width: width(12),
		height: height(3.2),
		borderRadius: width(6),
		justifyContent: "center",
		position: "relative",
	},
	switchThumb: {
		width: width(4.5),
		height: width(4.5),
		borderRadius: width(2.25),
		backgroundColor: white,
		shadowColor: "#000",
		shadowOffset: {
			width: 0,
			height: 1,
		},
		shadowOpacity: 0.2,
		shadowRadius: 1.41,
		elevation: 2,
	},
});
