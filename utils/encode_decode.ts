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

/**
 * Safely extracts user_id (sub claim) from a JWT access token without external libraries
 */
export const getUserIdFromToken = (token?: string | null): string | null => {
	if (!token || typeof token !== "string") return null;
	try {
		const parts = token.split(".");
		if (parts.length < 2) return null;
		let base64Url = parts[1];
		let base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
		while (base64.length % 4) {
			base64 += "=";
		}
		const json = decode(base64);
		const payload = JSON.parse(json);
		return (payload.sub as string) || (payload.user_id as string) || (payload.id as string) || null;
	} catch {
		return null;
	}
};

