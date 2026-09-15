import { TranslatedText } from "@/components/TranslatedText";
import { IconSymbol } from "@/components/ui/IconSymbol";
import { dark, primary, white } from "@/constants/Colors";
import { Images } from "@/constants/images";
import { useDefault } from "@/hooks/useDefault";
import { useNetworkAwareQuery } from "@/hooks/useNetworkAwareQuery";
import { useTranslation } from "@/hooks/useTranslation";
import { LANGUAGES, type Languages } from "@/store";
import { getUserDashboardData, getUserProfile } from "@/utils/api";
import { fetchSelfie } from "@/utils/api/kyc";
import { font, height, width } from "@/utils/dimensions";
import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect, useNavigation } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
	Animated,
	BackHandler,
	Dimensions,
	Image,
	Modal,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from "react-native";

interface MenuItem {
	title: string;
	icon: keyof typeof ICON_MAPPING;
	onPress: () => void;
}

const ICON_MAPPING = {
	"loan-details": "description",
	"loan-history": "arrow.clockwise.circle",
	"bank-account": "account-balance",
	notification: "bell",
	"account-security": "security",
	"app-appearance": "local-offer",
	"help-support": "gift.fill",
	"rate-us": "account-balance-wallet",
	phone: "phone",
	language: "globe.americas",
	"lending-partners": "business",
} as const;

const { height: screenHeight } = Dimensions.get("window");

