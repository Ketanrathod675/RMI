import { HyperlinkText } from "@/components/HyperlinkText";
import { Images } from "@/constants/images";
import { useJourneyTracker } from "@/hooks/useJourneyTracker";
import { useTranslation } from "@/hooks/useTranslation";
import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import {
	BackHandler,
	Image,
	Linking,
	Platform,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	TouchableOpacity,
	useWindowDimensions,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface FAQItemData {
	id: number;
	question: string;
	answer: string;
	category: "general" | "repayments" | "security";
}

const CATEGORIES = [
	{ id: "all", label: "All Questions" },
	{ id: "general", label: "General" },
	{ id: "repayments", label: "Repayments" },
	{ id: "security", label: "Security" },
] as const;

export default function HelpAndSupport() {
	const insets = useSafeAreaInsets();
	const { width: screenWidth } = useWindowDimensions();
	const W = Math.min(screenWidth, 500);

	// Proportional dimensions ensuring 100% faithful alignment on every screen size:
	const bannerHeadroom = Math.round(W * 0.09);
	const bannerCardHeight = Math.round(W * 0.44);
	const mascotWidth = Math.round(W * 0.50);
	const mascotHeight = Math.round(mascotWidth / 0.8326);
	const circleSize = Math.round(W * 0.15);

	const { t } = useTranslation();
	useJourneyTracker("/help-support");

	// Search & Category filter states
	const [searchQuery, setSearchQuery] = useState("");
	const [selectedCategory, setSelectedCategory] = useState<string>("all");

	// First item active and expanded by default matching the latest screenshot
	const [activeFaq, setActiveFaq] = useState<number | null>(0);
	const [expandedAnswerId, setExpandedAnswerId] = useState<number | null>(0);

	// Handle hardware back press on Android
	useFocusEffect(
		useCallback(() => {
			const onBackPress = () => {
				if (router.canGoBack()) {
					router.back();
				} else {
					router.replace("/(tabs)");
				}
				return true;
			};

			const subscription = BackHandler.addEventListener(
				"hardwareBackPress",
				onBackPress
			);

			return () => subscription.remove();
		}, [])
	);

	const toggleFaq = (id: number) => {
		setActiveFaq(id);
		setExpandedAnswerId((prev) => (prev === id ? null : id));
	};

	const handleCallPress = () => {
		Linking.openURL("tel:+911234567890").catch((err) =>
			console.error("Failed to dial:", err)
		);
	};

	const handleWhatsAppPress = () => {
		Linking.openURL(
			"https://wa.me/+919029003135?text=" +
			encodeURIComponent("Hi! Can we have a chat.")
		).catch((err) => console.error("Failed to open WhatsApp:", err));
	};

	const handleEmailPress = () => {
		Linking.openURL(
			"mailto:care@rapidmoney.in?subject=" +
			encodeURIComponent("RapidMoney App Support")
		).catch((err) => console.error("Failed to open Email:", err));
	};

	const faqList: FAQItemData[] = [
		{
			id: 0,
			question: "What is RapidMoney and how does it work?",
			answer:
				"RapidMoney is an RBI-compliant digital personal lending platform designed for salaried & self-employed professionals in India. We offer collateral-free personal credit disbursed straight to your verified bank account within minutes via 100% paperless e-KYC.",
			category: "general",
		},
		{
			id: 1,
			question: t("faqQ2"),
			answer: t("faqA2"),
			category: "general",
		},
		{
			id: 2,
			question: t("faqQ3"),
			answer: t("faqA3"),
			category: "security",
		},
		{
			id: 3,
			question: t("faqQ4"),
			answer: t("faqA4"),
			category: "repayments",
		},
		{
			id: 4,
			question: t("isRapidMoneyBankOrNBFC"),
			answer: t("faqAnswer1"),
			category: "general",
		},
		{
			id: 5,
			question: t("whyShouldIBorrowFromRapidMoney"),
			answer: t("faqAnswer3"),
			category: "general",
		},
		{
			id: 6,
			question: t("whatIfIHaveToRaiseComplaint"),
			answer: t("faqAnswer4"),
			category: "general",
		},
		{
			id: 7,
			question: t("canIApplyForLoanFirstTime"),
			answer: t("faqAnswer5"),
			category: "general",
		},
		{
			id: 8,
			question: t("canIApplyWithoutSmartphone"),
			answer: t("faqAnswer6"),
			category: "general",
		},
		{
			id: 9,
			question: t("howIsRapidMoneyDifferent"),
			answer: t("faqAnswer7"),
			category: "general",
		},
		{
			id: 10,
			question: t("whatIsInstantPersonalLoan"),
			answer: t("faqAnswer8"),
			category: "general",
		},
		{
			id: 11,
			question: t("howDoesPersonalLoanWork"),
			answer: t("faqAnswer9"),
			category: "general",
		},
		{
			id: 12,
			question: t("howQuicklyCanIReceiveFunds"),
			answer: t("faqAnswer10"),
			category: "general",
		},
		{
			id: 13,
			question: t("howDoesRapidMoneyEnsureSecurity"),
			answer: t("faqAnswer11"),
			category: "security",
		},
		{
			id: 14,
			question: t("whatIsMinimumIncomeRequirement"),
			answer: t("faqAnswer12"),
			category: "general",
		},
		{
			id: 15,
			question: t("areThereFeesForEarlyRepayment"),
			answer: t("faqAnswer13"),
			category: "repayments",
		},
		{
			id: 16,
			question: t("whatIsTypicalRepaymentTenure"),
			answer: t("faqAnswer14"),
			category: "repayments",
		},
		{
			id: 17,
			question: t("canIApplyJointlyWithSpouse"),
			answer: t("faqAnswer15"),
			category: "general",
		},
		{
			id: 18,
			question: t("whatIsMyLoanEligibility"),
			answer: t("faqAnswer16"),
			category: "general",
		},
		{
			id: 19,
			question: t("whatDocumentsAreRequired"),
			answer: t("faqAnswer17"),
			category: "general",
		},
		{
			id: 20,
			question: t("amGettingSalaryViaCash"),
			answer: t("faqAnswer18"),
			category: "general",
		},
		{
			id: 21,
			question: t("myLoanGotRejected"),
			answer: t("faqAnswer19"),
			category: "general",
		},
		{
			id: 22,
			question: t("howCanIIncreaseChances"),
			answer: t("faqAnswer20"),
			category: "general",
		},
		{
			id: 23,
			question: t("whichPlatformsCanBeUsed"),
			answer: t("faqAnswer21"),
			category: "general",
		},
		{
			id: 24,
			question: t("recentlyStartedNewJob"),
			answer: t("faqAnswer22"),
			category: "general",
		},
		{
			id: 25,
			question: t("benefitsOfHigherCreditScore"),
			answer: t("faqAnswer23"),
			category: "general",
		},
		{
			id: 26,
			question: t("whatIsCreditScore"),
			answer: t("faqAnswer24"),
			category: "general",
		},
		{
			id: 27,
			question: t("howIsCreditLimitDecided"),
			answer: t("faqAnswer25"),
			category: "general",
		},
		{
			id: 28,
			question: t("whatIsAPR"),
			answer: t("faqAnswer26"),
			category: "repayments",
		},
		{
			id: 29,
			question: t("whyDoYouNeedBankAccountDetails"),
			answer: t("faqAnswer27"),
			category: "security",
		},
		{
			id: 30,
			question: t("canIGetMyLoanCancelled"),
			answer: t("faqAnswer28"),
			category: "repayments",
		},
		{
			id: 31,
			question: t("howCanITrackRepaymentSchedule"),
			answer: t("faqAnswer29"),
			category: "repayments",
		},
		{
			id: 32,
			question: t("canIPayBeforeEMIDate"),
			answer: t("faqAnswer30"),
			category: "repayments",
		},
	];

	const filteredFaqs = faqList.filter((item) => {
		const matchesCategory =
			selectedCategory === "all" || item.category === selectedCategory;
		const query = searchQuery.trim().toLowerCase();
		const matchesSearch =
			!query ||
			item.question.toLowerCase().includes(query) ||
			item.answer.toLowerCase().includes(query);
		return matchesCategory && matchesSearch;
	});

	return (
		<View style={[styles.screenContainer, { paddingTop: insets.top }]}>
			{/* Header */}
			<View style={styles.header}>
				<View style={styles.headerLeft}>
					<TouchableOpacity
						activeOpacity={0.7}
						onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)"))}
						style={styles.backButton}>
						<MaterialIcons name="arrow-back" size={24} color="#14201A" />
					</TouchableOpacity>
					<Text style={styles.headerTitle}>Help & Support</Text>
				</View>

				<TouchableOpacity activeOpacity={0.7} style={styles.menuButton}>
					<MaterialIcons name="more-vert" size={24} color="#14201A" />
				</TouchableOpacity>
			</View>

			<ScrollView
				style={styles.scrollView}
				contentContainerStyle={styles.scrollContent}
				showsVerticalScrollIndicator={false}>
				{/* Support Mascot Banner Area */}
				<View style={[styles.bannerWrapper, { height: bannerHeadroom + bannerCardHeight }]}>
					{/* Light Blue Curved Card */}
					<View
						style={[
							styles.supportBannerCard,
							{
								marginTop: bannerHeadroom,
								height: bannerCardHeight,
								borderBottomLeftRadius: Math.round(W * 0.08),
								borderBottomRightRadius: Math.round(W * 0.08),
							},
						]}>
						<View style={[styles.supportBannerLeft, { width: Math.round(W * 0.50), paddingLeft: Math.round(W * 0.05) }]}>
							<Text style={styles.contactSupportTitle}>Contact us for support.</Text>

							<TouchableOpacity
								activeOpacity={0.8}
								onPress={handleCallPress}
								style={styles.phonePill}>
								<MaterialIcons name="call" size={Math.round(W * 0.042)} color="#65A30D" />
								<Text style={styles.phoneNumberText}>+91 - 1234567890</Text>
							</TouchableOpacity>

							<Text style={styles.availableTitle}>We're available from:</Text>
							<Text style={styles.availableText}>{"Mon to Sat\n(10:am - 7:00 Pm )"}</Text>
						</View>
					</View>

					{/* Floating Mascot Group (Woman + Headset) */}
					<View
						pointerEvents="none"
						style={[
							styles.mascotGroup,
							{
								width: mascotWidth,
								height: mascotHeight,
							},
						]}>
						{/* Smiling Mascot Girl */}
						<Image
							source={Images.HELP_SUPPORT_MASCOT}
							style={{ width: mascotWidth, height: mascotHeight }}
							resizeMode="contain"
						/>

						{/* Purple Headset Icon (pinned right to the girl's head & above hand) */}
						<Image
							source={Images.HELP_SUPPORT_ICON}
							style={[
								styles.headsetIcon,
								{
									width: circleSize,
									height: circleSize,
									left: -Math.round(circleSize * 0.16),
									top: Math.round(mascotHeight * 0.14),
								},
							]}
							resizeMode="contain"
						/>
					</View>
				</View>

				{/* Registered Office Block (Commented for now) */}
				{/* <View style={styles.officeContainer}>
					<View style={styles.officePill}>
						<MaterialIcons name="location-on" size={20} color="#76C800" />
						<Text style={styles.officePillText}>{"Registered\nOffice"}</Text>
					</View>

					<Text style={styles.officeAddress}>
						{"902, 9th Floor, Shubhjivan Arcade, Swami\nVivekananda Rd, Datta Park, Borivali West,\nMumbai, Maharashtra 400092"}
					</Text>
				</View> */}

				{/* Contact Options: Chat & Email */}
				<View style={styles.contactActionsContainer}>
					{/* WhatsApp Action Card */}
					<TouchableOpacity
						activeOpacity={0.75}
						onPress={handleWhatsAppPress}
						style={styles.actionCard}>
						<View style={styles.actionCardLeft}>
							<MaterialCommunityIcons name="whatsapp" size={24} color="#25D366" />
							<Text style={styles.actionCardText}>Chat with us</Text>
						</View>
						<MaterialIcons name="chevron-right" size={22} color="#14201A" />
					</TouchableOpacity>

					{/* Email Action Card */}
					<TouchableOpacity
						activeOpacity={0.75}
						onPress={handleEmailPress}
						style={styles.actionCard}>
						<View style={styles.actionCardLeft}>
							<MaterialCommunityIcons name="email-outline" size={24} color="#76C800" />
							<Text style={styles.actionCardText}>Write an email to us</Text>
						</View>
						<MaterialIcons name="chevron-right" size={22} color="#14201A" />
					</TouchableOpacity>
				</View>

				{/* FAQ Section */}
				<View style={styles.faqSection}>
					<Text style={styles.faqTitle}>Read Our FAQs</Text>

					{/* Search Bar */}
					<View style={styles.searchBarWrapper}>
						<MaterialIcons name="search" size={22} color="#9CA3AF" style={styles.searchIcon} />
						<TextInput
							style={styles.searchInput}
							placeholder="Search queries (e.g. loan, security, EMI)..."
							placeholderTextColor="#9CA3AF"
							value={searchQuery}
							onChangeText={setSearchQuery}
							autoCapitalize="none"
							clearButtonMode="while-editing"
						/>
					</View>

					{/* Category Filter Tabs */}
					<ScrollView
						horizontal
						showsHorizontalScrollIndicator={false}
						contentContainerStyle={styles.categoriesContainer}>
						{CATEGORIES.map((category) => {
							const isSelected = selectedCategory === category.id;
							return (
								<TouchableOpacity
									key={category.id}
									activeOpacity={0.75}
									onPress={() => setSelectedCategory(category.id)}
									style={[
										styles.categoryPill,
										isSelected ? styles.categoryPillActive : styles.categoryPillInactive,
									]}>
									<Text
										style={[
											styles.categoryPillText,
											isSelected
												? styles.categoryPillTextActive
												: styles.categoryPillTextInactive,
										]}>
										{category.label}
									</Text>
								</TouchableOpacity>
							);
						})}
					</ScrollView>

					{/* FAQ Cards Accordion */}
					<View style={styles.faqCardContainer}>
						{filteredFaqs.map((item, index) => {
							const isActive = activeFaq === item.id;
							const isAnswerOpen = expandedAnswerId === item.id;
							const isLast = index === filteredFaqs.length - 1;

							return (
								<View
									key={item.id}
									style={[
										styles.faqItemWrapper,
										!isLast && styles.faqItemBorderBottom,
									]}>
									<TouchableOpacity
										activeOpacity={0.7}
										style={styles.faqQuestionRow}
										onPress={() => toggleFaq(item.id)}>
										<Text
											style={[
												styles.faqQuestionText,
												isActive && styles.faqQuestionTextActive,
											]}>
											{item.question}
										</Text>

										<MaterialIcons
											name={isActive && isAnswerOpen ? "keyboard-arrow-up" : "keyboard-arrow-down"}
											size={26}
											color={isActive && isAnswerOpen ? "#4CAE38" : "#2E3A59"}
										/>
									</TouchableOpacity>

									{isAnswerOpen && item.answer ? (
										<View style={styles.faqAnswerContainer}>
											<HyperlinkText text={item.answer} style={styles.faqAnswerText} />
										</View>
									) : null}
								</View>
							);
						})}
					</View>
				</View>
			</ScrollView>
		</View>
	);
}

