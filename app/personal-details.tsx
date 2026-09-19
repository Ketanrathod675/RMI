import Input from "@/components/Input";
import { TranslatedText } from "@/components/TranslatedText";
import { dark, white } from "@/constants/Colors";
import { useDefault } from "@/hooks/useDefault";
import { useJourneyTracker } from "@/hooks/useJourneyTracker";
import { useNetworkAwareQuery } from "@/hooks/useNetworkAwareQuery";
import { useTranslation } from "@/hooks/useTranslation";
import { fetchSelfie } from "@/utils/api/kyc";
import { getUserProfile } from "@/utils/api/user";
import { font, height, width } from "@/utils/dimensions";
import { MaterialIcons } from "@expo/vector-icons";
import { router, Stack, useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useState } from "react";
import {
	ActivityIndicator,
	BackHandler,
	Dimensions,
	Image,
	Modal,
	Platform,
	ScrollView,
	StatusBar as RNStatusBar,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from "react-native";

export default function PersonalDetails() {
	useJourneyTracker("/personal-details");
	const { t } = useTranslation();
	const { language } = useDefault();

	// Selfie state
	const [selfieUri, setSelfieUri] = useState<string | null>(null);
	const [showImageModal, setShowImageModal] = useState(false);

	// All fields are read-only, computed from API data
	const [displayData, setDisplayData] = useState({
		fullName: "",
		countryCode: "+91",
		phoneNumber: "",
		email: "",
		gender: "",
		dateOfBirth: "",
		permanentAddress: "",
		currentAddress: "",
	});

	// Fetch user profile data
	const {
		data: userProfile,
		isLoading,
		error,
	} = useNetworkAwareQuery({
		queryKey: ["userProfile"],
		queryFn: getUserProfile,
		staleTime: 300000,
	});

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
		}, [refetchSelfie])
	);

	// Ensure system status bar is visible (dark icons over white header) when Personal Details is focused
	useFocusEffect(
		React.useCallback(() => {
			RNStatusBar.setBarStyle("dark-content");
			if (Platform.OS === "android") {
				RNStatusBar.setBackgroundColor("transparent");
				RNStatusBar.setTranslucent(true);
			}
		}, [])
	);

	// Get country flag based on country code
	const getCountryFlag = (countryCode: string) => {
		const flagMap: { [key: string]: string } = {
			"+91": "https://flagcdn.com/w20/in.png", // India
			"+1": "https://flagcdn.com/w20/us.png", // USA
			"+44": "https://flagcdn.com/w20/gb.png", // UK
			"+61": "https://flagcdn.com/w20/au.png", // Australia
		};
		return flagMap[countryCode] || "https://flagcdn.com/w20/in.png";
	};

	// Handle hardware back press on Android
	useFocusEffect(
		React.useCallback(() => {
			const onBackPress = () => {
				router.back();
				return true;
			};

			const subscription = BackHandler.addEventListener(
				"hardwareBackPress",
				onBackPress
			);

			return () => subscription.remove();
		}, [])
	);

	// Populate display data when API data is loaded
	useEffect(() => {
		if (userProfile) {
			// Extract phone number and country code
			let extractedCountryCode = "+91";
			let phoneWithoutCountryCode = "";

			if (userProfile.phone_number) {
				const rawPhone = userProfile.phone_number.trim();
				if (rawPhone.startsWith("+91")) {
					extractedCountryCode = "+91";
					phoneWithoutCountryCode = rawPhone.slice(3).replace(/\D/g, "");
				} else if (rawPhone.startsWith("+1") && rawPhone.replace(/\D/g, "").length === 11) {
					extractedCountryCode = "+1";
					phoneWithoutCountryCode = rawPhone.slice(2).replace(/\D/g, "");
				} else if (rawPhone.startsWith("+44") && rawPhone.replace(/\D/g, "").length >= 12) {
					extractedCountryCode = "+44";
					phoneWithoutCountryCode = rawPhone.slice(3).replace(/\D/g, "");
				} else if (rawPhone.startsWith("+")) {
					const digitsOnly = rawPhone.replace(/\D/g, "");
					if (digitsOnly.length > 10) {
						extractedCountryCode = `+${digitsOnly.slice(0, digitsOnly.length - 10)}`;
						phoneWithoutCountryCode = digitsOnly.slice(-10);
					} else {
						extractedCountryCode = "+91";
						phoneWithoutCountryCode = digitsOnly;
					}
				} else {
					const digitsOnly = rawPhone.replace(/\D/g, "");
					if (digitsOnly.length === 12 && digitsOnly.startsWith("91")) {
						extractedCountryCode = "+91";
						phoneWithoutCountryCode = digitsOnly.slice(2);
					} else if (digitsOnly.length > 10) {
						extractedCountryCode = `+${digitsOnly.slice(0, digitsOnly.length - 10)}`;
						phoneWithoutCountryCode = digitsOnly.slice(-10);
					} else {
						extractedCountryCode = "+91";
						phoneWithoutCountryCode = digitsOnly;
					}
				}
			}

			// Format gender
			const genderValue = userProfile.personal_details?.gender;
			const formattedGender = genderValue
				? genderValue.charAt(0).toUpperCase() + genderValue.slice(1).toLowerCase()
				: "";

			// Format date of birth
			let formattedDate = "";
			if (userProfile.personal_details?.date_of_birth) {
				const date = new Date(userProfile.personal_details.date_of_birth);
				formattedDate = `${String(date.getDate()).padStart(2, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${date.getFullYear()}`;
			}

			// 1. Current / Communication Address
			const communicationAddress = userProfile.address;
			let formattedCommunicationAddress = "";

			if (communicationAddress) {
				const parts = [
					communicationAddress.address_line1,
					communicationAddress.address_line2,
					communicationAddress.city,
					communicationAddress.state,
					communicationAddress.pincode,
					communicationAddress.country,
				].filter(Boolean);

				formattedCommunicationAddress = parts.join(", ");
			}

			// 2. Permanent / KYC Address
			const kycAddress = userProfile.address?.kyc_address_shown;
			let formattedKycAddress = "";

			if (kycAddress) {
				const parts = [
					kycAddress.address,
					kycAddress.city,
					kycAddress.state,
					kycAddress.pin_code,
				].filter(Boolean);

				formattedKycAddress = parts.join(", ");
			}

			// 3. Fallback Priority
			// Permanent address prefers KYC address first, falls back to communication address
			const finalPermanentAddress =
				formattedKycAddress || formattedCommunicationAddress || "";

			// Current address prefers communication address first, falls back to KYC address
			const finalCurrentAddress =
				formattedCommunicationAddress || formattedKycAddress || "";

			setDisplayData({
				fullName: userProfile.personal_details?.full_name || "",
				countryCode: extractedCountryCode,
				phoneNumber: phoneWithoutCountryCode,
				email: userProfile.email || "",
				gender: formattedGender,
				dateOfBirth: formattedDate,
				permanentAddress: finalPermanentAddress,
				currentAddress: finalCurrentAddress,
			});
		}
	}, [userProfile]);

	// Show loading state
	if (isLoading) {
		return (
			<View style={[styles.container, styles.centered]}>
				<ActivityIndicator size="large" color={dark} />
				<TranslatedText style={styles.loadingText} translationKey="loadingYourProfile" />
			</View>
		);
	}

	// Show error state
	if (error) {
		return (
			<View style={[styles.container, styles.centered]}>
				<MaterialIcons name="error-outline" size={48} color="#FF6B6B" />
				<TranslatedText style={styles.errorText} translationKey="noDataAvailable" />
				<TranslatedText
					style={styles.errorSubText}
					translationKey="pleaseCompleteYourLoanApplication"
				/>
			</View>
		);
	}

	return (
		<ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
			<Stack.Screen options={{ headerShown: true, title: t("personalDetails") }} />
			<StatusBar style="dark" />

			{/* Profile Image Section */}
			<View style={styles.profileSection}>
				<TouchableOpacity
					style={styles.imageContainer}
					onPress={() => selfieUri && setShowImageModal(true)}
					disabled={!selfieUri}>
					{selfieUri ? (
						<Image source={{ uri: selfieUri }} style={styles.profileImage} />
					) : (
						<MaterialIcons name="person" size={60} color="#999" />
					)}
					{/* Edit button overlay is inactive/disabled matching reference */}
					{/* <TouchableOpacity
						style={[styles.editButton, styles.disabledButton]}
						disabled={true}>
						<MaterialIcons style={{ zIndex: 10 }} name="edit" size={16} color="#999" />
					</TouchableOpacity> */}
				</TouchableOpacity>
			</View>

			{/* Enlarged Image Modal */}
			<Modal
				visible={showImageModal}
				transparent={true}
				animationType="fade"
				onRequestClose={() => setShowImageModal(false)}>
				<TouchableOpacity
					style={styles.modalOverlay}
					activeOpacity={1}
					onPress={() => setShowImageModal(false)}>
					<View style={styles.modalContent}>
						{selfieUri && (
							<Image
								source={{ uri: selfieUri }}
								style={styles.enlargedImage}
								resizeMode="contain"
							/>
						)}
						<TouchableOpacity
							style={styles.closeButton}
							onPress={() => setShowImageModal(false)}>
							<MaterialIcons name="close" size={30} color={white} />
						</TouchableOpacity>
					</View>
				</TouchableOpacity>
			</Modal>

			{/* Form Fields */}
			<View style={styles.formContainer}>
				<Input
					label={t("fullName")}
					value={displayData.fullName}
					onChangeText={() => {}}
					placeholder={t("enterFullName")}
					editable={false}
				/>

				<View style={styles.phoneSection}>
					<TranslatedText style={styles.label} translationKey="phoneNumber" />
					<View style={styles.phoneContainer}>
						<View style={styles.countryCodeContainer}>
							<Image
								source={{ uri: getCountryFlag(displayData.countryCode) }}
								style={styles.flagImage}
							/>
							<Text style={styles.countryCodeText}>{displayData.countryCode}</Text>
						</View>
						<View style={styles.phoneNumberContainer}>
							<Text style={styles.phoneNumberText}>{displayData.phoneNumber}</Text>
						</View>
					</View>
				</View>

				<Input
					label={t("email")}
					value={displayData.email}
					onChangeText={() => {}}
					placeholder={t("enterYourEmail")}
					keyboardType="email-address"
					editable={false}
				/>

				<View style={styles.selectContainer}>
					<TranslatedText style={styles.label} translationKey="gender" />
					<View style={styles.displayField}>
						<Text style={styles.displayText}>
							{displayData.gender || t("notSpecified")}
						</Text>
					</View>
				</View>

				<View style={styles.dateContainer}>
					<TranslatedText style={styles.label} translationKey="dateOfBirth" />
					<View style={styles.displayField}>
						<Text style={styles.displayText}>
							{displayData.dateOfBirth || t("notSpecified")}
						</Text>
						<MaterialIcons name="calendar-today" size={20} color="#999" />
					</View>
				</View>

				{/* KYC Status */}
				<View style={styles.kycContainer}>
					<View style={styles.kycContent}>
						<TranslatedText style={styles.kycText} translationKey="kyc" />
						<View style={styles.kycStatus}>
							{userProfile?.personal_details?.is_pan_verified ? (
								<>
									<MaterialIcons name="check-circle" size={16} color="#5A8F0A" />
									<TranslatedText
										style={styles.kycStatusText}
										translationKey="completed"
									/>
								</>
							) : (
								<>
									<MaterialIcons name="pending" size={16} color="#FF9500" />
									<TranslatedText
										style={[styles.kycStatusText, { color: "#FF9500" }]}
										translationKey="pending"
									/>
								</>
							)}
						</View>
					</View>
				</View>

				<View style={styles.addressContainer}>
					<TranslatedText
						style={styles.label}
						translationKey="permanentAddressAsPerAadhaar"
					/>
					<View style={[styles.displayField, styles.addressDisplayField]}>
						<Text style={styles.displayText}>
							{displayData.permanentAddress || t("addressNotProvided")}
						</Text>
					</View>
				</View>

				<View style={styles.addressContainer}>
					<TranslatedText
						style={styles.label}
						translationKey="currentCommunicationAddress"
					/>
					<View style={[styles.displayField, styles.addressDisplayField]}>
						<Text style={styles.displayText}>
							{displayData.currentAddress || t("addressNotProvided")}
						</Text>
					</View>
				</View>
			</View>
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: white,
	},
	centered: {
		justifyContent: "center",
		alignItems: "center",
		paddingHorizontal: width(4),
	},
	loadingText: {
		fontSize: font(1.6),
		color: dark,
		marginTop: height(2),
		textAlign: "center",
	},
	errorText: {
		fontSize: font(1.8),
		color: "#FF6B6B",
		fontWeight: "600",
		marginTop: height(2),
		textAlign: "center",
	},
	errorSubText: {
		fontSize: font(1.4),
		color: "#666",
		marginTop: height(1),
		textAlign: "center",
	},
	profileSection: {
		alignItems: "center",
		paddingVertical: height(3),
		paddingHorizontal: width(4),
	},
	imageContainer: {
		position: "relative",
		width: width(20),
		height: width(20),
		borderRadius: width(10),
		backgroundColor: "#FFE8B3",
		alignItems: "center",
		justifyContent: "center",
	},
	profileImage: {
		width: "100%",
		height: "100%",
		borderRadius: width(10),
	},
	editButton: {
		position: "absolute",
		top: -5,
		right: -5,
		backgroundColor: white,
		borderRadius: 12,
		width: 24,
		height: 24,
		alignItems: "center",
		justifyContent: "center",
		shadowColor: "#000",
		shadowOffset: {
			width: 0,
			height: 2,
		},
		shadowOpacity: 0.25,
		shadowRadius: 4,
		elevation: 10,
		zIndex: 10,
	},
	formContainer: {
		paddingHorizontal: width(4),
		paddingBottom: height(4),
	},
	phoneSection: {
		marginVertical: height(1.5),
	},
	label: {
		color: dark,
		fontSize: font(1.5),
		marginBottom: height(0.5),
		marginLeft: width(1),
	},
	phoneContainer: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: white,
		borderRadius: width(2),
		borderWidth: 1,
		borderColor: "#E5E5E5",
		overflow: "hidden",
	},
	countryCodeContainer: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: "#F8F9FA",
		paddingVertical: height(1.5),
		paddingHorizontal: width(3),
		borderRightWidth: 1,
		borderRightColor: "#E5E5E5",
	},
	phoneNumberContainer: {
		flex: 1,
		paddingVertical: height(1.5),
		paddingHorizontal: width(3),
	},
	flagImage: {
		width: 20,
		height: 15,
		marginRight: width(2),
	},
	countryCodeText: {
		fontSize: font(1.6),
		color: dark,
		fontWeight: "500",
	},
	phoneNumberText: {
		fontSize: font(1.8),
		color: dark,
	},
	displayField: {
		backgroundColor: "#F5F5F5",
		borderRadius: width(2),
		paddingVertical: height(1.5),
		paddingHorizontal: width(4),
		borderWidth: 1,
		borderColor: "#E5E5E5",
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},
	displayText: {
		fontSize: font(1.8),
		color: "#666",
		flex: 1,
	},
	addressDisplayField: {
		minHeight: height(8),
		alignItems: "flex-start",
		paddingTop: height(1.5),
	},
	selectContainer: {
		marginVertical: height(1.5),
	},
	genderSelect: {
		marginVertical: 0,
	},
	dateContainer: {
		marginVertical: height(1.5),
	},
	dateInput: {
		backgroundColor: white,
		borderRadius: width(2),
		paddingVertical: height(1.5),
		paddingHorizontal: width(4),
		borderWidth: 1,
		borderColor: "#E5E5E5",
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},
	dateText: {
		fontSize: font(1.8),
		color: dark,
	},
	kycContainer: {
		backgroundColor: "#E8F5E8",
		borderRadius: width(2),
		paddingVertical: height(1.5),
		paddingHorizontal: width(4),
		marginVertical: height(1.5),
	},
	kycContent: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},
	kycText: {
		fontSize: font(1.8),
		color: "#5A8F0A",
		fontWeight: "600",
	},
	kycStatus: {
		flexDirection: "row",
		alignItems: "center",
	},
	kycStatusText: {
		fontSize: font(1.5),
		color: "#5A8F0A",
		marginLeft: width(1),
		fontWeight: "500",
	},
	addressContainer: {
		marginVertical: height(1.5),
	},
	addressInput: {
		height: height(12),
		textAlignVertical: "top",
		paddingTop: height(1.5),
	},
	disabledInput: {
		backgroundColor: "#F5F5F5",
		opacity: 0.7,
	},
	disabledText: {
		color: "#999",
	},
	disabledButton: {
		backgroundColor: "#F5F5F5",
		opacity: 0.7,
	},
	modalOverlay: {
		flex: 1,
		backgroundColor: "rgba(0, 0, 0, 0.9)",
		justifyContent: "center",
		alignItems: "center",
	},
	modalContent: {
		width: "100%",
		height: "100%",
		justifyContent: "center",
		alignItems: "center",
		position: "relative",
	},
	enlargedImage: {
		width: Dimensions.get("window").width * 0.9,
		height: Dimensions.get("window").height * 0.7,
	},
	closeButton: {
		position: "absolute",
		top: 50,
		right: 20,
		backgroundColor: "rgba(0, 0, 0, 0.5)",
		borderRadius: 20,
		width: 40,
		height: 40,
		justifyContent: "center",
		alignItems: "center",
	},
});
