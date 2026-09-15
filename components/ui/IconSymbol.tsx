// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { OpaqueColorValue, type StyleProp, type TextStyle } from "react-native";

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
const MAPPING = {
	"house.fill": "home",
	"paperplane.fill": "send",
	"chevron.left.forwardslash.chevron.right": "code",
	"chevron.right": "chevron-right",
	"gift.fill": "redeem",
	"arrow.clockwise.circle": "history",
	"arrow.clockwise": "refresh",
	person: "account-circle",
	bell: "notifications-none",
	"account-balance": "account-balance",
	description: "description",
	"local-offer": "local-offer",
	security: "security",
	notifications: "notifications",
	"account-balance-wallet": "account-balance-wallet",
	phone: "phone",
	download: "downloading",
	logout: "exit-to-app",
	visibility: "visibility",
	visibilityOff: "visibility-off",
	"arrow-back": "arrow-back",
	close: "close",
	"globe.americas": "language",
	business: "business",
	trash: "delete",
	settings: "settings",
	calendar: "event",
	"arrow.right": "arrow-forward",
	"checkmark.circle.fill": "check-circle",
	rocket: "rocket-launch",
	bag: "shopping-bag",
	speedometer: "speed",
	"play.fill": "play-arrow",
} as const;

type IconMapping = typeof MAPPING;
type IconSymbolName = keyof IconMapping;

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
 */
export function IconSymbol({
	name,
	size = 24,
	color,
	style,
}: {
	name: IconSymbolName;
	size?: number;
	color: string | OpaqueColorValue;
	style?: StyleProp<TextStyle>;
	weight?: string;
}) {
	return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}
