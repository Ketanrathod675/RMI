import * as Linking from "expo-linking";
import Toast from "react-native-toast-message";

export async function openExternalUrl(url: string): Promise<boolean> {
	try {
		const scheme = url.trim().match(/^([a-z][a-z0-9+.-]*):/i)?.[1]?.toLowerCase();
		if (!scheme || !["http", "https", "mailto", "tel"].includes(scheme)) throw new Error("unsupported_url");
		if (!(await Linking.canOpenURL(url))) throw new Error("no_handler");
		await Linking.openURL(url);
		return true;
	} catch {
		Toast.show({ type: "error", text1: "Unable to open this link. Please try again." });
		return false;
	}
}
