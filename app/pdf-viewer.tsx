import { dark, white } from "@/constants/Colors";
import { useTranslation } from "@/hooks/useTranslation";
import { downloadAuthenticatedPdf, openLocalPdf } from "@/utils/api";
import { font, height } from "@/utils/dimensions";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
	ActivityIndicator,
	StyleSheet,
	Text,
	TouchableOpacity,
	UIManager,
	View,
} from "react-native";
import PdfRendererView from "react-native-pdf-renderer";
import { SafeAreaView } from "react-native-safe-area-context";

// Native PDF view manager is missing in Expo Go; fall back to an external viewer.
const isNativePdfAvailable = (() => {
	try {
		return Boolean(
			UIManager &&
				typeof (UIManager as any).getViewManagerConfig === "function" &&
				((UIManager as any).getViewManagerConfig("RNPdfRendererView") ||
					(UIManager as any).getViewManagerConfig("PdfRendererView")),
		);
	} catch {
		return false;
	}
})();

/**
 * Generic authenticated PDF viewer.
 * params: path (API path, e.g. "loan/kfs/document/file"), title, file (local file name)
 */
export default function PdfViewer() {
	const { t } = useTranslation();
	const router = useRouter();
	const { path, title, file } = useLocalSearchParams<{
		path?: string;
		title?: string;
		file?: string;
	}>();

	const [uri, setUri] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [failed, setFailed] = useState(false);

	const load = useCallback(async () => {
		if (!path) {
			setFailed(true);
			setLoading(false);
			return;
		}
		try {
			setLoading(true);
			setFailed(false);
			setUri(await downloadAuthenticatedPdf(String(path), String(file || "document.pdf")));
		} catch (err) {
			console.error("PDF viewer download failed:", err);
			setUri(null);
			setFailed(true);
		} finally {
			setLoading(false);
		}
	}, [path, file]);

	useEffect(() => {
		load();
	}, [load]);

	return (
		<SafeAreaView style={styles.container}>
			<View style={styles.header}>
				<TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
					<Ionicons name="arrow-back" size={24} color={dark} />
				</TouchableOpacity>
				<Text style={styles.title} numberOfLines={1}>
					{title || ""}
				</Text>
			</View>

			{loading ? (
				<View style={styles.center}>
					<ActivityIndicator size="large" color="#A4E65E" />
				</View>
			) : failed || !uri ? (
				<View style={styles.center}>
					<Text style={styles.message}>{t("errorLoadingPDF")}</Text>
					<TouchableOpacity onPress={load} style={styles.button}>
						<Text style={styles.buttonText}>{t("retry") || "Retry"}</Text>
					</TouchableOpacity>
				</View>
			) : isNativePdfAvailable ? (
				<PdfRendererView
					style={styles.pdf}
					source={uri}
					distanceBetweenPages={5}
					maxZoom={3}
					maxPageResolution={1024}
					singlePage={false}
					onError={() => setFailed(true)}
				/>
			) : (
				<View style={styles.center}>
					<TouchableOpacity onPress={() => openLocalPdf(uri)} style={styles.button}>
						<Text style={styles.buttonText}>{title || "Open PDF"}</Text>
					</TouchableOpacity>
				</View>
			)}
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: white },
	header: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: 16,
		paddingVertical: 12,
	},
	backButton: { padding: 6, marginRight: 8 },
	title: { flex: 1, fontSize: font(18), fontWeight: "600", color: dark },
	center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
	message: { fontSize: font(15), color: dark, textAlign: "center" },
	button: {
		marginTop: height(2),
		backgroundColor: "#A4E65E",
		paddingVertical: 12,
		paddingHorizontal: 28,
		borderRadius: 10,
	},
	buttonText: { fontSize: font(15), fontWeight: "600", color: dark },
	pdf: { flex: 1, backgroundColor: "gray" },
});
