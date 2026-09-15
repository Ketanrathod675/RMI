import { Platform } from "react-native";
import {
	activateOtpListener,
	getHash as getAutoVerifyHash,
	removeListener as removeAutoVerifyListener,
	type OtpListenerSubscription,
} from "react-native-otp-auto-verify";

let currentSubscription: OtpListenerSubscription | null = null;

const RNOtpVerify: {
	getOtp: () => Promise<boolean | string>;
	getHash: () => Promise<string[]>;
	addListener: (handler: (message: string) => void) => any;
	removeListener: () => void;
} = {
	getOtp: async () => {
		if (Platform.OS !== "android") return false;
		return true;
	},

	getHash: async () => {
		if (Platform.OS !== "android") return [];
		try {
			return await getAutoVerifyHash();
		} catch (e) {
			if (__DEV__) {
				console.warn("[RNOtpVerify] Failed to get hash on Android:", e);
			}
			return [];
		}
	},

	addListener: (handler: (message: string) => void) => {
		if (Platform.OS !== "android") return;

		// Clean up existing subscription if any before creating a new one
		if (currentSubscription) {
			currentSubscription.remove();
			currentSubscription = null;
		}

		activateOtpListener(
			(message: string) => {
				if (typeof handler === "function") {
					handler(message);
				}
			},
			{ numberOfDigits: 4 }
		)
			.then((sub) => {
				currentSubscription = sub;
			})
			.catch((e) => {
				if (__DEV__) {
					console.warn("[RNOtpVerify] Failed to activate OTP listener on Android:", e);
				}
			});
	},

	removeListener: () => {
		if (Platform.OS !== "android") return;

		if (currentSubscription) {
			currentSubscription.remove();
			currentSubscription = null;
		}

		try {
			removeAutoVerifyListener();
		} catch (e) {
			if (__DEV__) {
				console.warn("[RNOtpVerify] Failed to remove OTP listener on Android:", e);
			}
		}
	},
};

export default RNOtpVerify;

