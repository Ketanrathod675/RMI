import React from "react";
import { StyleSheet } from "react-native";
import Toast, { BaseToast, ErrorToast, ToastConfig } from "react-native-toast-message";
import { dark_primary, error_color } from "@/constants/Colors";

export const toastConfig: ToastConfig = {
	success: (props) => (
		<BaseToast
			{...props}
			onPress={() => {
				if (props.onPress) {
					props.onPress();
				} else {
					Toast.hide();
				}
			}}
			style={[styles.toastBase, styles.successToast]}
			contentContainerStyle={styles.contentContainer}
			text1Style={styles.text1}
			text2Style={styles.text2}
			text1NumberOfLines={2}
			text2NumberOfLines={3}
		/>
	),
	error: (props) => (
		<ErrorToast
			{...props}
			onPress={() => {
				if (props.onPress) {
					props.onPress();
				} else {
					Toast.hide();
				}
			}}
			style={[styles.toastBase, styles.errorToast]}
			contentContainerStyle={styles.contentContainer}
			text1Style={styles.text1}
			text2Style={styles.text2}
			text1NumberOfLines={2}
			text2NumberOfLines={3}
		/>
	),
	info: (props) => (
		<BaseToast
			{...props}
			onPress={() => {
				if (props.onPress) {
					props.onPress();
				} else {
					Toast.hide();
				}
			}}
			style={[styles.toastBase, styles.infoToast]}
			contentContainerStyle={styles.contentContainer}
			text1Style={styles.text1}
			text2Style={styles.text2}
			text1NumberOfLines={2}
			text2NumberOfLines={3}
		/>
	),
};

const styles = StyleSheet.create({
	toastBase: {
		height: "auto",
		minHeight: 56,
		width: "92%",
		maxWidth: 420,
		borderRadius: 14,
		backgroundColor: "#FFFFFF",
		paddingVertical: 10,
		borderLeftWidth: 5,
		shadowColor: "#000000",
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.12,
		shadowRadius: 10,
		elevation: 6,
	},
	successToast: {
		borderLeftColor: dark_primary, // #09A143 from Colors.ts
	},
	errorToast: {
		borderLeftColor: error_color, // #FF4D4F from Colors.ts
	},
	infoToast: {
		borderLeftColor: "#3B82F6",
	},
	contentContainer: {
		paddingHorizontal: 16,
		justifyContent: "center",
	},
	text1: {
		fontSize: 14,
		fontWeight: "700",
		color: "#11181C",
		lineHeight: 19,
	},
	text2: {
		fontSize: 12,
		fontWeight: "500",
		color: "#687076",
		lineHeight: 16,
		marginTop: 2,
	},
});

export default toastConfig;
