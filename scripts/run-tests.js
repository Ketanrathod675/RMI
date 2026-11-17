const ts = require("typescript");
const fs = require("fs");
const path = require("path");
const Module = require("module");

global.__DEV__ = false;
process.env.EXPO_PUBLIC_API_URL = process.env.EXPO_PUBLIC_API_URL || "https://example.invalid";

const memoryStorage = new Map();
const mockAsyncStorage = {
	__store: memoryStorage,
	getItem: async (k) => (memoryStorage.has(k) ? memoryStorage.get(k) : null),
	setItem: async (k, v) => {
		memoryStorage.set(k, String(v));
	},
	removeItem: async (k) => {
		memoryStorage.delete(k);
	},
	multiGet: async (keys) => keys.map((k) => [k, memoryStorage.has(k) ? memoryStorage.get(k) : null]),
	multiSet: async (pairs) => {
		for (const [k, v] of pairs) memoryStorage.set(k, String(v));
	},
	multiRemove: async (keys) => {
		for (const k of keys) memoryStorage.delete(k);
	},
	getAllKeys: async () => Array.from(memoryStorage.keys()),
	clear: async () => {
		memoryStorage.clear();
	},
};

const moduleMocks = new Map();
moduleMocks.set("@react-native-async-storage/async-storage", {
	__esModule: true,
	default: mockAsyncStorage,
	...mockAsyncStorage,
});
moduleMocks.set("react-native", {
	Platform: { OS: "android", select: (obj) => obj.android ?? obj.default },
	Alert: { alert: () => {} },
	StyleSheet: { create: (s) => s, flatten: (s) => s },
	processColor: (c) => c,
	Dimensions: { get: () => ({ width: 390, height: 844 }) },
	View: "View",
	Text: "Text",
	TouchableOpacity: "TouchableOpacity",
	NativeModules: {},
	DeviceEventEmitter: { addListener: () => ({ remove: () => {} }) },
	ToastAndroid: { show: () => {}, SHORT: 0, LONG: 1 },
	AppState: { addEventListener: () => ({ remove: () => {} }), currentState: "active" },
});
moduleMocks.set("react-native-svg", {
	__esModule: true,
	default: "Svg",
	Svg: "Svg",
	Path: "Path",
	Circle: "Circle",
	Rect: "Rect",
});
moduleMocks.set("react-native-reanimated", {
	__esModule: true,
	default: { View: "View", Text: "Text", createAnimatedComponent: (c) => c },
	useSharedValue: (v) => ({ value: v }),
	useAnimatedStyle: (fn) => fn(),
	withTiming: (v) => v,
	withSpring: (v) => v,
});
moduleMocks.set("react-native-toast-message", {
	__esModule: true,
	default: { show: () => {}, hide: () => {} },
});
moduleMocks.set("expo-router", {
	router: { push: () => {}, replace: () => {}, back: () => {}, dismissAll: () => {} },
});
moduleMocks.set("expo-secure-store", {
	getItemAsync: async () => null,
	setItemAsync: async () => {},
	deleteItemAsync: async () => {},
});
moduleMocks.set("expo-constants", {
	__esModule: true,
	default: { expoConfig: { extra: {} } },
});
moduleMocks.set("@react-native-community/netinfo", {
	__esModule: true,
	default: { fetch: async () => ({ isConnected: true, isInternetReachable: true }) },
});
moduleMocks.set("@sentry/react-native", {
	addBreadcrumb: () => {},
	captureException: () => {},
	captureMessage: () => {},
});
moduleMocks.set("react-native-device-info", {
	__esModule: true,
	default: { getUniqueId: async () => "test-device" },
});
moduleMocks.set("expo-application", {
	applicationId: "com.rapidmoney.app",
	nativeApplicationVersion: "1.0.0",
});
moduleMocks.set("expo-device", {
	modelName: "TestDevice",
});
moduleMocks.set("expo-sharing", {
	isAvailableAsync: async () => false,
	shareAsync: async () => {},
});
moduleMocks.set("expo-file-system", {
	documentDirectory: "/tmp/",
});
moduleMocks.set("expo-file-system/legacy", {
	documentDirectory: "/tmp/",
});
moduleMocks.set("expo-linking", {
	createURL: (p) => `rapid-money://${p || ""}`,
});
moduleMocks.set("react-redux", {
	useDispatch: () => () => {},
	useSelector: (fn) => fn({}),
	Provider: ({ children }) => children,
});

const projectRoot = path.resolve(__dirname, "..");

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
	if (moduleMocks.has(request)) {
		return moduleMocks.get(request);
	}
	if (request.startsWith("@/")) {
		const resolved = path.resolve(projectRoot, request.slice(2));
		return originalLoad.call(this, resolved, parent, isMain);
	}
	return originalLoad.call(this, request, parent, isMain);
};

function transpileAndCompile(moduleObj, filename, jsx = false) {
	const source = fs.readFileSync(filename, "utf8");
	const output = ts.transpileModule(source, {
		compilerOptions: {
			module: ts.ModuleKind.CommonJS,
			target: ts.ScriptTarget.ES2020,
			jsx: jsx ? ts.JsxEmit.React : ts.JsxEmit.None,
			esModuleInterop: true,
		},
	});
	return moduleObj._compile(output.outputText, filename);
}

require.extensions[".ts"] = (mod, filename) => transpileAndCompile(mod, filename, false);
require.extensions[".tsx"] = (mod, filename) => transpileAndCompile(mod, filename, true);

async function runSingleFile(filePath) {
	const mod = require(path.resolve(filePath));
	let ran = 0;
	for (const [name, val] of Object.entries(mod)) {
		if (typeof val === "function" && name.startsWith("run")) {
			await val();
			console.log(`[PASS] ${path.basename(filePath)} (${name})`);
			ran++;
		}
	}
	return ran;
}

async function main() {
	process.env.NODE_ENV = "test_runner";
	const arg = process.argv[2];

	if (arg) {
		await runSingleFile(arg);
		return;
	}

	const testDir = path.resolve(projectRoot, "__tests__");
	const files = fs.readdirSync(testDir).filter((f) => f.endsWith(".test.ts"));
	console.log(`Running ${files.length} test suites...`);

	let pass = 0;
	let fail = 0;

	for (const f of files) {
		const filePath = path.join(testDir, f);
		try {
			// Clear storage between tests
			memoryStorage.clear();
			await runSingleFile(filePath);
			pass++;
		} catch (err) {
			console.error(`[FAIL] ${f}:`, err);
			fail++;
		}
	}

	console.log(`\nSummary: ${pass} passed, ${fail} failed out of ${files.length} total.`);
	if (fail > 0) process.exit(1);
}

main().catch((err) => {
	console.error("FATAL:", err);
	process.exit(1);
});
