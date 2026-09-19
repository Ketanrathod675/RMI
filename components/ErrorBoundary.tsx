import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { dark_primary } from "@/constants/Colors";
import type { ErrorBoundaryProps } from "expo-router";

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
		console.error("App crashed:", error?.message || "Unknown error");
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

/**
 * Reusable Route-level ErrorBoundary for Expo Router screens.
 * Screens can export this as: `export { RouteErrorBoundary as ErrorBoundary } from "@/components/ErrorBoundary";`
 */
export function RouteErrorBoundary({ error, retry }: ErrorBoundaryProps) {
	React.useEffect(() => {
		console.error("Screen crashed:", error?.message || "Unknown error");
	}, [error]);

	return (
		<View style={styles.container}>
			<Text style={styles.title}>Something went wrong</Text>
			<Text style={styles.subtitle}>
				We're sorry for the inconvenience. Please try again.
			</Text>
			<TouchableOpacity style={styles.button} activeOpacity={0.8} onPress={retry}>
				<Text style={styles.buttonText}>Try Again</Text>
			</TouchableOpacity>
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
});

export default ErrorBoundary;
