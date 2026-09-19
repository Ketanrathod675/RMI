import React, { useEffect, useState } from "react";
import {
	Alert,
	BackHandler,
	Modal,
	Platform,
	SafeAreaView,
	ScrollView,
	Share,
	StyleSheet,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams, useNavigation } from "expo-router";
import Toast from "react-native-toast-message";
import * as DocumentPicker from "expo-document-picker";
import { Image } from "expo-image";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { IconSymbol } from "@/components/ui/IconSymbol";
import { TranslatedText } from "@/components/TranslatedText";
import { KycSuccessModal } from "@/components/KycSuccessModal";
import { dark } from "@/constants/Colors";
import { useJourneyTracker } from "@/hooks/useJourneyTracker";
import { useNetworkAwareMutation } from "@/hooks/useNetworkAwareMutation";
import { useTranslation } from "@/hooks/useTranslation";
import { API_URL } from "@/utils/api";
// TODO: migrate off legacy API
import { lookupPincode } from "@/utils/api/bank";
import {
	uploadKycDocument,
	verifyAddress,
	type AddressVerificationRequestType,
} from "@/utils/api/kyc";
import { font, height, width } from "@/utils/dimensions";

// ============================================================================
// PHASE 1 TEMPORARY MOCK: Base Permanent Address Stand-in
// In Phase 2, this will be fetched from DigiLocker / KYC API response.
// ============================================================================
const MOCK_DIGILOCKER_ADDRESS = {
	house: "Flat 402, Green Valley Apartments",
	street: "Sector 14, MG Road",
	loc: "Near City Center",
	dist: "Gurgaon",
	pc: "122001",
	state: "Haryana",
	country: "India",
	subdist: "",
	vtc: "",
	po: "",
	landmark: "",
};

export type AddressType = typeof MOCK_DIGILOCKER_ADDRESS;

export type UploadedFileType = {
	name: string;
	uri: string;
	uploadUrl?: string;
	fileUrl?: string;
	uploading?: boolean;
	mimeType?: string;
};

