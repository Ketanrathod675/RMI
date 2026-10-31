import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { dark_primary } from "@/constants/Colors";
import type { ErrorBoundaryProps } from "expo-router";
import { reportError } from "@/utils/errorHandling";
import { router, usePathname } from "expo-router";
import { useTranslation } from "@/hooks/useTranslation";

interface Props {
	children: React.ReactNode;
}

interface State {
	hasError: boolean;
	error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
	state: State = { hasError: false, error: null };

	static getDerivedStateFromError(error: Error): State {
		return { hasError: true, error };
	}

	componentDidCatch(error: Error, _info: React.ErrorInfo) {
		// Log a short message only — never log full error objects that might
		// contain request/response data with PII, and never log in a way that
		// could leak sensitive state. A message only is safe.
		reportError(error, "root-boundary");
	}

	handleReset = () => this.setState({ hasError: false, error: null });

	render() {
		if (this.state.hasError) {
			return (
				<View style={styles.container}>
					<Text style={styles.title}>Something went wrong</Text>
					<Text style={styles.subtitle}>
						We're sorry for the inconvenience. Please try again.
					</Text>
					<TouchableOpacity style={styles.button} activeOpacity={0.8} onPress={this.handleReset}>
						<Text style={styles.buttonText}>Try Again</Text>
					</TouchableOpacity>
				</View>
			);
		}
		return this.props.children;
	}
}

const errorHistory: number[] = [];

function recordBoundaryError(): number {
	const now = Date.now();
	errorHistory.push(now);
	const recent = errorHistory.filter((ts) => now - ts < 30_000);
	errorHistory.length = 0;
	errorHistory.push(...recent);
	return recent.length;
}

/**
 * Reusable Route-level ErrorBoundary for Expo Router screens.
 * Screens can export this as: `export { RouteErrorBoundary as ErrorBoundary } from "@/components/ErrorBoundary";`
 */
export function RouteErrorBoundary({ error, retry }: ErrorBoundaryProps) {
	const pathname = usePathname();
	const { t } = useTranslation();
	const previousPathRef = React.useRef(pathname);
	const retryRef = React.useRef(retry);
	retryRef.current = retry;
	const [errorCount] = React.useState(() => recordBoundaryError());

	React.useEffect(() => {
		reportError(error, pathname);
	}, [error, pathname]);

	React.useEffect(() => {
		if (previousPathRef.current !== pathname) {
			previousPathRef.current = pathname;
			retryRef.current();
		}
	}, [pathname]);

	const isHomeScreen = pathname === "/" || pathname === "/(tabs)" || pathname.startsWith("/(tabs)/index");
	const hasRepeatedErrors = errorCount >= 2;

	let canRestartWithUpdates = false;
	let reloadAsyncFn: (() => Promise<void>) | null = null;
	try {
		const Updates = require("expo-updates");
		if (typeof Updates?.reloadAsync === "function") {
			canRestartWithUpdates = true;
			reloadAsyncFn = Updates.reloadAsync;
		}
	} catch {
		// expo-updates not installed
	}

	const handleRestart = async () => {
		if (reloadAsyncFn) {
			try {
				await reloadAsyncFn();
				return;
			} catch {}
		}
		retry();
	};

	return (
		<View style={styles.container}>
			<Text style={styles.title}>{t("somethingWentWrong", "Something went wrong")}</Text>
			<Text style={styles.subtitle}>
				{t("errorBoundaryMessage", "We're sorry for the inconvenience. Please try again.")}
			</Text>
			<TouchableOpacity style={styles.button} activeOpacity={0.8} onPress={retry}>
				<Text style={styles.buttonText}>{t("tryAgain", "Try again")}</Text>
			</TouchableOpacity>
			{hasRepeatedErrors ? (
				canRestartWithUpdates ? (
					<TouchableOpacity style={[styles.button, { marginTop: 10 }]} activeOpacity={0.8} onPress={handleRestart}>
						<Text style={styles.buttonText}>{t("restartApp", "Restart app")}</Text>
					</TouchableOpacity>
				) : (
					<Text style={styles.reopenNotice}>
						{t("pleaseCloseAndReopenApp", "Please close and reopen the app.")}
					</Text>
				)
			) : !isHomeScreen ? (
				<TouchableOpacity style={[styles.button, { marginTop: 10 }]} activeOpacity={0.8} onPress={() => router.replace("/(tabs)")}>
					<Text style={styles.buttonText}>{t("goToHome", "Go to Home")}</Text>
				</TouchableOpacity>
			) : (
				<Text style={styles.reopenNotice}>
					{t("pleaseCloseAndReopenApp", "Please close and reopen the app.")}
				</Text>
			)}
		</View>
	);
}


const styles = StyleSheet.create({
	container: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		padding: 24,
		backgroundColor: "#ffffff",
	},
	title: {
		fontSize: 18,
		fontWeight: "700",
		marginBottom: 8,
		textAlign: "center",
		color: "#11181C",
	},
	subtitle: {
		fontSize: 14,
		color: "#666666",
		textAlign: "center",
		marginBottom: 20,
		lineHeight: 20,
	},
	button: {
		backgroundColor: dark_primary,
		paddingHorizontal: 24,
		paddingVertical: 12,
		borderRadius: 8,
	},
	buttonText: {
		color: "#ffffff",
		fontWeight: "700",
		fontSize: 15,
	},
	reopenNotice: {
		marginTop: 16,
		fontSize: 13,
		color: "#64748B",
		textAlign: "center",
		fontWeight: "500",
	},
});


export default ErrorBoundary;