export default function Profile() {
	const navigation = useNavigation();
	const [modalVisible, setModalVisible] = useState(false);
	const [rating, setRating] = useState(0);
	const [feedback, setFeedback] = useState("");
	const [isNavigating, setIsNavigating] = useState(false);
	const { t } = useTranslation();
	const { setLanguage } = useDefault();

	// Language selection modal state
	const [showLanguageModal, setShowLanguageModal] = useState(false);
	const [searchText, setSearchText] = useState("");
	const slideAnim = useRef(new Animated.Value(screenHeight)).current;
	const backgroundOpacity = useRef(new Animated.Value(0)).current;

	// Selfie state
	const [selfieUri, setSelfieUri] = useState<string | null>(null);

	// Fetch selfie from API
	const {
		data: selfieData,
		isLoading: isSelfieLoading,
		refetch: refetchSelfie,
	} = useNetworkAwareQuery({
		queryKey: ["userSelfie"],
		queryFn: fetchSelfie,
		retry: 1,
	});

	// Update selfie URI when data is fetched from API only
	useEffect(() => {
		console.log("🔍 Selfie data from API:", selfieData);
		if (selfieData?.selfie_url) {
			console.log("📸 Setting selfie from API:", selfieData.selfie_url);
			setSelfieUri(selfieData.selfie_url);
		} else {
			setSelfieUri(null);
		}
	}, [selfieData]);

	// Reload selfie when screen comes into focus
	useFocusEffect(
		React.useCallback(() => {
			refetchSelfie();
		}, [refetchSelfie]),
	);

	// Handle back press - navigate to dashboard
	useFocusEffect(
		React.useCallback(() => {
			const backHandler = BackHandler.addEventListener("hardwareBackPress", () => {
				if (!navigation.isFocused()) {
					return false;
				}
				router.push("/(tabs)");
				return true;
			});

			return () => {
				backHandler.remove();
			};
		}, [navigation]),
	);

	// Auto-show language modal on component mount
	useEffect(() => {
		if (!showLanguageModal) return;

		const timer = setTimeout(() => {
			setShowLanguageModal(true);

			Animated.timing(backgroundOpacity, {
				toValue: 1,
				duration: 200,
				useNativeDriver: true,
			}).start(() => {
				setTimeout(() => {
					Animated.timing(slideAnim, {
						toValue: 0,
						duration: 300,
						useNativeDriver: true,
					}).start();
				}, 80);
			});
		}, 100);

		return () => clearTimeout(timer);
	}, [showLanguageModal, backgroundOpacity, slideAnim]);

	const handleStarPress = (starIndex: number) => {
		setRating(starIndex + 1);
	};

	const handleSubmitFeedback = () => {
		console.log("Rating:", rating, "Feedback:", feedback);
		setModalVisible(false);
		setRating(0);
		setFeedback("");
	};

	const handleCloseModal = () => {
		setModalVisible(false);
		setRating(0);
		setFeedback("");
	};

	const menuItems: MenuItem[] = [
		{
			title: t("loanDetails"),
			icon: "loan-details",
			onPress: () => router.push("/loan-details" as any),
		},
		{
			title: t("loanHistory"),
			icon: "loan-history",
			onPress: () => router.push("/loan-history" as any),
		},
		{
			title: t("lendingPartners"),
			icon: "lending-partners",
			onPress: () => router.push("/lending-partners" as any),
		},
		{
			title: t("bankDetails"),
			icon: "bank-account",
			onPress: () => router.push("/bank-details-settings" as any),
		},
		{
			title: t("notifications"),
			icon: "notification",
			onPress: () => router.push("/notification-settings" as any),
		},
		{
			title: t("selectLanguage"),
			icon: "language",
			onPress: () => setShowLanguageModal(true),
		},
		{
			title: t("helpSupport"),
			icon: "help-support",
			onPress: () => router.push("/help-support" as any),
		},
		{
			title: t("rateUs"),
			icon: "rate-us",
			onPress: () => setModalVisible(true),
		},
	];

	// Fetch user profile data
	const {
		data: userProfile,
		isLoading: _isLoading,
		error: _error,
	} = useNetworkAwareQuery({
		queryKey: ["userProfile"],
		queryFn: getUserProfile,
	});

	// Fetch dashboard data
	const {
		data: dashboardData,
		isLoading: isDashboardLoading,
	} = useNetworkAwareQuery({
		queryKey: ["userDashboard"],
		queryFn: () => getUserDashboardData(),
	});

	useEffect(() => {
		if (userProfile?.customer_id) {
			refetchSelfie();
		}
	}, [userProfile?.customer_id, refetchSelfie]);

	const handleLanguageSelect = async (lang: Languages) => {
		await setLanguage(lang);
		hideLanguageModal();
	};

	const hideLanguageModal = () => {
		Animated.timing(slideAnim, {
			toValue: screenHeight,
			duration: 250,
			useNativeDriver: true,
		}).start(() => {
			Animated.timing(backgroundOpacity, {
				toValue: 0,
				duration: 200,
				useNativeDriver: true,
			}).start(() => {
				setShowLanguageModal(false);
				setSearchText("");
			});
		});
	};

	// Filter languages based on search text
	const filteredLanguages = LANGUAGES.filter((lang) =>
		lang.label.toLowerCase().includes(searchText.toLowerCase()),
	);

	return (
		<ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
			{/* User Profile Card */}
			<View style={styles.profileCardWrapper}>
				<LinearGradient
					colors={["#1a2332", "#2d3748"]}
					start={{ x: 0, y: 0 }}
					end={{ x: 1, y: 0 }}
					style={styles.profileCard}>
					{/* Pattern Overlay */}
					<View style={styles.patternOverlay}>
						<Image
							source={Images.BLUE_BG_WAVES}
							style={styles.patternImage}
							resizeMode="cover"
						/>
					</View>

					{/* Profile Content */}
					<TouchableOpacity
						style={styles.profileSection}
						onPress={() => router.push("/personal-details" as any)}>
						{selfieUri ? (
							<Image source={{ uri: selfieUri }} style={styles.profileImage} />
						) : (
							<MaterialIcons name="person" size={60} color="#999" />
						)}
						<View style={styles.userInfo}>
							<Text style={styles.userName}>
								{userProfile?.personal_details?.full_name ?? t("user")}
							</Text>
							<View style={styles.phoneRow}>
								<IconSymbol name="phone" size={14} color={primary} />
								<Text style={styles.userPhone}>
									{userProfile?.phone_number ?? ""}
								</Text>
							</View>
						</View>
						<IconSymbol name="chevron.right" size={20} color={white} />
					</TouchableOpacity>
				</LinearGradient>
			</View>

			{/* Menu Items */}
			<View style={styles.menuWrapper}>
				{menuItems.map((item, index) => (
					<TouchableOpacity
						key={index}
						style={styles.menuItem}
						onPress={() => {
							if (isNavigating) return;
							setIsNavigating(true);

							item.onPress();

							setTimeout(() => setIsNavigating(false), 400);
						}}
						activeOpacity={0.7}>
						<View style={styles.menuItemContent}>
							<View style={styles.menuLeft}>
								<View style={styles.iconWrapper}>
									<IconSymbol
										name={ICON_MAPPING[item.icon]}
										size={26}
										color="#666"
									/>
								</View>
								<Text style={styles.menuTitle}>{item.title}</Text>
							</View>
							<IconSymbol name="chevron.right" size={25} color="#999" />
						</View>
					</TouchableOpacity>
				))}
			</View>

			{/* Review & Feedback Modal */}
			<Modal
				visible={modalVisible}
				transparent={true}
				animationType="slide"
				onRequestClose={handleCloseModal}>
				<TouchableOpacity
					style={styles.modalOverlay}
					activeOpacity={1}
					onPress={handleCloseModal}>
					<TouchableOpacity
						style={styles.modalContent}
						activeOpacity={1}
						onPress={(e) => e.stopPropagation()}>
						{/* Modal Header Line */}
						<View style={styles.modalHeaderLine} />

						{/* Title */}
						<TranslatedText style={styles.modalTitle} translationKey="reviewFeedback" />

						{/* Rating Section */}
						<TranslatedText
							style={styles.ratingQuestion}
							translationKey="howWouldYouRate"
						/>
						<View style={styles.starsContainer}>
							{[...Array(5)].map((_, index) => (
								<TouchableOpacity
									key={index}
									onPress={() => handleStarPress(index)}
									style={styles.starButton}>
									<Text
										style={[
											styles.star,
											index < rating ? styles.filledStar : styles.emptyStar,
										]}>
										★
									</Text>
								</TouchableOpacity>
							))}
						</View>

						{/* Feedback Section */}
						<TranslatedText
							style={styles.feedbackLabel}
							translationKey="tellUsWhatYouThink"
						/>

						{/* Text Input */}
						<TextInput
							style={styles.feedbackInput}
							placeholder={t("enterFeedback")}
							placeholderTextColor="#999"
							multiline={true}
							numberOfLines={4}
							value={feedback}
							onChangeText={setFeedback}
							textAlignVertical="top"
						/>

						{/* Submit Button */}
						<TouchableOpacity
							style={styles.submitButton}
							onPress={handleSubmitFeedback}>
							<TranslatedText
								style={styles.submitButtonText}
								translationKey="submit"
							/>
						</TouchableOpacity>
					</TouchableOpacity>
				</TouchableOpacity>
			</Modal>

			{/* Language Selection Modal */}
			<Modal
				visible={showLanguageModal}
				transparent={true}
				animationType="none"
				onRequestClose={hideLanguageModal}>
				<Animated.View
					style={[
						styles.modalOverlay,
						{
							opacity: backgroundOpacity,
						},
					]}>
					<Pressable style={styles.modalOverlayPressable} onPress={hideLanguageModal}>
						<Animated.View
							style={[
								styles.modalContainer,
								{
									transform: [{ translateY: slideAnim }],
								},
							]}>
							<Pressable style={styles.langModalContent}>
								{/* Modal Handle */}
								<View style={styles.modalHandle} />

								{/* Title */}
								<Text style={styles.langModalTitle}>Select Language</Text>

								{/* Search Box */}
								<View style={styles.searchContainer}>
									<MaterialIcons
										name="search"
										size={20}
										color="#999"
										style={styles.searchIcon}
									/>
									<TextInput
										style={styles.searchInput}
										placeholder={t("searchLanguage")}
										value={searchText}
										onChangeText={setSearchText}
										placeholderTextColor="#999"
									/>
								</View>

								{/* Language Options */}
								<View style={styles.languageList}>
									{filteredLanguages.map((lang) => (
										<TouchableOpacity
											key={lang.key}
											style={styles.languageOption}
											disabled={lang.disabled ?? false}
											activeOpacity={0.7}
											onPress={() => handleLanguageSelect(lang.key)}>
											<View style={styles.languageTextWrap}>
												<Text style={styles.languageLabel}>
													{lang.label}
												</Text>
												<Text style={styles.languageSub}>{lang.sub}</Text>
											</View>
										</TouchableOpacity>
									))}
									{filteredLanguages.length === 0 && (
										<Text style={styles.noResultsText}>No results found</Text>
									)}
								</View>
							</Pressable>
						</Animated.View>
					</Pressable>
				</Animated.View>
			</Modal>
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: white,
	},
	profileCardWrapper: {
		marginHorizontal: width(5),
		marginTop: height(2),
		marginBottom: height(2),
	},
	profileCard: {
		borderRadius: 20,
		padding: width(5),
		paddingVertical: height(3),
		position: "relative",
		overflow: "hidden",
		elevation: 3,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.1,
		shadowRadius: 4,
	},
	patternOverlay: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		opacity: 0.3,
	},
	patternImage: {
		width: "100%",
		height: "100%",
	},
	profileSection: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		zIndex: 1,
	},
	profileImage: {
		width: width(16),
		height: width(16),
		borderRadius: width(8),
		borderColor: "#FFF5D6",
		backgroundColor: "#FFF5D6",
		borderWidth: 1,
	},
	userInfo: {
		flex: 1,
		marginLeft: width(4),
	},
	userName: {
		fontSize: font(2.4),
		fontWeight: "600",
		color: white,
		marginBottom: height(0.5),
	},
	phoneRow: {
		flexDirection: "row",
		alignItems: "center",
	},
	userPhone: {
		fontSize: font(1.8),
		color: white,
		opacity: 0.9,
		marginLeft: width(1.5),
	},
	menuWrapper: {
		marginHorizontal: width(5),
		paddingBottom: height(2),
	},
	menuItem: {},
	menuItemContent: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingVertical: height(2),
		paddingHorizontal: width(4),
	},
	menuLeft: {
		flexDirection: "row",
		alignItems: "center",
		flex: 1,
	},
	iconWrapper: {
		width: width(11),
		height: width(11),
		borderRadius: width(1),
		backgroundColor: "#f5f5f5",
		justifyContent: "center",
		alignItems: "center",
		marginRight: width(3.5),
	},
	menuTitle: {
		fontSize: font(2),
		color: dark,
		fontWeight: "500",
	},
	modalOverlay: {
		flex: 1,
		backgroundColor: "rgba(0, 0, 0, 0.5)",
		justifyContent: "flex-end",
	},
	modalContent: {
		backgroundColor: "white",
		borderTopLeftRadius: 20,
		borderTopRightRadius: 20,
		paddingHorizontal: width(6),
		paddingTop: height(2),
		paddingBottom: height(4),
		minHeight: height(60),
	},
	modalHeaderLine: {
		width: width(12),
		height: 4,
		backgroundColor: "#E0E0E0",
		borderRadius: 2,
		alignSelf: "center",
		marginBottom: height(3),
	},
	modalTitle: {
		fontSize: 20,
		fontWeight: "600",
		color: "#333",
		textAlign: "center",
		marginBottom: height(4),
	},
	ratingQuestion: {
		fontSize: 16,
		color: "#333",
		marginBottom: height(2),
	},
	starsContainer: {
		flexDirection: "row",
		marginBottom: height(4),
	},
	starButton: {
		marginRight: width(2),
	},
	star: {
		fontSize: 32,
	},
	emptyStar: {
		color: "#E0E0E0",
	},
	filledStar: {
		color: "#FFD700",
	},
	feedbackLabel: {
		fontSize: 14,
		color: "#333",
		marginBottom: height(2),
		lineHeight: 20,
	},
	feedbackInput: {
		borderWidth: 1,
		borderColor: "#E0E0E0",
		borderRadius: 8,
		padding: width(4),
		fontSize: 14,
		color: "#333",
		minHeight: height(12),
		marginBottom: height(4),
	},
	submitButton: {
		backgroundColor: "#A4E65E",
		borderRadius: 25,
		paddingVertical: height(2),
		alignItems: "center",
		width: "100%",
	},
	submitButtonText: {
		fontSize: 18,
		fontWeight: "600",
		color: "#000000",
	},
	modalOverlayPressable: {
		flex: 1,
		justifyContent: "flex-end",
	},
	modalContainer: {
		width: "100%",
		maxHeight: "80%",
	},
	langModalContent: {
		backgroundColor: white,
		borderTopLeftRadius: width(5),
		borderTopRightRadius: width(5),
		paddingHorizontal: 0,
		paddingBottom: height(3),
		shadowColor: "#000",
		shadowOffset: {
			width: 0,
			height: -2,
		},
		shadowOpacity: 0.25,
		shadowRadius: 4,
		elevation: 5,
	},
	modalHandle: {
		width: width(10),
		height: height(0.4),
		backgroundColor: "#E0E0E0",
		borderRadius: width(1),
		alignSelf: "center",
		marginTop: height(1),
		marginBottom: height(2),
	},
	langModalTitle: {
		fontSize: font(2.2),
		fontWeight: "bold",
		color: dark,
		textAlign: "center",
		marginBottom: height(2),
		paddingHorizontal: width(6),
	},
	searchContainer: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: "#F5F5F5",
		borderRadius: width(3),
		marginHorizontal: width(6),
		marginBottom: height(2),
		paddingHorizontal: width(4),
		paddingVertical: height(1),
	},
	searchIcon: {
		marginRight: width(2),
	},
	searchInput: {
		flex: 1,
		fontSize: font(1.6),
		color: "#333",
	},
	languageList: {
		paddingHorizontal: width(6),
		marginBottom: height(2),
	},
	languageOption: {
		backgroundColor: white,
		paddingHorizontal: width(4),
		marginBottom: height(1.5),
		flexDirection: "row",
		alignItems: "center",
	},
	languageTextWrap: {
		flexDirection: "column",
	},
	languageLabel: {
		color: dark,
		fontWeight: "bold",
		fontSize: font(1.8),
	},
	languageSub: {
		color: dark,
		opacity: 0.7,
		fontSize: font(1.4),
		marginTop: 2,
	},
	noResultsText: {
		color: dark,
		fontSize: font(1.4),
		marginBottom: height(2),
		textAlign: "center",
	},
});
