import RejectionModal from '@/components/RejectionModal';
import ExitIntentModal from "@/components/assessment-fee/ExitIntentModal";
import { Images } from "@/constants/images";
import { TranslatedText } from "@/components/TranslatedText";
import { dark, white } from "@/constants/Colors";
import { IconSymbol } from "@/components/ui/IconSymbol";
import RNOtpVerify from "@/utils/otpVerify";
import { useJourneyTracker } from "@/hooks/useJourneyTracker";
import { useNetworkAwareMutation } from "@/hooks/useNetworkAwareMutation";
import { useNetworkAwareQuery } from "@/hooks/useNetworkAwareQuery";
import { useTranslation } from "@/hooks/useTranslation";
import { axios, errorHandler, initiateDigitalSigning, URLS } from "@/utils/api";
import { font, height, width } from "@/utils/dimensions";
import { setStorageItem, STORAGE_KEYS } from "@/utils/storage";
import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import { Image } from "expo-image";
import * as Linking from "expo-linking";
import { useNavigation, useRouter } from "expo-router";
// import * as Sharing from "expo-sharing";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Animated,
    BackHandler,
    Modal,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    ImageBackground,
    UIManager,
    View,
} from "react-native";
import * as WebBrowser from "expo-web-browser";
import PdfRendererView from "react-native-pdf-renderer";
import Toast from "react-native-toast-message";

export interface KfsDocumentResponse {
	success: boolean;
	data: Data;
}

export interface Data {
	loan_id: string;
	application_id: string;
	kfs_url: string;
	is_signed: boolean;
	signed_at: null;
	document_ready: boolean;
	status: string;
	loan_amount: number;
	tenure_months: number;
	next_step: string;
}

export interface LoanStatusResponse {
	status:
		| "processing"
		| "rejected_by_lender"
		| "nach_setup_completed"
		| "nach_setup_failed"
		| "disbursed"
		| "kfs_generated";
	loan_id: string;
	application_id: string;
	user_name: string;
	processing_details: {
		current_stage: string;
		estimated_time: string;
		progress_percentage: number;
		time_elapsed_minutes: number;
		submitted_at: string | null;
	};
	next_steps: {
		action: string;
		message: string;
		wait_message: string;
	};
	ui_action: string;
	timestamp: string;
	polling_interval: number;
}

export interface LoanAgreementResponse {
	message: string;
	agreement_number: string;
	file_url: string;
	download_url: string;
	valid_until: string;
	first_emi_date: string;
	loan_details: {
		loan_amount: number;
		interest_rate: number;
		tenure_months: number;
		emi_amount: number;
		processing_fee: number;
	};
	next_step: string;
}

const DEFAULT_FILE_URL =
	"https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf";

// API function to download loan agreement
const downloadLoanAgreement = async () => {
	try {
		console.log("📄 Calling loan agreement download API");
		const response = await axios.get("loan-agreement/download");
		console.log("📄 Loan Agreement API Response:", JSON.stringify(response.data, null, 2));
		return response.data;
	} catch (error) {
		console.error("❌ Loan Agreement Download Error:", error);
		throw error;
	}
};

// Skeleton Loader Component for PDF
const PDFSkeletonLoader = () => {
	const shimmerAnim = useRef(new Animated.Value(0)).current;

	useEffect(() => {
		const shimmer = Animated.loop(
			Animated.sequence([
				Animated.timing(shimmerAnim, {
					toValue: 1,
					duration: 1000,
					useNativeDriver: true,
				}),
				Animated.timing(shimmerAnim, {
					toValue: 0,
					duration: 1000,
					useNativeDriver: true,
				}),
			])
		);
		shimmer.start();
		return () => shimmer.stop();
	}, [shimmerAnim]);

	const opacity = shimmerAnim.interpolate({
		inputRange: [0, 1],
		outputRange: [0.3, 0.7],
	});

	return (
		<View style={styles.skeletonContainer}>
			<Animated.View style={[styles.skeletonContent, { opacity }]}>
				{/* PDF Page Skeleton */}
				<View style={styles.skeletonPage}>
					{/* Header bars */}
					<View style={styles.skeletonBar} />
					<View style={[styles.skeletonBar, { width: "80%" }]} />
					<View style={[styles.skeletonBar, { width: "90%" }]} />
					
					{/* Content lines */}
					<View style={styles.skeletonSection}>
						<View style={[styles.skeletonLine, { width: "95%" }]} />
						<View style={[styles.skeletonLine, { width: "88%" }]} />
						<View style={[styles.skeletonLine, { width: "92%" }]} />
						<View style={[styles.skeletonLine, { width: "85%" }]} />
					</View>

					<View style={styles.skeletonSection}>
						<View style={[styles.skeletonLine, { width: "90%" }]} />
						<View style={[styles.skeletonLine, { width: "93%" }]} />
						<View style={[styles.skeletonLine, { width: "87%" }]} />
					</View>

					<View style={styles.skeletonSection}>
						<View style={[styles.skeletonLine, { width: "91%" }]} />
						<View style={[styles.skeletonLine, { width: "86%" }]} />
						<View style={[styles.skeletonLine, { width: "94%" }]} />
						<View style={[styles.skeletonLine, { width: "89%" }]} />
					</View>
				</View>
			</Animated.View>
			
			{/* Loading Text */}
			<View style={styles.skeletonTextContainer}>
				<ActivityIndicator size="small" color="#666" />
				<Text style={styles.skeletonText}>Loading PDF...</Text>
			</View>
		</View>
	);
};

