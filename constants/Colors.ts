/**
 * RapidMoney Brand Color Tokens
 */

export const primary = "#B7FB52"; // Lime green primary
export const dark_primary = "#09A143"; // Dark emerald green
export const white = "#ffffff";
export const dark = "#333333";
export const dark_background = "#0B0F14";
export const surface_dark = "#151C24";
export const border_dark = "#222D38";
export const muted_text = "#8E9AA8";
export const error_color = "#FF4D4F";

const tintColorLight = dark_primary;
const tintColorDark = primary;

export const Colors = {
	light: {
		text: "#11181C",
		background: "#ffffff",
		tint: tintColorLight,
		icon: "#687076",
		tabIconDefault: "#687076",
		tabIconSelected: tintColorLight,
		card: "#F8FAFC",
		border: "#E2E8F0",
		primary: primary,
		darkPrimary: dark_primary,
	},
	dark: {
		text: "#ECEDEE",
		background: dark_background,
		tint: tintColorDark,
		icon: "#9BA1A6",
		tabIconDefault: "#9BA1A6",
		tabIconSelected: tintColorDark,
		card: surface_dark,
		border: border_dark,
		primary: primary,
		darkPrimary: dark_primary,
	},
};

export default Colors;
