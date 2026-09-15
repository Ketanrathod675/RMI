import {
	getDevMockOptions,
	resetDevMockCurrentStep,
	updateDevMockOptions,
} from "@/utils/api/devMockApi";
import { font, height, width } from "@/utils/dimensions";
import { getStorageItem, STORAGE_KEYS } from "@/utils/storage";
import { MaterialIcons } from "@expo/vector-icons";
import React, { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Toast from "react-native-toast-message";

interface DevPaymentSimulatorProps {
	onSimulateDeepLink: (status: "success" | "failure", txnId?: string) => void;
}

export const DevPaymentSimulator: React.FC<DevPaymentSimulatorProps> = ({
	onSimulateDeepLink,
}) => {
	if (!__DEV__) {
		return null;
	}

	const [isExpanded, setIsExpanded] = useState(false);
	const [mockOutcome, setMockOutcome] = useState<
		"delayed_success" | "immediate_success" | "failure"
	>(getDevMockOptions().easebuzzMockOutcome || "delayed_success");
	const [simulateReapplicationRejection, setSimulateReapplicationRejection] =
		useState<boolean>(getDevMockOptions().simulateReapplicationRejection || false);

	const handleOutcomeChange = (
		outcome: "delayed_success" | "immediate_success" | "failure",
	) => {
		setMockOutcome(outcome);
		updateDevMockOptions({ easebuzzMockOutcome: outcome });
	};

	const handleRejectionToggle = (enable: boolean) => {
		setSimulateReapplicationRejection(enable);
		updateDevMockOptions({ simulateReapplicationRejection: enable });
	};

	const triggerDeepLink = async (status: "success" | "failure") => {
		const storedTxnId = await getStorageItem(STORAGE_KEYS["@transaction-id"]);
		onSimulateDeepLink(status, storedTxnId || "mock_order_dev");
	};

	return (
		<View style={styles.container}>
			<TouchableOpacity
				style={styles.headerToggle}
				onPress={() => setIsExpanded(!isExpanded)}
				activeOpacity={0.8}>
				<View style={styles.badge}>
					<Text style={styles.badgeText}>DEV TEST SIMULATOR</Text>
				</View>
				<MaterialIcons
					name={isExpanded ? "expand-less" : "expand-more"}
					size={20}
					color="#033120"
				/>
			</TouchableOpacity>

			{isExpanded && (
				<View style={styles.panelContent}>
					<Text style={styles.label}>Easebuzz Mock Polling Outcome:</Text>
					<View style={styles.row}>
						<TouchableOpacity
							style={[
								styles.chip,
								mockOutcome === "delayed_success" && styles.chipActive,
							]}
							onPress={() => handleOutcomeChange("delayed_success")}>
							<Text
								style={[
									styles.chipText,
									mockOutcome === "delayed_success" && styles.chipTextActive,
								]}>
								Delayed Success
							</Text>
						</TouchableOpacity>

						<TouchableOpacity
							style={[
								styles.chip,
								mockOutcome === "immediate_success" && styles.chipActive,
							]}
							onPress={() => handleOutcomeChange("immediate_success")}>
							<Text
								style={[
									styles.chipText,
									mockOutcome === "immediate_success" && styles.chipTextActive,
								]}>
								Immediate
							</Text>
						</TouchableOpacity>

						<TouchableOpacity
							style={[
								styles.chip,
								mockOutcome === "failure" && styles.chipActive,
							]}
							onPress={() => handleOutcomeChange("failure")}>
							<Text
								style={[
									styles.chipText,
									mockOutcome === "failure" && styles.chipTextActive,
								]}>
								Failure
							</Text>
						</TouchableOpacity>
					</View>

					<Text style={[styles.label, { marginTop: height(1) }]}>
						Simulate Reapplication Rejection:
					</Text>
					<View style={styles.row}>
						<TouchableOpacity
							style={[
								styles.chip,
								!simulateReapplicationRejection && styles.chipActive,
							]}
							onPress={() => handleRejectionToggle(false)}>
							<Text
								style={[
									styles.chipText,
									!simulateReapplicationRejection && styles.chipTextActive,
								]}>
								OFF (Normal Flow)
							</Text>
						</TouchableOpacity>

						<TouchableOpacity
							style={[
								styles.chip,
								simulateReapplicationRejection && styles.chipActiveRejection,
							]}
							onPress={() => handleRejectionToggle(true)}>
							<Text
								style={[
									styles.chipText,
									simulateReapplicationRejection && styles.chipTextActive,
								]}>
								ON (Reject Application)
							</Text>
						</TouchableOpacity>
					</View>

					<Text style={[styles.label, { marginTop: height(1) }]}>
						Simulate Deep-Link Return:
					</Text>
					<View style={styles.row}>
						<TouchableOpacity
							style={[styles.btn, styles.btnSuccess]}
							onPress={() => triggerDeepLink("success")}>
							<Text style={styles.btnText}>Simulate Success Return</Text>
						</TouchableOpacity>

						<TouchableOpacity
							style={[styles.btn, styles.btnFailure]}
							onPress={() => triggerDeepLink("failure")}>
							<Text style={styles.btnText}>Simulate Failure</Text>
						</TouchableOpacity>
					</View>

					<TouchableOpacity
						style={styles.btnReset}
						onPress={() => {
							resetDevMockCurrentStep();
							Toast.show({
								type: "info",
								text1: "Mock Step Reset",
								text2: "currentStep reset to personal_details",
							});
						}}
						activeOpacity={0.8}>
						<Text style={styles.btnResetText}>🔄 Reset Step to "personal_details"</Text>
					</TouchableOpacity>
				</View>
			)}
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		backgroundColor: "#E8F5E9",
		borderWidth: 1,
		borderColor: "#81C784",
		borderRadius: width(2),
		marginHorizontal: width(4),
		marginVertical: height(1.5),
		overflow: "hidden",
	},
	headerToggle: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingVertical: height(1),
		paddingHorizontal: width(3),
	},
	badge: {
		backgroundColor: "#2E7D32",
		paddingHorizontal: width(2),
		paddingVertical: height(0.3),
		borderRadius: 4,
	},
	badgeText: {
		color: "#FFFFFF",
		fontSize: font(1.1),
		fontWeight: "bold",
	},
	panelContent: {
		padding: width(3),
		backgroundColor: "#F1F8E9",
		borderTopWidth: 1,
		borderTopColor: "#C8E6C9",
	},
	label: {
		fontSize: font(1.3),
		color: "#1B5E20",
		fontWeight: "600",
		marginBottom: height(0.6),
	},
	row: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: width(2),
		marginBottom: height(0.5),
	},
	chip: {
		backgroundColor: "#FFFFFF",
		borderWidth: 1,
		borderColor: "#A5D6A7",
		paddingVertical: height(0.6),
		paddingHorizontal: width(2.5),
		borderRadius: 16,
	},
	chipActive: {
		backgroundColor: "#2E7D32",
		borderColor: "#1B5E20",
	},
	chipActiveRejection: {
		backgroundColor: "#C62828",
		borderColor: "#8E0000",
	},
	chipText: {
		fontSize: font(1.2),
		color: "#2E7D32",
		fontWeight: "500",
	},
	chipTextActive: {
		color: "#FFFFFF",
		fontWeight: "bold",
	},
	btn: {
		flex: 1,
		paddingVertical: height(1),
		borderRadius: 6,
		alignItems: "center",
		justifyContent: "center",
	},
	btnSuccess: {
		backgroundColor: "#2E7D32",
	},
	btnFailure: {
		backgroundColor: "#C62828",
	},
	btnText: {
		color: "#FFFFFF",
		fontSize: font(1.3),
		fontWeight: "bold",
	},
	btnReset: {
		marginTop: height(1.2),
		paddingVertical: height(0.8),
		backgroundColor: "#FFFFFF",
		borderWidth: 1,
		borderColor: "#C8E6C9",
		borderRadius: 6,
		alignItems: "center",
		justifyContent: "center",
	},
	btnResetText: {
		color: "#2E7D32",
		fontSize: font(1.2),
		fontWeight: "600",
	},
});

export default DevPaymentSimulator;