// Check if native ViewManager exists in the current runtime (e.g. Expo Go vs dev client)
const isNativePdfAvailable = (() => {
	try {
		return Boolean(
			UIManager &&
			typeof (UIManager as any).getViewManagerConfig === "function" &&
			((UIManager as any).getViewManagerConfig("RNPdfRendererView") ||
			 (UIManager as any).getViewManagerConfig("PdfRendererView"))
		);
	} catch {
		return false;
	}
})();

interface ErrorBoundaryProps {
	fallback: React.ReactNode;
	children: React.ReactNode;
}

interface ErrorBoundaryState {
	hasError: boolean;
}

class PdfErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
	constructor(props: ErrorBoundaryProps) {
		super(props);
		this.state = { hasError: false };
	}

	static getDerivedStateFromError() {
		return { hasError: true };
	}

	componentDidCatch(error: any) {
		console.warn("PDF native renderer failed, falling back to preview card:", error?.message || error);
	}

	render() {
		if (this.state.hasError) {
			return this.props.fallback;
		}
		return this.props.children;
	}
}

const PdfFallbackPreview = ({
	onOpenPdf,
	onDownloadPdf,
	isDownloading,
}: {
	onOpenPdf: () => void;
	onDownloadPdf: () => void;
	isDownloading: boolean;
}) => {
	const { t } = useTranslation();
	return (
		<View style={styles.fallbackContainer}>
			<View style={styles.fallbackIconBadge}>
				<Ionicons name="document-text" size={40} color="#4D43FE" />
			</View>
			<Text style={styles.fallbackTitle}>
				{t("sanctionLetter")}
			</Text>
			<Text style={styles.fallbackSubtitle}>
				Your sanction document has been generated and is ready to view and sign.
			</Text>

			<View style={styles.fallbackBadgeRow}>
				<View style={styles.fallbackPill}>
					<Ionicons name="checkmark-circle" size={14} color="#10B981" />
					<Text style={styles.fallbackPillText}>Verified</Text>
				</View>
				<View style={styles.fallbackPill}>
					<Text style={styles.fallbackPillText}>PDF Document</Text>
				</View>
			</View>

			<View style={styles.fallbackActions}>
				<TouchableOpacity
					style={styles.fallbackOpenBtn}
					onPress={onOpenPdf}
					activeOpacity={0.8}>
					<Ionicons name="eye-outline" size={18} color="#FFFFFF" />
					<Text style={styles.fallbackOpenBtnText}>
						View Document
					</Text>
				</TouchableOpacity>

				<TouchableOpacity
					style={styles.fallbackDownloadBtn}
					onPress={onDownloadPdf}
					disabled={isDownloading}
					activeOpacity={0.8}>
					{isDownloading ? (
						<ActivityIndicator size="small" color="#4D43FE" />
					) : (
						<>
							<Ionicons name="download-outline" size={18} color="#4D43FE" />
							<Text style={styles.fallbackDownloadBtnText}>
								{t("downloadDocument")}
							</Text>
						</>
					)}
				</TouchableOpacity>
			</View>
		</View>
	);
};

