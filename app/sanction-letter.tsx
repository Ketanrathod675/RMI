import ExitIntentModal from "@/components/assessment-fee/ExitIntentModal";
import { dark, white } from "@/constants/Colors";
import { IconSymbol } from "@/components/ui/IconSymbol";
import { useQueryClient } from "@tanstack/react-query";
import { useJourneyTracker } from "@/hooks/useJourneyTracker";
import { useNetworkAwareMutation } from "@/hooks/useNetworkAwareMutation";
import { useNetworkAwareQuery } from "@/hooks/useNetworkAwareQuery";
import { useTranslation } from "@/hooks/useTranslation";
import {
	getSanctionLetterStatus,
	generateSanctionLetterPdf,
	downloadSanctionLetterPdf,
	initiateKfsSigning,
	openLocalPdf,
	URLS,
} from "@/utils/api";
import { getApiErrorInfo, errorText } from "@/utils/api/errors";
import { font, height, width } from "@/utils/dimensions";
import Logger from "@/utils/logger";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
	ActivityIndicator,
	Animated,
	BackHandler,
	ScrollView,
	StyleSheet,
	Text,
	TouchableOpacity,
	UIManager,
	View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import PdfRendererView from "react-native-pdf-renderer";
import Toast from "react-native-toast-message";

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
		Logger.debug("PdfErrorBoundary caught error", { message: error?.message });
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
}: {
	onOpenPdf: () => void;
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
					onPress={onOpenPdf}
					activeOpacity={0.8}>
					<Ionicons name="download-outline" size={18} color="#4D43FE" />
					<Text style={styles.fallbackDownloadBtnText}>
						{t("downloadDocument") || "Download"}
					</Text>
				</TouchableOpacity>
			</View>
		</View>
	);
};

