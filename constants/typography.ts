import { Platform } from "react-native";

export const JAKARTA = {
	regular: "PlusJakartaSans_400Regular",
	medium: "PlusJakartaSans_500Medium",
	semibold: "PlusJakartaSans_600SemiBold",
	bold: "PlusJakartaSans_700Bold",
	extraBold: "PlusJakartaSans_800ExtraBold",
} as const;

export const PRIMARY_FONT_FAMILY = Platform.select({
	ios: "System",
	android: "sans-serif",
	default: "sans-serif",
});

export type PrimaryFontWeight = "regular" | "medium" | "semibold" | "bold" | "extraBold";

const WEIGHT_MAP: Record<PrimaryFontWeight, "400" | "500" | "600" | "700" | "800"> = {
	regular: "400",
	medium: "500",
	semibold: "600",
	bold: "700",
	extraBold: "800",
};

export const primaryFont = (weight: PrimaryFontWeight = "regular") => ({
	fontFamily: PRIMARY_FONT_FAMILY,
	fontWeight: WEIGHT_MAP[weight],
});
