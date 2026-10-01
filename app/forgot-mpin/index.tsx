import { TranslatedText } from "@/components/TranslatedText";
import { dark, primary, white } from "@/constants/Colors";
import { ForgotMpinContext } from "@/context/forgot_mpin";
import { PhoneNumberSchema, useAuth } from "@/hooks/useAuth";
import { useNetworkAwareMutation } from "@/hooks/useNetworkAwareMutation";
import { useTranslation } from "@/hooks/useTranslation";
import { ForgotMpinLayout } from "@/layouts/forgot-mpin-layout";
import { axios, errorHandler, URLS } from "@/utils/api";
import { font, height, width } from "@/utils/dimensions";
import { MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import React, { useContext, useEffect, useRef, useState } from "react";
import {
	Animated,
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
	{ code: "+91", label: "India", flag: "https://flagcdn.com/w20/in.png" },
	// { code: "+1", label: "USA", flag: "https://flagcdn.com/w20/us.png" },
	// { code: "+44", label: "UK", flag: "https://flagcdn.com/w20/gb.png" },
	// { code: "+61", label: "Australia", flag: "https://flagcdn.com/w20/au.png" },
];

export default function ForgotMpin() {
	const { phoneNumber: storedPhoneNumber, logout } = useAuth();
	const { t } = useTranslation();

	const { phoneNumber, setPhoneNumber, countryCode, setCountryCode, setOtpVerified } =
		useContext(ForgotMpinContext);

	// Country selection modal state
	const [showCountryModal, setShowCountryModal] = useState(false);
	const [countrySearchText, setCountrySearchText] = useState("");
	const slideAnim = useRef(new Animated.Value(screenHeight)).current;
	const backgroundOpacity = useRef(new Animated.Value(0)).current;

	console.log("storedPhoneNumber", storedPhoneNumber);

	// Initialize phoneNumber from stored value
	useEffect(() => {
		if (storedPhoneNumber && !phoneNumber) {
			setPhoneNumber(storedPhoneNumber);
		}
	}, [storedPhoneNumber, phoneNumber, setPhoneNumber]);

	const { mutate, isPending } = useNetworkAwareMutation({
		mutationFn: async (data: { phone_number: string }) => {
			const response = await axios.post(URLS.auth.forgot_mpin, data);

			return response?.data;
		},
		onSuccess: (data) => {
			console.log("data", data);
			Toast.show({
				type: "success",
				text1: t("otpSentSuccessfully"),
				text2: t("pleaseEnterOtpAndSetNewMpin"),
			});

			setOtpVerified(true);

			router.push("/forgot-mpin/verify-phone");
		},
		onError: (err, variables, ctx) => {
			const { error } = errorHandler(err, variables, ctx);

			console.log("error", error);
			Toast.show({
				type: "error",
				text1: t("failedToSendOtp"),
				text2: error?.message || t("pleaseTryAgain"),
			});
		},
	});

	const handleForgotMpin = () => {
		// check for valid phone number
		const parsePhone = PhoneNumberSchema.safeParse(phoneNumber);

		if (!parsePhone.success) {
			Toast.show({
				type: "error",
				text1: t("invalidPhoneNumber"),
			});
			return;
		}

		// check if the number entered is the same as the one stored in the device
		if (storedPhoneNumber !== parsePhone.data) {
			Toast.show({
				type: "error",
				text1: t("deviceNotRegistered"),
				text2: t("pleaseLoginWithCorrectNumber"),
			});

			return;
		}

		mutate({ phone_number: parsePhone.data });
	};

	// Get current country info
	const getCurrentCountry = () => {
		return (
			COUNTRY_OPTIONS.find((country) => country.code === countryCode) || COUNTRY_OPTIONS[0]
		);
	};

	// Show country selection modal
	const showCountrySelection = () => {
		setShowCountryModal(true);
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
	};

	// Hide country selection modal
	const hideCountryModal = () => {
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
				setShowCountryModal(false);
				setCountrySearchText("");
			});
		});
	};

	// Handle country selection
	const handleCountrySelect = (countryCode: string) => {
		setCountryCode(countryCode);
		hideCountryModal();
	};

	useEffect(() => {
		if (!storedPhoneNumber) {
			logout();
			// router.replace("/mpin-login");
			router.replace("/login");
			return;
		}
	}, [storedPhoneNumber, logout]);

	// Phone number change handler
	const handlePhoneChange = (value: string) => {
		setPhoneNumber(value);
	};

	return (
		<ForgotMpinLayout>
			<View style={styles.formSection}>
				<TranslatedText style={styles.label} translationKey="phoneNumber" />
				<View style={styles.inputRow}>
					<View style={styles.countrySelector}>
						<Image
							source={{ uri: getCurrentCountry().flag }}
							style={styles.flagImage}
							contentFit="contain"
						/>
						<Text style={styles.countryCodeText}>{countryCode}</Text>
					</View>
				<TextInput
					style={styles.phoneInput}
					keyboardType="number-pad"
					placeholder="999xxxxxxx"
					value={phoneNumber}
					onChangeText={handlePhoneChange}
					maxLength={10}
					editable={!isPending}
				/>
				</View>

				<TouchableOpacity
					style={styles.button}
					disabled={isPending}
					onPress={handleForgotMpin}>
					<TranslatedText
						style={styles.buttonText}
						translationKey={isPending ? "sending" : "sendOtpCode"}
					/>
				</TouchableOpacity>

				<TouchableOpacity
					style={{ paddingHorizontal: width(3), marginVertical: height(2) }}
					onPress={() => {
						// router.replace("/mpin-login")
						router.replace("/login");
					}}>
					<TranslatedText
						style={{ textDecorationLine: "underline" }}
						translationKey="goBack"
					/>
				</TouchableOpacity>
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
						{
							opacity: backgroundOpacity,
						},
					]}>
					<Pressable style={styles.modalOverlayPressable} onPress={hideCountryModal}>
						<Animated.View
							style={[
								styles.modalContainer,
								{
									transform: [{ translateY: slideAnim }],
								},
							]}>
							<Pressable style={styles.modalContent}>
								{/* Modal Handle */}
								<View style={styles.modalHandle} />

								{/* Title */}
								<TranslatedText
									style={styles.modalTitle}
									translationKey="selectCountry"
								/>

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
										placeholder={t("searchCountry")}
										value={countrySearchText}
										onChangeText={setCountrySearchText}
										placeholderTextColor="#999"
									/>
								</View>

								{/* Country Options */}
								<View style={styles.countryList}>
									{COUNTRY_OPTIONS.filter(
										(country) =>
											country.label
												.toLowerCase()
												.includes(countrySearchText.toLowerCase()) ||
											country.code.includes(countrySearchText),
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
												<Text style={styles.countryLabel}>
													{country.label}
												</Text>
												<Text style={styles.countryCodeOption}>
													{country.code}
												</Text>
											</View>
										</TouchableOpacity>
									))}
									{COUNTRY_OPTIONS.filter(
										(country) =>
											country.label
												.toLowerCase()
												.includes(countrySearchText.toLowerCase()) ||
											country.code.includes(countrySearchText),
									).length === 0 && (
										<TranslatedText
											style={styles.noResultsText}
											translationKey="noResultsFound"
										/>
									)}
								</View>
							</Pressable>
						</Animated.View>
					</Pressable>
				</Animated.View>
			</Modal>
		</ForgotMpinLayout>
	);
}

