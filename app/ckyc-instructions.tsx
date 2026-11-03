import Logger from "@/utils/logger";
import { getFriendlyError } from "@/utils/api/core/friendlyError";
import OvalCameraCapture from "@/components/OvalCameraCapture";
import { TranslatedText } from "@/components/TranslatedText";
import { dark, primary } from "@/constants/Colors";
import ExitIntentModal from "@/components/assessment-fee/ExitIntentModal";
import { IconSymbol } from "@/components/ui/IconSymbol";
import { Images } from "@/constants/images";
import { useJourneyTracker } from "@/hooks/useJourneyTracker";
import { useNetworkAwareMutation } from "@/hooks/useNetworkAwareMutation";
import { useTranslation } from "@/hooks/useTranslation";
import { getAddressPrefill, getCkycStatus, getSelfieStatus, getWorkflowProgress, sendCkycOtp, uploadSelfie } from "@/utils/api";
import { handleApplicationRejected, isRejectedStatus } from "@/utils/applicationRejection";
import { updateUserSelfie } from "@/utils/selfie";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTypedNavigation } from "@/hooks/useTypedNavigation";
import { useQueryClient } from "@tanstack/react-query";
import Toast from "react-native-toast-message";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Feather, Ionicons } from "@expo/vector-icons";
import {
	ActivityIndicator,
	Alert,
	BackHandler,
	Image,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { font, height, width } from "@/utils/dimensions";

export default function CKYCInstructions() {
	const { t } = useTranslation();
	const router = useRouter();
	const navigation = useTypedNavigation();

	// Track this screen in the journey
	useJourneyTracker("/ckyc-instructions");

	const [step, setStep] = useState(1);
	const [pickedImage, setPickedImage] = useState<string | null>(null);
	const [showCamera, setShowCamera] = useState(false);
	const [isProceedingToCkyc, setIsProceedingToCkyc] = useState(false);
	const [isLoadingCkyc, setIsLoadingCkyc] = useState(true);
	const [isFaceMatching, setIsFaceMatching] = useState(false);
	const [retakeCount, setRetakeCount] = useState(0);
	const [isExitModalVisible, setIsExitModalVisible] = useState(false);
	const [isRefPhotoMissing, setIsRefPhotoMissing] = useState(false);
	const [verifiedName, setVerifiedName] = useState<string | null>(null);
	const queryClient = useQueryClient();

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
			if (fromDigilocker === "true" || startSelfie === "true") {
				try {
					const ckycResponse = await getCkycStatus();
					const nextAction = ckycResponse?.data?.next_action;

					if (nextAction === "digilocker") {
						router.replace("/digilocker-kyc" as any);
						return;
					}

					if (nextAction === "ckyc") {
						if (isMounted.current) {
							setStep(1);
							setIsLoadingCkyc(false);
						}
						return;
					}
					// If nextAction === "selfie_match" (or status === "completed"), continue with selfie logic below
				} catch (error) {
					Logger.warn("Operation failed", { code: "operation_failed" });
				}
			}

			if (fromDigilocker === "true") {
				try {
					const selfieRes = await getSelfieStatus();
					if (selfieRes?.data?.reference_photo_available === false) {
						if (isMounted.current) {
							setIsRefPhotoMissing(true);
							setIsLoadingCkyc(false);
						}
						return;
					}
					const name = (selfieRes?.data as any)?.name || (selfieRes?.data as any)?.full_name;
					if (name && typeof name === "string" && isMounted.current) {
						setVerifiedName(name);
					}
				} catch {
					Logger.warn("Operation failed", { code: "operation_failed" });
				}

				try {
					const prefillRes = await getAddressPrefill();
					const prefillName =
						(prefillRes?.data as any)?.name ||
						(prefillRes?.data as any)?.full_name ||
						(prefillRes?.data as any)?.aadhaar_name;
					if (prefillName && typeof prefillName === "string" && isMounted.current) {
						setVerifiedName((prev) => prev || prefillName);
					}
				} catch {
					// optional
				}

				if (isMounted.current) {
					setStep(0);
					setIsLoadingCkyc(false);
				}
				return;
			}

			if (startSelfie === "true") {
				try {
					const prefillRes = await getAddressPrefill();
					const prefillName =
						(prefillRes?.data as any)?.name ||
						(prefillRes?.data as any)?.full_name ||
						(prefillRes?.data as any)?.aadhaar_name;
					if (prefillName && typeof prefillName === "string" && isMounted.current) {
						setVerifiedName(prefillName);
					}
				} catch {
					// optional
				}

				if (isMounted.current) {
					setStep(0);
					setIsLoadingCkyc(false);
				}
				return;
			}

			try {
				const response = await getCkycStatus();
				const nextAction = response?.data?.next_action;

				if (nextAction === "digilocker") {
					router.replace("/digilocker-kyc" as any);
					return;
				}

				if (nextAction === "selfie_match") {
					setStep(0);
				}
				// if nextAction === "ckyc", stay on step 1 (setStep(1) default)
			} catch (error) {
				Logger.warn("Operation failed", { code: "operation_failed" });
			}

			if (isMounted.current) {
				setIsLoadingCkyc(false);
			}
		};

		checkCkycOnMount();
	}, [router, startSelfie, fromDigilocker]);

	// Set initial step when coming from OTP/reapplication for selfie
	useEffect(() => {
		if (startSelfie === "true" || fromDigilocker === "true") {
			setStep(0);
		}
	}, [startSelfie, fromDigilocker]);

	const handleLivenessFailed = useCallback(
		(remainingAttempts?: number) => {
			if (remainingAttempts !== undefined) {
				if (remainingAttempts <= 0) {
					Alert.alert(
						t("retakeLimitReached", "Retake Limit Reached"),
						t("tooManyAttemptsPleaseTryLater", "Too many attempts. Please try again later.")
					);
					return;
				}
			} else if (retakeCount >= 4) {
				Alert.alert(
					t("retakeLimitReached", "Retake Limit Reached"),
					t("tooManyAttemptsPleaseTryLater", "Too many attempts. Please try again later.")
				);
				return;
			}
			setRetakeCount((prev) => prev + 1);

			const attemptsText =
				remainingAttempts !== undefined
					? `\n\n(${remainingAttempts} ${remainingAttempts === 1 ? t("attemptLeft", "attempt left") : t("attemptsLeft", "attempts left")})`
					: "";

			Alert.alert(
				t("livenessCheckFailed", "Liveness Check Failed"),
				`${t("livenessFailedPleaseRetake", "Liveness check failed, please retake in good light")}${attemptsText}`,
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
		},
		[retakeCount, t]
	);

	const handleFaceMatchFailed = useCallback(
		(remainingAttempts?: number) => {
			if (remainingAttempts !== undefined) {
				if (remainingAttempts <= 0) {
					Alert.alert(
						t("retakeLimitReached", "Retake Limit Reached"),
						t("tooManyAttemptsPleaseTryLater", "Too many attempts. Please try again later.")
					);
					return;
				}
			} else if (retakeCount >= 4) {
				Alert.alert(
					t("retakeLimitReached", "Retake Limit Reached"),
					t("tooManyAttemptsPleaseTryLater", "Too many attempts. Please try again later.")
				);
				return;
			}
			setRetakeCount((prev) => prev + 1);

			const attemptsText =
				remainingAttempts !== undefined
					? `\n\n(${remainingAttempts} ${remainingAttempts === 1 ? t("attemptLeft", "attempt left") : t("attemptsLeft", "attempts left")})`
					: "";

			Alert.alert(
				t("faceVerificationFailed", "Face Verification Failed"),
				`${t(
					"selfieDoesNotMatchAadhaar",
					"Your selfie does not match with your Aadhaar photo. Please retake the photo ensuring good lighting and clear visibility."
				)}${attemptsText}`,
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
		},
		[retakeCount, t]
	);

	// Subsystem 3: Upload selfie and verify liveness & face match
	const { mutate: handleUploadSelfie, isPending } = useNetworkAwareMutation({
		mutationFn: async (imageUri: string) => {
			return uploadSelfie({ uri: imageUri, name: "selfie.jpg", type: "image/jpeg" });
		},
		onSuccess: async (data) => {
			if (data.success) {
				if (__DEV__) {
					console.log("✅ [CKYC] Selfie uploaded and face match verified successfully");
				}

				if (pickedImage) {
					try {
						await updateUserSelfie(pickedImage);
					} catch (error) {
						Logger.warn("Operation failed", { code: "operation_failed" });
					}
				}

				queryClient.invalidateQueries({ queryKey: ["user", "dashboard"] });

				Alert.alert(
					t("faceMatchedSuccessfully", "Face Matched Successfully"),
					t("yourIdentityHasBeenVerified", "Your identity has been verified successfully."),
					[
						{
							text: t("ok", "OK"),
							onPress: async () => {
								try {
									const progressRes = await getWorkflowProgress().catch(() => null);
									if (isRejectedStatus(progressRes?.data)) {
										await handleApplicationRejected({ router, queryClient, source: "ckyc-instructions" });
										return;
									}
								} catch {
									// Ignore check error
								}
								const params: any = { startFromAddress: "true", fromSelfie: "true" };
								if (permAddressData) params.permAddressData = String(permAddressData);
								if (corrAddressData) params.corrAddressData = String(corrAddressData);
								router.replace({ pathname: "/aadhaar-kyc", params } as any);
							},
						},
					]
				);
				return;
			}

			if (data.data?.reference_photo_missing || data.data?.restart_digilocker) {
				setIsRefPhotoMissing(true);
				Alert.alert(
					t("alert", "Alert"),
					t("aadhaarPhotoMissing", "We couldn't load your Aadhaar photo. Please verify with DigiLocker again."),
					[
						{
							text: t("verifyAgain", "Verify again"),
							onPress: () => {
								router.replace("/digilocker-kyc" as any);
							},
						},
					]
				);
				return;
			}

			if (data.data?.liveness_passed === false) {
				handleLivenessFailed(data.data?.remaining_attempts);
				return;
			}

			if (data.data?.face_match_passed === false) {
				handleFaceMatchFailed(data.data?.remaining_attempts);
				return;
			}

			Toast.show({
				type: "error",
				text1: t("alert", "Alert"),
				text2: data.message || t("uploadFailed", "Upload Failed"),
			});
		},
		onError: (err: any) => {
			const errorData = err?.response?.data?.data || err?.response?.data;
			if (
				errorData?.reference_photo_missing ||
				errorData?.restart_digilocker ||
				err?.code === "PHOTO_UNUSABLE" ||
				err?.code === "PARSE_FAILED"
			) {
				setIsRefPhotoMissing(true);
				Alert.alert(
					t("alert", "Alert"),
					t("aadhaarPhotoMissing", "We couldn't load your Aadhaar photo. Please verify with DigiLocker again."),
					[
						{
							text: t("verifyAgain", "Verify again"),
							onPress: () => {
								router.replace("/digilocker-kyc" as any);
							},
						},
					]
				);
				return;
			}

			Toast.show({
				type: "error",
				text1: t("alert", "Alert"),
				text2: getFriendlyError(err).message || t("uploadFailed", "Upload Failed"),
			});
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
				setIsExitModalVisible(true);
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
		} else if (step <= 1) {
			setIsExitModalVisible(true);
			return true;
		}

		return false;
	}, [step, showCamera, handleCameraCancel, startSelfie]);

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
					setIsExitModalVisible(true);
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
			handleUploadSelfie(pickedImage);
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
			const response = await sendCkycOtp();

			if (!isMounted.current) return;

			if (response.success) {
				const sessionId = response.data?.session_id;
				router.replace({
					pathname: "/ckyc-otp" as any,
					params: sessionId ? { sessionId } : undefined,
				});
			} else {
				const msg = response.message || "";
				const switchToDigilocker =
					Boolean((response.data as any)?.switch_to_digilocker) ||
					msg.toLowerCase().includes("digilocker");

				if (switchToDigilocker) {
					router.replace("/digilocker-kyc" as any);
				} else {
					Toast.show({
						type: "error",
						text1: t("alert", "Alert"),
						text2: msg || t("pleaseRetryPayment", "Please try again"),
					});
				}
			}
		} catch (error: any) {
			if (!isMounted.current) return;
			if (error?.isApplicationRejected) return;
			const msg = getFriendlyError(error).message || "";
			if (msg.toLowerCase().includes("digilocker")) {
				router.replace("/digilocker-kyc" as any);
			} else {
				Toast.show({
					type: "error",
					text1: t("alert", "Alert"),
					text2: msg || t("pleaseRetryPayment", "Please try again"),
				});
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

	if (isRefPhotoMissing) {
		return (
			<SafeAreaView style={styles.safeContainer}>
				<View style={styles.centered}>
					<Image source={Images.SELFIE} style={styles.illustration} resizeMode="contain" />
					<Text style={styles.stepTitle}>
						{t("aadhaarPhotoMissing", "We couldn't load your Aadhaar photo. Please verify with DigiLocker again.")}
					</Text>
					<TouchableOpacity
						style={styles.ctaBtn}
						onPress={() => router.replace("/digilocker-kyc" as any)}>
						<View style={styles.ctaBtnContentRow}>
							<Text style={styles.ctaBtnText}>{t("verifyAgain", "Verify again")}</Text>
							<IconSymbol name="arrow.right" size={20} color={dark} />
						</View>
					</TouchableOpacity>
				</View>
			</SafeAreaView>
		);
	}

	return (
		<SafeAreaView style={styles.safeContainer}>
			{/* STEP 0: Liveness Check Instructions */}
			{step === 0 && (
				<View style={styles.centered}>
					<TranslatedText style={styles.stepTitle} translationKey="livenessCheckInstructions" />
					{verifiedName ? (
						<Text style={styles.verifiedAsText}>Verified as {verifiedName}</Text>
					) : null}
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
						{verifiedName ? (
							<Text style={styles.verifiedAsText}>Verified as {verifiedName}</Text>
						) : null}

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
	verifiedAsText: {
		fontSize: 14,
		color: "#666",
		fontWeight: "500",
		marginTop: -4,
		marginBottom: 12,
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
