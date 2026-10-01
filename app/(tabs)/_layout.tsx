import { HapticTab } from "@/components/HapticTab";
import { IconSymbol } from "@/components/ui/IconSymbol";
import TabBarBackground from "@/components/ui/TabBarBackground";
import { useTranslation } from "@/hooks/useTranslation";
import { Tabs } from "expo-router";
import React from "react";
import { Image, Platform } from "react-native";

const HomeRActive = require("@/assets/images/HomeRActive.png");
const HomeRInactive = require("@/assets/images/HomeRInactive.png");

export default function TabLayout() {
	const { t } = useTranslation();

	return (
		<Tabs
			screenOptions={{
				tabBarActiveTintColor: "#79CA00",
				tabBarInactiveTintColor: "#8E8E93",
				tabBarLabelStyle: {
					fontSize: 12,
					fontWeight: "600",
				},
				headerShown: false,
				tabBarButton: HapticTab,
				tabBarBackground: TabBarBackground,
				tabBarStyle: {
					backgroundColor: "#FFFFFF",
					borderTopColor: "#F1F5F9",
					borderTopWidth: 1,
					elevation: 8,
					shadowColor: "#000",
					shadowOffset: { width: 0, height: -2 },
					shadowOpacity: 0.05,
					shadowRadius: 4,
				},
			}}>
			<Tabs.Screen
				name="index"
				options={{
					title: t("home"),
					tabBarIcon: ({ focused }) => (
						<Image
							source={focused ? HomeRActive : HomeRInactive}
							style={{ width: 22, height: 22, resizeMode: "contain" }}
						/>
					),
				}}
			/>
			<Tabs.Screen
				name="my-loan"
				options={{
					title: t("myLoan"),
					tabBarIcon: ({ color }) => (
						<IconSymbol size={25} name="gift.fill" color={color} />
					),
				}}
			/>
			<Tabs.Screen
				name="history"
				options={{
					title: t("history"),
					tabBarIcon: ({ color }) => (
						<IconSymbol size={25} name="arrow.clockwise.circle" color={color} />
					),
				}}
			/>
			<Tabs.Screen
				name="profile"
				options={{
					title: t("profile"),
					headerShown: true,
					headerStyle: { backgroundColor: "#FFFFFF" },
					headerTintColor: "#000000",
					headerTitleStyle: { fontWeight: "600" },
					headerShadowVisible: false,
					tabBarIcon: ({ color }) => <IconSymbol size={25} name="person" color={color} />,
				}}
			/>
		</Tabs>
	);
}
