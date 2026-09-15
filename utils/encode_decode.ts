/**
 * Base64 encoding/decoding utilities compatible with React Native
 */
export const encode = (value: string): string => {
	try {
		return btoa(value);
	} catch {
		return Buffer.from(value, "utf-8").toString("base64");
	}
};

export const decode = (value: string): string => {
	try {
		return atob(value);
	} catch {
		return Buffer.from(value, "base64").toString("utf-8");
	}
};
