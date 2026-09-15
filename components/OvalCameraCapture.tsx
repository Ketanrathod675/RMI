import React, { useEffect, useRef, useState } from "react";
import {
	Alert,
	Dimensions,
	Modal,
	Platform,
	SafeAreaView,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";
import Toast from "react-native-toast-message";
import { CameraType, CameraView, useCameraPermissions } from "expo-camera";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

export interface OvalCameraCaptureProps {
	visible?: boolean;
	onCapture: (imageUri: string) => void;
	onCancel: () => void;
	onLivenessConfirmed?: () => void;
	countdownFrom?: number;
}

// Check if running inside Expo Go store client (where native modules like VisionCamera don't exist)
const isExpoGo =
	Constants.appOwnership === "expo" ||
	Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

let LivenessCameraModal: React.ComponentType<any> | null = null;
let nativeLivenessLoadError: Error | null = null;

if (!isExpoGo) {
	try {
		const livenessModule = require("@rick427/react-native-liveness");
		LivenessCameraModal = livenessModule.LivenessCameraModal;
	} catch (err: any) {
		nativeLivenessLoadError = err;
		if (__DEV__) {
			console.warn("⚠️ [@rick427/react-native-liveness] Native module load failed:", err?.message);
		}
	}
}

/**
 * Fallback Camera component for Expo Go testing where native VisionCamera / ML Kit is unavailable.
 */
function ExpoGoCameraFallback({
	visible,
	onCapture,
	onCancel,
}: {
	visible: boolean;
	onCapture: (uri: string) => void;
	onCancel: () => void;
}) {
	const [facing, setFacing] = useState<CameraType>("front");
	const [permission, requestPermission] = useCameraPermissions();
	const [cameraReady, setCameraReady] = useState(false);
	const cameraRef = useRef<CameraView>(null);

	const ovalWidth = screenWidth * 0.82;
	const ovalHeight = ovalWidth * 1.15;
	const ovalX = (screenWidth - ovalWidth) / 2;
	const ovalY = (screenHeight - ovalHeight) / 2 - 40;

	const takePicture = async () => {
		if (cameraRef.current) {
			try {
				const photo = await cameraRef.current.takePictureAsync({
					quality: 0.8,
					base64: false,
					skipProcessing: false,
				});
				if (photo?.uri) {
					onCapture(photo.uri);
				}
			} catch (error) {
				console.error("Error taking photo in fallback camera:", error);
				Alert.alert("Camera Error", "Failed to capture photo. Please try again.");
			}
		}
	};

	return (
		<Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={onCancel}>
			<SafeAreaView style={styles.fallbackContainer}>
				{/* Top dev notice banner */}
				<View style={styles.devBanner}>
					<Text style={styles.devBannerTitle}>⚡ Expo Go Preview Mode</Text>
					<Text style={styles.devBannerSub}>
						Run `npx expo run:android` for native blink &amp; head-turn liveness verification.
					</Text>
				</View>

				{!permission?.granted ? (
					<View style={styles.permissionContainer}>
						<Text style={styles.permissionText}>Camera permission required for selfie capture.</Text>
						<TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
							<Text style={styles.permissionButtonText}>Grant Permission</Text>
						</TouchableOpacity>
						<TouchableOpacity style={[styles.permissionButton, { marginTop: 12, backgroundColor: "#666" }]} onPress={onCancel}>
							<Text style={styles.permissionButtonText}>Cancel</Text>
						</TouchableOpacity>
					</View>
				) : (
					<CameraView
						ref={cameraRef}
						style={styles.camera}
						facing={facing}
						onCameraReady={() => setCameraReady(true)}>
						{/* Oval overlay */}
						{cameraReady && (
							<View style={styles.overlay} pointerEvents="none">
								<View
									style={[
										styles.ovalBorder,
										{
											width: ovalWidth,
											height: ovalHeight,
											left: ovalX,
											top: ovalY,
											borderRadius: ovalWidth / 2,
										},
									]}
								/>
							</View>
						)}

						{/* Instructions */}
						<View style={styles.instructionsContainer}>
							<Text style={styles.instructionsText}>Position your face in the oval</Text>
							<Text style={styles.instructionsSubText}>Keep face centered and well lit</Text>
						</View>

						{/* Controls */}
						<View style={styles.controlsContainer}>
							<TouchableOpacity style={styles.cancelButton} onPress={onCancel} activeOpacity={0.7}>
								<Text style={styles.cancelButtonText}>Cancel</Text>
							</TouchableOpacity>

							<TouchableOpacity style={styles.captureButton} onPress={takePicture} activeOpacity={0.7}>
								<View style={styles.captureButtonInner} />
							</TouchableOpacity>

							<TouchableOpacity
								style={styles.flipButton}
								onPress={() => setFacing((c) => (c === "back" ? "front" : "back"))}
								activeOpacity={0.7}>
								<Text style={styles.flipButtonText}>↻</Text>
							</TouchableOpacity>
						</View>
					</CameraView>
				)}
			</SafeAreaView>
		</Modal>
	);
}

export default function OvalCameraCapture({
	visible = true,
	onCapture,
	onCancel,
	onLivenessConfirmed,
	countdownFrom = 3,
}: OvalCameraCaptureProps) {
	if (!visible) {
		return null;
	}

	// In Expo Go or if native Vision Camera module failed to load, use the fallback camera
	if (isExpoGo || !LivenessCameraModal) {
		return (
			<ExpoGoCameraFallback
				visible={visible}
				onCapture={onCapture}
				onCancel={onCancel}
			/>
		);
	}

	const handleCapture = (result: any) => {
		if (__DEV__) {
			console.log("📸 [Liveness] Verified and captured photo:", result?.photo?.path);
		}
		const rawPath = result?.photo?.path || "";
		const formattedUri = rawPath.startsWith("file://") ? rawPath : `file://${rawPath}`;
		onCapture(formattedUri);
	};

	const handleError = (error: Error) => {
		console.error("Liveness camera error:", error);
		Toast.show({
			type: "error",
			text1: "Liveness Verification Error",
			text2: error?.message || "Failed to complete liveness check. Please try again.",
		});
		onCancel();
	};

	return (
		<LivenessCameraModal
			visible={visible}
			onClose={onCancel}
			onCapture={handleCapture}
			onLivenessConfirmed={onLivenessConfirmed}
			onError={handleError}
			countdownFrom={countdownFrom}
			fontFamily={Platform.select({ ios: "System", android: "sans-serif" })}
		/>
	);
}

const styles = StyleSheet.create({
	fallbackContainer: {
		flex: 1,
		backgroundColor: "#000",
	},
	camera: {
		flex: 1,
		width: "100%",
		height: "100%",
	},
	devBanner: {
		backgroundColor: "#1F2937",
		paddingVertical: 10,
		paddingHorizontal: 16,
		alignItems: "center",
		zIndex: 20,
	},
	devBannerTitle: {
		color: "#FBBF24",
		fontSize: 13,
		fontWeight: "700",
	},
	devBannerSub: {
		color: "#D1D5DB",
		fontSize: 11,
		textAlign: "center",
		marginTop: 2,
	},
	permissionContainer: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		backgroundColor: "#111",
		paddingHorizontal: 20,
	},
	permissionText: {
		fontSize: 16,
		color: "#fff",
		textAlign: "center",
		marginBottom: 20,
	},
	permissionButton: {
		backgroundColor: "#4F6EF7",
		paddingHorizontal: 28,
		paddingVertical: 12,
		borderRadius: 8,
	},
	permissionButtonText: {
		color: "#fff",
		fontSize: 15,
		fontWeight: "600",
	},
	overlay: {
		...StyleSheet.absoluteFill,
		backgroundColor: "transparent",
	},
	ovalBorder: {
		position: "absolute",
		borderWidth: 3,
		borderColor: "#4F6EF7",
		borderStyle: "solid",
	},
	instructionsContainer: {
		position: "absolute",
		top: 70,
		left: 0,
		right: 0,
		alignItems: "center",
		paddingHorizontal: 20,
	},
	instructionsText: {
		color: "#fff",
		fontSize: 17,
		fontWeight: "700",
		textAlign: "center",
		textShadowColor: "rgba(0, 0, 0, 0.8)",
		textShadowOffset: { width: 1, height: 1 },
		textShadowRadius: 4,
	},
	instructionsSubText: {
		color: "#ddd",
		fontSize: 13,
		textAlign: "center",
		marginTop: 4,
		textShadowColor: "rgba(0, 0, 0, 0.8)",
		textShadowOffset: { width: 1, height: 1 },
		textShadowRadius: 4,
	},
	controlsContainer: {
		position: "absolute",
		bottom: 40,
		left: 0,
		right: 0,
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingHorizontal: 36,
		zIndex: 10,
	},
	cancelButton: {
		backgroundColor: "rgba(255, 255, 255, 0.2)",
		paddingHorizontal: 18,
		paddingVertical: 10,
		borderRadius: 20,
		borderWidth: 1,
		borderColor: "rgba(255, 255, 255, 0.3)",
	},
	cancelButtonText: {
		color: "#fff",
		fontSize: 14,
		fontWeight: "600",
	},
	captureButton: {
		width: 76,
		height: 76,
		borderRadius: 38,
		backgroundColor: "rgba(255, 255, 255, 0.3)",
		justifyContent: "center",
		alignItems: "center",
		borderWidth: 4,
		borderColor: "#fff",
	},
	captureButtonInner: {
		width: 56,
		height: 56,
		borderRadius: 28,
		backgroundColor: "#fff",
	},
	flipButton: {
		backgroundColor: "rgba(255, 255, 255, 0.2)",
		width: 48,
		height: 48,
		borderRadius: 24,
		justifyContent: "center",
		alignItems: "center",
		borderWidth: 1,
		borderColor: "rgba(255, 255, 255, 0.3)",
	},
	flipButtonText: {
		color: "#fff",
		fontSize: 22,
		fontWeight: "bold",
	},
});