export default function SanctionLetter() {
	const { t } = useTranslation();
	const router = useRouter();
	const navigation = useNavigation();

	// Track this screen in the journey
	useJourneyTracker("/sanction-letter");

	const [source, setSource] = useState<string | null>(null);
	const [page, setPage] = useState({
		current: 0,
		total: 0,
	});

	const [downloading, setDownloading] = useState(true);
	const [downloadingToDevice, setDownloadingToDevice] = useState(false);
	const [showRejectionScreen, setShowRejectionScreen] = useState(false);
	const [loanStatus, setLoanStatus] = useState<LoanStatusResponse | null>(null);
	const [shouldPoll, setShouldPoll] = useState(true);
	const [rejectionModalVisible, setRejectionModalVisible] = useState(false);
	const [delayVisible, setDelayVisible] = useState(false);
	const [rejectionMessage, setRejectionMessage] = useState<string>("");
	const [rejectionCountdown, setRejectionCountdown] = useState(15);
	const [isExitModalVisible, setIsExitModalVisible] = useState(false);

	// const { data } = useNetworkAwareQuery({
	// 	queryKey: ["sanction-letter", "generate"],
	// 	queryFn: async () => {
	// 		const response = await axios.post(URLS.sanction_letter.generate, {});
	// 		return response.data;
	// 	},
	// 	retry: 2,
	// 	staleTime: 300 * 1000,
	// });

	// Initiate Digital Signing Mutation
	const { mutate: initiateSigningMutation, isPending: isInitiatingSign } =
		useNetworkAwareMutation({
		mutationFn: initiateDigitalSigning,
		onSuccess: (data) => {
			console.log("Initiate Digital Signing API Response:", data);
			console.log("Digital Signing Success:", JSON.stringify(data, null, 2));

			// If onSuccess is called, API succeeded - check for success field or otp_sent field
			if (data?.success !== false && (data?.success || data?.otp_sent || data?.message)) {
				Toast.show({
					type: "success",
					text1: t("otpSentSuccessfully2"),
					text2: data?.message || t("checkRegisteredMobile"),
				});

				// Navigate to OTP verification page
				router.push("/enter-otp");
			} else {
				Toast.show({
					type: "error",
					text1: t("failedToSendOTP"),
					text2: data?.message || t("pleaseTryAgain"),
				});
			}
		},
			onError: (err: any, variables, ctx) => {
				console.log("❌ Initiate Digital Signing API Error:", err);
				console.log("📤 Request payload that failed:", JSON.stringify(variables, null, 2));

				const { error, errorType } = errorHandler(err, variables, ctx);

				console.log("🔥 Processed Error:", error);
				console.log("🔥 Error Type:", errorType);

				// Show detailed error message
				let errorMessage = "Please try again";
				if (err?.response?.data?.message) {
					errorMessage = err.response.data.message;
				} else if (err?.response?.data?.detail) {
					errorMessage =
						typeof err.response.data.detail === "string"
							? err.response.data.detail
							: JSON.stringify(err.response.data.detail);
				} else if (error?.message) {
					errorMessage = error.message;
				}

				Toast.show({
					type: "error",
					text1: t("failedToSendOTP"),
					text2: errorMessage,
				});
			},
		});

	useEffect(() => {
		// Track if this screen is currently focused
		const isFocused = navigation.isFocused();
		
		// Prevent swipe or navigation.goBack inside router
		// BUT only when this screen is actually focused
		const unsubscribe = navigation.addListener("beforeRemove", (e) => {
			// Only show exit modal if this screen is currently focused (not if loan-enter-otp is on top)
			if (["GO_BACK", "POP"].includes(e.data.action.type) && navigation.isFocused()) {
				e.preventDefault();
				setIsExitModalVisible(true);
			}
		});

		// Intercept Android hardware back button
		// Only when this screen is focused
		const backHandler = BackHandler.addEventListener("hardwareBackPress", () => {
			// Only show exit modal if this screen is currently focused
			if (navigation.isFocused()) {
				setIsExitModalVisible(true);
				return true; // prevent default app exit
			}
			return false; // let the focused screen handle it
		});

		return () => {
			unsubscribe();
			backHandler.remove();
		};
	}, [navigation, router]);

	const handleSignWithOTP = async () => {
		console.log("🚀 Initiating digital signing process...");
		let appHash = "";
		try {
			const hashes = await RNOtpVerify.getHash();
			if (hashes && hashes.length > 0) {
				appHash = hashes[0];
				console.log("🔑 [SanctionLetter] Retrieved App Hash for OTP Auto-Fetch:", appHash);
			}
		} catch (hashError) {
			console.error("❌ [SanctionLetter] Failed to get app hash:", hashError);
		}
		initiateSigningMutation(appHash || undefined);
	};

	const downloadPDFToDevice = useCallback(async () => {
		try {
			setDownloadingToDevice(true);
			console.log("📄 Starting loan agreement download...");
			
			const response = await downloadLoanAgreement();
			
			if (response.download_url) {
				console.log("📄 Opening download URL:", response.download_url);
				
				// Open the URL directly - mobile browsers will handle PDF downloads
				const canOpen = await Linking.canOpenURL(response.download_url);
				
				if (canOpen) {
					await Linking.openURL(response.download_url);
					
					Toast.show({
						type: "success",
						text1: "Download Started",
						text2: "The PDF will download to your device",
					});
				} else {
					throw new Error("Cannot open download URL");
				}
			} else {
				throw new Error("No download URL received");
			}

			// if (Platform.OS === "android") {
			// 	// For Android, request media library permissions
			// 	const { status } = await MediaLibrary.requestPermissionsAsync();

			// 	if (status !== "granted") {
			// 		Alert.alert(
			// 			"Permission Required",
			// 			"Storage permission is required to download the PDF. Please enable it in settings.",
			// 		);
			// 		return;
			// 	}

			// 	// Copy file to a more accessible location and save to media library
			// 	const fileName = `Sanction_Letter_${Date.now()}.pdf`;
			// 	const fileUri = FileSystem.documentDirectory + fileName;

			// 	// Copy the downloaded file to a new location with a clean name
			// 	await FileSystem.copyAsync({
			// 		from: source,
			// 		to: fileUri,
			// 	});

			// 	// Save to device storage
			// 	const asset = await MediaLibrary.createAssetAsync(fileUri);
			// 	const album = await MediaLibrary.getAlbumAsync("Downloads");

			// 	if (album == null) {
			// 		await MediaLibrary.createAlbumAsync("Downloads", asset, false);
			// 	} else {
			// 		await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
			// 	}

			// 	Alert.alert("Download Complete", "PDF has been saved to your Downloads folder", [
			// 		{ text: "OK" },
			// 	]);
			// } else {
			// 	// For iOS, use sharing
			// 	const fileName = `Sanction_Letter_${Date.now()}.pdf`;
			// 	const fileUri = FileSystem.documentDirectory + fileName;

			// 	// Copy the downloaded file to a new location with a clean name
			// 	await FileSystem.copyAsync({
			// 		from: source,
			// 		to: fileUri,
			// 	});

			// 	if (await Sharing.isAvailableAsync()) {
			// 		await Sharing.shareAsync(fileUri, {
			// 			mimeType: "application/pdf",
			// 			dialogTitle: "Save Sanction Letter PDF",
			// 		});
			// 	} else {
			// 		Alert.alert("Error", "Sharing is not available on this device");
			// 	}
			// }
		} catch (error: any) {
			console.error("❌ Download failed:", error);
			Toast.show({
				type: "error",
				text1: "Download Failed",
				text2: error?.response?.data?.message || error?.message || "Unable to download loan agreement",
			});
		} finally {
			setDownloadingToDevice(false);
		}
	}, [t]);

	const downloadWithExpoFileSystem = useCallback(async (file_url: string) => {
		try {
			console.log("downloading...", file_url);
			setDownloading(true);

			/**
			 * Download the PDF file with expo-file-system/legacy
			 */
			const targetUrl = file_url || DEFAULT_FILE_URL;
			const destinationUri =
				((FileSystem as any).documentDirectory || "") + "sanction.pdf";

			const response = await FileSystem.downloadAsync(targetUrl, destinationUri);
			console.log("Download response status:", response.status);

			// Check if download was successful
			if (response.status === 200) {
				console.log("PDF downloaded successfully to:", response.uri);
				setSource(response.uri);
			} else {
				console.error("Download failed with status:", response.status);
				if (targetUrl !== DEFAULT_FILE_URL) {
					console.warn("Attempting fallback PDF download...");
					const fallbackResponse = await FileSystem.downloadAsync(
						DEFAULT_FILE_URL,
						destinationUri,
					);
					if (fallbackResponse.status === 200) {
						console.log("Fallback PDF downloaded successfully to:", fallbackResponse.uri);
						setSource(fallbackResponse.uri);
					}
				}
			}
		} catch (err) {
			console.error("Error while downloading PDF:", err);
			try {
				const destinationUri =
					((FileSystem as any).documentDirectory || "") + "sanction.pdf";
				const fallbackResponse = await FileSystem.downloadAsync(
					DEFAULT_FILE_URL,
					destinationUri,
				);
				if (fallbackResponse.status === 200) {
					console.log("Fallback PDF downloaded successfully in catch:", fallbackResponse.uri);
					setSource(fallbackResponse.uri);
				}
			} catch (fallbackErr) {
				console.error("Fallback PDF download also failed:", fallbackErr);
			}
		} finally {
			setDownloading(false);
		}
	}, []);

	// Loan status polling query
	const { data: loanStatusData, isLoading: isPollLoading } = useNetworkAwareQuery({
		queryKey: ["loan-status", "simple-loan-status"],
		queryFn: async () => {
			const response = await axios.get<LoanStatusResponse>(
				URLS.loan_status.simple_loan_status,
			);
			return response.data;
		},
		// refetchInterval: shouldPoll ? 15000 : false,
		enabled: false,
		refetchIntervalInBackground: false,
	});

	// Fetch Loan Agreement from generate API
	const { data: loanAgreement, isLoading, error: loanAgreementError } = useNetworkAwareQuery({
		queryKey: ["loan-agreement", "generate"],
		queryFn: async () => {
			const response = await axios.post<LoanAgreementResponse>(
				URLS.loan_agreement.generate,
				{},
				{ timeout: 0 } // No timeout for this specific request
			);
			return response.data;
		},
		staleTime: 0, // Force fresh fetch every time to prevent showing old letter
		gcTime: 0, // Clear from cache when unmounted
	});

	const handleOpenPdf = useCallback(async () => {
		try {
			const targetUrl = loanAgreement?.file_url || DEFAULT_FILE_URL;
			console.log("Opening PDF:", targetUrl);
			await WebBrowser.openBrowserAsync(targetUrl, {
				presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
			});
		} catch (error) {
			console.warn("WebBrowser open failed, trying Linking:", error);
			try {
				const targetUrl = loanAgreement?.file_url || DEFAULT_FILE_URL;
				await Linking.openURL(targetUrl);
			} catch (linkingErr) {
				console.error("Linking open failed:", linkingErr);
				Toast.show({
					type: "info",
					text1: "Opening Document",
					text2: "Unable to open viewer directly. Tap Download to save.",
				});
			}
		}
	}, [loanAgreement?.file_url]);

	// Handle loan agreement API error - "Loan application rejected by lender"
	useEffect(() => {
		if (loanAgreementError) {
			const error: any = loanAgreementError;
			const errorMessage = error?.response?.data?.message || error?.message || "";
			const lowerCaseError = errorMessage.toLowerCase();
			if (lowerCaseError.includes("rejected by lender") || lowerCaseError.includes("loan application rejected")) {
				console.log("⚠️ Loan application rejected by lender - showing rejection modal");
				// Use standard rejection message for all rejections
				setRejectionMessage(t("standardRejectionMessage"));
				// Set flag to indicate loan was rejected
				setStorageItem(STORAGE_KEYS["@loan-rejected-flag"], "true");
				setRejectionModalVisible(true);
			}
		}
	}, [loanAgreementError]);


	// COMMENTED OUT: Old KFS Document API
	// const { data: kfsDocument, isLoading } = useNetworkAwareQuery({
	// 	queryKey: ["sanction-letter", "kfs-document"],
	// 	queryFn: async () => {
	// 		const response = await axios.get<KfsDocumentResponse>(
	// 			URLS.sanction_letter.kfs_document,
	// 		);
	// 		return response.data;
	// 	},
	// 	enabled: loanStatusData?.status === "kfs_generated", // Only enable when kfs_generated status is received
	// });

	useEffect(() => {
		// Download PDF from API response
		if (loanAgreement?.file_url) {
			downloadWithExpoFileSystem(loanAgreement.file_url);
		}
		
		// COMMENTED OUT: Old hardcoded S3 URL
		// downloadWithExpoFileSystem(DEFAULT_FILE_URL);
		
		// COMMENTED OUT: Old KFS Document
		// if (kfsDocument) {
		// 	downloadWithExpoFileSystem(kfsDocument.data.kfs_url);
		// }
	}, [loanAgreement, downloadWithExpoFileSystem]);


	// Handle loan status changes
	useEffect(() => {
		if (loanStatusData) {
			setLoanStatus(loanStatusData);

			// Stop polling if status is not "processing"
			if (loanStatusData.status !== "processing") {
				setShouldPoll(false);
			}

			// Handle rejection
			if (loanStatusData.status === "rejected_by_lender") {
				setShowRejectionScreen(true);

				// Redirect to tabs after 5 seconds
				const redirectTimer = setTimeout(() => {
					router.replace("/(tabs)");
				}, 15000);

				return () => clearTimeout(redirectTimer);
			}
		}
	}, [loanStatusData, router]);

	console.log("source", source);

	const handleGoBack = () => {
		setIsExitModalVisible(true);
	};

	// Rejection Screen Component
	const RejectionScreen = () => (
		<View style={styles.rejectionContainer}>
			<View style={styles.rejectionContent}>
				<Ionicons name="close-circle" size={80} color="#FF6B6B" />
				<Text style={styles.rejectionScreenTitle}>{t("loanRejected")}</Text>
				<Text style={styles.rejectionScreenMessage}>
					{t("yourLoanApplicationHasBeenRejected")}
				</Text>
				<Text style={styles.rejectionSubMessage}>{t("redirectingToHomePageShortly")}</Text>
				<ActivityIndicator size="large" color="#FF6B6B" style={{ marginTop: height(3) }} />
			</View>
		</View>
	);

	// Processing Screen Component
	const ProcessingScreen = () => (
		<View style={styles.processingContainer}>
			<View style={styles.processingContent}>
				<ActivityIndicator size="large" color="#A4E65E" />
				<Text style={styles.processingTitle}>
					{loanStatus?.processing_details?.current_stage || t("processing")}
				</Text>
				<Text style={styles.processingMessage}>
					{loanStatus?.next_steps?.wait_message ||
						t("pleaseWaitWhileWeProcessYourApplication")}
				</Text>
				<Text style={[styles.processingMessage, { marginTop: height(1) }]}>
					{loanStatus?.next_steps?.wait_message || t("thisWillTakeSomeTime")}
				</Text>
				{loanStatus?.processing_details?.progress_percentage && (
					<View style={styles.progressContainer}>
						<Text style={styles.progressText}>
							{t("progress")}: {loanStatus.processing_details.progress_percentage}%
						</Text>
					</View>
				)}
			</View>
		</View>
	);

	// Show rejection screen if loan is rejected
	if (showRejectionScreen) {
		return (
			<SafeAreaView style={styles.container}>
				<RejectionScreen />
			</SafeAreaView>
		);
	}

	console.log("loanStatus", loanStatus);

	// Show processing screen if loan is still processing
	// COMMENTED OUT: Old processing screen with header
	// if (loanStatus?.status === "processing" || isPollLoading /*|| shouldPoll*/) {
	// 	return (
	// 		<SafeAreaView style={styles.container}>
	// 			{/* Header */}
	// 			<View style={styles.header}>
	// 				<TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
	// 					<Ionicons name="arrow-back" size={24} color={dark} />
	// 				</TouchableOpacity>
	// 				<Text style={styles.headerTitle}>{t("loanProcessing")}</Text>
	// 			</View>
	// 			<ProcessingScreen />
	// 		</SafeAreaView>
	// 	);
	// }

	return (
		<>
			<SafeAreaView style={styles.container}>
				{/* Header */}
				<View style={styles.header}>
					<TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
						<Ionicons name="arrow-back" size={24} color={dark} />
					</TouchableOpacity>
					<Text style={styles.headerTitle}>{t("digitallySignYourSanctionLetter")}</Text>
				</View>

				{/* Content */}
				{downloading || isLoading ? (
					<View style={styles.simpleLoadingContainer}>
						<ActivityIndicator size="large" color="#000000" />
						<TranslatedText style={styles.simpleLoadingText} translationKey="loading" />
					</View>
				) : (
					<>
						<ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
							<View style={styles.documentContainer}>
								<Text style={styles.sectionTitle}>{t("sanctionLetter")}</Text>
								{source ? (
									<View style={styles.pdfContainer}>
										{isNativePdfAvailable ? (
											<PdfErrorBoundary
												fallback={
													<PdfFallbackPreview
														onOpenPdf={handleOpenPdf}
														onDownloadPdf={downloadPDFToDevice}
														isDownloading={downloadingToDevice}
													/>
												}>
												<PdfRendererView
													style={styles.pdfRenderer}
													source={source}
													distanceBetweenPages={5}
													maxZoom={1}
													maxPageResolution={1024}
													singlePage={false}
													onError={() => {
														console.warn("Error loading PDF");
													}}
													onPageChange={(current: number, total: number) => {
														console.log("📄 PDF Page Change - Current:", current, "Total:", total);
														setPage({ current, total });
													}}
												/>
											</PdfErrorBoundary>
										) : (
											<PdfFallbackPreview
												onOpenPdf={handleOpenPdf}
												onDownloadPdf={downloadPDFToDevice}
												isDownloading={downloadingToDevice}
											/>
										)}
									</View>
								) : (
									<View style={styles.loadingContainer}>
										<Text style={styles.loadingText}>{t("errorLoadingPDF")}</Text>
									</View>
								)}
							</View>
							{source && isNativePdfAvailable && (
								<Text style={styles.pageCounter}>
									{page.current + 1} / {page.total || 15}
								</Text>
							)}
						</ScrollView>

						{/* Fixed Buttons at bottom */}
						{source && (
							<View style={styles.buttonContainer}>
								
								<TouchableOpacity
									style={[
										styles.signButton,
										isInitiatingSign && styles.disabledButton,
									]}
									onPress={handleSignWithOTP}
									disabled={isInitiatingSign}>
									<View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
										<Text style={styles.signButtonText}>
											{isInitiatingSign
												? t("sendingOTP")
												: t("signAllDocumentsWithOTP")}
										</Text>
										<IconSymbol name="arrow.right" size={20} color="#333" />
									</View>
								</TouchableOpacity>
								<TouchableOpacity
									style={[
										styles.downloadButton,
										downloadingToDevice && styles.disabledButton,
									]}
									onPress={downloadPDFToDevice}
									disabled={downloadingToDevice}>
									<Text style={styles.downloadButtonText}>
										{downloadingToDevice
											? t("downloading")
											: t("downloadDocument")}
									</Text>
								</TouchableOpacity>
							</View>
						)}
					</>
				)}
			</SafeAreaView>

			{/* Rejection Modal */}
				<RejectionModal
					visible={rejectionModalVisible}
					countdown={rejectionCountdown}
					setCountdown={setRejectionCountdown}
					onClose={() => setRejectionModalVisible(false)}
				/>
				<ExitIntentModal
					visible={isExitModalVisible}
					onClose={() => setIsExitModalVisible(false)}
					onConfirmExit={() => {
						setIsExitModalVisible(false);
						router.replace("/(tabs)");
					}}
				/>
		</>
	);
}