export default function AadhaarKyc() {
	const { t } = useTranslation();
	const router = useRouter();
	const navigation = useNavigation();
	const insets = useSafeAreaInsets();
	const params = useLocalSearchParams<{
		startFromAddress?: string;
		permAddressData?: string;
		nextStep?: string;
	}>();

	// Track this screen in the journey
	useJourneyTracker("/aadhaar-kyc");

	// Step 1: Address verification form (Phase 1 focus)
	const [address, setAddress] = useState<AddressType | null>(MOCK_DIGILOCKER_ADDRESS);
	const [currentAddress, setCurrentAddress] = useState<"Yes" | "No">("Yes");
	const [commAddressLine1, setCommAddressLine1] = useState("");
	const [commAddressLine2, setCommAddressLine2] = useState("");
	const [commCity, setCommCity] = useState("");
	const [commPincode, setCommPincode] = useState("");
	const [commState, setCommState] = useState("");
	const [uploadedFiles, setUploadedFiles] = useState<UploadedFileType[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [isUploading, setIsUploading] = useState(false);
	const [previewFile, setPreviewFile] = useState<{ uri: string; name: string; mimeType?: string } | null>(null);
	const [isKycSuccessModalVisible, setIsKycSuccessModalVisible] = useState(false);
	const [successRouteParams, setSuccessRouteParams] = useState<{
		is_repeat_user: string;
		next_step: string;
	}>({ is_repeat_user: "false", next_step: "" });

	const handleContinueSuccess = () => {
		setIsKycSuccessModalVisible(false);
		router.push({
			pathname: "/search-loan",
			params: successRouteParams,
		});
	};

	// Load CKYC address if provided in params, otherwise keep mock address
	useEffect(() => {
		if (params.permAddressData) {
			try {
				const parsed = JSON.parse(String(params.permAddressData));
				setAddress({
					house: parsed.PERM_LINE1 || parsed.house || MOCK_DIGILOCKER_ADDRESS.house,
					street: parsed.PERM_LINE2 || parsed.street || MOCK_DIGILOCKER_ADDRESS.street,
					loc: parsed.loc || parsed.landmark || MOCK_DIGILOCKER_ADDRESS.loc,
					dist: parsed.PERM_CITY || parsed.dist || MOCK_DIGILOCKER_ADDRESS.dist,
					pc: parsed.PERM_PIN || parsed.pc || MOCK_DIGILOCKER_ADDRESS.pc,
					state: parsed.PERM_STATE || parsed.state || MOCK_DIGILOCKER_ADDRESS.state,
					country: parsed.country || "India",
					subdist: parsed.subdist || "",
					vtc: parsed.vtc || "",
					po: parsed.po || "",
					landmark: parsed.landmark || "",
				});
			} catch (e) {
				console.warn("Could not parse permAddressData param, using mock address");
			}
		}
	}, [params.permAddressData]);

	// Back button handling with confirmation alert
	const handleBack = () => {
		if (isKycSuccessModalVisible) {
			handleContinueSuccess();
			return;
		}
		Alert.alert(
			t("areYouSureGoBack", "Are you sure you want to go back?"),
			t("youWillLoseProgress", "You will lose your progress."),
			[
				{ text: t("cancel", "Cancel"), style: "cancel" },
				{ text: t("goBack", "Go Back"), onPress: () => router.replace("/(tabs)") },
			]
		);
	};

	useEffect(() => {
		const unsubscribe = navigation.addListener("beforeRemove", (e) => {
			if (["GO_BACK", "POP"].includes(e.data.action.type)) {
				e.preventDefault();
				handleBack();
			}
		});

		const backHandler = BackHandler.addEventListener("hardwareBackPress", () => {
			handleBack();
			return true;
		});

		return () => {
			unsubscribe();
			backHandler.remove();
		};
	}, [navigation]);

	// ─── Pincode Lookup Mutation ─────────────────────────────────────────────
	const { mutate: lookupPincodeMutation, isPending: isLookingUpPincode } = useNetworkAwareMutation({
		mutationFn: lookupPincode,
		onSuccess: (data) => {
			console.log("📍 Pincode lookup completed");
			if (data?.success && data?.location_details) {
				const city = data.location_details.city || data.location_details.district || "";
				const state = data.location_details.state || "";

				setCommCity(city);
				setCommState(state);

				if (city && state) {
					Toast.show({
						type: "success",
						text1: t("pincodeValid", "Pincode is valid"),
						text2: `${city}, ${state}`,
						visibilityTime: 2000,
					});
				}
			} else {
				setCommCity("");
				setCommState("");
				Toast.show({
					type: "error",
					text1: t("invalidPincode", "Invalid pincode"),
					text2: t("pleaseCheckAndEnterValidPincode", "Please check and enter a valid pincode"),
					visibilityTime: 3000,
				});
			}
		},
		onError: () => {
			console.warn("⚠️ Pincode lookup failed");
			setCommCity("");
			setCommState("");
			Toast.show({
				type: "error",
				text1: t("pincodeLookupFailed", "Pincode lookup failed"),
				text2: t("pleaseEnterValidPincode", "Please enter a valid pincode"),
				visibilityTime: 3000,
			});
		},
	});

	// ─── Document Upload Mutation ────────────────────────────────────────────
	const uploadDocumentMutation = useNetworkAwareMutation({
		mutationFn: uploadKycDocument,
		onSuccess: (data, variables) => {
			console.log("📄 Document upload successful");

			setUploadedFiles((prev) =>
				prev.map((file) =>
					file.uri === (variables.file as any).uri
						? {
								...file,
								uploadUrl: data.upload_url,
								fileUrl: data.file_url,
								uploading: false,
						  }
						: file
				)
			);

			Toast.show({
				type: "success",
				text1: t("documentUploadedSuccessfully", "Document uploaded successfully"),
				text2: data.filename,
			});
		},
		onError: (error: any, variables) => {
			console.error("❌ Document upload failed");

			setUploadedFiles((prev) =>
				prev.map((file) =>
					file.uri === (variables.file as any).uri ? { ...file, uploading: false } : file
				)
			);

			const errorMessage =
				error?.response?.data?.message || error?.message || t("pleaseRetryPayment", "Please try again");
			Toast.show({
				type: "error",
				text1: t("documentUploadFailed", "Document upload failed"),
				text2: errorMessage,
			});
		},
	});

	const handleFileUpload = async (fileUri: string, fileName: string, fileType?: string) => {
		try {
			setIsUploading(true);
			await uploadDocumentMutation.mutateAsync({
				document_type: "aadhaar kyc",
				file: {
					uri: fileUri,
					name: fileName,
					type: fileType || "application/pdf",
				},
			});
		} catch (error) {
			console.error("File upload error:", error);
		} finally {
			setIsUploading(false);
		}
	};

	// Validation check: when "No", requires all four address fields + 1 uploaded document
	const isCommunicationAddressComplete = () => {
		return (
			commAddressLine1.trim() !== "" &&
			commPincode.trim() !== "" &&
			commCity.trim() !== "" &&
			commState.trim() !== "" &&
			uploadedFiles.length > 0 &&
			uploadedFiles.some((file) => file.fileUrl || file.uploadUrl)
		);
	};

	// ─── Submit Address Verification ─────────────────────────────────────────
	const handleAddressVerification = async (isCurrentAddr: boolean) => {
		try {
			setIsLoading(true);

			const kycAddress = `${address?.house || ""} ${address?.street || ""} ${address?.loc || ""}`.trim();

			// Request shape matching reference handleAddressVerification
			const requestData: AddressVerificationRequestType = {
				is_current_address: isCurrentAddr,
				kyc_proof_of_address_number: "abc", // Reference-inherited oddity
				kyc_address: kycAddress,
				kyc_city: address?.dist || "",
				kyc_pin_code: address?.pc || "",
				kyc_state: address?.state || "",
			};

			if (!isCurrentAddr) {
				const commAddress = `${commAddressLine1} ${commAddressLine2}`.trim();
				requestData.communication_address = commAddress;
				requestData.communication_city = commCity;
				requestData.communication_pin_code = commPincode;
				requestData.communication_state = commState;
				requestData.communication_proof_of_address_number = "abc"; // Reference-inherited oddity

				const uploadedFile = uploadedFiles.find((file) => file.fileUrl || file.uploadUrl);
				if (uploadedFile?.fileUrl) {
					requestData.address_proof_url = uploadedFile.fileUrl;
					requestData.document_type = "electricity_bill"; // Reference-inherited oddity
				} else if (uploadedFile?.uploadUrl) {
					requestData.address_proof_url = `${API_URL}${uploadedFile.uploadUrl}`;
					requestData.document_type = "electricity_bill"; // Reference-inherited oddity
				} else {
					requestData.document_type = "electricity_bill"; // Reference-inherited oddity
				}
			}

			// Security standard: Short status-only log without PII address values
			console.log("Submitting address verification - isCurrentAddress:", isCurrentAddr);

			const response = await verifyAddress(requestData);

			console.log("Address verification status: success");

			if (response) {
				setSuccessRouteParams({
					is_repeat_user: response.is_repeat_user ? "true" : "false",
					next_step: response.next_step || "",
				});
				setIsKycSuccessModalVisible(true);
			} else {
				Toast.show({
					type: "error",
					text1: t("addressVerificationFailed", "Address verification failed"),
					text2: t("pleaseRetryPayment", "Please try again"),
				});
			}
		} catch (error: any) {
			console.error("Address verification error occurred");
			const errorMessage =
				error?.response?.data?.message || error?.message || t("pleaseRetryPayment", "Please try again");

			Toast.show({
				type: "error",
				text1: t("failedToVerifyAddress", "Failed to verify address"),
				text2: errorMessage,
			});
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<SafeAreaView style={styles.bg}>
			{/* Top Header */}
			<View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
				<TouchableOpacity
					style={styles.backButton}
					onPress={handleBack}
					hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
					activeOpacity={0.7}
				>
					<MaterialIcons name="arrow-back" size={24} color={dark} />
				</TouchableOpacity>
				<Text style={styles.headerTitle}>
					{t("confirmYourAddressDetails", "Confirm your address details")}
				</Text>
				<View style={styles.headerRight} />
			</View>

			<ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
				<View style={styles.card}>
					<TranslatedText
						style={styles.cardTitle}
						translationKey="confirmYourAddressDetails"
						fallback="Confirm your address details"
					/>

					{/* Address Line 1 */}
					<TranslatedText style={styles.label} translationKey="addressLine1" fallback="Address Line 1" />
					{currentAddress === "Yes" ? (
						<ScrollView horizontal showsHorizontalScrollIndicator={false}>
							<View style={[styles.input, styles.readOnlyContainer, { minWidth: "100%" }]}>
								<Text style={styles.readOnlyText}>{address?.house || ""}</Text>
							</View>
						</ScrollView>
					) : (
						<TextInput
							style={styles.input}
							value={commAddressLine1}
							onChangeText={setCommAddressLine1}
							placeholder={t("enterAddressLine1", "Enter address line 1")}
							placeholderTextColor="#999"
							editable={!isLoading && !isUploading}
						/>
					)}

					{/* Address Line 2 */}
					<TranslatedText style={styles.label} translationKey="addressLine2" fallback="Address Line 2" />
					{currentAddress === "Yes" ? (
						<ScrollView horizontal showsHorizontalScrollIndicator={false}>
							<View style={[styles.input, styles.readOnlyContainer, { minWidth: "100%" }]}>
								<Text style={styles.readOnlyText}>
									{`${address?.street ?? ""} ${address?.loc ?? ""}`.trim()}
								</Text>
							</View>
						</ScrollView>
					) : (
						<TextInput
							style={styles.input}
							value={commAddressLine2}
							onChangeText={setCommAddressLine2}
							placeholder={t("enterAddressLine2", "Enter address line 2")}
							placeholderTextColor="#999"
							editable={!isLoading && !isUploading}
						/>
					)}

					{/* Pincode */}
					<TranslatedText style={styles.label} translationKey="pincode" fallback="Pincode" />
					<TextInput
						style={styles.input}
						value={currentAddress === "No" ? commPincode : address?.pc}
						onChangeText={(value) => {
							if (currentAddress === "No") {
								const numericValue = value.replace(/[^0-9]/g, "");
								setCommPincode(numericValue);

								if (numericValue.length === 6) {
									lookupPincodeMutation(numericValue);
								} else if (numericValue.length !== 6) {
									setCommCity("");
									setCommState("");
								}
							}
						}}
						placeholder={
							isLookingUpPincode
								? t("lookingUp", "Looking up...")
								: t("enterPincode", "Enter pincode")
						}
						placeholderTextColor="#999"
						keyboardType="numeric"
						maxLength={6}
						editable={currentAddress === "No" && !isLoading && !isUploading}
					/>

					{/* City & State (Two columns) */}
					<View style={{ flexDirection: "row", gap: 8 }}>
						<View style={{ flex: 1 }}>
							<TranslatedText style={styles.label} translationKey="city" fallback="City" />
							<TextInput
								style={[
									styles.input,
									currentAddress === "No" && commCity !== "" && styles.disabledInput,
								]}
								value={currentAddress === "No" ? commCity : address?.dist}
								placeholder=""
								editable={false}
							/>
						</View>
						<View style={{ flex: 1 }}>
							<TranslatedText style={styles.label} translationKey="state" fallback="State" />
							<TextInput
								style={[
									styles.input,
									currentAddress === "No" && commState !== "" && styles.disabledInput,
								]}
								value={currentAddress === "No" ? commState : address?.state}
								placeholder=""
								editable={false}
							/>
						</View>
					</View>

					{/* Document Upload Section (Shown ONLY when "No" is selected) */}
					{currentAddress === "No" && (
						<>
							<TranslatedText
								style={styles.label}
								translationKey="uploadUtilityBillRentalAgreement"
								fallback="Upload Utility Bill / Rental Agreement"
							/>
							<Text style={{ fontSize: 12, color: "#666", marginBottom: 8 }}>
								{t("acceptedFormats", "Accepted formats")}: PNG, JPG, PDF
							</Text>
							<View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
								<TouchableOpacity
									style={[
										styles.uploadBtn,
										uploadedFiles.length >= 1 && { opacity: 0.5 },
									]}
									disabled={isUploading || uploadedFiles.length >= 1}
									onPress={async () => {
										try {
											const result = await DocumentPicker.getDocumentAsync({
												type: [
													"image/png",
													"image/jpeg",
													"image/jpg",
													"application/pdf",
												],
											});

											if (!result.canceled && result.assets && result.assets.length > 0) {
												const file = result.assets[0];

												// Validate file type
												const validTypes = [
													"image/png",
													"image/jpeg",
													"image/jpg",
													"application/pdf",
												];
												const fileExtension = file.name.toLowerCase().split(".").pop();
												const validExtensions = ["png", "jpg", "jpeg", "pdf"];

												if (
													!validTypes.includes(file.mimeType || "") &&
													!validExtensions.includes(fileExtension || "")
												) {
													Toast.show({
														type: "error",
														text1: t("invalidFileType", "Invalid file type"),
														text2: t(
															"onlyPngJpgPdfAllowed",
															"Only PNG, JPG, and PDF files are allowed"
														),
													});
													return;
												}

												if (uploadedFiles.length >= 1) {
													Toast.show({
														type: "error",
														text1: t("maximumFileLimit", "Maximum file limit reached"),
														text2: t(
															"youCanUploadOnlyOneDocument",
															"You can upload only one document"
														),
													});
													return;
												}

												// Add file to list
												setUploadedFiles((prev) => [
													...prev,
													{
														name: file.name,
														uri: file.uri,
														uploading: true,
														mimeType: file.mimeType,
													},
												]);

												// Execute upload
												handleFileUpload(file.uri, file.name, file.mimeType);
											}
										} catch (err) {
											console.error("Document picker error:", err);
										}
									}}
								>
									<Text style={styles.uploadBtnText}>
										{isUploading
											? t("uploading", "Uploading...")
											: uploadedFiles.length >= 1
											? t("maxLimitReached", "Max limit reached")
											: t("upload", "Upload ⬆️")}
									</Text>
								</TouchableOpacity>
							</View>

							{/* Uploaded File List */}
							{uploadedFiles.length > 0 && (
								<View style={{ marginTop: 12, width: "100%" }}>
									<TranslatedText
										style={styles.label}
										translationKey="uploadedFiles"
										fallback="Uploaded Files:"
									/>
									{uploadedFiles.map((file, idx) => (
										<TouchableOpacity
											key={file.uri}
											style={styles.fileRow}
											onPress={() => {
												if (file.uri) {
													setPreviewFile({
														uri: file.uri,
														name: file.name,
														mimeType: file.mimeType,
													});
												}
											}}
										>
											<View style={{ flex: 1 }}>
												<Text style={styles.fileName}>
													{file.name}
													{file.uploading && ` (${t("uploading", "Uploading...")})`}
													{(file.uploadUrl || file.fileUrl) && " ✓"}
												</Text>
												<Text style={{ fontSize: 11, color: "#666", marginTop: 2 }}>
													{t("tapToPreview", "Tap to preview")}
												</Text>
											</View>
											<TouchableOpacity
												onPress={(e) => {
													e.stopPropagation();
													setUploadedFiles((files) => files.filter((_, i) => i !== idx));
												}}
												disabled={file.uploading}
											>
												<Text
													style={[
														styles.removeFile,
														file.uploading && { color: "#ccc" },
													]}
												>
													{t("remove", "Remove")}
												</Text>
											</TouchableOpacity>
										</TouchableOpacity>
									))}
								</View>
							)}
						</>
					)}

					{/* "Is this your current address?" Radio Toggle */}
					<TranslatedText
						style={styles.label}
						translationKey="isCurrentAddress"
						fallback="Is this your current address ?"
					/>
					<View
						style={{
							flexDirection: "row",
							alignItems: "center",
							marginBottom: 16,
							marginTop: 8,
						}}
					>
						<TouchableOpacity
							style={styles.radioBtn}
							onPress={() => {
								setCurrentAddress("Yes");
								setCommAddressLine1("");
								setCommAddressLine2("");
								setCommPincode("");
								setCommCity("");
								setCommState("");
								setUploadedFiles([]);
							}}
							activeOpacity={0.8}
						>
							<View
								style={[
									styles.radioOuter,
									currentAddress === "Yes" && styles.radioOuterActive,
								]}
							>
								{currentAddress === "Yes" && <View style={styles.radioInner} />}
							</View>
							<TranslatedText
								style={styles.radioText}
								translationKey="yesIStayHere"
								fallback="Yes, I stay here"
							/>
						</TouchableOpacity>

						<TouchableOpacity
							style={styles.radioBtn}
							onPress={() => {
								setCurrentAddress("No");
							}}
							activeOpacity={0.8}
						>
							<View
								style={[
									styles.radioOuter,
									currentAddress === "No" && styles.radioOuterActive,
								]}
							>
								{currentAddress === "No" && <View style={styles.radioInner} />}
							</View>
							<TranslatedText
								style={styles.radioText}
								translationKey="noIDontStayHere"
								fallback="No, I don't stay here"
							/>
						</TouchableOpacity>
					</View>

					{/* Submit Button */}
					<TouchableOpacity
						style={[
							styles.submitBtn,
							{
								opacity:
									currentAddress === "Yes"
										? isLoading
											? 0.5
											: 1
										: isCommunicationAddressComplete() && !isLoading && !isUploading
										? 1
										: 0.5,
							},
						]}
						disabled={
							isLoading ||
							(currentAddress === "No" &&
								(!isCommunicationAddressComplete() ||
									isUploading ||
									uploadDocumentMutation.isPending))
						}
						onPress={() => {
							if (currentAddress === "Yes") {
								handleAddressVerification(true);
							} else {
								handleAddressVerification(false);
							}
						}}
						activeOpacity={0.85}
					>
						<View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
							<Text style={styles.submitBtnText}>
								{isLoading
									? t("processing", "Processing...")
									: isUploading
									? t("uploading", "Uploading...")
									: t("submit", "Submit")}
							</Text>
							{!(isLoading || isUploading) && (
								<IconSymbol name="arrow.right" size={20} color="white" />
							)}
						</View>
					</TouchableOpacity>
				</View>
			</ScrollView>

			{/* Document Preview Modal */}
			<Modal
				visible={previewFile !== null}
				transparent={true}
				animationType="fade"
				onRequestClose={() => setPreviewFile(null)}
			>
				<View style={styles.previewModalOverlay}>
					<View style={styles.previewModalContent}>
						<View style={styles.previewHeader}>
							<Text style={styles.previewTitle} numberOfLines={1}>
								{previewFile?.name || t("preview", "Preview")}
							</Text>
							<TouchableOpacity
								onPress={() => setPreviewFile(null)}
								style={styles.previewCloseButton}
							>
								<Text style={styles.previewCloseText}>✕</Text>
							</TouchableOpacity>
						</View>
						<View style={styles.previewImageContainer}>
							{previewFile?.mimeType?.startsWith("image/") ? (
								<Image
									source={{ uri: previewFile.uri }}
									style={styles.previewImage}
									contentFit="contain"
								/>
							) : (
								<View style={styles.pdfPreviewPlaceholder}>
									<Text style={styles.pdfIcon}>📄</Text>
									<Text style={styles.pdfText}>
										{t("pdfDocument", "PDF Document")}
									</Text>
									<Text style={styles.pdfName}>{previewFile?.name}</Text>
									<TouchableOpacity
										style={styles.openExternalButton}
										onPress={async () => {
											if (previewFile?.uri) {
												try {
													await Share.share({
														url: previewFile.uri,
														title: t("openInExternalApp", "Open in External App"),
													});
												} catch (error) {
													console.error("Error sharing PDF:", error);
													Toast.show({
														type: "error",
														text1: t("cannotOpenFile", "Cannot open file"),
														text2: t(
															"pleaseInstallPdfViewer",
															"Please install a PDF viewer app"
														),
													});
												}
											}
										}}
									>
										<Text style={styles.openExternalButtonText}>
											{t("openInExternalApp", "Open in External App")}
										</Text>
									</TouchableOpacity>
								</View>
							)}
						</View>
					</View>
				</View>
			</Modal>

			{/* KYC Verification Success Modal */}
			<KycSuccessModal
				visible={isKycSuccessModalVisible}
				onContinue={handleContinueSuccess}
			/>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	bg: {
		flex: 1,
		backgroundColor: "#EAF2FB",
	},
	header: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: 16,
		paddingBottom: 12,
		backgroundColor: "#EAF2FB",
	},
	backButton: {
		padding: 4,
	},
	headerTitle: {
		fontSize: 18,
		fontWeight: "700",
		color: dark,
	},
	headerRight: {
		width: 32,
	},
	container: {
		flexGrow: 1,
		justifyContent: "center",
		alignItems: "center",
		padding: 16,
	},
	card: {
		backgroundColor: "#FFFFFF",
		borderRadius: 18,
		padding: 20,
		width: "100%",
		maxWidth: 420,
		marginBottom: 24,
		elevation: 2,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.1,
		shadowRadius: 3,
	},
	cardTitle: {
		fontWeight: "700",
		fontSize: 20,
		marginBottom: 16,
		color: dark,
	},
	label: {
		fontWeight: "600",
		fontSize: 14,
		marginTop: 12,
		marginBottom: 4,
		color: "#777777",
	},
	input: {
		backgroundColor: "#FFFFFF",
		borderWidth: 1,
		borderColor: "#CCCCCC",
		color: "#000000",
		borderRadius: 8,
		padding: 12,
		fontSize: 15,
		marginBottom: 4,
	},
	readOnlyContainer: {
		justifyContent: "center",
		backgroundColor: "#F9FAFB",
		borderColor: "#E5E7EB",
	},
	readOnlyText: {
		fontSize: 15,
		color: "#111827",
	},
	disabledInput: {
		backgroundColor: "#F5F5F5",
		color: "#666666",
	},
	submitBtn: {
		backgroundColor: "#4F6EF7",
		borderRadius: 8,
		paddingVertical: 16,
		alignItems: "center",
		marginTop: 20,
	},
	submitBtnText: {
		color: "#FFFFFF",
		fontWeight: "600",
		fontSize: 16,
	},
	radioBtn: {
		flexDirection: "row",
		alignItems: "center",
		marginRight: 16,
	},
	radioOuter: {
		width: 20,
		height: 20,
		borderRadius: 10,
		borderWidth: 2,
		borderColor: "#4F6EF7",
		alignItems: "center",
		justifyContent: "center",
		marginRight: 6,
	},
	radioOuterActive: {
		borderColor: "#4F6EF7",
	},
	radioInner: {
		width: 10,
		height: 10,
		borderRadius: 5,
		backgroundColor: "#4F6EF7",
	},
	radioText: {
		fontSize: 14,
		color: "#222222",
	},
	uploadBtn: {
		backgroundColor: "#EAF2EB",
		borderRadius: 6,
		paddingHorizontal: 16,
		paddingVertical: 10,
	},
	uploadBtnText: {
		color: "#1DBF73",
		fontWeight: "600",
		fontSize: 15,
	},
	fileRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		backgroundColor: "#F3F3F3",
		borderRadius: 6,
		padding: 10,
		marginTop: 6,
	},
	fileName: {
		color: "#333333",
		fontSize: 14,
		flex: 1,
	},
	removeFile: {
		color: "#F44336",
		fontWeight: "600",
		marginLeft: 12,
	},
	previewModalOverlay: {
		flex: 1,
		backgroundColor: "rgba(0, 0, 0, 0.9)",
		justifyContent: "center",
		alignItems: "center",
	},
	previewModalContent: {
		width: width(90),
		height: height(80),
		backgroundColor: "#FFFFFF",
		borderRadius: 12,
		overflow: "hidden",
	},
	previewHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		padding: 16,
		borderBottomWidth: 1,
		borderBottomColor: "#E5E5E5",
		backgroundColor: "#FFFFFF",
	},
	previewTitle: {
		fontSize: 16,
		fontWeight: "600",
		color: dark,
		flex: 1,
		marginRight: 12,
	},
	previewCloseButton: {
		width: 32,
		height: 32,
		borderRadius: 16,
		backgroundColor: "#F5F5F5",
		justifyContent: "center",
		alignItems: "center",
	},
	previewCloseText: {
		fontSize: 18,
		color: "#666666",
		fontWeight: "bold",
	},
	previewImageContainer: {
		flex: 1,
		backgroundColor: "#F5F5F5",
		justifyContent: "center",
		alignItems: "center",
	},
	previewImage: {
		width: "100%",
		height: "100%",
	},
	pdfPreviewPlaceholder: {
		justifyContent: "center",
		alignItems: "center",
		padding: 24,
	},
	pdfIcon: {
		fontSize: 64,
		marginBottom: 16,
	},
	pdfText: {
		fontSize: 18,
		fontWeight: "600",
		color: dark,
		marginBottom: 8,
	},
	pdfName: {
		fontSize: 14,
		color: "#666666",
		textAlign: "center",
		marginBottom: 24,
	},
	openExternalButton: {
		backgroundColor: "#4F6EF7",
		paddingHorizontal: 24,
		paddingVertical: 12,
		borderRadius: 8,
	},
	openExternalButtonText: {
		color: "#FFFFFF",
		fontSize: 16,
		fontWeight: "600",
	},
});

export { RouteErrorBoundary as ErrorBoundary } from "@/components/ErrorBoundary";
