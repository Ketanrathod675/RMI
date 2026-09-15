import {
	getDevMockOptions,
	getIsMockModeEnabled,
	initDevMockMode,
	resetDevMockCurrentStep,
	setDevMockModeEnabled,
	subscribeDevMockMode,
	subscribeDevMockOptions,
	updateDevMockOptions,
	type DevMockOptions,
} from "@/utils/api/devMockApi";
import React, { useEffect, useState } from "react";
import {
	Modal,
	StyleSheet,
	Switch,
	Text,
	TouchableOpacity,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

export function DevMockBanner() {
	// Guard #1: Physical static return in release builds
	if (!__DEV__) {
		return null;
	}

	const insets = useSafeAreaInsets();
	const [isMockEnabled, setIsMockEnabled] = useState(getIsMockModeEnabled());
	const [showDevModal, setShowDevModal] = useState(false);
	const [options, setOptions] = useState<DevMockOptions>(getDevMockOptions());

	useEffect(() => {
		initDevMockMode().then((enabled) => {
			setIsMockEnabled(enabled);
			setOptions(getDevMockOptions());
		});

		const unsubscribeMode = subscribeDevMockMode((enabled) => {
			setIsMockEnabled(enabled);
		});

		const unsubscribeOptions = subscribeDevMockOptions((updatedOptions) => {
			setOptions(updatedOptions);
		});

		return () => {
			unsubscribeMode();
			unsubscribeOptions();
		};
	}, []);

	const handleToggle = async () => {
		const nextState = !isMockEnabled;
		await setDevMockModeEnabled(nextState);
		Toast.show({
			type: nextState ? "info" : "success",
			text1: nextState ? "🛠️ Dev Mock API Enabled" : "⚡ Real API Mode Enabled",
			text2: nextState
				? "auth/login & auth/verify-otp are now simulated"
				: "Requests will hit the live backend",
			visibilityTime: 2500,
		});
	};

	const handleOptionToggle = (key: keyof DevMockOptions) => {
		const updated = { ...options, [key]: !options[key] };
		setOptions(updated);
		updateDevMockOptions(updated);
	};

	const handleSetStep = (step: string) => {
		updateDevMockOptions({ currentStep: step });
		Toast.show({
			type: "info",
			text1: `Step Set to: ${step}`,
			text2: "Persisted to AsyncStorage",
			visibilityTime: 2000,
		});
	};

	const handleResetStep = () => {
		resetDevMockCurrentStep();
		Toast.show({
			type: "success",
			text1: "🔄 Mock Step Reset",
			text2: "currentStep reset to personal_details",
			visibilityTime: 2500,
		});
	};

	const currentStepVal = options.currentStep || "personal_details";

	return (
		<>
			{/* Dev Floating Indicator Badge */}
			<View style={[styles.floatingContainer, { top: insets.top + 6 }]}>
				<TouchableOpacity
					style={[
						styles.badgeButton,
						isMockEnabled ? styles.badgeMockOn : styles.badgeMockOff,
					]}
					onPress={handleToggle}
					onLongPress={() => setShowDevModal(true)}
					activeOpacity={0.8}>
					<Text style={styles.badgeText}>
						{isMockEnabled ? `🛠️ MOCK: ${currentStepVal}` : "⚡ REAL API"}
					</Text>
				</TouchableOpacity>
			</View>

			{/* Developer Options Modal */}
			<Modal
				visible={showDevModal}
				transparent={true}
				animationType="fade"
				onRequestClose={() => setShowDevModal(false)}>
				<View style={styles.modalBackdrop}>
					<View style={styles.modalContent}>
						<Text style={styles.modalTitle}>🛠️ Developer Options</Text>
						<Text style={styles.modalSubtitle}>
							Mock API configuration (Persisted in AsyncStorage)
						</Text>

						<View style={styles.optionRow}>
							<View style={styles.optionTextContainer}>
								<Text style={styles.optionLabel}>Enable Mock API Mode</Text>
								<Text style={styles.optionDesc}>
									Bypasses backend and returns simulated login & OTP responses
								</Text>
							</View>
							<Switch value={isMockEnabled} onValueChange={handleToggle} />
						</View>

						<View style={styles.divider} />

						{/* Workflow Current Step Section */}
						<Text style={styles.sectionHeader}>Workflow Current Step</Text>
						<View style={styles.activeStepContainer}>
							<Text style={styles.activeStepLabel}>Active Step in Mock Dashboard:</Text>
							<Text style={styles.activeStepValue}>{currentStepVal}</Text>
						</View>

						<View style={styles.stepChipsRow}>
							{[
								{ label: "Personal Details", value: "personal_details" },
								{ label: "Assessment Fee", value: "assessment_fee_payment" },
								{ label: "Professional Details", value: "professional_details" },
								{ label: "CKYC", value: "ckyc" },
								{ label: "Address KYC", value: "address_submission" },
							].map((item) => (
								<TouchableOpacity
									key={item.value}
									style={[
										styles.stepChip,
										currentStepVal === item.value && styles.stepChipActive,
									]}
									onPress={() => handleSetStep(item.value)}
									activeOpacity={0.75}>
									<Text
										style={[
											styles.stepChipText,
											currentStepVal === item.value && styles.stepChipTextActive,
										]}>
										{item.label}
									</Text>
								</TouchableOpacity>
							))}
						</View>

						<TouchableOpacity
							style={styles.resetStepButton}
							onPress={handleResetStep}
							activeOpacity={0.8}>
							<Text style={styles.resetStepButtonText}>
								🔄 Reset Step to "personal_details"
							</Text>
						</TouchableOpacity>

						<View style={styles.divider} />

						<Text style={styles.sectionHeader}>Simulated Response Flags</Text>

						<View style={styles.optionRow}>
							<View style={styles.optionTextContainer}>
								<Text style={styles.optionLabel}>Permission Given</Text>
								<Text style={styles.optionDesc}>
									Routes to /(tabs) if true, /request-permissions if false
								</Text>
							</View>
							<Switch
								value={options.permissionGiven}
								onValueChange={() => handleOptionToggle("permissionGiven")}
							/>
						</View>

						<View style={styles.optionRow}>
							<View style={styles.optionTextContainer}>
								<Text style={styles.optionLabel}>First Time User (New Signup)</Text>
								<Text style={styles.optionDesc}>
									Simulates is_first_login flag in verify-otp response
								</Text>
							</View>
							<Switch
								value={options.isFirstLogin}
								onValueChange={() => handleOptionToggle("isFirstLogin")}
							/>
						</View>

						<View style={styles.optionRow}>
							<View style={styles.optionTextContainer}>
								<Text style={styles.optionLabel}>Soft Pull Consent Required</Text>
								<Text style={styles.optionDesc}>
									Shows soft-pull checkbox on OTP screen if enabled
								</Text>
							</View>
							<Switch
								value={options.softPullConsentRequired}
								onValueChange={() =>
									handleOptionToggle("softPullConsentRequired")
								}
							/>
						</View>

						<View style={styles.divider} />
						<Text style={styles.sectionHeader}>CKYC & Face Match Simulation</Text>

						<Text style={styles.optionDesc}>Mount check outcome:</Text>
						<View style={styles.stepChipsRow}>
							{[
								{ label: "Happy Path", value: "happy_path" },
								{ label: "DigiLocker Redirect", value: "digilocker_redirect" },
								{ label: "Reapply (Selfie)", value: "reapplication_selfie" },
							].map((item) => (
								<TouchableOpacity
									key={item.value}
									style={[
										styles.stepChip,
										(options.ckycOutcome || "happy_path") === item.value && styles.stepChipActive,
									]}
									onPress={() => {
										updateDevMockOptions({ ckycOutcome: item.value as any });
									}}
									activeOpacity={0.75}>
									<Text
										style={[
											styles.stepChipText,
											(options.ckycOutcome || "happy_path") === item.value && styles.stepChipTextActive,
										]}>
										{item.label}
									</Text>
								</TouchableOpacity>
							))}
						</View>

						<View style={styles.optionRow}>
							<View style={styles.optionTextContainer}>
								<Text style={styles.optionLabel}>Face Match Successful</Text>
								<Text style={styles.optionDesc}>Simulates whether selfie matches Aadhaar</Text>
							</View>
							<Switch
								value={options.faceMatchSuccess !== false}
								onValueChange={() => handleOptionToggle("faceMatchSuccess")}
							/>
						</View>

						<View style={styles.optionRow}>
							<View style={styles.optionTextContainer}>
								<Text style={styles.optionLabel}>CKYC Send OTP Success</Text>
								<Text style={styles.optionDesc}>Simulates CKYC OTP dispatch</Text>
							</View>
							<Switch
								value={options.ckycSendOtpSuccess !== false}
								onValueChange={() => handleOptionToggle("ckycSendOtpSuccess")}
							/>
						</View>

						<TouchableOpacity
							style={styles.closeButton}
							onPress={() => setShowDevModal(false)}>
							<Text style={styles.closeButtonText}>Done</Text>
						</TouchableOpacity>
					</View>
				</View>
			</Modal>
		</>
	);
}

const styles = StyleSheet.create({
	floatingContainer: {
		position: "absolute",
		right: 12,
		zIndex: 99999,
		elevation: 99999,
	},
	badgeButton: {
		paddingHorizontal: 10,
		paddingVertical: 4,
		borderRadius: 12,
		borderWidth: 1,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.25,
		shadowRadius: 3.84,
	},
	badgeMockOn: {
		backgroundColor: "#FFF3CD",
		borderColor: "#FFE69C",
	},
	badgeMockOff: {
		backgroundColor: "#E2E8F0",
		borderColor: "#CBD5E1",
		opacity: 0.6,
	},
	badgeText: {
		fontSize: 10,
		fontWeight: "700",
		color: "#333",
		letterSpacing: 0.3,
	},
	modalBackdrop: {
		flex: 1,
		backgroundColor: "rgba(0, 0, 0, 0.6)",
		justifyContent: "center",
		alignItems: "center",
		padding: 20,
	},
	modalContent: {
		backgroundColor: "#FFFFFF",
		borderRadius: 16,
		padding: 20,
		width: "100%",
		maxWidth: 400,
	},
	modalTitle: {
		fontSize: 18,
		fontWeight: "700",
		color: "#11181C",
		marginBottom: 4,
	},
	modalSubtitle: {
		fontSize: 12,
		color: "#687076",
		marginBottom: 16,
	},
	divider: {
		height: 1,
		backgroundColor: "#E2E8F0",
		marginVertical: 12,
	},
	sectionHeader: {
		fontSize: 13,
		fontWeight: "600",
		color: "#333",
		marginBottom: 10,
		textTransform: "uppercase",
		letterSpacing: 0.5,
	},
	optionRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingVertical: 8,
	},
	optionTextContainer: {
		flex: 1,
		paddingRight: 12,
	},
	optionLabel: {
		fontSize: 14,
		fontWeight: "600",
		color: "#11181C",
	},
	optionDesc: {
		fontSize: 11,
		color: "#687076",
		marginTop: 2,
	},
	closeButton: {
		backgroundColor: "#B7FB52",
		borderRadius: 8,
		paddingVertical: 10,
		alignItems: "center",
		marginTop: 16,
	},
	closeButtonText: {
		fontSize: 14,
		fontWeight: "700",
		color: "#333",
	},
	activeStepContainer: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		backgroundColor: "#F8FAFC",
		padding: 10,
		borderRadius: 8,
		borderWidth: 1,
		borderColor: "#E2E8F0",
		marginBottom: 10,
	},
	activeStepLabel: {
		fontSize: 12,
		color: "#64748B",
	},
	activeStepValue: {
		fontSize: 12,
		fontWeight: "700",
		color: "#0F172A",
		backgroundColor: "#E2E8F0",
		paddingHorizontal: 8,
		paddingVertical: 2,
		borderRadius: 4,
	},
	stepChipsRow: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: 6,
		marginBottom: 10,
	},
	stepChip: {
		paddingHorizontal: 10,
		paddingVertical: 6,
		borderRadius: 6,
		backgroundColor: "#F1F5F9",
		borderWidth: 1,
		borderColor: "#CBD5E1",
	},
	stepChipActive: {
		backgroundColor: "#0F172A",
		borderColor: "#0F172A",
	},
	stepChipText: {
		fontSize: 11,
		fontWeight: "600",
		color: "#475569",
	},
	stepChipTextActive: {
		color: "#FFFFFF",
	},
	resetStepButton: {
		backgroundColor: "#FEF2F2",
		borderWidth: 1,
		borderColor: "#FECACA",
		borderRadius: 8,
		paddingVertical: 8,
		alignItems: "center",
		marginBottom: 6,
	},
	resetStepButtonText: {
		fontSize: 12,
		fontWeight: "700",
		color: "#DC2626",
	},
});

export default DevMockBanner;
