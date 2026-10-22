import React, { useCallback, useEffect, useRef, useState } from "react";
import {
	ActivityIndicator,
	BackHandler,
	Modal,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import Toast from "react-native-toast-message";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import Logger from "@/utils/logger";
import { useJourneyTracker } from "@/hooks/useJourneyTracker";
import { signConsent } from "@/utils/api/services/consent.service";
import { getUserDashboardData } from "@/utils/api/services/user.service";
import { getApiErrorInfo } from "@/utils/api/errors";
import { resolveWorkflowRoute } from "@/utils/api/types/user.types";
import type { ConsentKey, ConsentPayload } from "@/utils/api/types/consent.types";

type IconName =
	| "shield"
	| "lock"
	| "check"
	| "id"
	| "gauge"
	| "phone"
	| "bank"
	| "network"
	| "message";

function Icon({
	name,
	size = 20,
	color = "#7CC21F",
}: {
	name: IconName;
	size?: number;
	color?: string;
}) {
	const commonProps = {
		width: size,
		height: size,
		viewBox: "0 0 24 24",
		fill: "none" as const,
		stroke: color,
		strokeWidth: 1.75,
		strokeLinecap: "round" as const,
		strokeLinejoin: "round" as const,
	};

	switch (name) {
		case "shield":
			return (
				<Svg {...commonProps}>
					<Path d="M12 3 20 6v5.5c0 4.5-3.1 7.7-8 9.5-4.9-1.8-8-5-8-9.5V6l8-3Z" />
					<Path d="m8.5 12 2.2 2.2 4.8-5" />
				</Svg>
			);
		case "lock":
			return (
				<Svg {...commonProps}>
					<Rect x={5.5} y={10} width={13} height={10} rx={2} />
					<Path d="M8.5 10V7a3.5 3.5 0 0 1 7 0v3" />
				</Svg>
			);
		case "check":
			return (
				<Svg {...commonProps}>
					<Path d="m5 12.5 4.5 4.5L19 7" />
				</Svg>
			);
		case "id":
			return (
				<Svg {...commonProps}>
					<Rect x={3.5} y={5} width={17} height={14} rx={2} />
					<Circle cx={8.5} cy={10} r={1.7} />
					<Path d="M6 14.5c.6-1.6 4.4-1.6 5 0" />
					<Path d="M14 9h3.5M14 12h3.5M14 15h2" />
				</Svg>
			);
		case "gauge":
			return (
				<Svg {...commonProps}>
					<Circle cx={12} cy={12} r={8.5} />
					<Path d="M7 16a6 6 0 0 1 10 0" />
					<Path d="m12 12 3.5-3.5" />
					<Circle cx={12} cy={12} r={1} />
				</Svg>
			);
		case "phone":
			return (
				<Svg {...commonProps}>
					<Rect x={5.5} y={2.8} width={10} height={18.4} rx={2} />
					<Path d="M9 5h3M9.5 18.3h2" />
					<Path d="m17 10 3.5 1.5v2.8c0 2.1-1.4 3.8-3.5 4.7-2.1-.9-3.5-2.6-3.5-4.7v-2.8L17 10Z" />
					<Path d="m15.6 14.3 1 1 1.8-2" />
				</Svg>
			);
		case "bank":
			return (
				<Svg {...commonProps}>
					<Path d="m3 9 9-5.5L21 9H3Z" />
					<Path d="M4.5 10v7.5M8.5 10v7.5M12 10v7.5M15.5 10v7.5M19.5 10v7.5" />
					<Path d="M3 20h18M4 17.5h16" />
				</Svg>
			);
		case "network":
			return (
				<Svg {...commonProps}>
					<Circle cx={12} cy={5} r={2.1} />
					<Circle cx={5.5} cy={17.5} r={2.1} />
					<Circle cx={18.5} cy={17.5} r={2.1} />
					<Path d="m10.9 6.9-4.3 8.7M13.1 6.9l4.3 8.7M7.7 17.5h8.6" />
					<Circle cx={12} cy={12} r={1.3} />
				</Svg>
			);
		case "message":
			return (
				<Svg {...commonProps}>
					<Path d="M4 4.5h16a1.5 1.5 0 0 1 1.5 1.5v11a1.5 1.5 0 0 1-1.5 1.5H9l-5 3v-3.4A1.5 1.5 0 0 1 2.5 17V6A1.5 1.5 0 0 1 4 4.5Z" />
					<Path d="M7 9h10M7 12.5h7" />
				</Svg>
			);
		default:
			return null;
	}
}

function BrandShield() {
	return (
		<Svg width={44} height={50} viewBox="0 0 60 66" fill="none">
			<Path
				d="M30 2 53 12v17c0 15.4-9.2 25.8-23 32C16.2 54.8 7 44.4 7 29V12L30 2Z"
				fill="#7CC21F"
			/>
			<Rect x={21} y={25} width={18} height={15} rx={2.5} fill="#FFFFFF" />
			<Path
				d="M25 25v-4a5 5 0 0 1 10 0v4"
				stroke="#FFFFFF"
				strokeWidth={3}
				strokeLinecap="round"
			/>
			<Circle cx={47} cy={57} r={9} fill="#7CC21F" />
			<Path
				d="m43 57 2.5 2.5 5-5"
				stroke="#FFFFFF"
				strokeWidth={1.75}
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</Svg>
	);
}

const ROWS: {
	key: ConsentKey;
	label: string;
	icon: IconName;
}[] = [
	{
		key: "kycVerification",
		label: "Identify and KYC verification.",
		icon: "id",
	},
	{
		key: "creditBureau",
		label: "Fetch Credit Bureau information.",
		icon: "gauge",
	},
	{
		key: "deviceFraud",
		label: "Device, Technical and fraud prevention information.",
		icon: "phone",
	},
	{
		key: "bankAmlMnrl",
		label: "Bank Account Verification, AML, MNRL",
		icon: "bank",
	},
	{
		key: "dataSharing",
		label:
			"Sharing of data with respective entities for KYC, Credit Bureau, Bank Account verification, Credit Bureau Reporting, Regulatory Audit, Compliance, Customer Support and Grievance, Collection & Recovery Team, Cloud Base for data storing",
		icon: "network",
	},
	{
		key: "communication",
		label:
			"Communication Consent via SMS, Whatsapp, Email, Phone Calls, IVR & Push Notifications for various communication activities related to Loan Accounts and EMI /Repayment recovery process",
		icon: "message",
	},
];

export default function CustomerDataConsentScreen() {
	useJourneyTracker("/customer-data-consent");

	const router = useRouter();
	const queryClient = useQueryClient();

	const [consents, setConsents] = useState<ConsentPayload>({
		kycVerification: false,
		creditBureau: false,
		deviceFraud: false,
		bankAmlMnrl: false,
		dataSharing: false,
		communication: false,
	});

	const [isSubmitting, setIsSubmitting] = useState(false);
	const [showExitDialog, setShowExitDialog] = useState(false);
	const isSubmittingRef = useRef(false);

	const allChecked =
		consents.kycVerification &&
		consents.creditBureau &&
		consents.deviceFraud &&
		consents.bankAmlMnrl &&
		consents.dataSharing &&
		consents.communication;

	const toggleRow = (key: ConsentKey) => {
		if (isSubmitting) return;
		setConsents((prev) => ({
			...prev,
			[key]: !prev[key],
		}));
	};

	// Hardware back button opens exit dialog
	useEffect(() => {
		const onBackPress = () => {
			setShowExitDialog(true);
			return true;
		};
		const subscription = BackHandler.addEventListener(
			"hardwareBackPress",
			onBackPress,
		);
		return () => subscription.remove();
	}, []);

	const handleAgreeAndContinue = useCallback(async () => {
		if (!allChecked || isSubmitting || isSubmittingRef.current) return;
		isSubmittingRef.current = true;
		setIsSubmitting(true);

		Logger.debug("Customer data consent submit requested");

		try {
			let responseMessage = "Consent document signed successfully";
			try {
				const res = await signConsent({
					kycVerification: true,
					creditBureau: true,
					deviceFraud: true,
					bankAmlMnrl: true,
					dataSharing: true,
					communication: true,
				});
				if (res?.message) responseMessage = res.message;
			} catch (signErr: any) {
				const info = getApiErrorInfo(signErr);
				const detailLower = info.detail.toLowerCase();
				// 409 already signed is treated as success
				if (info.status === 409 && detailLower.includes("already signed")) {
					responseMessage = info.detail || "Consent already signed";
				} else if (
					info.status === 409 &&
					(detailLower.includes("not required") ||
						detailLower.includes("not in progress"))
				) {
					await queryClient.invalidateQueries({ queryKey: ["user", "dashboard"] });
					router.replace("/(tabs)");
					return;
				} else {
					throw signErr;
				}
			}

			Toast.show({
				type: "success",
				text1: responseMessage,
				visibilityTime: 3000,
			});

			await queryClient.invalidateQueries({ queryKey: ["user", "dashboard"] });
			const freshDash = await getUserDashboardData();

			const currentStep = freshDash?.workflow_progress?.current_step;
			const overallStatus = freshDash?.workflow_progress?.overall_status;
			const breStatus =
				freshDash?.workflow_progress?.bre_status ??
				(freshDash as any)?.lead?.lead_metadata?.bre_status;
			const breFailedRule =
				freshDash?.workflow_progress?.bre_failed_rule ??
				(freshDash as any)?.lead?.lead_metadata?.bre_failed_rule;

			const nextRoute = resolveWorkflowRoute(
				currentStep,
				overallStatus,
				breStatus,
				breFailedRule,
			);

			if (nextRoute === "/customer-data-consent") {
				Toast.show({
					type: "error",
					text1: "Your application has not advanced yet. Please try again shortly.",
					visibilityTime: 4000,
				});
				return;
			}

			if (nextRoute === "/professional-details") {
				router.replace({
					pathname: "/professional-details" as any,
					params: { disableBack: "true" },
				});
			} else {
				router.replace(nextRoute as any);
			}
		} catch (err: any) {
			const info = getApiErrorInfo(err);
			if (info.status === 401) {
				// Let axios interceptor handle 401
				return;
			}
			Toast.show({
				type: "error",
				text1: info.detail || "Unable to submit your consent. Please try again.",
				visibilityTime: 4000,
			});
		} finally {
			isSubmittingRef.current = false;
			setIsSubmitting(false);
		}
	}, [allChecked, isSubmitting, queryClient, router]);

	const handleExitConfirm = () => {
		setShowExitDialog(false);
		router.replace("/(tabs)");
	};

	return (
		<SafeAreaView style={styles.safeArea}>
			<ScrollView
				contentContainerStyle={styles.scrollContent}
				showsVerticalScrollIndicator={false}
			>
				<View style={styles.card}>
					{/* Header Row */}
					<View style={styles.headerRow}>
						<BrandShield />
						<Text style={styles.headerTitle}>
							CUSTOMER DATA CONSENT FOR DIGITAL LENDING
						</Text>
					</View>

					{/* Intro Paragraph */}
					<Text style={styles.introParagraph}>
						By clicking “I Agree & Continue”, I voluntarily provide my consent to{" "}
						<Text style={styles.highlightName}>
							[Ruloans Financial Services Private Limited]
						</Text>{" "}
						(“Regulated Entity / Lender”) or{" "}
						<Text style={styles.highlightName}>
							[MoneyTime Technology Solutions Pvt. Ltd.]
						</Text>{" "}
						(“Lending Service Provider” or “LSP”) for collection, verification,
						storage, processing, sharing, and use of my personal information for
						the purpose of availing and servicing financial products through a
						digital lending platform.
					</Text>

					{/* Panel */}
					<LinearGradient
						colors={["#F8FBFF", "#F1F6FB"]}
						start={{ x: 0, y: 0 }}
						end={{ x: 1, y: 1 }}
						style={styles.panel}
					>
						{/* Section Header Row */}
						<View style={styles.sectionHeaderRow}>
							<LinearGradient
								colors={["#A4DF55", "#70B51A"]}
								start={{ x: 0, y: 0 }}
								end={{ x: 0, y: 1 }}
								style={styles.sectionIndicator}
							/>
							<Text style={styles.sectionHeading}>
								I provide the consent for using my personal data for
							</Text>
						</View>

						{/* Six Rows */}
						<View style={styles.rowsContainer}>
							{ROWS.map((row) => {
								const isChecked = consents[row.key];
								return (
									<Pressable
										key={row.key}
										accessibilityRole="checkbox"
										accessibilityState={{ checked: isChecked }}
										onPress={() => toggleRow(row.key)}
										style={[
											styles.rowItem,
											isChecked && styles.rowItemChecked,
										]}
									>
										<View style={styles.iconCircle}>
											<Icon name={row.icon} size={16} color="#7CC21F" />
										</View>
										<Text style={styles.rowLabel}>{row.label}</Text>
										<View
											style={[
												styles.checkbox,
												isChecked && styles.checkboxChecked,
											]}
										>
											{isChecked ? (
												<Icon name="check" size={14} color="#FFFFFF" />
											) : null}
										</View>
									</Pressable>
								);
							})}
						</View>

						{/* Notice Box */}
						<View style={styles.noticeBox}>
							<Icon name="shield" size={20} color="#7CC21F" />
							<Text style={styles.noticeText}>
								Your data is safe with us. We are committed to protect your
								personal information as per applicable laws and RBI guidelines.
							</Text>
						</View>
					</LinearGradient>

					{/* Actions */}
					<View style={styles.actionsContainer}>
						<Pressable
							onPress={handleAgreeAndContinue}
							disabled={!allChecked || isSubmitting}
							style={({ pressed }) => [
								styles.agreeButton,
								(!allChecked || isSubmitting) && styles.agreeButtonDisabled,
								pressed && allChecked && !isSubmitting && styles.agreeButtonPressed,
							]}
						>
							{isSubmitting ? (
								<ActivityIndicator size="small" color="#FFFFFF" />
							) : (
								<Icon name="lock" size={18} color="#FFFFFF" />
							)}
							<Text style={styles.agreeButtonText}>I Agree & Continue</Text>
						</Pressable>

						<Pressable
							onPress={() => setShowExitDialog(true)}
							disabled={isSubmitting}
							style={({ pressed }) => [
								styles.declineButton,
								isSubmitting && styles.declineButtonDisabled,
								pressed && { opacity: 0.7 },
							]}
						>
							<Text style={styles.declineButtonText}>Decline & Exit</Text>
						</Pressable>
					</View>
				</View>
			</ScrollView>

			{/* Exit Modal */}
			<Modal
				visible={showExitDialog}
				transparent
				animationType="fade"
				onRequestClose={() => setShowExitDialog(false)}
			>
				<View style={styles.modalBackdrop}>
					<View style={styles.modalDialog}>
						<Text style={styles.modalTitle}>Are you sure you want to exit?</Text>
						<Text style={styles.modalBody}>
							You need to give consent to continue.
						</Text>
						<View style={styles.modalButtonsRow}>
							<Pressable
								onPress={() => setShowExitDialog(false)}
								style={styles.modalCancelButton}
							>
								<Text style={styles.modalCancelButtonText}>Cancel</Text>
							</Pressable>
							<Pressable
								onPress={handleExitConfirm}
								style={styles.modalExitButton}
							>
								<Text style={styles.modalExitButtonText}>Exit</Text>
							</Pressable>
						</View>
					</View>
				</View>
			</Modal>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	safeArea: {
		flex: 1,
		backgroundColor: "#F4F7FC",
	},
	scrollContent: {
		paddingVertical: 12,
		paddingHorizontal: 8,
	},
	card: {
		backgroundColor: "#FFFFFF",
		borderRadius: 14,
		borderWidth: 1,
		borderColor: "#E3E8F0",
		paddingVertical: 20,
		paddingHorizontal: 14,
		shadowColor: "#000",
		shadowOpacity: 0.05,
		shadowRadius: 8,
		shadowOffset: { width: 0, height: 2 },
		elevation: 2,
	},
	headerRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
		marginBottom: 16,
	},
	headerTitle: {
		flex: 1,
		fontSize: 15,
		fontFamily: "PlusJakartaSans_700Bold",
		color: "#1B1F5E",
		letterSpacing: -0.2,
		lineHeight: 20,
	},
	introParagraph: {
		fontSize: 12,
		lineHeight: 20,
		color: "#4A5568",
		fontFamily: "PlusJakartaSans_400Regular",
		marginBottom: 18,
	},
	highlightName: {
		fontFamily: "PlusJakartaSans_700Bold",
		color: "#7CC21F",
	},
	panel: {
		borderWidth: 1,
		borderColor: "#DCE6EF",
		borderRadius: 12,
		paddingVertical: 14,
		paddingHorizontal: 10,
	},
	sectionHeaderRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
		marginBottom: 12,
		paddingBottom: 10,
		borderBottomWidth: 1,
		borderBottomColor: "#E0E8EF",
	},
	sectionIndicator: {
		width: 4,
		height: 18,
		borderRadius: 10,
	},
	sectionHeading: {
		flex: 1,
		fontSize: 12,
		fontFamily: "PlusJakartaSans_700Bold",
		color: "#1B1F5E",
		lineHeight: 16,
	},
	rowsContainer: {
		gap: 8,
	},
	rowItem: {
		flexDirection: "row",
		alignItems: "flex-start",
		gap: 10,
		paddingVertical: 12,
		paddingHorizontal: 10,
		borderRadius: 10,
		borderWidth: 1,
		borderColor: "#E3E8F0",
		backgroundColor: "#FFFFFF",
	},
	rowItemChecked: {
		borderColor: "#7CC21F",
	},
	iconCircle: {
		width: 30,
		height: 30,
		borderRadius: 15,
		backgroundColor: "#E6F5D5",
		alignItems: "center",
		justifyContent: "center",
		marginTop: 2,
	},
	rowLabel: {
		flex: 1,
		fontSize: 12,
		lineHeight: 19,
		color: "#4A5568",
		fontFamily: "PlusJakartaSans_400Regular",
	},
	checkbox: {
		width: 20,
		height: 20,
		borderWidth: 2,
		borderColor: "#81839A",
		borderRadius: 4,
		backgroundColor: "#FFFFFF",
		alignItems: "center",
		justifyContent: "center",
		marginTop: 2,
	},
	checkboxChecked: {
		borderColor: "#7CC21F",
		backgroundColor: "#7CC21F",
	},
	noticeBox: {
		marginTop: 12,
		padding: 10,
		gap: 8,
		borderRadius: 10,
		borderWidth: 1,
		borderColor: "#E3E8F0",
		backgroundColor: "#FFFFFF",
		flexDirection: "row",
		alignItems: "flex-start",
	},
	noticeText: {
		flex: 1,
		fontSize: 11,
		lineHeight: 16.5,
		color: "#4A5568",
		fontFamily: "PlusJakartaSans_400Regular",
	},
	actionsContainer: {
		marginTop: 18,
	},
	agreeButton: {
		width: "100%",
		minHeight: 48,
		borderRadius: 10,
		backgroundColor: "#7CC21F",
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 8,
		paddingVertical: 12,
	},
	agreeButtonPressed: {
		backgroundColor: "#6BAA17",
	},
	agreeButtonDisabled: {
		opacity: 0.6,
	},
	agreeButtonText: {
		fontSize: 14,
		fontFamily: "PlusJakartaSans_700Bold",
		color: "#FFFFFF",
	},
	declineButton: {
		marginTop: 16,
		alignSelf: "center",
		paddingVertical: 4,
		paddingHorizontal: 12,
	},
	declineButtonDisabled: {
		opacity: 0.5,
	},
	declineButtonText: {
		fontSize: 13,
		fontFamily: "PlusJakartaSans_700Bold",
		color: "#7CC21F",
	},
	modalBackdrop: {
		flex: 1,
		backgroundColor: "rgba(27,31,94,0.30)",
		paddingVertical: 24,
		paddingHorizontal: 16,
		alignItems: "center",
		justifyContent: "center",
	},
	modalDialog: {
		maxWidth: 420,
		width: "100%",
		padding: 24,
		borderRadius: 16,
		borderWidth: 1,
		borderColor: "#E3E8F0",
		backgroundColor: "#FFFFFF",
		shadowColor: "#000",
		shadowOpacity: 0.1,
		shadowRadius: 10,
		elevation: 5,
	},
	modalTitle: {
		fontSize: 16,
		fontFamily: "PlusJakartaSans_700Bold",
		color: "#1B1F5E",
		lineHeight: 24,
	},
	modalBody: {
		marginTop: 12,
		fontSize: 14,
		lineHeight: 24,
		color: "#4A5568",
		fontFamily: "PlusJakartaSans_400Regular",
	},
	modalButtonsRow: {
		marginTop: 24,
		flexDirection: "row",
		gap: 12,
		justifyContent: "flex-end",
	},
	modalCancelButton: {
		minHeight: 40,
		paddingVertical: 8,
		paddingHorizontal: 16,
		borderRadius: 8,
		borderWidth: 1,
		borderColor: "#E3E8F0",
		backgroundColor: "#FFFFFF",
		alignItems: "center",
		justifyContent: "center",
	},
	modalCancelButtonText: {
		fontSize: 14,
		fontFamily: "PlusJakartaSans_600SemiBold",
		color: "#1B1F5E",
	},
	modalExitButton: {
		minHeight: 40,
		paddingVertical: 8,
		paddingHorizontal: 16,
		borderRadius: 8,
		borderWidth: 1,
		borderColor: "#7CC21F",
		backgroundColor: "#7CC21F",
		alignItems: "center",
		justifyContent: "center",
	},
	modalExitButtonText: {
		fontSize: 14,
		fontFamily: "PlusJakartaSans_600SemiBold",
		color: "#FFFFFF",
	},
});
