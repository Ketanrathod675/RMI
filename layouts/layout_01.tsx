import { dark, white } from "@/constants/Colors";
import { Images } from "@/constants/images";
import { height, width } from "@/utils/dimensions";
import { Image } from "expo-image";
import type { FC, ReactNode } from "react";
import {
	KeyboardAvoidingView,
	Platform,
	StatusBar as RNStatusBar,
	StyleSheet,
	View,
	type StyleProp,
	type ViewStyle,
} from "react-native";

const AUTH_BANNER = Images.AUTH_BANNER;
const LOGO_RAPID_MONEY = Images.LOGO_RAPID_MONEY;

export const Layout01: FC<{
	children?: ReactNode;
	style?: StyleProp<ViewStyle>;
	contentStyle?: StyleProp<ViewStyle>;
}> = ({ children, style, contentStyle }) => {
	return (
		<View style={{ flex: 1, backgroundColor: white }}>
			<RNStatusBar barStyle="light-content" translucent backgroundColor="transparent" />
			<KeyboardAvoidingView
				style={{ flex: 1, backgroundColor: white }}
				behavior={Platform.OS === "ios" ? "padding" : "height"}>
				<View style={[styles.container, style]}>
					<View style={styles.bannerContainer}>
						<Image source={AUTH_BANNER} style={styles.banner} contentFit="cover" />
						<Image source={LOGO_RAPID_MONEY} style={styles.logo} contentFit="contain" />
					</View>
					<KeyboardAvoidingView style={[styles.content, contentStyle]}>
						{children}
					</KeyboardAvoidingView>
				</View>
			</KeyboardAvoidingView>
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: white,
		alignItems: "center",
	},
	bannerContainer: {
		width: "100%",
		alignItems: "center",
		position: "relative",
		height: "45%",
		backgroundColor: white,
		zIndex: 10,
	},
	banner: {
		width: width(100),
		height: "100%",
		overflow: "hidden",
		borderBottomLeftRadius: width(10),
		borderBottomRightRadius: width(10),
		backgroundColor: dark,
	},
	logo: {
		position: "absolute",
		top: "10%",
		alignSelf: "center",
		width: "55%",
		height: "12%",
		zIndex: 2,
	},
	content: {
		flex: 1,
		width: "100%",
		backgroundColor: white,
		marginTop: -height(5),
		paddingHorizontal: width(6),
		paddingTop: height(5),
		alignItems: "center",
	},
});
