import OvalCameraCapture from "@/components/OvalCameraCapture";
import { TranslatedText } from "@/components/TranslatedText";
import { dark, primary } from "@/constants/Colors";
import { IconSymbol } from "@/components/ui/IconSymbol";
import { Images } from "@/constants/images";
import { useJourneyTracker } from "@/hooks/useJourneyTracker";
import { useNetworkAwareMutation } from "@/hooks/useNetworkAwareMutation";
import { useTranslation } from "@/hooks/useTranslation";
import { axios, errorHandler, URLS } from "@/utils/api";
import { getMyCkyc, uploadDocument } from "@/utils/api/kyc";
import { updateUserSelfie } from "@/utils/selfie";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Feather, Ionicons } from "@expo/vector-icons";
import {
	ActivityIndicator,
	Alert,
	BackHandler,
	Image,
	SafeAreaView,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from "react-native";
import { font, height, width } from "@/utils/dimensions";

export default function CKYCInstructions() {
	const { t } = useTranslation();
	const router = useRouter();
	const navigation = useNavigation();

	// Track this screen in the journey
	useJourneyTracker("/ckyc-instructions");

	const [step, setStep] = useState(1);
	const [pickedImage, setPickedImage] = useState<string | null>(null);
	const [showCamera, setShowCamera] = useState(false);
	const [isProceedingToCkyc, setIsProceedingToCkyc] = useState(false);
	const [isLoadingCkyc, setIsLoadingCkyc] = useState(true);
	const [isFaceMatching, setIsFaceMatching] = useState(false);

	const isMounted = useRef(true);
	useEffect(() => {
		isMounted.current = true;
		return () => {
			isMounted.current = false;
		};
	}, []);

	const { startSelfie, permAddressData, corrAddressData, fromDigilocker } = useLocalSearchParams<{
		startSelfie?: string;
		permAddressData?: string;
		corrAddressData?: string;
		fromDigilocker?: string;
	}>();

	// Subsystem 1: Mount-time CKYC status check (real, active logic)
	useEffect(() => {
		const checkCkycOnMount = async () => {
			try {
				const response = await getMyCkyc();
				if (__DEV__) {
					console.log("📥 [CKYC] Mount check completed. next_step:", response?.next_step, "reapplication:", response?.reapplication);
				}

				if (response?.next_step === "digilocker" && startSelfie !== "true") {
					if (__DEV__) {
						console.log("👉 [CKYC] next_step is digilocker, navigating to /aadhaar-kyc");
					}
					router.replace({
						pathname: "/aadhaar-kyc",
						params: { nextStep: "digilocker" },
					} as any);
					return;
				}

				if (response?.reapplication) {
					const nextStep = response.next_step;
					if (nextStep === "selfie_match") {
						// Avoid infinite loop if we are already in selfie mode
						if (startSelfie !== "true") {
							router.replace({
								pathname: "/ckyc-instructions",
								params: { startSelfie: "true" },
							} as any);
							return;
						}
					} else if (nextStep) {
						let route = `/${nextStep.replace(/_/g, "-")}`;
						if (nextStep === "pan_verification") route = "/verify-pan";
						else if (nextStep === "email_verification") route = "/verify-email";

						router.replace(route as any);
						return;
					}
				}
			} catch (error) {
				console.error("❌ [CKYC] Failed to verify CKYC status on mount:", error);
			}

			if (isMounted.current) {
				setIsLoadingCkyc(false);
			}
		};

		checkCkycOnMount();
	}, [router, startSelfie]);

	// Set initial step when coming from OTP/reapplication for selfie
	useEffect(() => {
		if (startSelfie === "true") {
			setStep(0);
		}
	}, [startSelfie]);

	// Subsystem 3: Upload selfie and run face match verification
	const { mutate: handleUploadDocument, isPending } = useNetworkAwareMutation({
		mutationFn: uploadDocument,
		onSuccess: async (data) => {
			if (data.status === "uploaded") {
				if (__DEV__) {
					console.log("✅ [CKYC] Selfie uploaded successfully");
				}

				// Save selfie to local storage for immediate access in profile
				if (pickedImage) {
					try {
						await updateUserSelfie(pickedImage);
					} catch (error) {
						console.error("Failed to save selfie to storage:", error);
					}
				}

				// Call face match API after successful selfie upload
				setIsFaceMatching(true);
				try {
					if (__DEV__) {
						console.log("🔍 [CKYC] Calling face match verification API...");
					}
					const faceMatchResponse = await axios.post("kychub-face-match/verify-selfie-with-aadhaar", {});
					const isIdentical =
						faceMatchResponse.data?.is_identical === "true" ||
						faceMatchResponse.data?.is_identical === true;

					if (!isIdentical) {
						if (__DEV__) {
							console.log("❌ [CKYC] Face match failed — not identical");
						}
						setIsFaceMatching(false);
						Alert.alert(
							t("faceVerificationFailed", "Face Verification Failed"),
							t(
								"selfieDoesNotMatchAadhaar",
								"Your selfie does not match with your Aadhaar photo. Please retake the photo ensuring good lighting and clear visibility."
							),
							[
								{
									text: t("retakePhoto", "Retake Photo"),
									onPress: () => {
										setPickedImage(null);
										setShowCamera(true);
									},
								},
							]
						);
						return;
					}

					if (__DEV__) {
						console.log("✅ [CKYC] Face match successful!");
					}

					// Optional lender approval check
					try {
						await axios.post(URLS.lender_approval.check_approval, {});
					} catch (checkApprovalError) {
						// Non-blocking for UI progression
					}

					setIsFaceMatching(false);

					// If coming from DigiLocker, navigate to address screen
					if (fromDigilocker === "true" && startSelfie === "true") {
						router.replace({
							pathname: "/aadhaar-kyc",
							params: { startFromAddress: "true" },
						} as any);
						return;
					}

					// Normal CKYC flow
					Alert.alert(
						t("faceMatchedSuccessfully", "Face Matched Successfully"),
						t("yourIdentityHasBeenVerified", "Your identity has been verified successfully."),
						[
							{
								text: t("ok", "OK"),
								onPress: () => {
									if (startSelfie === "true") {
										const params: any = { startFromAddress: "true" };
										if (permAddressData) params.permAddressData = String(permAddressData);
										if (corrAddressData) params.corrAddressData = String(corrAddressData);
										router.replace({ pathname: "/aadhaar-kyc", params } as any);
									} else {
										setStep(1); // Show CKYC info screen
									}
								},
							},
						]
					);
				} catch (faceMatchError: any) {
					console.error("❌ [CKYC] Face Match Error:", faceMatchError);
					setIsFaceMatching(false);
					Alert.alert(
						t("verificationError", "Verification Error"),
						t("unableToVerifyFacePleaseTryAgain", "Unable to verify your face at this moment. Please try again."),
						[
							{
								text: t("retakePhoto", "Retake Photo"),
								onPress: () => {
									setPickedImage(null);
									setShowCamera(true);
								},
							},
						]
					);
					return;
				}

				return;
			}

			Alert.alert(
				t("alert", "Alert"),
				`${t("uploadFailed", "Upload Failed")}: ${data.message || t("pleaseRetryPayment", "Please try again")}`
			);
		},
		onError: (err, variables, ctx) => {
			const { error } = errorHandler(err, variables, ctx);
			console.error("❌ [CKYC] Upload failed:", error);
			Alert.alert(t("alert", "Alert"), t("uploadFailed", "Upload Failed"), [
				{
					style: "cancel",
				},
			]);
		},
	});

	const handleCameraCancel = useCallback(() => {
		setShowCamera(false);
		if (pickedImage) {
			setStep(4);
		} else {
			setStep(2);
		}
	}, [pickedImage]);

	// Precise back-handler logic matching reference
	const handleBack = useCallback(() => {
		if (showCamera) {
			handleCameraCancel();
			return true;
		}

		// If coming from CKYC OTP (startSelfie=true), user is in liveness flow
		if (startSelfie === "true") {
			if (step === 4) {
				setStep(2);
				return true;
			} else if (step === 2) {
				setStep(0);
				return true;
			} else if (step === 0) {
				Alert.alert(t("areYouSureGoBack", "Are you sure you want to go back?"), t("youWillLoseProgress", "You will lose your progress."), [
					{
						text: t("cancel", "Cancel"),
						style: "cancel",
					},
					{
						text: t("goBack", "Go Back"),
						onPress: () => {
							router.back();
						},
					},
				]);
				return true;
			}
		}

		// Normal flow (not from CKYC OTP)
		if (step > 1) {
			if (step === 4) {
				setStep(2);
			} else if (step === 2) {
				setStep(1);
			} else {
				setStep((prevStep) => prevStep - 1);
			}
			return true;
		} else if (step === 1) {
			Alert.alert(t("areYouSureGoBack", "Are you sure you want to go back?"), t("youWillLoseProgress", "You will lose your progress."), [
				{
					text: t("cancel", "Cancel"),
					style: "cancel",
				},
				{
					text: t("goBack", "Go Back"),
					onPress: () => {
						router.replace("/(tabs)");
					},
				},
			]);
			return true;
		}

		return false;
	}, [step, showCamera, handleCameraCancel, router, startSelfie, t]);

	useEffect(() => {
		const unsubscribe = navigation.addListener("beforeRemove", (e) => {
			if (["GO_BACK", "POP"].includes(e.data.action.type)) {
				e.preventDefault();

				if (showCamera) {
					handleCameraCancel();
					return;
				}

				if (step > 0) {
					if (step === 4) {
						setStep(2);
					} else if (step === 2) {
						setStep(0);
					} else {
						setStep((prevStep) => prevStep - 1);
					}
				} else {
					if (startSelfie === "true") {
						router.replace("/(tabs)");
					} else {
						Alert.alert(t("areYouSureGoBack", "Are you sure you want to go back?"), t("youWillLoseProgress", "You will lose your progress."), [
							{
								text: t("cancel", "Cancel"),
								style: "cancel",
							},
							{
								text: t("goBack", "Go Back"),
								onPress: () => {
									router.replace("/(tabs)");
								},
							},
						]);
					}
				}
			}
		});

		const backHandler = BackHandler.addEventListener("hardwareBackPress", handleBack);

		return () => {
			unsubscribe();
			backHandler.remove();
		};
	}, [handleBack, navigation, step, showCamera, handleCameraCancel, router, startSelfie, t]);

	const handleNext = () => {
		if (step === 0) {
			setStep(2);
		} else if (step === 2) {
			setShowCamera(true);
		} else {
			setStep((s) => s + 1);
		}
	};

	const handleCameraCapture = (imageUri: string) => {
		setPickedImage(imageUri);
		setShowCamera(false);
		setStep(4);
	};

	const handleRetake = () => {
		setPickedImage(null);
		setShowCamera(true);
	};

	const handleOkay = () => {
		if (pickedImage) {
			handleUploadDocument({
				fileUri: pickedImage,
				documentType: "selfie",
				description: "Upload selfie image file",
			});
		} else {
			Alert.alert(t("alert", "Alert"), t("noImageSelected", "No image selected"));
		}
	};

	// Subsystem 2: Initiate CKYC OTP
	const handleFinalProceed = async () => {
		if (!isMounted.current) return;

		setIsProceedingToCkyc(true);
		try {
			if (__DEV__) {
				console.log("📤 [CKYC] Sending CKYC OTP request...");
			}
			const response = await axios.post("onefin/ckyc/send-otp", {});

			if (!isMounted.current) return;

			if (response.status === 200 && response?.data?.success !== false) {
				if (isMounted.current) {
					router.replace("/ckyc-otp" as any);
				}
			} else {
				if (__DEV__) {
					console.warn("⚠️ [CKYC] send-otp not successful, falling back to /aadhaar-kyc");
				}
				if (isMounted.current) {
					router.replace("/aadhaar-kyc" as any);
				}
			}
		} catch (error) {
			if (!isMounted.current) return;
			if (__DEV__) {
				console.warn("⚠️ [CKYC] send-otp failed, falling back to /aadhaar-kyc");
			}
			if (isMounted.current) {
				router.replace("/aadhaar-kyc" as any);
			}
		} finally {
			if (isMounted.current) {
				setIsProceedingToCkyc(false);
			}
		}
	};

	if (isLoadingCkyc) {
		return (
			<View style={styles.loadingContainer}>
				<ActivityIndicator size="large" color={primary} />
			</View>
		);
	}

	return (
		<SafeAreaView style={styles.safeContainer}>
			{/* STEP 0: Liveness Check Instructions */}
			{step === 0 && (
				<View style={styles.centered}>
					<TranslatedText style={styles.stepTitle} translationKey="livenessCheckInstructions" />
					<TranslatedText style={styles.stepDescBold} translationKey="ensurePassportSizedPhoto" />
					<View style={styles.livenessRow}>
						<View style={styles.livenessCol}>
							<View style={styles.livenessBoxGreen}>
								<Image source={Images.CORRECT_SELFIE} style={styles.livenessImg} resizeMode="contain" />
								<TranslatedText style={styles.livenessDo} translationKey="dos" />
								<TranslatedText style={styles.livenessDoText} translationKey="alignFaceCenter" />
							</View>
						</View>
						<View style={styles.livenessCol}>
							<View style={styles.livenessBoxRed}>
								<Image source={Images.INCORRECT_SELFIE} style={styles.livenessImg} resizeMode="contain" />
								<TranslatedText style={styles.livenessDont} translationKey="donts" />
								<TranslatedText style={styles.livenessDontText} translationKey="dontCropFaceOrAngle" />
							</View>
						</View>
					</View>
					<TranslatedText style={styles.livenessNote} translationKey="livenessCheckNote" />
					<TouchableOpacity style={styles.ctaBtn} onPress={handleNext}>
						<View style={styles.ctaBtnContentRow}>
							<TranslatedText style={styles.ctaBtnText} translationKey="proceed" />
							<IconSymbol name="arrow.right" size={20} color={dark} />
						</View>
					</TouchableOpacity>
				</View>
			)}

			{/* STEP 1: CKYC Consent & Live KYC Instructions */}
			{step === 1 && (
				<View style={styles.centered}>
					<Image source={Images.LIVE_KYC} style={styles.illustration} resizeMode="contain" />
					<TranslatedText style={styles.stepTitle} translationKey="liveKYC" />
					<TranslatedText style={styles.stepDesc} translationKey="weAreFollowingPermissions" />

					<View style={styles.noteBox}>
						<TranslatedText style={styles.noteTitle} translationKey="note" />
						<TranslatedText style={styles.noteDesc} translationKey="byClickingProceedConsent" />
						<TranslatedText style={styles.noteDesc} translationKey="fetchDownloadKYCDocuments" />
					</View>

					<TouchableOpacity
						style={[styles.ctaBtn, isProceedingToCkyc && { opacity: 0.7 }]}
						onPress={handleFinalProceed}
						disabled={isProceedingToCkyc}>
						{isProceedingToCkyc ? (
							<ActivityIndicator size="small" color={dark} />
						) : (
							<View style={styles.ctaBtnContentRow}>
								<TranslatedText style={styles.ctaBtnText} translationKey="proceedToLiveKYC" />
								<IconSymbol name="arrow.right" size={20} color={dark} />
							</View>
						)}
					</TouchableOpacity>
				</View>
			)}

			{/* STEP 2: Instructions to Take a Selfie */}
			{step === 2 && (
				<View style={styles.centeredStep2}>
					<View style={styles.selfieContentCenterGroup}>
						<TranslatedText style={styles.takeSelfieTitle} translationKey="takeASelfie" />

						<Image source={Images.SELFIE} style={styles.selfieIllustration} resizeMode="contain" />

						<View style={styles.instructionsContainer}>
							<View style={styles.instructionRow}>
								<Feather name="sun" size={20} color="#000" style={styles.instructionIcon} />
								<TranslatedText style={styles.instructionText} translationKey="standInBrightRoom" />
							</View>

							<View style={styles.instructionRow}>
								<Feather name="eye" size={20} color="#000" style={styles.instructionIcon} />
								<TranslatedText style={styles.instructionText} translationKey="removeHatMaskGlasses" />
							</View>

							<View style={styles.instructionRow}>
								<Ionicons name="ban" size={20} color="#000" style={styles.instructionIcon} />
								<TranslatedText style={styles.instructionText} translationKey="makeSureFaceVisible" />
							</View>
						</View>
					</View>

					<TouchableOpacity style={styles.selfieCtaBtn} onPress={handleNext}>
						<View style={styles.ctaBtnContent}>
							<TranslatedText style={styles.selfieCtaBtnText} translationKey="proceedToTakeSelfie" />
							<Feather name="arrow-right" size={20} color="#000" />
						</View>
					</TouchableOpacity>
				</View>
			)}

			{/* STEP 4: Preview Captured Selfie */}
			{step === 4 && pickedImage && (
				<View style={styles.centered}>
					<TranslatedText style={styles.stepTitle} translationKey="preview" />
					<View style={styles.previewImageContainer}>
						<Image source={{ uri: pickedImage }} style={styles.previewImg} resizeMode="cover" />
					</View>
					<View style={styles.previewButtonsContainer}>
						<TouchableOpacity
							style={styles.retakeBtn}
							disabled={isPending || isFaceMatching}
							onPress={handleRetake}>
							<TranslatedText style={styles.retakeBtnText} translationKey="retakePhoto" />
						</TouchableOpacity>
						<TouchableOpacity
							style={styles.ctaBtn}
							disabled={isPending || isFaceMatching}
							onPress={handleOkay}>
							{isPending || isFaceMatching ? (
								<ActivityIndicator size="small" color="#333" />
							) : (
								<View style={styles.ctaBtnContentRow}>
									<Text style={styles.ctaBtnText}>{t("imOkayWithPhoto", "I'm okay with my photo")}</Text>
									<IconSymbol name="arrow.right" size={20} color={dark} />
								</View>
							)}
						</TouchableOpacity>
					</View>
					{(isPending || isFaceMatching) && (
						<Text style={styles.verifyingStatusText}>
							{isPending ? t("uploading", "Uploading...") : t("verifying", "Verifying...")}
						</Text>
					)}
				</View>
			)}

			<OvalCameraCapture
				visible={showCamera}
				onCapture={handleCameraCapture}
				onCancel={handleCameraCancel}
			/>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	safeContainer: {
		flex: 1,
		backgroundColor: "#fff",
	},
	loadingContainer: {
		flex: 1,
		backgroundColor: "#fff",
		justifyContent: "center",
		alignItems: "center",
	},
	centered: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		paddingHorizontal: 24,
		backgroundColor: "#fff",
	},
	illustration: {
		width: 180,
		height: 180,
		marginBottom: 24,
	},
	stepTitle: {
		fontWeight: "700",
		fontSize: 22,
		color: "#222",
		marginBottom: 8,
		textAlign: "center",
	},
	stepDesc: {
		fontSize: 15,
		color: "#555",
		marginBottom: 24,
		textAlign: "center",
	},
	stepDescBold: {
		fontSize: 15,
		color: "#222",
		fontWeight: "600",
		marginBottom: 8,
		textAlign: "center",
	},
	ctaBtn: {
		backgroundColor: primary,
		borderRadius: 8,
		paddingVertical: 16,
		paddingHorizontal: 32,
		marginTop: 32,
		marginBottom: 12,
		alignItems: "center",
		alignSelf: "stretch",
	},
	ctaBtnContentRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
	},
	ctaBtnText: {
		color: dark,
		fontWeight: "600",
		fontSize: 16,
		textAlign: "center",
	},
	noteBox: {
		backgroundColor: "#F8F8F8",
		borderRadius: 8,
		padding: 12,
		marginBottom: 16,
		alignSelf: "stretch",
	},
	noteTitle: {
		fontWeight: "700",
		fontSize: 14,
		color: "#222",
		marginBottom: 4,
	},
	noteDesc: {
		fontSize: 13,
		color: "#444",
		marginBottom: 8,
	},
	livenessRow: {
		flexDirection: "row",
		width: "100%",
		marginBottom: 16,
		marginTop: 8,
		gap: 3,
	},
	livenessCol: {
		flex: 1,
		alignItems: "center",
		borderWidth: 0.5,
		borderColor: "#aaaaaa",
		borderRadius: 10,
	},
	livenessBoxGreen: {
		borderRadius: 8,
		padding: 12,
		alignItems: "center",
		width: "95%",
	},
	livenessBoxRed: {
		borderRadius: 8,
		padding: 12,
		alignItems: "center",
		width: "95%",
	},
	livenessImg: {
		width: 60,
		height: 60,
		marginBottom: 8,
	},
	livenessDo: {
		color: "#1DBF73",
		fontWeight: "700",
		fontSize: 15,
		marginBottom: 2,
	},
	livenessDoText: {
		color: "#222",
		fontSize: 13,
		textAlign: "center",
		marginBottom: 2,
	},
	livenessDont: {
		color: "#F44336",
		fontWeight: "700",
		fontSize: 15,
		marginBottom: 2,
	},
	livenessDontText: {
		color: "#222",
		fontSize: 13,
		textAlign: "center",
		marginBottom: 2,
	},
	livenessNote: {
		fontSize: 12,
		color: "#888",
		marginTop: 8,
		marginBottom: 8,
		textAlign: "center",
	},
	previewImageContainer: {
		width: 250,
		height: 250,
		borderRadius: 125,
		overflow: "hidden",
		marginBottom: 24,
		borderWidth: 3,
		borderColor: "#4F6EF7",
		backgroundColor: "#f0f0f0",
	},
	previewImg: {
		width: "100%",
		height: "100%",
	},
	previewButtonsContainer: {
		width: "100%",
		gap: 12,
	},
	retakeBtn: {
		backgroundColor: "#fff",
		borderRadius: 8,
		paddingVertical: 16,
		paddingHorizontal: 32,
		alignItems: "center",
		alignSelf: "stretch",
		borderWidth: 2,
		borderColor: "#4F6EF7",
	},
	retakeBtnText: {
		color: "#4F6EF7",
		fontWeight: "600",
		fontSize: 16,
		textAlign: "center",
	},
	centeredStep2: {
		flex: 1,
		alignItems: "center",
		justifyContent: "flex-start",
		paddingHorizontal: 24,
		backgroundColor: "#fff",
		paddingTop: height(4),
		paddingBottom: height(6),
	},
	takeSelfieTitle: {
		fontWeight: "700",
		fontSize: font(3.2),
		color: "#000",
		textAlign: "center",
		marginTop: height(1),
	},
	selfieIllustration: {
		width: width(70),
		height: height(33),
		marginVertical: height(5),
	},
	instructionsContainer: {
		width: "100%",
		paddingHorizontal: width(6),
		marginVertical: height(2),
		gap: height(1.5),
	},
	instructionRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: width(4),
	},
	instructionIcon: {
		width: 24,
		textAlign: "center",
	},
	instructionText: {
		fontSize: font(1.8),
		color: "#000",
		fontWeight: "500",
	},
	selfieCtaBtn: {
		backgroundColor: primary,
		borderRadius: 100,
		paddingVertical: height(1.8),
		alignItems: "center",
		justifyContent: "center",
		alignSelf: "stretch",
		marginHorizontal: width(4),
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.1,
		shadowRadius: 4,
		elevation: 2,
		marginTop: "auto",
		marginBottom: height(5),
	},
	ctaBtnContent: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
	},
	selfieCtaBtnText: {
		color: "#000",
		fontWeight: "700",
		fontSize: font(2.1),
		textAlign: "center",
	},
	selfieContentCenterGroup: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		width: "100%",
	},
	verifyingStatusText: {
		marginTop: 20,
		color: "#666",
		fontSize: 14,
	},
});
