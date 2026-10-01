import {
	VerificationLoaderContent,
	VerificationLoaderStep,
} from "@/components/VerificationLoader";
import { Redirect } from "expo-router";
import React, { useState } from "react";
import {
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from "react-native";

const PREVIEW_STEPS: VerificationLoaderStep[] = [
	{ id: "pan", title: "Verifying PAN" },
	{ id: "kyc", title: "Checking Aadhaar KYC" },
	{
		id: "bank",
		title: "Verifying bank account",
		subtitle: "Penny drop in progress",
	},
	{ id: "credit", title: "Checking credit profile" },
	{ id: "lenders", title: "Finding best lenders for you" },
];

export default function DevLoaderPreviewScreen() {
	if (!__DEV__) {
		return <Redirect href="/" />;
	}

	const [completedIds, setCompletedIds] = useState<string[]>(["pan", "kyc"]);
	const [activeId, setActiveId] = useState<string | null>("bank");
	const [failedId, setFailedId] = useState<string | null>(null);
	const [progressPercent, setProgressPercent] = useState<number>(60);

	const handleNextStep = () => {
		setFailedId(null);
		const currentIdx = PREVIEW_STEPS.findIndex((s) => s.id === activeId);

		if (currentIdx >= 0) {
			const currentStepId = PREVIEW_STEPS[currentIdx].id;
			const nextCompleted = Array.from(new Set([...completedIds, currentStepId]));
			setCompletedIds(nextCompleted);

			if (currentIdx + 1 < PREVIEW_STEPS.length) {
				const nextStep = PREVIEW_STEPS[currentIdx + 1];
				setActiveId(nextStep.id);
				setProgressPercent(Math.round(((nextCompleted.length + 0.5) / PREVIEW_STEPS.length) * 100));
			} else {
				setActiveId(null);
				setProgressPercent(100);
			}
		} else {
			// If none active, restart from first uncompleted or loop
			setCompletedIds([]);
			setActiveId(PREVIEW_STEPS[0].id);
			setProgressPercent(10);
		}
	};

	const handleFailStep = () => {
		if (activeId) {
			setFailedId(activeId);
		}
	};

	const handleReset = () => {
		setCompletedIds(["pan", "kyc"]);
		setActiveId("bank");
		setFailedId(null);
		setProgressPercent(60);
	};

	return (
		<View style={styles.container}>
			<View style={styles.contentWrapper}>
				<VerificationLoaderContent
					steps={PREVIEW_STEPS}
					completedIds={completedIds}
					activeId={activeId}
					failedId={failedId}
					progressPercent={progressPercent}
				/>
			</View>

			{/* Interactive Test Toolbar */}
			<View style={styles.toolbar}>
				<TouchableOpacity
					style={[styles.btn, styles.btnNext]}
					onPress={handleNextStep}
					activeOpacity={0.8}>
					<Text style={styles.btnText}>Next Step</Text>
				</TouchableOpacity>

				<TouchableOpacity
					style={[styles.btn, styles.btnFail]}
					onPress={handleFailStep}
					activeOpacity={0.8}>
					<Text style={styles.btnText}>Fail Step</Text>
				</TouchableOpacity>

				<TouchableOpacity
					style={[styles.btn, styles.btnReset]}
					onPress={handleReset}
					activeOpacity={0.8}>
					<Text style={styles.btnResetText}>Reset</Text>
				</TouchableOpacity>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#FFFFFF",
	},
	contentWrapper: {
		flex: 1,
	},
	toolbar: {
		flexDirection: "row",
		paddingHorizontal: 16,
		paddingVertical: 12,
		backgroundColor: "#F8FAFC",
		borderTopWidth: 1,
		borderTopColor: "#E2E8F0",
		gap: 8,
		justifyContent: "center",
		alignItems: "center",
	},
	btn: {
		paddingHorizontal: 16,
		paddingVertical: 10,
		borderRadius: 8,
		minWidth: 90,
		alignItems: "center",
	},
	btnNext: {
		backgroundColor: "#09A143",
	},
	btnFail: {
		backgroundColor: "#EF4444",
	},
	btnReset: {
		backgroundColor: "#E2E8F0",
	},
	btnText: {
		color: "#FFFFFF",
		fontSize: 13,
		fontWeight: "600",
	},
	btnResetText: {
		color: "#334155",
		fontSize: 13,
		fontWeight: "600",
	},
});