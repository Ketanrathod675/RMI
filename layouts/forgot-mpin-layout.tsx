import { white } from "@/constants/Colors";
import { Images } from "@/constants/images";
import { height, width } from "@/utils/dimensions";
import { Image } from "expo-image";
import type { FC, ReactNode } from "react";
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

const SHIELD_ICON = Images.SHIELD_MPIN;

export const ForgotMpinLayout: FC<{ 
	children: ReactNode; 
	viewStyles?: StyleProp<ViewStyle>;
	scrollEnabled?: boolean; 
}> = ({
	children,
	viewStyles,
	scrollEnabled = true,
}) => {
	const ContentContainer = scrollEnabled ? ScrollView : View;
	const contentProps = scrollEnabled 
		? {
			contentContainerStyle: styles.scrollContentContainer,
			keyboardShouldPersistTaps: "handled" as const,
			showsVerticalScrollIndicator: false,
		}
		: {};

	return (
		<ContentContainer style={[styles.container, viewStyles]} {...contentProps}>
			<View style={styles.shieldRow}>
				<Image source={SHIELD_ICON} style={styles.shield} contentFit="contain" />
			</View>

			<View style={styles.childrenContainer}>{children}</View>
		</ContentContainer>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: white,
		paddingTop: height(7),
	},
	scrollContentContainer: {
		flexGrow: 1,
	},
	shieldRow: {
		alignItems: "center",
		marginBottom: height(2),
	},
	shield: {
		width: width(45),
		height: width(45),
	},
	childrenContainer: {
		flex: 1,
		width: "100%",
		paddingBottom: height(10),
	},
});
