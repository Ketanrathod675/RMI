import React, { type ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useKeyboardVisible } from "@/hooks/useKeyboardVisible";

interface StickyFormFooterProps {
	children: ReactNode;
	style?: StyleProp<ViewStyle>;
}

export const StickyFormFooter: React.FC<StickyFormFooterProps> = ({ children, style }) => {
	const { visible } = useKeyboardVisible();
	const insets = useSafeAreaInsets();

	if (visible) {
		return null;
	}

	return (
		<View
			style={[
				styles.container,
				style,
				{
					paddingBottom: Math.max(insets.bottom + 8, 16),
				},
			]}>
			{children}
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		backgroundColor: "#FFFFFF",
		width: "100%",
	},
});

export default StickyFormFooter;
