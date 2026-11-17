import React, { useEffect, useRef } from "react";
import {
	KeyboardAvoidingView,
	Modal,
	Platform,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { primaryFont } from "@/constants/typography";
import { useKeyboardVisible } from "@/hooks/useKeyboardVisible";
import { useTranslation } from "@/hooks/useTranslation";
import type { ScrollViewRef } from "@/types/rn-refs";
import { getMissingFormHint, type BankFormValues } from "@/utils/bankAccountPicker";
import BankAccountForm, { useBankAccountForm } from "./BankAccountForm";

interface AddBankAccountSheetProps {
	visible: boolean;
	accountHolderName: string;
	onClose: () => void;
	onSaveDraft: (values: BankFormValues) => boolean;
}

export const AddBankAccountSheet: React.FC<AddBankAccountSheetProps> = ({
	visible,
	accountHolderName,
	onClose,
	onSaveDraft,
}) => {
	const insets = useSafeAreaInsets();
	const { t } = useTranslation();
	const { visible: isKeyboardVisible } = useKeyboardVisible();
	const form = useBankAccountForm(accountHolderName);
	const scrollRef = useRef<ScrollViewRef | null>(null);
	const scrollYRef = useRef(0);

	useEffect(() => {
		if (visible) {
			form.reset(accountHolderName);
			scrollYRef.current = 0;
		}
	}, [visible]);

	const missingHintKey = getMissingFormHint(form.values);
	const isFormReady = missingHintKey === null;

	const handleSave = () => {
		if (!form.validate()) return;
		onSaveDraft(form.values);
	};

	return (
		<Modal
			visible={visible}
			transparent={true}
			animationType="slide"
			statusBarTranslucent={true}
			onRequestClose={onClose}
		>
			<KeyboardAvoidingView
				behavior="padding"
				keyboardVerticalOffset={0}
				style={styles.backdrop}
			>
				<Pressable style={styles.backdropTapArea} onPress={onClose} />

				<View
					style={[
						styles.sheetContainer,
						{
							marginTop: isKeyboardVisible
								? Math.max(insets.top + 4, 16)
								: Math.max(insets.top + 12, 48),
						},
					]}
				>
					{/* Grabber */}
					<View style={styles.grabberRow}>
						<View style={styles.grabber} />
					</View>

					{/* Sheet Header */}
					<View style={styles.sheetHeader}>
						<View style={styles.sheetTitleCol}>
							<Text style={styles.sheetTitle}>
								{t("addNewAccountTitle", "Add new account")}
							</Text>
							<Text style={styles.sheetSubtitle}>
								{t("addNewAccountSubtitle", "Link an additional bank account for disbursal")}
							</Text>
						</View>
						<TouchableOpacity
							accessibilityRole="button"
							accessibilityLabel={t("close", "Close")}
							hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
							onPress={onClose}
							style={styles.closeBtn}
						>
							<Ionicons name="close" size={18} color="#475569" />
						</TouchableOpacity>
					</View>

					<ScrollView
						ref={scrollRef}
						style={styles.scroll}
						contentContainerStyle={[
							styles.scrollContent,
							{ paddingBottom: isKeyboardVisible ? 48 : 28 },
						]}
						onScroll={(e) => {
							scrollYRef.current = e.nativeEvent.contentOffset.y;
						}}
						scrollEventThrottle={16}
						nestedScrollEnabled={true}
						keyboardShouldPersistTaps="handled"
						keyboardDismissMode="none"
						showsVerticalScrollIndicator={false}
					>
						<BankAccountForm
							accountHolderName={accountHolderName}
							form={form}
							scrollViewRef={scrollRef}
							scrollYRef={scrollYRef}
						/>
					</ScrollView>

					{/* Sticky Sheet CTA */}
					<View
						style={[
							styles.footer,
							{
								paddingTop: isKeyboardVisible ? 8 : 12,
								paddingBottom: isKeyboardVisible ? 10 : Math.max(insets.bottom, 16),
							},
						]}
					>
						{missingHintKey ? (
							<Text style={styles.missingHintText}>
								{t(missingHintKey as any, missingHintKey)}
							</Text>
						) : null}

						<TouchableOpacity
							accessibilityRole="button"
							accessibilityLabel={t("saveAccount", "Save account")}
							activeOpacity={0.85}
							onPress={handleSave}
							style={styles.ctaTouchable}
						>
							<LinearGradient
								colors={
									isFormReady ? ["#09A143", "#78DE26"] : ["#E2E8F0", "#CBD5E1"]
								}
								start={{ x: 0, y: 0.5 }}
								end={{ x: 1, y: 0.5 }}
								style={styles.ctaGradient}
							>
								<Text style={[styles.ctaText, !isFormReady && styles.ctaTextDisabled]}>
									{t("saveAccount", "Save account")}
								</Text>
								<MaterialCommunityIcons
									name="arrow-right"
									size={20}
									color={isFormReady ? "#FFFFFF" : "#64748B"}
								/>
							</LinearGradient>
						</TouchableOpacity>
					</View>
				</View>
			</KeyboardAvoidingView>
		</Modal>
	);
};

const styles = StyleSheet.create({
	backdrop: {
		flex: 1,
		backgroundColor: "rgba(15, 23, 42, 0.6)",
		justifyContent: "flex-end",
	},
	backdropTapArea: {
		flex: 0,
		minHeight: 40,
	},
	sheetContainer: {
		flex: 1,
		backgroundColor: "#F5F7F2",
		borderTopLeftRadius: 32,
		borderTopRightRadius: 32,
		overflow: "hidden",
		shadowColor: "#000000",
		shadowOffset: { width: 0, height: -8 },
		shadowOpacity: 0.2,
		shadowRadius: 20,
		elevation: 14,
	},
	grabberRow: {
		backgroundColor: "#FFFFFF",
		paddingTop: 12,
		paddingBottom: 6,
		alignItems: "center",
	},
	grabber: {
		width: 48,
		height: 5,
		borderRadius: 999,
		backgroundColor: "#CBD5E1",
	},
	sheetHeader: {
		backgroundColor: "#FFFFFF",
		paddingHorizontal: 20,
		paddingTop: 6,
		paddingBottom: 14,
		borderBottomWidth: 1,
		borderBottomColor: "#F1F5F9",
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: 12,
	},
	sheetTitleCol: {
		flex: 1,
	},
	sheetTitle: {
		...primaryFont("extraBold"),
		fontSize: 16,
		color: "#0F172A",
		includeFontPadding: false,
	},
	sheetSubtitle: {
		...primaryFont("medium"),
		fontSize: 11,
		color: "#64748B",
		marginTop: 2,
		includeFontPadding: false,
	},
	closeBtn: {
		width: 36,
		height: 36,
		borderRadius: 18,
		backgroundColor: "#F1F5F9",
		alignItems: "center",
		justifyContent: "center",
	},
	scroll: {
		flex: 1,
	},
	scrollContent: {
		padding: 16,
		paddingBottom: 28,
	},
	footer: {
		backgroundColor: "#FFFFFF",
		borderTopWidth: 1,
		borderTopColor: "#E2E8F0",
		paddingHorizontal: 16,
		paddingTop: 12,
	},
	missingHintText: {
		...primaryFont("medium"),
		fontSize: 11,
		color: "#64748B",
		textAlign: "center",
		marginBottom: 8,
		includeFontPadding: false,
	},
	ctaTouchable: {
		width: "100%",
		borderRadius: 16,
		overflow: "hidden",
	},
	ctaGradient: {
		width: "100%",
		minHeight: 56,
		borderRadius: 16,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 8,
		paddingHorizontal: 16,
	},
	ctaText: {
		...primaryFont("bold"),
		fontSize: 16,
		color: "#FFFFFF",
		textShadowColor: "rgba(0, 0, 0, 0.22)",
		textShadowOffset: { width: 0, height: 1 },
		textShadowRadius: 2,
		includeFontPadding: false,
	},
	ctaTextDisabled: {
		color: "#64748B",
		textShadowColor: "transparent",
	},
});

export default AddBankAccountSheet;
