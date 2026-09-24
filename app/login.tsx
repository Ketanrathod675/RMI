import { CustomersIcon } from "@/components/ui/CustomersIcon";
import { IconSymbol } from "@/components/ui/IconSymbol";
import { TranslatedText } from "@/components/TranslatedText";
import { dark, dark_primary, primary, white } from "@/constants/Colors";
import { Images } from "@/constants/images";
import { useAuth } from "@/hooks/useAuth";
import { useDefault } from "@/hooks/useDefault";
import { useNetworkAwareMutation } from "@/hooks/useNetworkAwareMutation";
import { useSignin } from "@/hooks/useSignin";
import { useTranslation } from "@/hooks/useTranslation";
import { Layout01 } from "@/layouts/layout_01";
import { LANGUAGES } from "@/store";
import { Languages } from "@/store/slices/global";
import { errorHandler, login } from "@/utils/api";
import { font, height, width } from "@/utils/dimensions";
import { MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, useFocusEffect, useNavigation, usePathname } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
	ActivityIndicator,
	Alert,
	Animated,
	BackHandler,
	Dimensions,
	Modal,
	Pressable,
	StyleSheet,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from "react-native";
import Toast from "react-native-toast-message";

const { height: screenHeight } = Dimensions.get("window");

const COUNTRY_OPTIONS = [
	{ code: "+91", label: "India", flag: "https://flagcdn.com/w40/in.png" },
];

