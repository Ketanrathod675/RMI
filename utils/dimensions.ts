import { Dimensions } from "react-native";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

export const width = (percentage: number) => (percentage * SCREEN_WIDTH) / 100;
export const height = (percentage: number) => (percentage * SCREEN_HEIGHT) / 100;
export const font = (percentage: number) => (percentage * SCREEN_HEIGHT) / 100;

export const SCREEN_DIMENSIONS = {
	width: SCREEN_WIDTH,
	height: SCREEN_HEIGHT,
};

export default {
	width,
	height,
	font,
	SCREEN_DIMENSIONS,
};