const styles = StyleSheet.create({
	languageSection: {
		paddingHorizontal: width(7),
		marginTop: height(2),
	},
	languageSelector: {
		marginVertical: height(1),
	},
	formSection: {
		width: "100%",
		paddingHorizontal: width(7),
		flexDirection: "column",
		marginTop: height(2),
	},
	label: {
		fontSize: font(1.8),
		fontWeight: "semibold",
		color: dark,
		// marginBottom: height(1.5),
	},
	inputRow: {
		flexDirection: "row",
		gap: width(2),
		alignItems: "center",
		marginVertical: height(1),
	},

	countrySelector: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: white,
		borderWidth: 1,
		borderColor: "#E5E5E5",
		borderRadius: width(2),
		paddingHorizontal: width(3),
		paddingVertical: height(2.2),
		minHeight: height(6),
		minWidth: width(20),
	},
	flagImage: {
		width: 20,
		height: 15,
		marginRight: width(2),
	},
	countryCodeText: {
		fontSize: width(4),
		color: dark,
		fontWeight: "500",
		marginRight: width(1),
	},
	phoneInput: {
		flex: 1,
		backgroundColor: white,
		borderWidth: 1,
		borderColor: "#E5E5E5",
		borderRadius: width(2),
		paddingHorizontal: width(3),
		paddingVertical: height(1.8),
		fontSize: width(4),
		color: dark,
	},
	clearBtn: {
		marginLeft: width(1),
		padding: 2,
	},
	clearBtnText: {
		fontSize: width(6),
		color: "#B0B0B0",
		fontWeight: "bold",
	},
	button: {
		backgroundColor: primary,
		width: "100%",
		paddingVertical: height(2.2),
		borderRadius: 100,
		alignItems: "center",
		marginTop: height(4),
		marginBottom: height(2),
	},
	buttonText: {
		color: dark,
		fontSize: width(4.5),
		fontWeight: "bold",
	},
	otpContainer: {
		flexDirection: "row",
		// justifyContent: "space-between",
		marginBottom: height(2),
		// paddingHorizontal: width(2),
		gap: width(3),
	},
	otpInput: {
		width: width(12),
		height: height(6),
		borderWidth: 2,
		borderColor: primary,
		borderRadius: width(2),
		backgroundColor: white,
		fontSize: width(4.5),
		fontWeight: "bold",
		color: dark,
	},
	mpinContainer: {
		flexDirection: "row",
		// justifyContent: "center",
		marginBottom: height(2),
		gap: width(3),
	},
	mpinInput: {
		width: width(12),
		height: height(6),
		borderWidth: 2,
		borderColor: primary,
		borderRadius: width(2),
		backgroundColor: white,
		fontSize: width(6),
		fontWeight: "bold",
		color: dark,
	},
	errorText: {
		color: "#d32f2f",
		fontSize: width(3.5),
		textAlign: "center",
		marginTop: height(1),
		fontWeight: "500",
	},
	sectionHeader: {
		flexDirection: "row",
		alignItems: "center",
		// justifyContent: "space-between",
		marginBottom: height(1.5),
		gap: width(2),
	},
	// Modal styles
	modalOverlay: {
		flex: 1,
		backgroundColor: "rgba(0, 0, 0, 0.5)",
		justifyContent: "flex-end",
	},
	modalOverlayPressable: {
		flex: 1,
		justifyContent: "flex-end",
	},
	modalContainer: {
		width: "100%",
		maxHeight: "80%",
	},
	modalContent: {
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
	modalTitle: {
		fontSize: width(5.5),
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
		fontSize: width(4),
		color: "#333",
		paddingVertical: height(0.5),
	},
	countryList: {
		paddingHorizontal: width(6),
		marginBottom: height(2),
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
		fontSize: width(4),
	},
	countryCodeOption: {
		color: "#666",
		fontSize: width(3.5),
		marginTop: 2,
	},
	noResultsText: {
		color: dark,
		fontSize: width(3.5),
		marginBottom: height(2),
		textAlign: "center",
	},
});
