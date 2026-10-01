import { TranslatedText } from "@/components/TranslatedText";
import { IconSymbol } from "@/components/ui/IconSymbol";
import { dark, white } from "@/constants/Colors";
import { Images } from "@/constants/images";
import { useTranslation } from "@/hooks/useTranslation";
import { font, height, width } from "@/utils/dimensions";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import React, { useEffect } from "react";
import { BackHandler, ScrollView, StyleSheet, Text, View } from "react-native";

export default function RapidCare() {
	const { t } = useTranslation();
	const router = useRouter();

	useEffect(() => {
		const backAction = () => {
			router.back();
			return true;
		};

		const backHandler = BackHandler.addEventListener(
			"hardwareBackPress",
			backAction,
		);

		return () => backHandler.remove();
	}, []);

	return (
		<View style={styles.container}>
			<ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
				{/* Coverage Summary */}
				<TranslatedText style={styles.sectionTitle} translationKey="yourCoverageSummary" />
				<View style={styles.summaryCard}>
					<View style={styles.summaryRow}>
						<View style={styles.summaryItem}>
							<TranslatedText
								style={styles.summaryLabel}
								translationKey="sumInsured"
							/>
							<Text style={styles.summaryValue}>₹1,00,000</Text>
						</View>
						<View style={styles.summaryItem}>
							<TranslatedText
								style={styles.summaryLabel}
								translationKey="policyTerm"
							/>
							<Text style={styles.summaryValue}>3 {t("months")}</Text>
						</View>
					</View>
				</View>

				{/* What's Covered */}
				<TranslatedText style={styles.sectionTitle} translationKey="whatsCovered" />

				{/* Doctor on Call / Chat */}
				<View style={styles.coverageItem}>
					<View style={styles.coverageIconContainer}>
						<Image
							source={Images.CHAT_WITH_DOCTOR_ICON}
							style={styles.coverageIcon}
							contentFit="contain"
						/>
					</View>
					<View style={styles.coverageContent}>
						<TranslatedText
							style={styles.coverageTitle}
							translationKey="doctorOnCallChat"
						/>
						<TranslatedText
							style={styles.coverageDescription}
							translationKey="consultCertifiedDoctors"
						/>
					</View>
				</View>

				{/* Accidental Death */}
				<View style={styles.coverageItem}>
					<View style={[styles.coverageIconContainer, { backgroundColor: "#FFE8E8" }]}>
						<Image
							source={Images.DEATH_COVERAGE_ICON}
							style={styles.coverageIcon}
							contentFit="contain"
						/>
					</View>
					<View style={styles.coverageContent}>
						<TranslatedText
							style={styles.coverageTitle}
							translationKey="accidentalDeath"
						/>
						<TranslatedText
							style={styles.coverageDescription}
							translationKey="accidentalDeathDescription"
						/>
					</View>
				</View>

				{/* How to Avail Phone - Consultation */}
				<TranslatedText
					style={styles.sectionTitle}
					translationKey="howToAvailPhoneConsultation"
				/>

				<View style={styles.consultationList}>
					<View style={styles.consultationItem}>
						<IconSymbol name="phone" size={16} color="#666" />
						<TranslatedText
							style={styles.consultationText}
							translationKey="getPhoneConsultationsWithDoctors"
						/>
					</View>

					<View style={styles.consultationItem}>
						<IconSymbol name="notifications" size={16} color="#666" />
						<TranslatedText
							style={styles.consultationText}
							translationKey="quickPreliminaryAdvice"
						/>
					</View>

					<View style={styles.consultationItem}>
						<IconSymbol name="phone" size={16} color="#666" />
						<Text style={styles.consultationText}>
							<TranslatedText style={styles.boldText} translationKey="callService" />{" "}
							1800 266 3390
						</Text>
					</View>

					<View style={styles.consultationItem}>
						<IconSymbol name="paperplane.fill" size={16} color="#666" />
						<Text style={styles.consultationText}>
							<TranslatedText style={styles.boldText} translationKey="chatService" />{" "}
							<TranslatedText translationKey="postPurchaseLinkInfo" />
						</Text>
					</View>

					<View style={styles.consultationItem}>
						<IconSymbol name="paperplane.fill" size={16} color="#666" />
						<Text style={styles.consultationText}>
							<TranslatedText style={styles.boldText} translationKey="claimService" />{" "}
							<TranslatedText translationKey="emailOrCallSupport" />
						</Text>
					</View>

					<View style={styles.consultationItem}>
						<IconSymbol name="notifications" size={16} color="#666" />
						<Text style={styles.consultationText}>
							<TranslatedText
								style={styles.boldText}
								translationKey="docOnCallChatTimings"
							/>{" "}
							<TranslatedText translationKey="mondayToFridayTiming" />
						</Text>
					</View>
				</View>

				{/* Exclusions */}
				<TranslatedText style={styles.exclusionsTitle} translationKey="exclusions" />

				<View style={styles.exclusionsList}>
					<View style={styles.exclusionItem}>
						<View style={styles.exclusionIcon}>
							<IconSymbol name="close" size={12} color={white} />
						</View>
						<TranslatedText
							style={styles.exclusionText}
							translationKey="selfHarmSuicideAlcohol"
						/>
					</View>

					<View style={styles.exclusionItem}>
						<View style={styles.exclusionIcon}>
							<IconSymbol name="close" size={12} color={white} />
						</View>
						<TranslatedText
							style={styles.exclusionText}
							translationKey="criminalActivityWar"
						/>
					</View>

					<View style={styles.exclusionItem}>
						<View style={styles.exclusionIcon}>
							<IconSymbol name="close" size={12} color={white} />
						</View>
						<TranslatedText
							style={styles.exclusionText}
							translationKey="personsBelow18Above70"
						/>
					</View>

					<View style={styles.exclusionItem}>
						<View style={styles.exclusionIcon}>
							<IconSymbol name="close" size={12} color={white} />
						</View>
						<TranslatedText
							style={styles.exclusionText}
							translationKey="lossNotDirectlyFromAccident"
						/>
					</View>
				</View>

				{/* Terms & Conditions */}
				<TranslatedText style={styles.termsTitle} translationKey="termsAndConditions" />

				<View style={styles.termsList}>
					<View style={styles.termItem}>
						<Text style={styles.bulletPoint}>•</Text>
						<TranslatedText
							style={styles.termText}
							translationKey="insurancePartOfRapidCare"
						/>
					</View>

					<View style={styles.termItem}>
						<Text style={styles.bulletPoint}>•</Text>
						<TranslatedText
							style={styles.termText}
							translationKey="insuranceSubjectMatterSolicitation"
						/>
					</View>
				</View>
			</ScrollView>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: white,
	},
	header: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: width(4),
		paddingTop: height(6),
		paddingBottom: height(2),
		backgroundColor: white,
	},
	backButton: {
		padding: width(2),
	},
	headerTitle: {
		fontSize: font(2.4),
		fontWeight: "600",
		color: dark,
	},
	placeholder: {
		width: width(10),
	},
	scrollView: {
		flex: 1,
	},
	content: {
		paddingHorizontal: width(4),
		paddingBottom: height(4),
	},
	sectionTitle: {
		fontSize: font(2.2),
		fontWeight: "600",
		color: dark,
		marginBottom: height(2),
		marginTop: height(2),
	},
	summaryCard: {
		backgroundColor: "#F5F5F5",
		borderRadius: width(3),
		padding: width(4),
		marginBottom: height(2),
	},
	summaryRow: {
		flexDirection: "row",
		justifyContent: "space-between",
	},
	summaryItem: {
		flex: 1,
	},
	summaryLabel: {
		fontSize: font(1.6),
		color: "#666",
		marginBottom: height(0.5),
	},
	summaryValue: {
		fontSize: font(2),
		fontWeight: "600",
		color: dark,
	},
	coverageItem: {
		flexDirection: "row",
		marginBottom: height(3),
		alignItems: "flex-start",
	},
	coverageIconContainer: {
		backgroundColor: "#E8F5E8",
		borderRadius: width(2),
		padding: width(2),
		marginRight: width(3),
		marginTop: height(0.5),
	},
	coverageIcon: {
		width: width(6),
		height: width(6),
	},
	coverageContent: {
		flex: 1,
	},
	coverageTitle: {
		fontSize: font(1.8),
		fontWeight: "600",
		color: dark,
		marginBottom: height(0.5),
	},
	coverageDescription: {
		fontSize: font(1.5),
		color: "#666",
		lineHeight: font(2),
	},
	consultationList: {
		marginTop: height(1),
	},
	consultationItem: {
		flexDirection: "row",
		alignItems: "flex-start",
		marginBottom: height(2),
		paddingRight: width(2),
	},
	consultationText: {
		fontSize: font(1.5),
		color: "#666",
		marginLeft: width(3),
		flex: 1,
		lineHeight: font(2),
	},
	boldText: {
		fontWeight: "600",
		color: dark,
	},
	exclusionsTitle: {
		fontSize: font(2.2),
		fontWeight: "600",
		color: "#FF6B6B",
		marginBottom: height(2),
		marginTop: height(3),
	},
	exclusionsList: {
		marginBottom: height(3),
	},
	exclusionItem: {
		flexDirection: "row",
		alignItems: "flex-start",
		marginBottom: height(1.5),
		paddingRight: width(2),
	},
	exclusionIcon: {
		backgroundColor: "#FF6B6B",
		borderRadius: width(2),
		width: width(4),
		height: width(4),
		alignItems: "center",
		justifyContent: "center",
		marginTop: height(0.2),
	},
	exclusionText: {
		fontSize: font(1.5),
		color: "#666",
		marginLeft: width(3),
		flex: 1,
		lineHeight: font(2),
	},
	termsTitle: {
		fontSize: font(2.2),
		fontWeight: "600",
		color: dark,
		marginBottom: height(2),
		marginTop: height(1),
	},
	termsList: {
		marginBottom: height(3),
	},
	termItem: {
		flexDirection: "row",
		alignItems: "flex-start",
		marginBottom: height(2),
		paddingRight: width(2),
	},
	bulletPoint: {
		fontSize: font(1.8),
		color: dark,
		marginRight: width(2),
		marginTop: height(0.2),
	},
	termText: {
		fontSize: font(1.5),
		color: "#666",
		flex: 1,
		lineHeight: font(2),
	},
});
