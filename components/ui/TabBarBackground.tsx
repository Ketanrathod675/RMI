import React from "react";
import { StyleSheet, View } from "react-native";

export default function TabBarBackground() {
	return <View style={[StyleSheet.absoluteFill, { backgroundColor: "#FFFFFF" }]} />;
}

export function useBottomTabOverflow() {
  return 0;
}
