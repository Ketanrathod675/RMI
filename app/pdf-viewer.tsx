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
					<View style={styles.docCard}>
						<Ionicons name="document-text-outline" size={52} color="#79CA01" />
						<Text style={styles.docTitle} numberOfLines={2}>
							{title || "Document"}
						</Text>
						<Text style={styles.docSubtitle}>
							Tap below to view this document in your PDF reader.
						</Text>
						<TouchableOpacity
							onPress={() => openLocalPdf(uri)}
							style={styles.button}
							activeOpacity={0.8}
						>
							<Ionicons name="open-outline" size={18} color="#0F172A" style={styles.buttonIcon} />
							<Text style={styles.buttonText}>Open PDF</Text>
						</TouchableOpacity>
					</View>
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
		borderBottomWidth: 1,
		borderBottomColor: "#F1F5F9",
	},
	backButton: { padding: 6, marginRight: 8 },
	title: { flex: 1, fontSize: 18, fontWeight: "600", color: dark },
	center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
	message: { fontSize: 14, color: dark, textAlign: "center", marginBottom: 16 },
	docCard: {
		backgroundColor: "#F8FAFC",
		borderWidth: 1,
		borderColor: "#E2E8F0",
		borderRadius: 16,
		padding: 24,
		alignItems: "center",
		width: "100%",
		maxWidth: 340,
	},
	docTitle: {
		fontSize: 18,
		fontWeight: "700",
		color: dark,
		textAlign: "center",
		marginTop: 14,
	},
	docSubtitle: {
		fontSize: 13,
		color: "#64748B",
		textAlign: "center",
		marginTop: 6,
		lineHeight: 18,
	},
	button: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		marginTop: 20,
		backgroundColor: "#B7FB52",
		paddingVertical: 14,
		paddingHorizontal: 28,
		borderRadius: 12,
		width: "100%",
	},
	buttonIcon: {
		marginRight: 8,
	},
	buttonText: { fontSize: 15, fontWeight: "700", color: "#0F172A" },
	pdf: { flex: 1, backgroundColor: "gray" },
});
