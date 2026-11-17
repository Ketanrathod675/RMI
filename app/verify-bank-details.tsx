import React, { useCallback, useEffect, useRef, useState } from "react";
import {
	ActivityIndicator,
	BackHandler,
	KeyboardAvoidingView,
	Platform,
	ScrollView,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ExitIntentModal from "@/components/assessment-fee/ExitIntentModal";
import AddBankAccountSheet from "@/components/bank/AddBankAccountSheet";
import BankAccountCard from "@/components/bank/BankAccountCard";
import BankAccountForm, { useBankAccountForm } from "@/components/bank/BankAccountForm";
import { primaryFont } from "@/constants/typography";
import { useApplicationStatusGuard } from "@/hooks/useApplicationStatusGuard";
import { useBankAccountPicker } from "@/hooks/useBankAccountPicker";
import { useJourneyTracker } from "@/hooks/useJourneyTracker";
import { useKeyboardVisible } from "@/hooks/useKeyboardVisible";
import { useTranslation } from "@/hooks/useTranslation";
import { useTypedNavigation } from "@/hooks/useTypedNavigation";
import type { ScrollViewRef } from "@/types/rn-refs";
import { getFriendlyError } from "@/utils/api/core/friendlyError";
import { getMissingFormHint } from "@/utils/bankAccountPicker";
import { formatRupees } from "@/utils/repaymentFormatting";

export default function VerifyBankDetails() {
	const insets = useSafeAreaInsets();
	const navigation = useTypedNavigation();
	const { t } = useTranslation();
	const { visible: isKeyboardVisible } = useKeyboardVisible();

	useJourneyTracker("/verify-bank-details");
	useApplicationStatusGuard();

	const picker = useBankAccountPicker();
	const inlineForm = useBankAccountForm(picker.accountHolderName);
	const scrollRef = useRef<ScrollViewRef | null>(null);
	const scrollYRef = useRef(0);
	const [isExitModalVisible, setIsExitModalVisible] = useState(false);

	const handleAttemptBack = useCallback(() => {
		if (picker.hasUnsavedDrafts) {
			picker.confirmDiscardDrafts(() => setIsExitModalVisible(true));
		} else {
			setIsExitModalVisible(true);
		}
	}, [picker]);

	useEffect(() => {
		const unsubscribe = navigation.addListener("beforeRemove", (e) => {
			if (["GO_BACK", "POP"].includes(e.data.action.type)) {
				e.preventDefault();
				handleAttemptBack();
			}
		});

		const backHandler = BackHandler.addEventListener("hardwareBackPress", () => {
			handleAttemptBack();
			return true;
		});

		return () => {
			unsubscribe();
			backHandler.remove();
		};
	}, [handleAttemptBack, navigation]);

	const subtitleParts: string[] = [];
	if (picker.activeLoanMeta.loanNumber) {
		subtitleParts.push(`Loan #${picker.activeLoanMeta.loanNumber}`);
	}
	if (picker.activeLoanMeta.loanAmount && picker.activeLoanMeta.loanAmount > 0) {
		subtitleParts.push(formatRupees(picker.activeLoanMeta.loanAmount));
	}
	const loanSubtitle = subtitleParts.join(" • ");

	const handleInlineContinue = () => {
		if (!inlineForm.validate()) return;
		void picker.submitSelection(inlineForm.values, (fields) => {
			inlineForm.setFieldErrors((prev) => ({
				...prev,
				...(fields.account_holder_name ? { accountHolderName: fields.account_holder_name } : {}),
				...(fields.account_number ? { accountNumber: fields.account_number } : {}),
				...(fields.confirm_account_number
					? { confirmAccountNumber: fields.confirm_account_number }
					: {}),
				...(fields.ifsc_code || fields.ifscCode
					? { ifscCode: fields.ifsc_code || fields.ifscCode }
					: {}),
				...(fields.account_type ? { accountType: fields.account_type } : {}),
			}));
		});
	};

	const inlineMissingHint = !picker.showPicker ? getMissingFormHint(inlineForm.values) : null;
	const selectedAccount = picker.selectedAccount;
	const isPickerSelectionBlocked =
		!selectedAccount || (selectedAccount.isDraft && Boolean(selectedAccount.isBlacklisted));

	const pickerCtaText = picker.isSubmitting
		? t("savingProgress", "Saving…")
		: selectedAccount
			? `${t("continueWithBank", "Continue with")} ${selectedAccount.bank_name} ••${selectedAccount.last4}`
			: t("continue", "Continue");

	const inlineCtaText = picker.isSubmitting
		? t("savingProgress", "Saving…")
		: t("saveAndContinue", "Save & continue");

	const isPrimaryEnabled = picker.showPicker
		? !isPickerSelectionBlocked && !picker.isSubmitting
		: inlineMissingHint === null && !picker.isSubmitting;

	const headerTitle = picker.showPicker
		? t("disbursalAccountTitle", "Disbursal Account")
		: t("bankAccountHeaderTitle", "Bank account");

	return (
		<KeyboardAvoidingView
			style={styles.container}
			behavior="padding"
			keyboardVerticalOffset={0}
		>
			{/* Sticky Top Header */}
			<View style={[styles.header, { paddingTop: Math.max(insets.top + 8, 16) }]}>
				<TouchableOpacity
					accessibilityRole="button"
					accessibilityLabel={t("back", "Back")}
					hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
					onPress={handleAttemptBack}
					style={styles.backBtn}
				>
					<Ionicons name="chevron-back" size={20} color="#334155" />
				</TouchableOpacity>
				<View style={styles.headerTitleCol}>
					<Text numberOfLines={1} style={styles.headerTitle}>
						{headerTitle}
					</Text>
					{picker.showPicker && loanSubtitle ? (
						<Text numberOfLines={1} style={styles.headerSubtitle}>
							{loanSubtitle}
						</Text>
					) : !picker.showPicker ? (
						<Text numberOfLines={1} style={styles.headerSubtitle}>
							{t("bankAccountHeaderSubtitle", "Loan disbursals & easy repayments")}
						</Text>
					) : null}
				</View>
			</View>

			{/* Main Content */}
			{picker.isLoadingAccounts ? (
				<View style={styles.skeletonContainer}>
					<View style={styles.skeletonCard} />
					<View style={styles.skeletonCard} />
					<View style={[styles.skeletonCard, { height: 76 }]} />
				</View>
			) : picker.isAccountsError ? (
				<View style={styles.errorStateContainer}>
					<View style={styles.errorCard}>
						<Ionicons name="cloud-offline-outline" size={34} color="#64748B" />
						<Text style={styles.errorStateTitle}>
							{t("failedToLoadBankAccounts", "Couldn't load your bank accounts")}
						</Text>
						<Text style={styles.errorStateSubtitle}>
							{getFriendlyError(picker.accountsError).message ||
								t("pleaseTryAgainLater", "Please check your connection and try again.")}
						</Text>
						<TouchableOpacity
							accessibilityRole="button"
							accessibilityLabel={t("retry", "Retry")}
							onPress={() => {
								void picker.refetchAccounts();
							}}
							style={styles.retryBtn}
						>
							<Text style={styles.retryBtnText}>{t("retry", "Retry")}</Text>
						</TouchableOpacity>
					</View>
				</View>
			) : (
				<>
					<ScrollView
						ref={scrollRef}
						style={styles.scrollView}
						contentContainerStyle={[
							styles.scrollContent,
							{ paddingBottom: isKeyboardVisible ? 48 : 32 },
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
						{picker.showPicker ? (
							<View style={styles.pickerSection}>
								<View>
									<Text style={styles.pickerHeading}>
										{t("whereShouldWeSendMoney", "Where should we send your money?")}
									</Text>
									<Text style={styles.pickerSubheading}>
										{t("chooseSavedOrAddNew", "Choose a saved account or add a new one.")}
									</Text>
								</View>

								{picker.selectionError ? (
									<View style={styles.selectionBanner}>
										<Ionicons name="alert-circle-outline" size={16} color="#BE123C" />
										<Text accessibilityLiveRegion="polite" style={styles.selectionBannerText}>
											{picker.selectionError}
										</Text>
									</View>
								) : null}

								<View accessibilityRole="radiogroup" style={styles.cardsList}>
									{picker.accounts.map((item) => (
										<BankAccountCard
											key={item.id}
											account={item}
											selected={picker.selectedId === item.id}
											onSelect={picker.selectAccount}
											onRemoveDraft={
												item.isDraft ? picker.removeDraftAccount : undefined
											}
											disabled={picker.isSubmitting}
										/>
									))}
								</View>

								<TouchableOpacity
									accessibilityRole="button"
									accessibilityLabel={t("addNewBankAccount", "Add new bank account")}
									activeOpacity={0.75}
									disabled={picker.isSubmitting}
									onPress={picker.openAddSheet}
									style={styles.addNewCard}
								>
									<View style={styles.addNewPlusCircle}>
										<Ionicons name="add" size={18} color="#475569" />
									</View>
									<Text style={styles.addNewText}>
										{t("addNewBankAccount", "Add new bank account")}
									</Text>
								</TouchableOpacity>
							</View>
						) : (
							<BankAccountForm
								accountHolderName={picker.accountHolderName}
								form={inlineForm}
								disabled={picker.isSubmitting}
								scrollViewRef={scrollRef}
								scrollYRef={scrollYRef}
							/>
						)}
					</ScrollView>

					{/* Sticky Bottom Bar */}
					<View
						style={[
							styles.bottomBar,
							{
								paddingTop: isKeyboardVisible ? 8 : 12,
								paddingBottom: isKeyboardVisible ? 10 : Math.max(insets.bottom, 16),
							},
						]}
					>
						<View style={styles.encryptedRow}>
							<Ionicons name="lock-closed" size={12} color="#64748B" />
							<Text style={styles.encryptedText}>
								{t("encryptedDetailsFooter", "Your account details are encrypted.")}
							</Text>
						</View>

						{!isPrimaryEnabled && !picker.isSubmitting ? (
							<Text style={styles.missingHintText}>
								{picker.showPicker
									? t("selectValidAccountHint", "Select an eligible bank account to continue")
									: inlineMissingHint
										? t(inlineMissingHint as any, inlineMissingHint)
										: null}
							</Text>
						) : null}

						<TouchableOpacity
							accessibilityRole="button"
							accessibilityLabel={picker.showPicker ? pickerCtaText : inlineCtaText}
							accessibilityState={{
								disabled: picker.showPicker
									? picker.isSubmitting || isPickerSelectionBlocked
									: picker.isSubmitting,
								busy: picker.isSubmitting,
							}}
							activeOpacity={0.88}
							disabled={
								picker.isSubmitting ||
								(picker.showPicker && isPickerSelectionBlocked)
							}
							onPress={
								picker.showPicker ? picker.handleContinueSelected : handleInlineContinue
							}
							style={styles.ctaTouchable}
						>
							<LinearGradient
								colors={
									isPrimaryEnabled
										? ["#09A143", "#78DE26"]
										: ["#E2E8F0", "#CBD5E1"]
								}
								start={{ x: 0, y: 0.5 }}
								end={{ x: 1, y: 0.5 }}
								style={styles.ctaGradient}
							>
								{picker.isSubmitting ? (
									<View style={styles.ctaInnerRow}>
										<ActivityIndicator size="small" color="#FFFFFF" />
										<Text style={styles.ctaText}>{pickerCtaText}</Text>
									</View>
								) : (
									<View style={styles.ctaInnerRow}>
										<Text
											numberOfLines={1}
											ellipsizeMode="middle"
											style={[
												styles.ctaText,
												!isPrimaryEnabled && styles.ctaTextDisabled,
											]}
										>
											{picker.showPicker ? pickerCtaText : inlineCtaText}
										</Text>
										<MaterialCommunityIcons
											name="arrow-right"
											size={20}
											color={isPrimaryEnabled ? "#FFFFFF" : "#64748B"}
										/>
									</View>
								)}
							</LinearGradient>
						</TouchableOpacity>
					</View>
				</>
			)}

			<AddBankAccountSheet
				visible={picker.sheetOpen}
				accountHolderName={picker.accountHolderName}
				onClose={picker.closeAddSheet}
				onSaveDraft={picker.addDraftAccount}
			/>

			<ExitIntentModal
				visible={isExitModalVisible}
				onClose={() => setIsExitModalVisible(false)}
				onConfirmExit={() => {
					setIsExitModalVisible(false);
					router.replace("/(tabs)");
				}}
			/>
		</KeyboardAvoidingView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#F5F7F2",
	},
	header: {
		backgroundColor: "#FFFFFF",
		borderBottomWidth: 1,
		borderBottomColor: "#F1F5F9",
		paddingHorizontal: 16,
		paddingBottom: 12,
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
	},
	backBtn: {
		width: 36,
		height: 36,
		borderRadius: 18,
		backgroundColor: "#F1F5F9",
		alignItems: "center",
		justifyContent: "center",
	},
	headerTitleCol: {
		flex: 1,
	},
	headerTitle: {
		...primaryFont("bold"),
		fontSize: 16,
		color: "#0F172A",
		includeFontPadding: false,
	},
	headerSubtitle: {
		...primaryFont("medium"),
		fontSize: 11,
		color: "#64748B",
		marginTop: 2,
		includeFontPadding: false,
	},
	skeletonContainer: {
		flex: 1,
		padding: 16,
		gap: 12,
	},
	skeletonCard: {
		height: 116,
		borderRadius: 16,
		backgroundColor: "#E2E8F0",
		opacity: 0.55,
	},
	errorStateContainer: {
		flex: 1,
		justifyContent: "center",
		padding: 20,
	},
	errorCard: {
		backgroundColor: "#FFFFFF",
		borderRadius: 16,
		padding: 24,
		borderWidth: 1,
		borderColor: "#E2E8F0",
		alignItems: "center",
		gap: 8,
	},
	errorStateTitle: {
		...primaryFont("bold"),
		fontSize: 16,
		color: "#0F172A",
		textAlign: "center",
		marginTop: 4,
	},
	errorStateSubtitle: {
		...primaryFont("medium"),
		fontSize: 13,
		color: "#64748B",
		textAlign: "center",
	},
	retryBtn: {
		marginTop: 8,
		backgroundColor: "#059669",
		borderRadius: 12,
		paddingHorizontal: 20,
		minHeight: 48,
		justifyContent: "center",
	},
	retryBtnText: {
		...primaryFont("bold"),
		fontSize: 14,
		color: "#FFFFFF",
	},
	scrollView: {
		flex: 1,
	},
	scrollContent: {
		padding: 16,
		paddingBottom: 32,
	},
	pickerSection: {
		gap: 14,
	},
	pickerHeading: {
		...primaryFont("extraBold"),
		fontSize: 18,
		color: "#0F172A",
		lineHeight: 24,
		includeFontPadding: false,
	},
	pickerSubheading: {
		...primaryFont("medium"),
		fontSize: 12,
		color: "#64748B",
		marginTop: 3,
		includeFontPadding: false,
	},
	selectionBanner: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
		backgroundColor: "#FFF1F2",
		borderWidth: 1,
		borderColor: "#FECDD3",
		borderRadius: 12,
		padding: 12,
	},
	selectionBannerText: {
		flex: 1,
		...primaryFont("medium"),
		fontSize: 12,
		color: "#BE123C",
		includeFontPadding: false,
	},
	cardsList: {
		gap: 12,
	},
	addNewCard: {
		borderWidth: 2,
		borderStyle: "dashed",
		borderColor: "#CBD5E1",
		borderRadius: 16,
		backgroundColor: "rgba(255, 255, 255, 0.7)",
		minHeight: 60,
		padding: 14,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 10,
	},
	addNewPlusCircle: {
		width: 32,
		height: 32,
		borderRadius: 16,
		backgroundColor: "#F1F5F9",
		alignItems: "center",
		justifyContent: "center",
	},
	addNewText: {
		...primaryFont("bold"),
		fontSize: 13,
		color: "#334155",
		includeFontPadding: false,
	},
	bottomBar: {
		backgroundColor: "#FFFFFF",
		borderTopWidth: 1,
		borderTopColor: "#E2E8F0",
		paddingHorizontal: 16,
		paddingTop: 12,
	},
	encryptedRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 5,
		marginBottom: 8,
	},
	encryptedText: {
		...primaryFont("medium"),
		fontSize: 11,
		color: "#64748B",
		includeFontPadding: false,
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
		paddingHorizontal: 16,
		alignItems: "center",
		justifyContent: "center",
	},
	ctaInnerRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 8,
	},
	ctaText: {
		...primaryFont("bold"),
		fontSize: 16,
		color: "#FFFFFF",
		flexShrink: 1,
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