const styles = StyleSheet.create({
	sectionTitle: {
		fontSize: 18,
		fontWeight: "600",
		color: dark,
		textAlign: "center",
		marginVertical: height(2),
	},
	separator: {
		height: 2,
		backgroundColor: "#E5E5E5",
		marginVertical: height(3),
		marginHorizontal: width(5),
	},
	container: {
		flex: 1,
		backgroundColor: white,
	},
	simpleLoadingContainer: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		backgroundColor: white,
	},
	simpleLoadingText: {
		fontSize: font(2),
		color: "#000000",
		fontWeight: "500",
		marginTop: height(2),
	},
	header: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: width(4),
		paddingTop: height(6),
		paddingBottom: height(2),
		backgroundColor: white,
		borderBottomWidth: 1,
		borderBottomColor: "#E5E5E5",
	},
	backButton: {
		marginRight: width(4),
		padding: 8,
	},
	headerTitle: {
		fontSize: font(1.8),
		fontWeight: "600",
		color: dark,
		lineHeight: 24,
	},
	scrollView: {
		flex: 1,
		paddingHorizontal: width(4),
	},
	documentContainer: {
		alignItems: "center",
		paddingVertical: height(1.5), // Reduced for better space utilization
	},
	pdfContainer: {
		width: width(92),
		height: height(55), // Reduced height for better button visibility on small screens
		borderRadius: 8,
		overflow: "hidden",
		backgroundColor: "#f5f5f5",
		borderWidth: 1,
		borderColor: "#e0e0e0",
	},
	pdfRenderer: {
		flex: 1,
		backgroundColor: "gray",
	},
	fallbackContainer: {
		flex: 1,
		backgroundColor: "#FFFFFF",
		alignItems: "center",
		justifyContent: "center",
		paddingHorizontal: width(5),
		paddingVertical: height(2),
	},
	fallbackIconBadge: {
		width: 72,
		height: 72,
		borderRadius: 36,
		backgroundColor: "#EEF2FF",
		alignItems: "center",
		justifyContent: "center",
		marginBottom: height(1.8),
	},
	fallbackTitle: {
		fontSize: font(2),
		fontWeight: "700",
		color: "#1F2937",
		textAlign: "center",
		marginBottom: height(0.8),
	},
	fallbackSubtitle: {
		fontSize: font(1.4),
		color: "#6B7280",
		textAlign: "center",
		lineHeight: 20,
		marginBottom: height(2),
		maxWidth: 280,
	},
	fallbackBadgeRow: {
		flexDirection: "row",
		gap: 8,
		marginBottom: height(2.5),
	},
	fallbackPill: {
		flexDirection: "row",
		alignItems: "center",
		gap: 4,
		backgroundColor: "#F3F4F6",
		paddingHorizontal: 10,
		paddingVertical: 4,
		borderRadius: 12,
	},
	fallbackPillText: {
		fontSize: 12,
		color: "#4B5563",
		fontWeight: "500",
	},
	fallbackActions: {
		width: "100%",
		flexDirection: "row",
		gap: 12,
		justifyContent: "center",
	},
	fallbackOpenBtn: {
		flex: 1,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 6,
		backgroundColor: "#4D43FE",
		paddingVertical: 12,
		borderRadius: 8,
	},
	fallbackOpenBtnText: {
		color: "#FFFFFF",
		fontSize: 14,
		fontWeight: "600",
	},
	fallbackDownloadBtn: {
		flex: 1,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 6,
		backgroundColor: "#EEF2FF",
		paddingVertical: 12,
		borderRadius: 8,
		borderWidth: 1,
		borderColor: "#C7D2FE",
	},
	fallbackDownloadBtnText: {
		color: "#4D43FE",
		fontSize: 14,
		fontWeight: "600",
	},
	loadingContainer: {
		width: width(92),
		height: height(55), // Match the PDF container height
		justifyContent: "center",
		alignItems: "center",
		backgroundColor: "#f5f5f5",
		borderRadius: 8,
		borderWidth: 1,
		borderColor: "#e0e0e0",
	},
	loadingText: {
		fontSize: 16,
		color: "#666",
		fontWeight: "500",
	},
	sanctionLetterImage: {
		width: width(92),
		height: height(65),
	},
	pageCounter: {
		textAlign: "center",
		fontSize: font(1.4),
		color: "#666",
		marginTop: height(1),
		marginBottom: height(1),
	},
	buttonContainer: {
		paddingHorizontal: width(4),
		paddingVertical: height(2),
		paddingBottom: height(7), // Extra padding to push buttons above bottom navigation
		backgroundColor: white,
		gap: height(1.5),
	},
	bottomContainer: {
		paddingHorizontal: width(4),
		paddingVertical: height(5),
		backgroundColor: white,
	},
	signButton: {
		backgroundColor: "#A4E65E",
		borderRadius: 25,
		paddingVertical: height(2),
		alignItems: "center",
		width: "100%",
	},
	signButtonText: {
		fontSize: 18,
		fontWeight: "600",
		color: "#333",
	},
	downloadButton: {
		borderRadius: 25,
		paddingVertical: height(2),
		alignItems: "center",
		width: "100%",
	},
	downloadButtonText: {
		fontSize: 18,
		fontWeight: "600",
		color: "#333",
		textDecorationLine: "underline",

	},
	disabledButton: {
		opacity: 0.7,
	},
	rejectionContainer: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		backgroundColor: white,
		paddingHorizontal: width(8),
	},
	rejectionContent: {
		alignItems: "center",
		textAlign: "center",
	},
	rejectionScreenTitle: {
		fontSize: font(2.4),
		fontWeight: "bold",
		color: "#FF6B6B",
		marginTop: height(3),
		textAlign: "center",
	},
	rejectionScreenMessage: {
		fontSize: font(1.6),
		color: dark,
		textAlign: "center",
		marginTop: height(2),
		lineHeight: 24,
	},
	rejectionSubMessage: {
		fontSize: font(1.4),
		color: "#666",
		textAlign: "center",
		marginTop: height(1),
	},
	processingContainer: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		backgroundColor: white,
		paddingHorizontal: width(8),
	},
	processingContent: {
		alignItems: "center",
		textAlign: "center",
	},
	processingTitle: {
		fontSize: font(2.0),
		fontWeight: "600",
		color: dark,
		marginTop: height(3),
		textAlign: "center",
	},
	processingMessage: {
		fontSize: font(1.4),
		color: "#666",
		textAlign: "center",
		marginTop: height(2),
		lineHeight: 22,
	},
	progressContainer: {
		marginTop: height(3),
		paddingHorizontal: width(4),
		paddingVertical: height(1.5),
		backgroundColor: "#f8f9fa",
		borderRadius: 8,
	},
	progressText: {
		fontSize: font(1.4),
		color: dark,
		fontWeight: "500",
		textAlign: "center",
	},
	// Header BG image
	rejectionHeaderBg: {
		width: "150%",
		paddingTop: height(5),
		paddingBottom: height(6),
		paddingHorizontal: width(7),
		alignItems: "center",
		justifyContent: "center",
		transform: [{ translateY: -height(2) }],
	},

	// Skeleton Loader Styles
	skeletonContainer: {
		width: width(92),
		height: height(55),
		borderRadius: 8,
		backgroundColor: "#f5f5f5",
		borderWidth: 1,
		borderColor: "#e0e0e0",
		justifyContent: "center",
		alignItems: "center",
		padding: width(4),
	},
	skeletonContent: {
		width: "100%",
		height: "100%",
	},
	skeletonPage: {
		flex: 1,
		backgroundColor: "white",
		borderRadius: 4,
		padding: width(4),
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.1,
		shadowRadius: 2,
		elevation: 2,
	},
	skeletonBar: {
		height: 16,
		backgroundColor: "#e0e0e0",
		borderRadius: 4,
		marginBottom: height(1.5),
		width: "100%",
	},
	skeletonSection: {
		marginTop: height(2),
		marginBottom: height(1),
	},
	skeletonLine: {
		height: 10,
		backgroundColor: "#e0e0e0",
		borderRadius: 3,
		marginBottom: height(0.8),
		width: "100%",
	},
	skeletonTextContainer: {
		position: "absolute",
		bottom: height(2),
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
	},
	skeletonText: {
		fontSize: 14,
		color: "#666",
		fontWeight: "500",
	},
});
