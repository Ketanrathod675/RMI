import { TranslatedText } from "@/components/TranslatedText";
import { dark, white } from "@/constants/Colors";
import { useDefault } from "@/hooks/useDefault";
import { useNetworkAwareQuery } from "@/hooks/useNetworkAwareQuery";
import { useTranslation } from "@/hooks/useTranslation";
import { LANGUAGES, type Languages } from "@/store";
import { getUserDashboardData, getUserProfile, getUserFeedback, saveFeedback } from "@/utils/api";
import { fetchSelfie } from "@/utils/api/kyc";
import { font, height, width } from "@/utils/dimensions";
import { MaterialIcons } from "@expo/vector-icons";
import { router, useFocusEffect, useNavigation } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useRef, useState } from "react";
import {
	ActivityIndicator,
	Animated,
	BackHandler,
	Dimensions,
	Image,
	Modal,
	Platform,
	Pressable,
	ScrollView,
	StatusBar as RNStatusBar,
	StyleSheet,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from "react-native";
import Toast from "react-native-toast-message";

interface MenuItem {
	title: string;
	icon: keyof typeof MaterialIcons.glyphMap;
	onPress: () => void;
}

const { height: screenHeight } = Dimensions.get("window");

export default function Profile() {
	const navigation = useNavigation();
	const [modalVisible, setModalVisible] = useState(false);
	const [rating, setRating] = useState(0);
	const [feedback, setFeedback] = useState("");
	const [existingFeedbackId, setExistingFeedbackId] = useState<string | null>(null);
	const [isAlreadyRated, setIsAlreadyRated] = useState(false);
	const [isEditingFeedback, setIsEditingFeedback] = useState(false);
	const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
	const [isLoadingFeedback, setIsLoadingFeedback] = useState(false);
	const [isNavigating, setIsNavigating] = useState(false);
	const { t } = useTranslation();
	const { setLanguage } = useDefault();

	// Language selection modal state
	const [showLanguageModal, setShowLanguageModal] = useState(false);
	const [searchText, setSearchText] = useState("");
	const slideAnim = useRef(new Animated.Value(screenHeight)).current;
	const backgroundOpacity = useRef(new Animated.Value(0)).current;

	// Rate Us modal animation state
	const rateSlideAnim = useRef(new Animated.Value(screenHeight)).current;
	const rateBackgroundOpacity = useRef(new Animated.Value(0)).current;

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
		if (selfieData?.selfie_url) {
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

	// Ensure system status bar is visible (dark icons over white header) when Profile is focused
	useFocusEffect(
		React.useCallback(() => {
			RNStatusBar.setBarStyle("dark-content");
			if (Platform.OS === "android") {
				RNStatusBar.setBackgroundColor("transparent");
				RNStatusBar.setTranslucent(true);
			}
		}, []),
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

	const openRateModal = async () => {
		setIsEditingFeedback(false);
		setModalVisible(true);
		rateBackgroundOpacity.setValue(0);
		rateSlideAnim.setValue(screenHeight);

		Animated.timing(rateBackgroundOpacity, {
			toValue: 1,
			duration: 200,
			useNativeDriver: true,
		}).start(() => {
			Animated.timing(rateSlideAnim, {
				toValue: 0,
				duration: 280,
				useNativeDriver: true,
			}).start();
		});

		// Fetch existing review if not already cached
		try {
			setIsLoadingFeedback(true);
			const currentUserId = userProfile?.id || userProfile?.user_id || (userProfile as any)?.uuid;
			const existing = await getUserFeedback(currentUserId);
			if (existing) {
				setExistingFeedbackId(existing.id);
				setRating(existing.rating);
				setFeedback(existing.feedback || "");
				setIsAlreadyRated(true);
			}
		} catch (_err) {
			// Non-blocking fallback
		} finally {
			setIsLoadingFeedback(false);
		}
	};

	const handleCloseModal = () => {
		if (isSubmittingFeedback) return;
		Animated.timing(rateSlideAnim, {
			toValue: screenHeight,
			duration: 250,
			useNativeDriver: true,
		}).start(() => {
			Animated.timing(rateBackgroundOpacity, {
				toValue: 0,
				duration: 200,
				useNativeDriver: true,
			}).start(() => {
				setModalVisible(false);
				setIsEditingFeedback(false);
				if (!isAlreadyRated) {
					setRating(0);
					setFeedback("");
					setExistingFeedbackId(null);
				}
			});
		});
	};

	const handleSubmitFeedback = async () => {
		if (rating === 0) {
			Toast.show({
				type: "error",
				text1: "Rating Required",
				text2: "Please tap the stars to select a rating.",
			});
			return;
		}

		if (!feedback.trim()) {
			Toast.show({
				type: "error",
				text1: "Feedback Required",
				text2: "Please enter your feedback.",
			});
			return;
		}

		try {
			setIsSubmittingFeedback(true);
			const currentUserId = userProfile?.id || userProfile?.user_id || (userProfile as any)?.uuid;
			const saved = await saveFeedback(
				{
					rating,
					feedback: feedback.trim(),
					is_recommended: rating >= 4,
				},
				existingFeedbackId,
				currentUserId,
			);

			if (saved?.id) {
				setExistingFeedbackId(saved.id);
			}
			setIsAlreadyRated(true);
			setIsEditingFeedback(false);
			refetchUserFeedback?.();

			Toast.show({
				type: "success",
				text1: "Thank You!",
				text2: "Your feedback has been submitted successfully.",
			});
		} catch (error: any) {
			const errorMsg =
				error?.response?.data?.detail ||
				error?.message ||
				"Failed to submit feedback. Please try again.";
			Toast.show({
				type: "error",
				text1: "Submission Failed",
				text2: typeof errorMsg === "string" ? errorMsg : "Please try again later.",
			});
		} finally {
			setIsSubmittingFeedback(false);
		}
	};

	const menuItems: MenuItem[] = [
		{
			title: t("loanDetails"),
			icon: "currency-rupee",
			onPress: () => router.push("/loan-details" as any),
		},
		{
			title: t("loanHistory"),
			icon: "receipt-long",
			onPress: () => router.push("/(tabs)/history" as any),
		},
		{
			title: t("bankDetails"),
			icon: "account-balance",
			onPress: () => router.push("/bank-details-settings" as any),
		},
		{
			title: t("lendingPartners"),
			icon: "business",
			onPress: () => router.push("/lending-partners" as any),
		},
		{
			title: t("notifications"),
			icon: "notifications-none",
			onPress: () => router.push("/notification-settings" as any),
		},
		{
			title: t("accountSecurity"),
			icon: "verified-user",
			onPress: () => router.push("/personal-details" as any),
		},
		{
			title: t("selectLanguage"),
			icon: "language",
			onPress: () => setShowLanguageModal(true),
		},
		{
			title: t("helpSupport"),
			icon: "help-outline",
			onPress: () => router.push("/help-support" as any),
		},
		{
			title: t("rateUs"),
			icon: "star-outline",
			onPress: openRateModal,
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

	// Fetch user existing feedback status
	const currentUserId =
		userProfile?.id ||
		userProfile?.user_id ||
		(userProfile as any)?.uuid ||
		(dashboardData as any)?.user?.id ||
		(dashboardData as any)?.user?.uuid ||
		(dashboardData as any)?.user_id;
	const { data: userFeedbackData, refetch: refetchUserFeedback } = useNetworkAwareQuery({
		queryKey: ["userFeedback", currentUserId],
		queryFn: () => getUserFeedback(currentUserId),
		enabled: !!currentUserId,
	});

	useEffect(() => {
		if (userFeedbackData) {
			setExistingFeedbackId(userFeedbackData.id);
			setRating(userFeedbackData.rating);
			setFeedback(userFeedbackData.feedback || "");
			setIsAlreadyRated(true);
		}
	}, [userFeedbackData]);

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
			<StatusBar style="dark" />
			{/* User Profile Card */}
			<View style={styles.profileCardWrapper}>
				<TouchableOpacity
					style={styles.profileCard}
					onPress={() => router.push("/personal-details" as any)}
					activeOpacity={0.8}>
					{/* Avatar */}
					<View style={styles.avatarContainer}>
						{selfieUri ? (
							<Image source={{ uri: selfieUri }} style={styles.profileImage} />
						) : (
							<MaterialIcons name="person" size={38} color="#D97706" />
						)}
					</View>

					{/* User Info */}
					<View style={styles.userInfo}>
						<Text style={styles.userName} numberOfLines={1}>
							{userProfile?.personal_details?.full_name ?? t("user")}
						</Text>
						<View style={styles.phoneRow}>
							<MaterialIcons name="call" size={14} color="#16A34A" />
							<Text style={styles.userPhone}>
								{userProfile?.phone_number
									? userProfile.phone_number.startsWith("+91")
										? userProfile.phone_number
										: `+91 - ${userProfile.phone_number}`
									: ""}
							</Text>
						</View>
					</View>

					{/* Circular Right Chevron Button */}
					<View style={styles.chevronCircle}>
						<MaterialIcons name="chevron-right" size={24} color="#0F172A" />
					</View>
				</TouchableOpacity>
			</View>

			{/* Section Header */}
			<View style={styles.sectionHeaderWrapper}>
				<Text style={styles.sectionTitle}>{t("settings")}</Text>
				<Text style={styles.optionsCount}>
					{menuItems.length} {t("options") || "options"}
				</Text>
			</View>

			{/* Menu Items Card */}
			<View style={styles.menuWrapper}>
				<View style={styles.listCard}>
					{menuItems.map((item, index) => {
						const isLast = index === menuItems.length - 1;
						return (
							<React.Fragment key={index}>
								<TouchableOpacity
									style={styles.menuItem}
									onPress={() => {
										if (isNavigating) return;
										setIsNavigating(true);

										item.onPress();

										setTimeout(() => setIsNavigating(false), 400);
									}}
									activeOpacity={0.6}>
									<View style={styles.menuLeft}>
										<View style={styles.iconWrapper}>
											<MaterialIcons
												name={item.icon}
												size={22}
												color="#1E293B"
											/>
										</View>
										<Text style={styles.menuTitle}>{item.title}</Text>
									</View>
									<MaterialIcons name="chevron-right" size={22} color="#94A3B8" />
								</TouchableOpacity>
								{!isLast && <View style={styles.divider} />}
							</React.Fragment>
						);
					})}
				</View>
			</View>

			{/* Review & Feedback Modal */}
			<Modal
				visible={modalVisible}
				transparent={true}
				animationType="none"
				onRequestClose={handleCloseModal}>
				<Animated.View
					style={[
						styles.modalOverlay,
						{
							opacity: rateBackgroundOpacity,
						},
					]}>
					<Pressable style={styles.modalOverlayPressable} onPress={handleCloseModal}>
						<Animated.View
							style={[
								styles.modalContainer,
								{
									transform: [{ translateY: rateSlideAnim }],
								},
							]}>
							<Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
								{/* Modal Header Line */}
								<View style={styles.modalHeaderLine} />

								{isAlreadyRated && !isEditingFeedback ? (
									/* Thanks for your rating view */
									<View style={styles.thankYouContainer}>
										<View style={styles.thankYouIconBox}>
											<MaterialIcons name="stars" size={48} color="#FFD700" />
										</View>

										<TranslatedText
											style={styles.thankYouTitle}
											translationKey="thanksForYourRating"
										/>

										<TranslatedText
											style={styles.thankYouSubtitle}
											translationKey="thanksForRatingDesc"
										/>

										{/* Stars given */}
										<View style={styles.thankYouStarsContainer}>
											{[...Array(5)].map((_, index) => (
												<Text
													key={index}
													style={[
														styles.thankYouStar,
														index < rating ? styles.filledStar : styles.emptyStar,
													]}>
													★
												</Text>
											))}
										</View>

										{/* Submitted feedback text if available */}
										{feedback ? (
											<View style={styles.feedbackQuoteBox}>
												<Text style={styles.feedbackQuoteText}>"{feedback}"</Text>
											</View>
										) : null}

										{/* Done button */}
										<TouchableOpacity
											style={styles.submitButton}
											onPress={handleCloseModal}
											activeOpacity={0.85}>
											<TranslatedText
												style={styles.submitButtonText}
												translationKey="done"
											/>
										</TouchableOpacity>

										{/* Update Rating button */}
										<TouchableOpacity
											style={styles.updateRatingButton}
											onPress={() => setIsEditingFeedback(true)}
											activeOpacity={0.7}>
											<MaterialIcons name="edit" size={16} color="#09A143" />
											<TranslatedText
												style={styles.updateRatingButtonText}
												translationKey="updateRating"
											/>
										</TouchableOpacity>
									</View>
								) : (
									/* Editable Rating & Feedback View */
									<View>
										{/* Title */}
										<TranslatedText
											style={styles.modalTitle}
											translationKey={isEditingFeedback ? "updateYourFeedback" : "reviewFeedback"}
										/>

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
											editable={!isSubmittingFeedback}
										/>

										{/* Submit Button */}
										<TouchableOpacity
											style={[
												styles.submitButton,
												(isSubmittingFeedback || rating === 0) && styles.submitButtonDisabled,
											]}
											onPress={handleSubmitFeedback}
											disabled={isSubmittingFeedback || rating === 0}>
											{isSubmittingFeedback ? (
												<ActivityIndicator size="small" color="#000000" />
											) : (
												<TranslatedText
													style={styles.submitButtonText}
													translationKey={isEditingFeedback ? "updateRating" : "submit"}
												/>
											)}
										</TouchableOpacity>

										{/* Cancel Editing button if in edit mode */}
										{isEditingFeedback && isAlreadyRated && (
											<TouchableOpacity
												style={styles.cancelEditButton}
												onPress={() => setIsEditingFeedback(false)}>
												<Text style={styles.cancelEditText}>Cancel</Text>
											</TouchableOpacity>
										)}
									</View>
								)}
							</Pressable>
						</Animated.View>
					</Pressable>
				</Animated.View>
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
		backgroundColor: "#F8FAFC",
	},
	profileCardWrapper: {
		marginHorizontal: width(4),
		marginTop: height(1.8),
		marginBottom: height(0.8),
	},
	profileCard: {
		backgroundColor: white,
		borderRadius: 20,
		paddingHorizontal: width(4.5),
		paddingVertical: height(2),
		flexDirection: "row",
		alignItems: "center",
		borderWidth: 1,
		borderColor: "#F1F5F9",
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.04,
		shadowRadius: 8,
		elevation: 2,
	},
	avatarContainer: {
		width: 58,
		height: 58,
		borderRadius: 29,
		backgroundColor: "#FEF08A",
		justifyContent: "center",
		alignItems: "center",
		overflow: "hidden",
		borderWidth: 1,
		borderColor: "#FDE047",
	},
	profileImage: {
		width: 58,
		height: 58,
		borderRadius: 29,
	},
	userInfo: {
		flex: 1,
		marginLeft: width(3.5),
	},
	userName: {
		fontSize: font(2.1),
		fontWeight: "700",
		color: "#0F172A",
		marginBottom: 4,
	},
	phoneRow: {
		flexDirection: "row",
		alignItems: "center",
	},
	userPhone: {
		fontSize: font(1.6),
		fontWeight: "500",
		color: "#64748B",
		marginLeft: 6,
	},
	chevronCircle: {
		width: 36,
		height: 36,
		borderRadius: 18,
		backgroundColor: "#F1F5F9",
		justifyContent: "center",
		alignItems: "center",
	},
	sectionHeaderWrapper: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		marginHorizontal: width(4.5),
		marginTop: height(2),
		marginBottom: height(1.2),
	},
	sectionTitle: {
		fontSize: font(2.1),
		fontWeight: "700",
		color: "#0F172A",
	},
	optionsCount: {
		fontSize: font(1.5),
		fontWeight: "500",
		color: "#64748B",
	},
	menuWrapper: {
		marginHorizontal: width(4),
		paddingBottom: height(3),
	},
	listCard: {
		backgroundColor: white,
		borderRadius: 20,
		borderWidth: 1,
		borderColor: "#F1F5F9",
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.04,
		shadowRadius: 8,
		elevation: 2,
		overflow: "hidden",
	},
	menuItem: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingVertical: height(1.8),
		paddingHorizontal: width(4),
	},
	menuLeft: {
		flexDirection: "row",
		alignItems: "center",
		flex: 1,
	},
	iconWrapper: {
		width: 44,
		height: 44,
		borderRadius: 12,
		backgroundColor: "#F8FAFC",
		justifyContent: "center",
		alignItems: "center",
		marginRight: 14,
		borderWidth: 1,
		borderColor: "#F1F5F9",
	},
	menuTitle: {
		fontSize: font(1.8),
		fontWeight: "600",
		color: "#1E293B",
	},
	divider: {
		height: 1,
		backgroundColor: "#F1F5F9",
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
	submitButtonDisabled: {
		opacity: 0.6,
	},
	submitButtonText: {
		fontSize: 18,
		fontWeight: "600",
		color: "#000000",
	},
	thankYouContainer: {
		alignItems: "center",
		paddingVertical: height(1),
	},
	thankYouIconBox: {
		width: 72,
		height: 72,
		borderRadius: 36,
		backgroundColor: "#FEF9C3",
		alignItems: "center",
		justifyContent: "center",
		marginBottom: height(1.5),
	},
	thankYouTitle: {
		fontSize: font(2.4),
		fontWeight: "700",
		color: "#1E293B",
		textAlign: "center",
		marginBottom: height(0.8),
	},
	thankYouSubtitle: {
		fontSize: font(1.4),
		color: "#64748B",
		textAlign: "center",
		lineHeight: font(2.0),
		paddingHorizontal: width(4),
		marginBottom: height(2),
	},
	thankYouStarsContainer: {
		flexDirection: "row",
		justifyContent: "center",
		gap: 6,
		marginBottom: height(2),
	},
	thankYouStar: {
		fontSize: 28,
	},
	feedbackQuoteBox: {
		backgroundColor: "#F8FAFC",
		borderWidth: 1,
		borderColor: "#E2E8F0",
		borderRadius: 12,
		paddingHorizontal: width(4),
		paddingVertical: height(1.5),
		width: "100%",
		marginBottom: height(2.5),
	},
	feedbackQuoteText: {
		fontSize: font(1.4),
		color: "#334155",
		fontStyle: "italic",
		textAlign: "center",
		lineHeight: font(2.0),
	},
	updateRatingButton: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 6,
		marginTop: height(1.5),
		paddingVertical: height(1),
	},
	updateRatingButtonText: {
		fontSize: font(1.5),
		fontWeight: "600",
		color: "#4D7C0F",
	},
	cancelEditButton: {
		alignItems: "center",
		marginTop: height(1.2),
		paddingVertical: height(0.8),
	},
	cancelEditText: {
		fontSize: font(1.5),
		color: "#64748B",
		fontWeight: "500",
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
