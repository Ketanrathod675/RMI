import React from "react";
import { PanResponder, StyleSheet, View } from "react-native";
import Toast, { BaseToast, ErrorToast, ToastConfig } from "react-native-toast-message";
import { dark_primary, error_color } from "@/constants/Colors";

function SwipeDismissToast({ children }: { children: React.ReactNode }) {
	const responder = React.useMemo(() => PanResponder.create({
		onMoveShouldSetPanResponder: (_event, gesture) => gesture.dy < -8,
		onPanResponderRelease: (_event, gesture) => { if (gesture.dy < -18) Toast.hide(); },
	}), []);
	return <View {...responder.panHandlers}>{children}</View>;
}

export const toastConfig: ToastConfig = {
	success: (props) => (
		<SwipeDismissToast>
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
			text2NumberOfLines={1}
		/>
		</SwipeDismissToast>
	),
	error: (props) => (
		<SwipeDismissToast>
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
			text2NumberOfLines={1}
		/>
		</SwipeDismissToast>
	),
	info: (props) => (
		<SwipeDismissToast>
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
			text2NumberOfLines={1}
		/>
		</SwipeDismissToast>
	),
};

import { getSyncTranslation } from "@/utils/toast_translations";

let installed = false;
export function installToastDefaults() {
	if (installed) return;
	installed = true;
	const originalShow = Toast.show.bind(Toast);
	let previousKey = "";
	let previousAt = 0;
	(Toast as any).show = (input: any) => {
		const config = { ...(input ?? {}) };
		const type = String(config.type ?? "info");
		const text1 = typeof config.text1 === "string" ? config.text1.trim() : "";
		const text2 = typeof config.text2 === "string" ? config.text2.trim() : "";
		const combined = [text1, text2].filter(Boolean).join("  ");
		// Strict stack-trace matching only to avoid false positives on normal sentences like "Contact support at help (24x7)"
		const containsTechnicalText = /traceback|exception|\bsql\b|psycopg|keyerror|<html|request failed with status code|network error|\bat\s+[\w$.<>]+\s+\([^)]*:\d+:\d+\)/i.test(combined);
		if (containsTechnicalText) {
			config.text1 = getSyncTranslation("errGeneric", "Something went wrong. Please try again.");
			config.text2 = undefined;
		}
		if (type === "success" && /proceeding to the next step|details submitted successfully|application submitted successfully/i.test(combined)) return;
		const key = `${type}|${combined}`;
		const now = Date.now();
		if (key === previousKey && now - previousAt < 2500) return;
		previousKey = key;
		previousAt = now;

		if (!containsTechnicalText) {
			config.text1 = text2 && combined.length <= 70 ? combined : text1;
			config.text2 = text2 && combined.length > 70 && type === "error" ? text2 : undefined;
		}
		const chars = `${config.text1 ?? ""}${config.text2 ?? ""}`.length;
		config.visibilityTime = Math.min(4000, config.visibilityTime ?? (chars > 55 ? 3200 : 2200));
		config.position = "top";
		originalShow(config);
	};
}


const styles = StyleSheet.create({
	toastBase: {
		height: "auto",
		minHeight: 44,
		width: "92%",
		maxWidth: 420,
		borderRadius: 999,
		backgroundColor: "#FFFFFF",
		paddingVertical: 5,
		borderLeftWidth: 3,
		shadowColor: "#000000",
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.08,
		shadowRadius: 5,
		elevation: 3,
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
		paddingHorizontal: 12,
		justifyContent: "center",
	},
	text1: {
		fontSize: 13,
		fontWeight: "700",
		color: "#11181C",
		lineHeight: 17,
	},
	text2: {
		fontSize: 12,
		fontWeight: "500",
		color: "#687076",
		lineHeight: 15,
		marginTop: 0,
	},
});

export default toastConfig;