export default function Login() {
	const [error, setError] = useState("");
	const pathname = usePathname();

	// Modals
	const [showLanguageModal, setShowLanguageModal] = useState(false);
	const [searchText, setSearchText] = useState("");
	const slideAnim = useRef(new Animated.Value(screenHeight)).current;
	const backgroundOpacity = useRef(new Animated.Value(0)).current;

	const [showCountryModal, setShowCountryModal] = useState(false);
	const [countrySearchText, setCountrySearchText] = useState("");
	const countrySlideAnim = useRef(new Animated.Value(screenHeight)).current;
	const countryBackgroundOpacity = useRef(new Animated.Value(0)).current;

	const { setLanguage } = useDefault();
	const { validateMobileAndCountryCode } = useAuth(false);
	const { t } = useTranslation();
	const navigation = useNavigation();

	useFocusEffect(
		React.useCallback(() => {
			const onBackPress = () => {
				Alert.alert(
					t("exitApp"),
					t("areYouSureExitApp"),
					[
						{ text: t("stay"), style: "cancel" },
						{
							text: t("exit"),
							style: "destructive",
							onPress: () => BackHandler.exitApp(),
						},
					],
					{ cancelable: false },
				);
				return true;
			};

			const subscription = BackHandler.addEventListener("hardwareBackPress", onBackPress);
			return () => subscription.remove();
		}, [t])
	);

	const {
		changeCountryCode,
		changePhoneNumber,
		countryCode = "+91",
		phoneNumber,
		changeLoginResponse,
	} = useSignin();

	const [mobile, setMobile] = useState<string>(phoneNumber || "");

	useEffect(() => {
		if (phoneNumber) {
			setMobile(phoneNumber);
		}
	}, [phoneNumber]);

	const { mutate: loginMutation, isPending } = useNetworkAwareMutation({
		mutationFn: login,
		onSuccess: (res) => {
			const signInKey = res?.sign_in_key ?? res?.otp_id;
			if (!signInKey) {
				Toast.show({
					type: "error",
					text1: t("errorOccurredWhileRequestingOTP"),
					text2: t("pleaseTryAgain"),
				});
				return;
			}

			changeLoginResponse(res as any);

			Toast.show({
				type: "success",
				text1: t("otpSentSuccessfully"),
				visibilityTime: 2500,
			});

			router.push({
				pathname: "/signin-otp",
				params: { signInKey },
			});
		},
		onError: (err, variables, ctx) => {
			const { error: errData } = errorHandler(err, variables, ctx);
			Toast.show({
				type: "error",
				text1: t("errorOccurredWhileRequestingOTP"),
				text2: errData?.message ?? t("pleaseTryAgain"),
			});
		},
	});

	const handleRequestOtp = () => {
		if (mobile.length < 10) {
			setError("Phone number must be 10 digits");
			return;
		}

		setError("");
		const validate = validateMobileAndCountryCode(countryCode!, mobile);

		if (!validate.countryCode.success || !validate.phoneNumber.success) {
			setError("Please enter a valid phone number");
			return;
		}

		changeCountryCode(countryCode);
		changePhoneNumber(mobile);

		loginMutation({
			phone_number: mobile,
		});
	};

	const handleMobileChange = (text: string) => {
		const numericText = text.replace(/[^0-9]/g, "");
		setMobile(numericText);
		if (numericText.length === 10) {
			setError("");
		}
	};

	const getCurrentCountry = () => {
		return COUNTRY_OPTIONS.find((c) => c.code === countryCode) || COUNTRY_OPTIONS[0];
	};

	const showCountrySelection = () => {
		setShowCountryModal(true);
		Animated.parallel([
			Animated.timing(countryBackgroundOpacity, {
				toValue: 1,
				duration: 250,
				useNativeDriver: true,
			}),
			Animated.spring(countrySlideAnim, {
				toValue: 0,
				tension: 50,
				friction: 8,
				useNativeDriver: true,
			}),
		]).start();
	};

	const hideCountryModal = () => {
		Animated.parallel([
			Animated.timing(countryBackgroundOpacity, {
				toValue: 0,
				duration: 200,
				useNativeDriver: true,
			}),
			Animated.timing(countrySlideAnim, {
				toValue: screenHeight,
				duration: 200,
				useNativeDriver: true,
			}),
		]).start(() => {
			setShowCountryModal(false);
			setCountrySearchText("");
		});
	};

	const handleCountrySelect = (code: string) => {
		changeCountryCode(code);
		hideCountryModal();
	};

	const showLanguageSelection = () => {
		setShowLanguageModal(true);
		Animated.parallel([
			Animated.timing(backgroundOpacity, {
				toValue: 1,
				duration: 250,
				useNativeDriver: true,
			}),
			Animated.spring(slideAnim, {
				toValue: 0,
				tension: 50,
				friction: 8,
				useNativeDriver: true,
			}),
		]).start();
	};

	const hideLanguageModal = () => {
		Animated.parallel([
			Animated.timing(backgroundOpacity, {
				toValue: 0,
				duration: 200,
				useNativeDriver: true,
			}),
			Animated.timing(slideAnim, {
				toValue: screenHeight,
				duration: 200,
				useNativeDriver: true,
			}),
		]).start(() => {
			setShowLanguageModal(false);
			setSearchText("");
		});
	};

	const handleLanguageSelect = (langKey: Languages) => {
		setLanguage(langKey);
		hideLanguageModal();
	};

	return (
		<Layout01 contentStyle={styles.layoutContent}>
			<View style={styles.formContainer}>
				{/* Section Title */}
				<Text style={styles.title}>Mobile Number</Text>

				{/* Unified Phone Input Box */}
				<View style={styles.unifiedInputContainer}>
					<TouchableOpacity
						style={styles.countryPickerTrigger}
						activeOpacity={0.7}
						onPress={showCountrySelection}>
						<Image
							source={{ uri: getCurrentCountry().flag }}
							style={styles.flagImage}
							contentFit="cover"
						/>
						<Text style={styles.countryCodeText}>{countryCode}</Text>
						<MaterialIcons name="keyboard-arrow-down" size={18} color="#64748B" />
					</TouchableOpacity>

					<View style={styles.inputDivider} />

					<TextInput
						style={styles.phoneTextInput}
						placeholder="Enter 10-digit number"
						placeholderTextColor="#94A3B8"
						keyboardType="number-pad"
						maxLength={10}
						value={mobile}
						onChangeText={handleMobileChange}
						editable={!isPending}
					/>

					{mobile.length > 0 && (
						<TouchableOpacity
							onPress={() => setMobile("")}
							style={styles.clearButton}
							hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
							<MaterialIcons name="close" size={18} color="#94A3B8" />
						</TouchableOpacity>
					)}
				</View>

				{/* Error text if present */}
				{error ? <Text style={styles.error}>{error}</Text> : null}

				{/* Aadhaar Helper Text with Info Icon */}
				<View style={styles.infoRow}>
					<MaterialIcons name="info" size={15} color="#4D7C0F" style={styles.infoIcon} />
					<Text style={styles.infoText}>
						Please enter your{" "}
						<Text style={styles.aadhaarHighlight}>AADHAAR</Text>-linked mobile number
					</Text>
				</View>

				{/* Request OTP Primary Button */}
				<TouchableOpacity
					style={[
						styles.button,
						(isPending || mobile.length < 10) && styles.buttonDisabled,
					]}
					onPress={handleRequestOtp}
					disabled={isPending || mobile.length < 10}>
					{isPending ? (
						<ActivityIndicator size="small" color="#3F6212" />
					) : (
						<View style={styles.buttonContent}>
							<Text style={styles.buttonText}>Request OTP</Text>
							<MaterialIcons
								name="arrow-forward"
								size={18}
								color="#3F6212"
								style={styles.buttonArrow}
							/>
						</View>
					)}
				</TouchableOpacity>

				{/* Subtle Horizontal Divider */}
				<View style={styles.horizontalDivider} />

				{/* Bottom Trust & Verification Badges Card */}
				<View style={styles.trustCard}>
					{/* RBI Approved */}
					<View style={styles.badgeItem}>
						<View style={styles.bankIconContainer}>
							<MaterialIcons name="account-balance" size={18} color="#B45309" />
						</View>
						<View style={styles.badgeTextWrap}>
							<Text style={styles.badgeTitle}>RBI Approved</Text>
							<Text style={styles.badgeSubtitle}>Powered by RBI NBFC</Text>
						</View>
					</View>

					{/* Vertical Separator */}
					<View style={styles.cardSeparator} />

					{/* 10 Lakh+ Customers */}
					<View style={styles.badgeItem}>
						<View style={styles.customersIconContainer}>
							<MaterialIcons name="groups" size={20} color="#EA580C" />
						</View>
						<View style={styles.badgeTextWrap}>
							<Text style={styles.badgeTitle}>10 Lakh+</Text>
							<Text style={styles.badgeSubtitle}>Customers nationwide</Text>
						</View>
					</View>
				</View>

				{/* SSL Security Footer */}
				<View style={styles.sslFooter}>
					<MaterialIcons name="lock" size={13} color="#15803D" style={styles.sslIcon} />
					<Text style={styles.sslText}>100% Secure & Bank Grade 256-bit SSL</Text>
				</View>
			</View>

			{/* Country Selection Modal */}
			<Modal
				visible={showCountryModal}
				transparent={true}
				animationType="none"
				onRequestClose={hideCountryModal}>
				<Animated.View
					style={[
						styles.modalOverlay,
						{ opacity: countryBackgroundOpacity },
					]}>
					<Pressable style={styles.modalOverlayPressable} onPress={hideCountryModal}>
						<Animated.View
							style={[
								styles.modalContainer,
								{ transform: [{ translateY: countrySlideAnim }] },
							]}>
							<Pressable style={styles.modalContent}>
								<View style={styles.modalHandle} />
								<Text style={styles.modalTitle}>Select Country</Text>

								<View style={styles.searchContainer}>
									<MaterialIcons name="search" size={20} color="#999" style={styles.searchIcon} />
									<TextInput
										style={styles.searchInput}
										placeholder="Search Country"
										value={countrySearchText}
										onChangeText={setCountrySearchText}
										placeholderTextColor="#999"
									/>
								</View>

								<View style={styles.languageList}>
									{COUNTRY_OPTIONS.filter(
										(country) =>
											country.label.toLowerCase().includes(countrySearchText.toLowerCase()) ||
											country.code.includes(countrySearchText)
									).map((country) => (
										<TouchableOpacity
											key={country.code}
											style={styles.countryOption}
											activeOpacity={0.7}
											onPress={() => handleCountrySelect(country.code)}>
											<Image
												source={{ uri: country.flag }}
												style={styles.countryFlagImage}
												contentFit="contain"
											/>
											<View style={styles.countryTextWrap}>
												<Text style={styles.countryLabel}>{country.label}</Text>
												<Text style={styles.countryCodeOption}>{country.code}</Text>
											</View>
										</TouchableOpacity>
									))}
								</View>
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
						{ opacity: backgroundOpacity },
					]}>
					<Pressable style={styles.modalOverlayPressable} onPress={hideLanguageModal}>
						<Animated.View
							style={[
								styles.modalContainer,
								{ transform: [{ translateY: slideAnim }] },
							]}>
							<Pressable style={styles.modalContent}>
								<View style={styles.modalHandle} />
								<Text style={styles.modalTitle}>Select Language</Text>

								<View style={styles.searchContainer}>
									<MaterialIcons name="search" size={20} color="#999" style={styles.searchIcon} />
									<TextInput
										style={styles.searchInput}
										placeholder="Search Language"
										value={searchText}
										onChangeText={setSearchText}
										placeholderTextColor="#999"
									/>
								</View>

								<View style={styles.languageList}>
									{LANGUAGES.filter((lang) =>
										lang.label.toLowerCase().includes(searchText.toLowerCase())
									).map((lang) => (
										<TouchableOpacity
											key={lang.key}
											style={styles.languageOption}
											disabled={lang.disabled ?? false}
											activeOpacity={0.7}
											onPress={() => handleLanguageSelect(lang.key)}>
											<View style={styles.languageTextWrap}>
												<Text style={styles.languageLabel}>{lang.label}</Text>
												<Text style={styles.languageSub}>{lang.sub}</Text>
											</View>
										</TouchableOpacity>
									))}
								</View>
							</Pressable>
						</Animated.View>
					</Pressable>
				</Animated.View>
			</Modal>
		</Layout01>
	);
}

