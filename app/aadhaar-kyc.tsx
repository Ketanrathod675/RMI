import React, { useCallback, useEffect, useRef, useState } from "react";
import {
	ActivityIndicator,
	Alert,
	BackHandler,
	Modal,
	Platform,
	ScrollView,
	Share,
	StyleSheet,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams, useNavigation } from "expo-router";
import Toast from "react-native-toast-message";
import * as DocumentPicker from "expo-document-picker";
import { Image } from "expo-image";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { IconSymbol } from "@/components/ui/IconSymbol";
import { TranslatedText } from "@/components/TranslatedText";
import { KycSuccessModal } from "@/components/KycSuccessModal";
import ExitIntentModal from "@/components/assessment-fee/ExitIntentModal";
import { dark } from "@/constants/Colors";
import { useJourneyTracker } from "@/hooks/useJourneyTracker";
import { useNetworkAwareMutation } from "@/hooks/useNetworkAwareMutation";
import { useTranslation } from "@/hooks/useTranslation";
import {
	getAddressDocumentTypes,
	getAddressStatus,
	getPincodeDetails,
	getUserDashboardData,
	StepHref,
	submitAddress,
	uploadAddressProof,
	type SubmitAddressPayload,
} from "@/utils/api";
import { Select, type SelectOption } from "@/components";
import { useQueryClient } from "@tanstack/react-query";
import { font, height, width } from "@/utils/dimensions";

export type AddressType = {
	house: string;
	street: string;
	loc: string;
	dist: string;
	pc: string;
	state: string;
	country: string;
	subdist: string;
	vtc: string;
	po: string;
	landmark: string;
};

const DEFAULT_EMPTY_ADDRESS: AddressType = {
	house: "",
	street: "",
	loc: "",
	dist: "",
	pc: "",
	state: "",
	country: "India",
	subdist: "",
	vtc: "",
	po: "",
	landmark: "",
};

export type UploadedFileType = {
	name: string;
	uri: string;
	uploadUrl?: string;
	fileUrl?: string;
	uploading?: boolean;
	mimeType?: string;
};

