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
				tabBarActiveTintColor: "#000000",
				tabBarInactiveTintColor: "#8E8E93",
				tabBarLabelStyle: {
					color: "#808080",
				},
				headerShown: false,
				tabBarButton: HapticTab,
				tabBarBackground: TabBarBackground,
				tabBarStyle: Platform.select({
					ios: {
						// Use a transparent background on iOS to show the blur effect
						position: "absolute",
					},
					default: {},
				}),
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
					tabBarIcon: ({ color }) => <IconSymbol size={25} name="person" color={color} />,
				}}
			/>
		</Tabs>
	);
}
