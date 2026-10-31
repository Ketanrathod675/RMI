import { getFriendlyError } from "@/utils/api/core/friendlyError";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

interface Props { error: unknown; onRetry: () => void; hasData?: boolean; onGoHome?: () => void }
export function QueryErrorState({ error, onRetry, hasData = false, onGoHome }: Props) {
	const friendly = getFriendlyError(error);
	const { t } = useTranslation();
	const message = t(`friendlyError_${friendly.kind}` as any, friendly.message);
	if (hasData) return <Text style={styles.cached}>{t("couldNotRefresh", "Couldn't refresh")}. {message}</Text>;
	return <View style={styles.container}>
		<Ionicons name="cloud-offline-outline" size={34} color="#64748B" />
		<Text style={styles.title}>{t("somethingWentWrong", friendly.title)}</Text>
		<Text style={styles.message}>{message}</Text>
		<TouchableOpacity style={styles.button} onPress={onRetry} accessibilityRole="button"><Text style={styles.buttonText}>{t("tryAgain", "Try again")}</Text></TouchableOpacity>
		{onGoHome && <TouchableOpacity onPress={onGoHome} accessibilityRole="button"><Text style={styles.home}>{t("goToHome", "Go to Home")}</Text></TouchableOpacity>}
	</View>;
}

const styles = StyleSheet.create({
	container: { flex: 1, minHeight: 260, alignItems: "center", justifyContent: "center", padding: 24, gap: 12, backgroundColor: "#fff" },
	title: { color: "#1E293B", fontSize: 18, fontWeight: "700", textAlign: "center" },
	message: { color: "#64748B", fontSize: 14, textAlign: "center", lineHeight: 20 },
	button: { borderRadius: 10, backgroundColor: "#B7FB52", paddingHorizontal: 24, paddingVertical: 12, marginTop: 4 },
	buttonText: { color: "#111827", fontWeight: "700" },
	home: { color: "#047857", padding: 8 },
	cached: { color: "#64748B", fontSize: 12, padding: 8 },
});