const styles = StyleSheet.create({
	screenContainer: {
		flex: 1,
		backgroundColor: "#F7F8FC",
	},
	header: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingHorizontal: 16,
		paddingTop: 8,
		paddingBottom: 2,
		backgroundColor: "#F7F8FC",
	},
	headerLeft: {
		flexDirection: "row",
		alignItems: "center",
	},
	backButton: {
		padding: 4,
		marginRight: 10,
	},
	headerTitle: {
		fontSize: 22,
		fontWeight: "800",
		color: "#14201A",
		fontFamily: Platform.select({ ios: "System", android: "sans-serif" }),
	},
	menuButton: {
		padding: 4,
	},
	scrollView: {
		flex: 1,
	},
	scrollContent: {
		paddingBottom: 80,
	},
	bannerWrapper: {
		width: "100%",
		position: "relative",
		marginBottom: 18,
	},
	supportBannerCard: {
		backgroundColor: "#EEF2FF",
		justifyContent: "center",
	},
	supportBannerLeft: {
		zIndex: 10,
	},
	contactSupportTitle: {
		fontSize: 14.5,
		fontWeight: "800",
		color: "#1E293B",
		marginBottom: 10,
		fontFamily: Platform.select({ ios: "System", android: "sans-serif" }),
	},
	phonePill: {
		backgroundColor: "#FFFFFF",
		borderRadius: 22,
		paddingHorizontal: 12,
		paddingVertical: 7,
		flexDirection: "row",
		alignItems: "center",
		alignSelf: "flex-start",
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.06,
		shadowRadius: 3,
		elevation: 2,
	},
	phoneNumberText: {
		fontSize: 13,
		fontWeight: "700",
		color: "#1E293B",
		marginLeft: 6,
		fontFamily: Platform.select({ ios: "System", android: "sans-serif" }),
	},
	availableTitle: {
		fontSize: 12.5,
		fontWeight: "700",
		color: "#1E293B",
		marginTop: 10,
		marginBottom: 2,
		fontFamily: Platform.select({ ios: "System", android: "sans-serif" }),
	},
	availableText: {
		fontSize: 12,
		color: "#475569",
		lineHeight: 16,
		fontFamily: Platform.select({ ios: "System", android: "sans-serif" }),
	},
	mascotGroup: {
		position: "absolute",
		right: 0,
		bottom: 0,
		zIndex: 20,
	},
	headsetIcon: {
		position: "absolute",
		zIndex: 25,
	},
	officeContainer: {
		marginHorizontal: 16,
		marginBottom: 16,
	},
	officePill: {
		backgroundColor: "#FFFFFF",
		borderRadius: 14,
		borderWidth: 1,
		borderColor: "#E5E7EB",
		paddingHorizontal: 12,
		paddingVertical: 6,
		flexDirection: "row",
		alignItems: "center",
		alignSelf: "flex-start",
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.04,
		shadowRadius: 2,
		elevation: 1,
	},
	officePillText: {
		fontSize: 11.5,
		fontWeight: "700",
		color: "#14201A",
		marginLeft: 6,
		lineHeight: 14,
		fontFamily: Platform.select({ ios: "System", android: "sans-serif" }),
	},
	officeAddress: {
		fontSize: 12.5,
		color: "#334155",
		lineHeight: 18,
		marginTop: 8,
		paddingLeft: 46,
		fontFamily: Platform.select({ ios: "System", android: "sans-serif" }),
	},
	contactActionsContainer: {
		marginHorizontal: 16,
		marginBottom: 16,
		gap: 10,
	},
	actionCard: {
		backgroundColor: "#FFFFFF",
		borderRadius: 16,
		borderWidth: 1,
		borderColor: "#E5E7EB",
		paddingHorizontal: 16,
		paddingVertical: 14,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.03,
		shadowRadius: 3,
		elevation: 1,
	},
	actionCardLeft: {
		flexDirection: "row",
		alignItems: "center",
	},
	actionCardText: {
		fontSize: 14.5,
		fontWeight: "700",
		color: "#14201A",
		marginLeft: 12,
		fontFamily: Platform.select({ ios: "System", android: "sans-serif" }),
	},
	faqSection: {
		marginTop: 8,
	},
	faqTitle: {
		fontSize: 20,
		fontWeight: "800",
		color: "#14201A",
		marginHorizontal: 16,
		marginBottom: 12,
		fontFamily: Platform.select({ ios: "System", android: "sans-serif" }),
	},
	searchBarWrapper: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: "#FFFFFF",
		borderRadius: 12,
		borderWidth: 1,
		borderColor: "#E5E7EB",
		marginHorizontal: 16,
		marginBottom: 14,
		paddingHorizontal: 12,
		height: 46,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.02,
		shadowRadius: 2,
		elevation: 1,
	},
	searchIcon: {
		marginRight: 8,
	},
	searchInput: {
		flex: 1,
		fontSize: 13.5,
		color: "#14201A",
		paddingVertical: 0,
		fontFamily: Platform.select({ ios: "System", android: "sans-serif" }),
	},
	categoriesContainer: {
		paddingHorizontal: 16,
		gap: 8,
		marginBottom: 16,
	},
	categoryPill: {
		borderRadius: 20,
		paddingHorizontal: 16,
		paddingVertical: 8,
		justifyContent: "center",
		alignItems: "center",
	},
	categoryPillActive: {
		backgroundColor: "#448008",
	},
	categoryPillInactive: {
		backgroundColor: "#FFFFFF",
		borderWidth: 1,
		borderColor: "#E5E7EB",
	},
	categoryPillText: {
		fontSize: 13,
		fontFamily: Platform.select({ ios: "System", android: "sans-serif" }),
	},
	categoryPillTextActive: {
		fontWeight: "700",
		color: "#FFFFFF",
	},
	categoryPillTextInactive: {
		fontWeight: "600",
		color: "#374151",
	},
	faqCardContainer: {
		backgroundColor: "#FFFFFF",
		borderWidth: 1,
		borderColor: "#E2E8F0",
		borderRadius: 8,
		marginHorizontal: 16,
		overflow: "hidden",
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.03,
		shadowRadius: 3,
		elevation: 1,
	},
	faqItemWrapper: {
		backgroundColor: "#FFFFFF",
	},
	faqItemBorderBottom: {
		borderBottomWidth: 1,
		borderBottomColor: "#EEF2ED",
	},
	faqQuestionRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingHorizontal: 16,
		paddingVertical: 15,
	},
	faqQuestionText: {
		flex: 1,
		fontSize: 15,
		fontWeight: "400",
		color: "#2D3748",
		marginRight: 12,
		lineHeight: 20,
		fontFamily: Platform.select({ ios: "System", android: "sans-serif" }),
	},
	faqQuestionTextActive: {
		fontWeight: "700",
		color: "#14201A",
	},
	faqAnswerContainer: {
		paddingHorizontal: 16,
		paddingBottom: 16,
		paddingTop: 2,
		backgroundColor: "#FFFFFF",
	},
	faqAnswerText: {
		fontSize: 13.5,
		color: "#475569",
		lineHeight: 20,
		fontFamily: Platform.select({ ios: "System", android: "sans-serif" }),
	},
});