const DEFAULT_DOCUMENT_TYPE_OPTIONS: SelectOption[] = [
	{ label: "Electricity Bill", value: "electricity_bill" },
	{ label: "Water Bill", value: "water_bill" },
	{ label: "Gas Bill", value: "gas_bill" },
	{ label: "Telephone / Broadband Bill", value: "telephone_bill" },
	{ label: "General Utility Bill", value: "utility_bill" },
	{ label: "Registered Rental Agreement", value: "rental_agreement" },
	{ label: "Property Tax Receipt", value: "property_tax_receipt" },
	{ label: "Driving License", value: "driving_license" },
	{ label: "Voter ID Card", value: "voter_id" },
	{ label: "Passport", value: "passport" },
];

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

	const [isExitModalVisible, setIsExitModalVisible] = useState(false);

	// Step 1: Address verification form
	const queryClient = useQueryClient();
	const [address, setAddress] = useState<AddressType | null>(DEFAULT_EMPTY_ADDRESS);
	const [isAddressLoading, setIsAddressLoading] = useState(true);
	const [addressLoadError, setAddressLoadError] = useState<string | null>(null);
	const [documentTypeOptions, setDocumentTypeOptions] = useState<SelectOption[]>(DEFAULT_DOCUMENT_TYPE_OPTIONS);
	const [selectedDocumentType, setSelectedDocumentType] = useState<string>("electricity_bill");
	const [currentAddress, setCurrentAddress] = useState<"Yes" | "No">("Yes");
	const [commAddressLine1, setCommAddressLine1] = useState("");
	const [commAddressLine2, setCommAddressLine2] = useState("");
	const [commCity, setCommCity] = useState("");
	const [commPincode, setCommPincode] = useState("");
	const [commState, setCommState] = useState("");
	const [commErrors, setCommErrors] = useState({ addressLine1: "", pincode: "" });
	const commAddressLine1Ref = useRef<TextInput>(null);
	const commAddressLine2Ref = useRef<TextInput>(null);
	const commPincodeRef = useRef<TextInput>(null);
	const [uploadedFiles, setUploadedFiles] = useState<UploadedFileType[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [isUploading, setIsUploading] = useState(false);
	const [previewFile, setPreviewFile] = useState<{ uri: string; name: string; mimeType?: string } | null>(null);
	const [isKycSuccessModalVisible, setIsKycSuccessModalVisible] = useState(false);

	const handleContinueSuccess = async () => {
		setIsKycSuccessModalVisible(false);
		try {
			await queryClient.invalidateQueries({ queryKey: ["user", "dashboard"] });
			const dash = await getUserDashboardData();
			const nextStep = dash?.workflow_progress?.current_step || "bank_details";
			const targetRoute = StepHref[nextStep as keyof typeof StepHref] || "/verify-bank-details";
			router.replace(targetRoute as any);
		} catch {
			router.replace("/verify-bank-details" as any);
		}
	};

	const loadAddressData = useCallback(async () => {
		setIsAddressLoading(true);
		setAddressLoadError(null);
		try {
			const res = await getAddressStatus();
			if (res.success && res.data) {
				const d = res.data;
				setAddress({
					house: d.kyc_address || "",
					street: "",
					loc: "",
					dist: d.kyc_city || "",
					pc: d.kyc_pin_code || "",
					state: d.kyc_state || "",
					country: "India",
					subdist: "",
					vtc: "",
					po: "",
					landmark: "",
				});

				let rawTypes = d.supported_document_types;
				if (!rawTypes || rawTypes.length === 0) {
					try {
						const docTypesRes = await getAddressDocumentTypes();
						rawTypes = docTypesRes.data?.document_types;
					} catch {
						// ignore fallback
					}
				}

				const formattedOptions: SelectOption[] = [];
				if (rawTypes && Array.isArray(rawTypes) && rawTypes.length > 0) {
					for (const item of rawTypes) {
						if (!item) continue;
						if (typeof item === "string") {
							formattedOptions.push({
								label: item.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()),
								value: item,
							});
							continue;
						}
						const val = item.value ?? item.id ?? item.code ?? item.type ?? "";
						if (!val) continue;
						const lbl =
							item.label ??
							item.name ??
							item.title ??
							String(val).replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
						formattedOptions.push({
							label: String(lbl),
							value: String(val),
						});
					}
				}

				const resolvedOptions: SelectOption[] =
					formattedOptions.length > 0 ? formattedOptions : DEFAULT_DOCUMENT_TYPE_OPTIONS;

				setDocumentTypeOptions(resolvedOptions);
				if (resolvedOptions.length > 0) {
					setSelectedDocumentType((prev) => {
						const exists = resolvedOptions.some((opt) => opt.value === prev);
						return exists ? prev : String(resolvedOptions[0].value);
					});
				}
			} else {
				setAddressLoadError(res.message || "Failed to load KYC address");
			}
		} catch (err: any) {
			setAddressLoadError(err?.detail || err?.message || "Failed to load KYC address");
			setDocumentTypeOptions((prev) => (prev.length > 0 ? prev : DEFAULT_DOCUMENT_TYPE_OPTIONS));
		} finally {
			setIsAddressLoading(false);
		}
	}, []);

	useEffect(() => {
		loadAddressData();
	}, [loadAddressData]);

	// Back button handling with confirmation modal
	const handleBack = () => {
		if (isKycSuccessModalVisible) {
			handleContinueSuccess();
			return;
		}
		setIsExitModalVisible(true);
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
		mutationFn: async (pin: string) => getPincodeDetails(pin),
		onSuccess: (data) => {
			if (data?.found) {
				const city = data.city || data.district || "";
				const state = data.state || "";

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
					text2: data?.message || t("pleaseCheckAndEnterValidPincode", "Please check and enter a valid pincode"),
					visibilityTime: 3000,
				});
			}
		},
		onError: () => {
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

	const handleFileUpload = async (fileUri: string, fileName: string, fileType?: string) => {
		try {
			setIsUploading(true);
			const res = await uploadAddressProof({
				uri: fileUri,
				name: fileName,
				type: fileType || "application/pdf",
			});

			if (res.success && res.data?.file_url) {
				setUploadedFiles([
					{
						name: fileName,
						uri: fileUri,
						fileUrl: res.data.file_url,
						uploadUrl: res.data.file_url,
						uploading: false,
						mimeType: fileType,
					},
				]);
				Toast.show({
					type: "success",
					text1: t("documentUploadedSuccessfully", "Document uploaded successfully"),
					text2: fileName,
				});
			} else {
				setUploadedFiles([]);
				Toast.show({
					type: "error",
					text1: t("documentUploadFailed", "Document upload failed"),
					text2: res.message || t("pleaseRetryPayment", "Please try again"),
				});
			}
		} catch (error: any) {
			setUploadedFiles([]);
			Toast.show({
				type: "error",
				text1: t("documentUploadFailed", "Document upload failed"),
				text2: error?.detail || error?.message || t("pleaseRetryPayment", "Please try again"),
			});
		} finally {
			setIsUploading(false);
		}
	};

	// Validation check: when "No", requires all four address fields + 1 uploaded document
	const isCommunicationAddressComplete = () => {
		return (
			commAddressLine1.trim() !== "" &&
			commPincode.trim().length === 6 &&
			commCity.trim() !== "" &&
			commState.trim() !== "" &&
			Boolean(selectedDocumentType) &&
			uploadedFiles.length > 0 &&
			uploadedFiles.some((file) => file.fileUrl || file.uploadUrl)
		);
	};

	// ─── Submit Address Verification ─────────────────────────────────────────
	const handleAddressVerification = async (isCurrentAddr: boolean) => {
		if (!isCurrentAddr) {
			if (!commAddressLine1.trim()) {
				setCommErrors((prev) => ({ ...prev, addressLine1: t("addressLine1Required" as any, "Address line 1 is required") }));
				commAddressLine1Ref.current?.focus();
				return;
			}
			if (!commPincode.trim() || commPincode.length !== 6) {
				setCommErrors((prev) => ({ ...prev, pincode: t("pincodeRequired", "Valid 6-digit pincode is required") }));
				commPincodeRef.current?.focus();
				return;
			}
			if (!commCity.trim() || !commState.trim()) {
				Toast.show({
					type: "error",
					text1: t("alert", "Alert"),
					text2: t("enterValidPincodeForCityState" as any, "Please enter a valid pincode to autofill city and state"),
				});
				return;
			}
			const proofFile = uploadedFiles.find((f) => f.fileUrl || f.uploadUrl);
			if (!proofFile?.fileUrl && !proofFile?.uploadUrl) {
				Toast.show({
					type: "error",
					text1: t("alert", "Alert"),
					text2: t("pleaseUploadAddressProof" as any, "Please upload address proof document"),
				});
				return;
			}
		}

		try {
			setIsLoading(true);

			const kycAddress = `${address?.house || ""} ${address?.street || ""} ${address?.loc || ""}`.trim();

			const payload: SubmitAddressPayload = {
				is_current_address: isCurrentAddr,
				kyc_address: kycAddress,
				kyc_city: address?.dist || "",
				kyc_pin_code: address?.pc || "",
				kyc_state: address?.state || "",
			};

			if (!isCurrentAddr) {
				payload.communication_address = `${commAddressLine1} ${commAddressLine2}`.trim();
				payload.communication_city = commCity;
				payload.communication_pin_code = commPincode;
				payload.communication_state = commState;
				payload.document_type = selectedDocumentType;
				const uploadedFile = uploadedFiles.find((file) => file.fileUrl || file.uploadUrl);
				payload.address_proof_url = uploadedFile?.fileUrl || uploadedFile?.uploadUrl;
			}

			const response = await submitAddress(payload);

			if (response.success) {
				queryClient.invalidateQueries({ queryKey: ["user", "dashboard"] });
				setIsKycSuccessModalVisible(true);
			} else {
				Toast.show({
					type: "error",
					text1: t("addressVerificationFailed", "Address verification failed"),
					text2: response.message || t("pleaseRetryPayment", "Please try again"),
				});
			}
		} catch (error: any) {
			Toast.show({
				type: "error",
				text1: t("failedToVerifyAddress", "Failed to verify address"),
				text2: error?.detail || error?.message || t("pleaseRetryPayment", "Please try again"),
			});
		} finally {
			setIsLoading(false);
		}
	};

	if (isAddressLoading) {
		return (
			<SafeAreaView style={[styles.bg, { justifyContent: "center", alignItems: "center" }]}>
				<ActivityIndicator size="large" color={dark} />
				<Text style={{ marginTop: 12, color: "#666", fontSize: font(1.6) }}>
					{t("verifyingDetails", "Verifying your details...")}
				</Text>
			</SafeAreaView>
		);
	}

	if (addressLoadError) {
		return (
			<SafeAreaView style={[styles.bg, { justifyContent: "center", alignItems: "center", padding: 24 }]}>
				<Text style={{ fontSize: font(2), fontWeight: "700", color: dark, marginBottom: 8 }}>
					{t("alert", "Alert")}
				</Text>
				<Text style={{ fontSize: font(1.5), color: "#666", textAlign: "center", marginBottom: 20 }}>
					{addressLoadError}
				</Text>
				<TouchableOpacity
					style={{ backgroundColor: dark, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 10 }}
					onPress={loadAddressData}
				>
					<Text style={{ color: "#fff", fontWeight: "700", fontSize: font(1.5) }}>{t("tryAgain", "Try Again")}</Text>
				</TouchableOpacity>
			</SafeAreaView>
		);
	}

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

			<ScrollView
				contentContainerStyle={styles.container}
				keyboardShouldPersistTaps="handled"
				keyboardDismissMode="on-drag">
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
						<>
							<TextInput
								ref={commAddressLine1Ref}
								style={[styles.input, commErrors.addressLine1 ? { borderColor: "#d32f2f" } : null]}
								value={commAddressLine1}
								onChangeText={(val) => {
									setCommAddressLine1(val);
									if (commErrors.addressLine1) setCommErrors((prev) => ({ ...prev, addressLine1: "" }));
								}}
								placeholder={t("enterAddressLine1", "Enter address line 1")}
								placeholderTextColor="#999"
								autoCapitalize="words"
								returnKeyType="next"
								blurOnSubmit={false}
								onSubmitEditing={() => commAddressLine2Ref.current?.focus()}
								editable={!isLoading && !isUploading}
							/>
							{commErrors.addressLine1 ? (
								<Text style={styles.errorText}>{commErrors.addressLine1}</Text>
							) : null}
						</>
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
							ref={commAddressLine2Ref}
							style={styles.input}
							value={commAddressLine2}
							onChangeText={setCommAddressLine2}
							placeholder={t("enterAddressLine2", "Enter address line 2")}
							placeholderTextColor="#999"
							autoCapitalize="words"
							returnKeyType="next"
							blurOnSubmit={false}
							onSubmitEditing={() => commPincodeRef.current?.focus()}
							editable={!isLoading && !isUploading}
						/>
					)}

					{/* Pincode */}
					<TranslatedText style={styles.label} translationKey="pincode" fallback="Pincode" />
					<TextInput
						ref={commPincodeRef}
						style={[styles.input, commErrors.pincode ? { borderColor: "#d32f2f" } : null]}
						value={currentAddress === "No" ? commPincode : address?.pc}
						onChangeText={(value) => {
							if (currentAddress === "No") {
								const numericValue = value.replace(/[^0-9]/g, "");
								setCommPincode(numericValue);
								if (commErrors.pincode) setCommErrors((prev) => ({ ...prev, pincode: "" }));

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
						autoCapitalize="none"
						maxLength={6}
						returnKeyType="done"
						editable={currentAddress === "No" && !isLoading && !isUploading}
					/>
					{commErrors.pincode ? (
						<Text style={styles.errorText}>{commErrors.pincode}</Text>
					) : null}

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
							<View style={{ marginBottom: 16 }}>
								<TranslatedText
									style={styles.label}
									translationKey={"documentType" as any}
									fallback="Document Type"
								/>
								<Select
									title={t("selectDocumentType" as any, "Select Document Type")}
									placeholder={t("selectDocumentType" as any, "Select Document Type")}
									options={documentTypeOptions}
									selectedValue={selectedDocumentType}
									onSelect={(val) => setSelectedDocumentType(String(val))}
								/>
							</View>

							<TranslatedText
								style={styles.label}
								translationKey={"uploadProofOfAddress" as any}
								fallback="Upload Proof of Address"
							/>
							<Text style={{ fontSize: 12, color: "#666", marginBottom: 8 }}>
								{t("acceptedFormats", "Accepted formats")}: PNG, JPG, PDF (Max 10 MB)
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

												if (file.size && file.size > 10 * 1024 * 1024) {
													Toast.show({
														type: "error",
														text1: t("alert", "Alert"),
														text2: "Maximum file size allowed is 10 MB",
													});
													return;
												}

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
								(!isCommunicationAddressComplete() || isUploading))
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

			<ExitIntentModal
				visible={isExitModalVisible}
				onClose={() => setIsExitModalVisible(false)}
				onConfirmExit={() => {
					setIsExitModalVisible(false);
					router.replace("/(tabs)");
				}}
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
	errorText: {
		color: "#d32f2f",
		fontSize: 12,
		marginBottom: 8,
		marginLeft: 2,
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
