import { TranslatedText } from "@/components/TranslatedText";
import { dark, primary, white } from "@/constants/Colors";
import { Images } from "@/constants/images";
import { IconSymbol } from "@/components/ui/IconSymbol";
import { useDefault } from "@/hooks/useDefault";
import { useTranslation } from "@/hooks/useTranslation";
import { Layout01 } from "@/layouts/layout_01";
import { Languages } from "@/store/slices/global";
import { font, height, width } from "@/utils/dimensions";
import { router } from "expo-router";
import React, { useState } from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";

const LOGO_RAPID_MONEY = Images.LOGO_RAPID_MONEY;

const LANGUAGES: { key: Languages; label: string; sub: string; disabled?: boolean }[] = [
	{ key: "english", label: "English", sub: "English" },
	{ key: "hindi", label: "Hindi", sub: "हिंदी", disabled: false },
];

export default function SetLanguage() {
	const [selected, setSelected] = useState<Languages>("english");

	const { setLanguage } = useDefault();
	const { t } = useTranslation();

	const handleSelect = (lang: Languages) => {
		setSelected(lang);
	};

	const handleContinue = async () => {
		await setLanguage(selected);

		setTimeout(() => router.replace("/login"), 700);
	};

	return (
		<Layout01>
			{/* Select Language */}
			<View style={styles.iconRow}>
				<Image
					source={{
						uri: "https://img.icons8.com/ios-filled/50/79ca01/internet--v1.png",
					}}
					style={styles.globeIcon}
				/>
				<TranslatedText style={styles.selectLanguage} translationKey="selectLanguage" />
			</View>
			<TranslatedText style={styles.subText} translationKey="choosePreferredLanguage" />
			{/* Language Options */}
			<View style={styles.langList}>
				{LANGUAGES.map((lang) => (
					<TouchableOpacity
						key={lang.key}
						style={[
							styles.langOption,
							selected === lang.key && styles.langOptionSelected,
						]}
						disabled={lang.disabled ?? false}
						activeOpacity={0.8}
						onPress={() => handleSelect(lang.key)}>
						<View style={styles.langTextWrap}>
							<Text style={styles.langLabel}>{lang.label}</Text>
							<Text style={styles.langSub}>{lang.sub}</Text>
						</View>
						{selected === lang.key && (
							<View style={styles.checkWrap}>
								<Text style={styles.checkMark}>✔</Text>
							</View>
						)}
					</TouchableOpacity>
				))}
			</View>
			{/* Continue Button */}
			<TouchableOpacity
				style={styles.continueBtn}
				activeOpacity={0.8}
				onPress={handleContinue}>
				<View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
					<TranslatedText style={styles.continueText} translationKey="continue" />
					<IconSymbol name="arrow.right" size={20} color={white} />
				</View>
			</TouchableOpacity>
		</Layout01>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: white,
		alignItems: "center",
		paddingTop: height(10),
	},
	logo: {
		width: width(60),
		height: height(7),
		marginBottom: height(5),
		alignSelf: "center",
	},
	iconRow: {
		flexDirection: "row",
		alignItems: "center",
		marginBottom: height(2),
	},
	globeIcon: {
		width: width(7),
		height: width(7),
		marginRight: width(2),
		tintColor: primary,
	},
	selectLanguage: {
		fontSize: font(2.2),
		fontWeight: "bold",
		color: dark,
	},
	subText: {
		color: dark,
		opacity: 0.7,
		fontSize: font(1.5),
		marginBottom: height(3),
	},
	langList: {
		width: width(90),
		marginBottom: height(4),
	},
	langOption: {
		backgroundColor: white,
		borderColor: primary,
		borderWidth: 1,
		borderRadius: width(2),
		paddingVertical: height(2.2),
		paddingHorizontal: width(4),
		marginBottom: height(2),
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},
	langOptionSelected: {
		backgroundColor: "#f4fbe8",
		borderColor: primary,
		borderWidth: 2,
	},
	langTextWrap: {
		flexDirection: "column",
	},
	langLabel: {
		color: dark,
		fontWeight: "bold",
		fontSize: font(1.8),
	},
	langSub: {
		color: dark,
		opacity: 0.7,
		fontSize: font(1.3),
		marginTop: 2,
	},
	checkWrap: {
		width: width(6),
		height: width(6),
		borderRadius: width(3),
		backgroundColor: primary,
		alignItems: "center",
		justifyContent: "center",
	},
	checkMark: {
		color: white,
		fontSize: font(1.7),
		fontWeight: "bold",
	},
	continueBtn: {
		width: width(90),
		backgroundColor: primary,
		borderRadius: width(2),
		paddingVertical: height(2.2),
		alignItems: "center",
		justifyContent: "center",
		alignSelf: "center",
	},
	continueText: {
		color: white,
		fontSize: font(2),
		fontWeight: "bold",
	},
});
