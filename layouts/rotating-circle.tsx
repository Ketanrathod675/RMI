import { white } from "@/constants/Colors";
import { Images } from "@/constants/images";
import { height, width } from "@/utils/dimensions";
import type { ImageSource } from "expo-image";
import { Image } from "expo-image";
import type { FC, ReactNode } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";

const ROTATING_CIRCLE = Images.ROTATING_CIRCLE;

export const RotatingCircle: FC<{ children?: ReactNode; imageSource?: ImageSource }> = ({ children, imageSource }) => {
	return (
		<KeyboardAvoidingView
			style={{ flex: 1, backgroundColor: white }}
			behavior={Platform.OS === "ios" ? "padding" : "height"}>
			<View style={styles.container}>
				<Image source={imageSource || ROTATING_CIRCLE} style={styles.banner} contentFit="cover" />
				<View style={styles.content}>{children}</View>
			</View>
		</KeyboardAvoidingView>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: white,
		alignItems: "center",
		height: "100%",
	},
	banner: {
		top: height(10),
		width: "100%",
		height: "50%",
	},
	content: {
		flex: 1,
		width: "90%",
		marginHorizontal: width(4),
		marginVertical: height(3),
		borderRadius: 10,
	},
});
