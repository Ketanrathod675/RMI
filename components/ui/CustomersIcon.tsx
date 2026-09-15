import React from "react";
import Svg, { Circle, Path } from "react-native-svg";

export const CustomersIcon = ({ size = 32 }: { size?: number }) => {
	const width = (size * 38) / 32;
	const height = size;

	return (
		<Svg width={width} height={height} viewBox="0 0 38 32" fill="none">
			{/* Left Avatar (Orange) */}
			<Circle cx="10" cy="10" r="6" fill="#FFA940" />
			<Path
				d="M3 26C3 20.5 6 17.5 10 17.5C14 17.5 17 20.5 17 26H3Z"
				fill="#FA8C16"
			/>

			{/* Right Avatar (Peach / Pink) */}
			<Circle cx="28" cy="10" r="6" fill="#FFBB96" />
			<Path
				d="M21 26C21 20.5 24 17.5 28 17.5C32 17.5 35 20.5 35 26H21Z"
				fill="#FF7875"
			/>

			{/* Center Foreground Avatar (Coral / Blue) */}
			<Circle cx="19" cy="11" r="7" fill="#FA541C" />
			<Path
				d="M10 29C10 22.5 14 19.5 19 19.5C24 19.5 28 22.5 28 29H10Z"
				fill="#1890FF"
			/>
		</Svg>
	);
};

export default CustomersIcon;
