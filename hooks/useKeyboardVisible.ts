import { useEffect, useState } from "react";
import { Keyboard, Platform, type KeyboardEvent } from "react-native";

export function useKeyboardVisible(): { visible: boolean; height: number } {
	const [visible, setVisible] = useState(false);
	const [height, setHeight] = useState(0);

	useEffect(() => {
		const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
		const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

		const showSubscription = Keyboard.addListener(showEvent, (e: KeyboardEvent) => {
			setVisible(true);
			setHeight(e?.endCoordinates ? e.endCoordinates.height : 0);
		});

		const hideSubscription = Keyboard.addListener(hideEvent, () => {
			setVisible(false);
			setHeight(0);
		});

		return () => {
			showSubscription.remove();
			hideSubscription.remove();
		};
	}, []);

	return { visible, height };
}

export default useKeyboardVisible;