const styles = StyleSheet.create({
	layoutContent: {
		alignItems: "stretch",
		paddingHorizontal: width(6),
	},
	formContainer: {
		flex: 1,
		width: "100%",
	},
	title: {
		fontSize: font(2.0),
		fontWeight: "600",
		color: "#1E293B",
		marginTop: height(1.5),
		marginBottom: height(1.2),
		textAlign: "left",
	},
	unifiedInputContainer: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: "#FAFAFA",
		borderWidth: 1,
		borderColor: "#E2E8F0",
		borderRadius: 14,
		paddingHorizontal: width(3.5),
		height: 54,
		width: "100%",
	},
	countryPickerTrigger: {
		flexDirection: "row",
		alignItems: "center",
		paddingRight: 6,
	},
	inputDivider: {
		width: 1,
		height: 24,
		backgroundColor: "#E2E8F0",
		marginHorizontal: 10,
	},
	flagImage: {
		width: 22,
		height: 15,
		borderRadius: 2,
		marginRight: 6,
	},
	countryCodeText: {
		fontSize: font(1.8),
		color: "#0F172A",
		fontWeight: "600",
		marginRight: 2,
	},
	phoneTextInput: {
		flex: 1,
		fontSize: font(1.8),
		fontWeight: "500",
		color: "#0F172A",
		paddingVertical: 0,
		paddingHorizontal: 2,
	},
	clearButton: {
		padding: 4,
		justifyContent: "center",
		alignItems: "center",
	},
	error: {
		color: "#d32f2f",
		fontSize: font(1.4),
		marginTop: height(0.6),
		marginLeft: width(1),
	},
	infoRow: {
		flexDirection: "row",
		alignItems: "center",
		marginTop: height(1.2),
		marginLeft: width(0.5),
	},
	infoIcon: {
		marginRight: 6,
	},
	infoText: {
		color: "#64748B",
		fontSize: font(1.4),
		lineHeight: height(2.0),
	},
	aadhaarHighlight: {
		color: "#365314",
		fontWeight: "700",
	},
	button: {
		backgroundColor: "#D7F98C",
		borderRadius: 28,
		height: 52,
		alignItems: "center",
		justifyContent: "center",
		width: "100%",
		marginTop: height(3.5),
	},
	buttonDisabled: {
		opacity: 0.95,
	},
	buttonContent: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
	},
	buttonText: {
		color: "#3F6212",
		fontSize: font(1.9),
		fontWeight: "600",
	},
	buttonArrow: {
		marginLeft: 8,
	},
	horizontalDivider: {
		height: 1,
		backgroundColor: "#F1F5F9",
		width: "100%",
		marginTop: height(4),
		marginBottom: height(2.5),
	},
	trustCard: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		backgroundColor: "#FAFAFA",
		borderWidth: 1,
		borderColor: "#F1F5F9",
		borderRadius: 16,
		paddingVertical: 12,
		paddingHorizontal: 14,
		width: "100%",
	},
	badgeItem: {
		flex: 1,
		flexDirection: "row",
		alignItems: "center",
	},
	bankIconContainer: {
		width: 36,
		height: 36,
		borderRadius: 18,
		backgroundColor: "#FEF3C7",
		alignItems: "center",
		justifyContent: "center",
		marginRight: 10,
	},
	customersIconContainer: {
		width: 36,
		height: 36,
		borderRadius: 18,
		backgroundColor: "#FFEDD5",
		alignItems: "center",
		justifyContent: "center",
		marginRight: 10,
	},
	cardSeparator: {
		width: 1,
		height: 34,
		backgroundColor: "#E2E8F0",
		marginHorizontal: 8,
	},
	badgeTextWrap: {
		flexDirection: "column",
		flex: 1,
	},
	badgeTitle: {
		fontSize: font(1.5),
		fontWeight: "700",
		color: "#0F172A",
	},
	badgeSubtitle: {
		fontSize: font(1.15),
		color: "#64748B",
		marginTop: 2,
		lineHeight: 14,
	},
	sslFooter: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		marginTop: height(2),
		marginBottom: height(2),
	},
	sslIcon: {
		marginRight: 6,
	},
	sslText: {
		fontSize: font(1.25),
		color: "#64748B",
		fontWeight: "500",
	},
	modalOverlay: {
		flex: 1,
		backgroundColor: "rgba(0,0,0,0.5)",
		justifyContent: "flex-end",
	},
	modalOverlayPressable: {
		flex: 1,
		justifyContent: "flex-end",
	},
	modalContainer: {
		backgroundColor: white,
		borderTopLeftRadius: width(6),
		borderTopRightRadius: width(6),
		maxHeight: height(70),
	},
	modalContent: {
		paddingTop: height(2),
		paddingBottom: height(4),
	},
	modalHandle: {
		width: width(12),
		height: 4,
		backgroundColor: "#E0E0E0",
		borderRadius: 2,
		alignSelf: "center",
		marginBottom: height(2),
	},
	modalTitle: {
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
	countryOption: {
		backgroundColor: white,
		paddingHorizontal: width(4),
		paddingVertical: height(1.5),
		marginBottom: height(1),
		flexDirection: "row",
		alignItems: "center",
		borderRadius: width(2),
	},
	countryFlagImage: {
		width: 24,
		height: 18,
		marginRight: width(3),
	},
	countryTextWrap: {
		flexDirection: "column",
	},
	countryLabel: {
		color: dark,
		fontWeight: "600",
		fontSize: font(1.6),
	},
	countryCodeOption: {
		color: "#666",
		fontSize: font(1.4),
		marginTop: 2,
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
});