export default function SanctionLetter() {
	const { t } = useTranslation();
	const router = useRouter();
	const navigation = useNavigation();
	const queryClient = useQueryClient();

	// Track this screen in the journey
	useJourneyTracker("/sanction-letter");

	const [page, setPage] = useState({
		current: 0,
		total: 0,
	});
	const [isExitModalVisible, setIsExitModalVisible] = useState(false);

	// Fetch or generate Sanction Letter PDF
	const {
		data: docData,
		isLoading,
		isFetching,
		error: docError,
		refetch: refetchDocument,
	} = useNetworkAwareQuery({
		queryKey: ["sanction-letter", "document"],
		queryFn: async () => {
			const status = await getSanctionLetterStatus();
			if (status.is_signed || status.status === "accepted") {
				return { signed: true as const, uri: null, sanctionNumber: status.sanction_number, validUntil: status.valid_until };
			}
			let currentStatus = status;
			if (currentStatus.status === "not_generated") {
				const genResult = await generateSanctionLetterPdf();
				currentStatus = await getSanctionLetterStatus();
				if (!currentStatus.download_url && genResult?.download_url) {
					currentStatus.download_url = genResult.download_url;
				}
			}
			const downloadUrl = currentStatus.download_url || URLS.sanction_letter.download;
			const uri = await downloadSanctionLetterPdf(
				downloadUrl,
				currentStatus.sanction_number
			);
			return {
				signed: false as const,
				uri,
				sanctionNumber: currentStatus.sanction_number,
				validUntil: currentStatus.valid_until,
			};
		},
		staleTime: 0,
		gcTime: 0,
		retry: 1,
	});

	// If already signed, navigate forward to auto debit setup
	useEffect(() => {
		if (docData?.signed) {
			queryClient.invalidateQueries({ queryKey: ["user", "dashboard"] });
			router.replace("/auto-debit-setup");
		}
	}, [docData, queryClient, router]);

	// Handle query errors
	useEffect(() => {
		if (docError) {
			const info = getApiErrorInfo(docError);
			const text = errorText(info);
			Logger.debug("Sanction letter document query error", { status: info.status });

			if ((info.status === 409 || info.status === 404) && text.includes("bank details")) {
				router.replace("/verify-bank-details");
				return;
			}
			if (
				info.status === 409 &&
				(text.includes("agreement signing step") || text.includes("not at"))
			) {
				queryClient.invalidateQueries({ queryKey: ["user", "dashboard"] });
				router.replace("/(tabs)");
				return;
			}
		}
	}, [docError, queryClient, router]);

	// Initiate Digital Signing Mutation
	const { mutate: initiateSigningMutation, isPending: isInitiatingSign } =
		useNetworkAwareMutation({
			mutationFn: () => initiateKfsSigning(),
			onSuccess: (data) => {
				Logger.debug("Initiate KFS signing success", {
					otp_sent: data?.otp_sent,
					expires_in_seconds: data?.expires_in_seconds,
				});

				if (__DEV__ && data?.test_otp) {
					Toast.show({
						type: "info",
						text1: `Test OTP: ${data.test_otp}`,
						visibilityTime: 10000,
					});
				}

				Toast.show({
					type: "success",
					text1: t("otpSentSuccessfully2") || "OTP Sent Successfully",
					text2: data?.message || t("checkRegisteredMobile") || "Please check your registered mobile number",
				});

				router.push({
					pathname: "/enter-otp",
					params: {
						sign_in_key: data?.sign_in_key ?? "",
						expires_in_seconds: String(data?.expires_in_seconds ?? ""),
					},
				});
			},
			onError: (err: any) => {
				const info = getApiErrorInfo(err);
				const text = errorText(info);
				Logger.debug("Initiate KFS signing error", { status: info.status });

				if (info.status === 429) {
					Toast.show({
						type: "error",
						text1: t("alert") || "Notice",
						text2: info.detail || info.message || "Too many requests. Please try again later.",
					});
					return;
				}

				if (info.status === 400 && text.includes("already signed")) {
					queryClient.invalidateQueries({ queryKey: ["user", "dashboard"] });
					router.replace("/auto-debit-setup");
					return;
				}

				if (info.status === 409) {
					queryClient.invalidateQueries({ queryKey: ["user", "dashboard"] });
					router.replace("/(tabs)");
					return;
				}

				Toast.show({
					type: "error",
					text1: t("failedToSendOTP") || "Failed to send OTP",
					text2: info.detail || info.message || t("pleaseTryAgain") || "Please try again",
				});
			},
		});

	// Back button interception
	useEffect(() => {
		const unsubscribe = navigation.addListener("beforeRemove", (e) => {
			if (["GO_BACK", "POP"].includes(e.data.action.type) && navigation.isFocused()) {
				e.preventDefault();
				setIsExitModalVisible(true);
			}
		});

		const backHandler = BackHandler.addEventListener("hardwareBackPress", () => {
			if (navigation.isFocused()) {
				setIsExitModalVisible(true);
				return true;
			}
			return false;
		});

		return () => {
			unsubscribe();
			backHandler.remove();
		};
	}, [navigation]);

	const handleGoBack = () => {
		setIsExitModalVisible(true);
	};

	const handleOpenPdf = useCallback(async () => {
		try {
			if (!docData?.uri) throw new Error("PDF not downloaded");
			await openLocalPdf(docData.uri);
		} catch (error: any) {
			Logger.debug("Could not open local PDF viewer", { message: error?.message });
			Toast.show({
				type: "info",
				text1: "Opening Document",
				text2: "Unable to open viewer directly.",
			});
		}
	}, [docData?.uri]);

	const errorInfo = docError ? getApiErrorInfo(docError) : null;
	const errorMessage = errorInfo?.detail || errorInfo?.message;

	const isPdfReady = Boolean(docData?.uri && !docData.signed);
	const isBusy = isLoading || isFetching || isInitiatingSign;
	const isSignDisabled = !isPdfReady || isBusy;

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
				<ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
					<View style={styles.documentContainer}>
						<Text style={styles.sectionTitle}>{t("sanctionLetter")}</Text>

						{isLoading || isFetching ? (
							<PDFSkeletonLoader />
						) : docData?.uri ? (
							<View style={styles.pdfContainer}>
								{isNativePdfAvailable ? (
									<PdfErrorBoundary
										fallback={
											<PdfFallbackPreview onOpenPdf={handleOpenPdf} />
										}>
										<PdfRendererView
											style={styles.pdfRenderer}
											source={docData.uri}
											distanceBetweenPages={5}
											maxZoom={1}
											maxPageResolution={1024}
											singlePage={false}
											onError={() => {
												Logger.debug("PDF native renderer failed on page render");
											}}
											onPageChange={(current: number, total: number) => {
												setPage({ current, total });
											}}
										/>
									</PdfErrorBoundary>
								) : (
									<PdfFallbackPreview onOpenPdf={handleOpenPdf} />
								)}
							</View>
						) : (
							<View style={styles.loadingContainer}>
								<Ionicons name="alert-circle-outline" size={48} color="#FF6B6B" style={{ marginBottom: 12 }} />
								<Text style={[styles.loadingText, { textAlign: "center", paddingHorizontal: 16 }]}>
									{errorMessage || t("errorLoadingPDF") || "Error Loading PDF"}
								</Text>
								<TouchableOpacity
									onPress={() => refetchDocument()}
									style={styles.retryButton}
									activeOpacity={0.7}>
									<Ionicons name="refresh-outline" size={18} color="#FFFFFF" />
									<Text style={styles.retryButtonText}>{t("retry") || "Retry"}</Text>
								</TouchableOpacity>
							</View>
						)}
					</View>

					{docData?.uri && isNativePdfAvailable && !isLoading && !isFetching && (
						<Text style={styles.pageCounter}>
							{page.current + 1} / {page.total || 1}
						</Text>
					)}
				</ScrollView>

				{/* Fixed Buttons at bottom */}
				<View style={styles.buttonContainer}>
					<TouchableOpacity
						style={[
							styles.signButton,
							isSignDisabled && styles.disabledButton,
						]}
						onPress={() => initiateSigningMutation()}
						disabled={isSignDisabled}>
						<View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
							<Text style={styles.signButtonText}>
								{isInitiatingSign
									? t("sendingOTP") || "Sending OTP..."
									: t("signAllDocumentsWithOTP") || "Sign with OTP"}
							</Text>
							<IconSymbol name="arrow.right" size={20} color="#333" />
						</View>
					</TouchableOpacity>

					{docData?.uri && (
						<TouchableOpacity
							style={[
								styles.downloadButton,
								isBusy && styles.disabledButton,
							]}
							onPress={handleOpenPdf}
							disabled={isBusy}>
							<Text style={styles.downloadButtonText}>
								{t("downloadDocument") || "Download Document"}
							</Text>
						</TouchableOpacity>
					)}
				</View>
			</SafeAreaView>

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
	container: {
		flex: 1,
		backgroundColor: white,
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
		paddingVertical: height(1.5),
	},
	pdfContainer: {
		width: width(92),
		height: height(55),
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
	downloadButton: {
		borderRadius: 25,
		paddingVertical: height(1.5),
		alignItems: "center",
		width: "100%",
		marginTop: height(1),
	},
	downloadButtonText: {
		fontSize: 16,
		fontWeight: "600",
		color: "#333",
		textDecorationLine: "underline",
	},
	loadingContainer: {
		width: width(92),
		height: height(55),
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
	retryButton: {
		marginTop: 16,
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
		backgroundColor: "#4D43FE",
		paddingVertical: 10,
		paddingHorizontal: 20,
		borderRadius: 8,
	},
	retryButtonText: {
		color: "#FFFFFF",
		fontSize: 14,
		fontWeight: "600",
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
		paddingBottom: height(7),
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
	disabledButton: {
		opacity: 0.5,
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
