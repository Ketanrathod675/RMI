import React from "react";
import { Pressable, type GestureResponderEvent } from "react-native";

export function HapticTab(props: any) {
	return (
		<Pressable
			{...props}
			onPressIn={(ev: GestureResponderEvent) => {
				props.onPressIn?.(ev);
			}}
		/>
	);
}
