import RejectionModal from '@/components/RejectionModal';
import { TranslatedText } from "@/components/TranslatedText";
import { dark_primary, white } from "@/constants/Colors";
import { IconSymbol } from "@/components/ui/IconSymbol";
import { useTranslation } from "@/hooks/useTranslation";
import { getMyDetails, initialApproval, verifyPan } from "@/utils/api/kyc";
import { height, width } from "@/utils/dimensions";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Animated,
    BackHandler,
    Image,
    ImageBackground,
    Linking,
    Modal,
    Platform,
    SafeAreaView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { Images } from "@/constants/images";
import Toast from "react-native-toast-message";

// New regex to match logic in loan-application
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

export default function VerifyPan() {
	const router = useRouter();
	const params = useLocalSearchParams();
	const { t } = useTranslation();

	const [name, setName] = useState("");
	const [pan, setPan] = useState("");
    const [nameError, setNameError] = useState("");
    const [panError, setPanError] = useState("");
	const [isVerifying, setIsVerifying] = useState(false);
	const [attempts, setAttempts] = useState(0);

    const [isLoadingDetails, setIsLoadingDetails] = useState(true);

    // Rejection modal state
	const [rejectionModalVisible, setRejectionModalVisible] = useState(false);
	const [delayVisible, setDelayVisible] = useState(false);
	const [rejectionMessage, setRejectionMessage] = useState<string>("");
	const [rejectionCountdown, setRejectionCountdown] = useState(15);

	// Params from previous screen
	const email = (params.email as string) || "";
	const isDeliverable = params.is_deliverable === "true";

	const finalSubmission = async (isPanVerified: boolean, isPanValid: boolean, currentName?: string, currentPan?: string) => {
		try {
			const approvalResponse = await initialApproval({
				email: email,
				is_deliverable: isDeliverable,
				is_pan_verified: isPanVerified,
				is_pan_valid: isPanValid,
				name: currentName || name,
				pan_number: currentPan || pan,
			});

			if (approvalResponse.status === "approved") {
				router.replace("/application-approved");
			} else if (approvalResponse.status === "reject") {
				// Show rejection modal
				setRejectionMessage(t("standardRejectionMessage"));
				setRejectionModalVisible(true);
			} else {
				router.replace({
					pathname: "/professional-details",
					params: { disableBack: "true" },
				});
			}
		} catch (error) {
			console.error("Approval check failed", error);
			router.replace({
				pathname: "/professional-details",
				params: { disableBack: "true" },
			});
		}
	};

	useEffect(() => {
		const fetchDetails = async () => {
			try {
				const response = await getMyDetails();
				console.log("=== Get My Details API Response ===", JSON.stringify(response, null, 2));

				if (response.reapplication) {
					const nextStep = response.next_step;
					if (nextStep) {
						let route = `/${nextStep.replace(/_/g, "-")}`;
						if (nextStep === "pan_verification") route = "/verify-pan";
						else if (nextStep === "email_verification") route = "/verify-email";

						console.log(`➡️ Reapplication is true, navigating to next step: ${route}`);
						router.replace(route as any);
						return;
					}
				}

				const details = response.kyc_record;

				let fetchedName = "";
				let fetchedPan = "";

				if (details?.name || details?.full_name) {
					fetchedName = details.name || details.full_name || "";
					setName(fetchedName);
					console.log("ℹ️ Auto-populated name from API:", fetchedName);
				}
				if (details?.pan_number) {
					fetchedPan = details.pan_number;
					setPan(fetchedPan);
					console.log("ℹ️ Auto-populated PAN from API:", fetchedPan);
				}

				// Auto-verification logic
				if (fetchedName && fetchedPan && PAN_REGEX.test(fetchedPan)) {
					console.log("🔄 Auto-verifying PAN...");
					setIsVerifying(true);
					try {
						const verifyRes = await verifyPan({
							name: fetchedName,
							pan_number: fetchedPan,
						});

						console.log("✅ Auto-verify PAN Success");
						const isPanValid = verifyRes.is_pan_valid || false;
						await finalSubmission(true, isPanValid, fetchedName, fetchedPan);
						return;
					} catch (err) {
						console.error("❌ Auto-verify failed:", err);
						// Fallback to manual verification handled by UI
					} finally {
						setIsVerifying(false);
					}
				}

			} catch (error) {
				console.error("Failed to fetch user details for PAN:", error);
			} finally {
				setIsLoadingDetails(false);
			}
		};

		fetchDetails();
	}, []);

	useEffect(() => {
		const backHandler = BackHandler.addEventListener("hardwareBackPress", () => {
			router.replace("/(tabs)");
			return true;
		});
		return () => backHandler.remove();
	}, []);






	const handleVerify = async () => {
        let hasError = false;
        
		if (!name.trim() || name.length < 3) {
            setNameError(t("enterFullNamePAN"));
            hasError = true;
		}
        
		if (!pan || !PAN_REGEX.test(pan)) {
            setPanError(t("invalidPANFormat"));
            hasError = true;
		}

        if (hasError) return;

		setIsVerifying(true);
		try {
			const verifyRes = await verifyPan({
				name: name,
				pan_number: pan,
			});

			// If verifyPan throws error, it goes to catch. 
			// Check response structure if verifyPan returns specific success flag not handled by throwing.
			// Assuming verifyPan throws on failure or returns success data.
			
			// Use actual verified status from response, default to true if it succeeds (as it didn't throw) but prefer response value
			const isPanVerified = verifyRes.verified !== false;
			const isPanValid = verifyRes.is_pan_valid || false;

			console.log("👉 Sending to Initial Approval:", {
				isPanVerified,
				isPanValid,
				name,
				pan
			});

			await finalSubmission(isPanVerified, isPanValid, name, pan);

		} catch (error: any) {
			console.error("PAN verification failed", error);
			
			// Show API error message
			const apiError = error?.response?.data?.message || error?.message || "Verification failed";

			if (apiError.toLowerCase().includes("already linked")) {
				const newAttempts = attempts + 1;
				setAttempts(newAttempts);

				if (newAttempts >= 2) {
					// Failed twice, proceed with is_pan_verified = false
					await finalSubmission(false, false, name, pan);
				} else {
					Toast.show({
						type: "error",
						text1: t("error"),
						text2: apiError,
						props: { numberOfLines: 10 }
					});
				}
			} else {
				// For other errors, fail immediately as per requirement
				await finalSubmission(false, false, name, pan);
			}
		} finally {
			setIsVerifying(false);
		}
	};

	const handleBack = () => {
		router.replace("/(tabs)");
	};

	return (
		<View style={{ flex: 1, backgroundColor: white }}>
			{/* Custom Header */}
			{!isLoadingDetails && (
				<SafeAreaView style={{ backgroundColor: '#000' }}>
					<View style={styles.header}>
						<TouchableOpacity onPress={handleBack} style={styles.backButton}>
							<Ionicons name="arrow-back" size={24} color="#fff" />
						</TouchableOpacity>
						<TranslatedText style={styles.headerTitle} translationKey="verifyPan" />
					</View>
				</SafeAreaView>
			)}

		<SafeAreaView style={styles.container}>
			<View style={styles.content}>
				{!isLoadingDetails && (
					<>
				<TranslatedText style={styles.description} translationKey="verifyPanDescription" />

				<View style={styles.inputContainer}>
					<TranslatedText style={styles.label} translationKey="fullName" />
					<TextInput
						style={[styles.input, nameError ? { borderColor: 'red' } : null]}
						value={name}
						onChangeText={(text) => {
                            // Helper to allow only letters and single spaces
                            const cleaned = text.replace(/[^a-zA-Z\s]/g, '').replace(/\s+/g, ' ');
                            setName(cleaned);
                            if (nameError) setNameError("");
                        }}
						placeholder="John Doe"
						autoCapitalize="words"
						editable={!isVerifying}
					/>
                    {nameError ? <Text style={styles.errorText}>{nameError}</Text> : null}
				</View>

				<View style={styles.inputContainer}>
					<TranslatedText style={styles.label} translationKey="panNumber" />
					<TextInput
						style={[styles.input, panError ? { borderColor: 'red' } : null]}
						value={pan}
						onChangeText={(text) => {
                            // Helper to allow only alphanumeric (uppercase enforced)
                            const cleaned = text.toUpperCase().replace(/[^A-Z0-9]/g, '');
                            setPan(cleaned);
                            if (panError) setPanError("");
                        }}
						placeholder="ABCDE1234F"
						autoCapitalize="characters"
						maxLength={10}
						editable={!isVerifying}
					/>
                    {panError ? <Text style={styles.errorText}>{panError}</Text> : null}
				</View>



				<TouchableOpacity
					style={[styles.button, isVerifying && styles.buttonDisabled]}
					onPress={handleVerify}
					disabled={isVerifying}>
					{isVerifying ? (
						<ActivityIndicator color="white" />
					) : (
						<View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
							<TranslatedText style={styles.buttonText} translationKey="verifyAndProceed" />
							<IconSymbol name="arrow.right" size={20} color={white} />
						</View>
					)}
				</TouchableOpacity>
				</>
				)}
			</View>
            
			{/* Rejection Modal */}
			<RejectionModal
				visible={rejectionModalVisible}
				countdown={rejectionCountdown}
				setCountdown={setRejectionCountdown}
				onClose={() => setRejectionModalVisible(false)}
			/>
		</SafeAreaView>

		{/* 🔥 FULLSCREEN LOADER (covers header too) */}
		{isLoadingDetails && (
		<View style={styles.loaderOverlay}>
			<ActivityIndicator size="large" color="#00C853" />
			<TranslatedText
			style={{ marginTop: 16 }}
			translationKey="loadingDetails"
			fallback="Fetching details..."
			/>
		</View>
		)}
	</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: white,
	},
	content: {
		flex: 1,
		padding: width(5),
		justifyContent: "flex-start",
		paddingTop: height(2),
	},
	header: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: 16,
		paddingBottom: 12,
		paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 12 : 12,
		backgroundColor: '#000',
	},
	backButton: {
		marginRight: 16,
	},
	headerTitle: {
		color: '#fff',
		fontSize: 18,
		fontWeight: 'bold',
	},
	loaderOverlay: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		backgroundColor: white,
		alignItems: "center",
		justifyContent: "center",
		zIndex: 9999,
	},
	description: {
		fontSize: 16,
		color: "#666",
		marginBottom: height(4),
		lineHeight: 24,
	},
	inputContainer: {
		marginBottom: height(3),
	},
	label: {
		fontSize: 14,
		fontWeight: "600",
		marginBottom: height(1),
		color: "#333",
	},
	input: {
		borderWidth: 1,
		borderColor: "#ddd",
		borderRadius: 8,
		padding: 12,
		fontSize: 16,
		color: "#000",
	},
	button: {
		backgroundColor: "#00C853",
		paddingVertical: 16,
		borderRadius: 12,
		alignItems: "center",
		marginTop: height(2),
	},
	buttonDisabled: {
		opacity: 0.7,
	},
	buttonText: {
		color: "white",
		fontWeight: "bold",
		fontSize: 18,
	},
    errorText: {
        color: 'red',
        fontSize: 12,
        marginTop: 4,
    },
});
