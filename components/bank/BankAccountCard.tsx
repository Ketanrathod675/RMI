import React from "react";
import { Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { primaryFont } from "@/constants/typography";
import { useTranslation } from "@/hooks/useTranslation";
import {
	formatMaskedAccountNumber,
	getBankAvatarInfo,
	type PickerAccountItem,
} from "@/utils/bankAccountPicker";

interface BankAccountCardProps {
	account: PickerAccountItem;
	selected: boolean;
	onSelect: (id: string) => void;
	onRemoveDraft?: (id: string) => void;
	disabled?: boolean;
}

export const BankAccountCard: React.FC<BankAccountCardProps> = React.memo(
	({ account, selected, onSelect, onRemoveDraft, disabled = false }) => {
		const { t } = useTranslation();
		const { initials, color } = getBankAvatarInfo(account.bank_name);
		const { formatted: maskedFormatted, last4 } = formatMaskedAccountNumber(
			account.account_number_masked,
		);
		const isDraft = account.isDraft;
		const isBlacklisted = isDraft && Boolean(account.isBlacklisted);
		const accountTypeLabel =
			String(account.account_type || "savings").toLowerCase() === "current"
				? t("currentShort", "Current")
				: t("savingsShort", "Savings");

		const a11yLabel = `${account.bank_name}, ${t("accountEnding", "account ending")} ${last4}, ${accountTypeLabel}, ${
			selected ? t("selected", "selected") : t("notSelected", "not selected")
		}`;

		return (
			<Pressable
				accessibilityRole="radio"
				accessibilityState={{ selected, disabled }}
				accessibilityLabel={a11yLabel}
				disabled={disabled}
				onPress={() => onSelect(account.id)}
				style={({ pressed }) => [
					styles.cardOuter,
					selected && !isBlacklisted ? styles.cardSelectedBorder : styles.cardDefaultBorder,
					isBlacklisted && styles.cardBlacklistedBorder,
					pressed && !disabled && styles.cardPressed,
				]}
			>
				{selected && !isBlacklisted ? (
					<LinearGradient
						colors={["#ECFDF5", "#FFFFFF", "#F0FDF4"]}
						start={{ x: 0, y: 0 }}
						end={{ x: 1, y: 1 }}
						style={styles.cardInner}
					>
						<CardContent
							account={account}
							initials={initials}
							avatarColor={color}
							maskedFormatted={maskedFormatted}
							accountTypeLabel={accountTypeLabel}
							selected={selected}
							isBlacklisted={isBlacklisted}
							onRemoveDraft={onRemoveDraft}
						/>
					</LinearGradient>
				) : (
					<View style={[styles.cardInner, isBlacklisted ? styles.blacklistedBg : styles.defaultBg]}>
						<CardContent
							account={account}
							initials={initials}
							avatarColor={color}
							maskedFormatted={maskedFormatted}
							accountTypeLabel={accountTypeLabel}
							selected={selected}
							isBlacklisted={isBlacklisted}
							onRemoveDraft={onRemoveDraft}
						/>
					</View>
				)}
			</Pressable>
		);
	},
);

interface CardContentProps {
	account: PickerAccountItem;
	initials: string;
	avatarColor: string;
	maskedFormatted: string;
	accountTypeLabel: string;
	selected: boolean;
	isBlacklisted: boolean;
	onRemoveDraft?: (id: string) => void;
}

const CardContent: React.FC<CardContentProps> = ({
	account,
	initials,
	avatarColor,
	maskedFormatted,
	accountTypeLabel,
	selected,
	isBlacklisted,
	onRemoveDraft,
}) => {
	const { t } = useTranslation();
	const isDraft = account.isDraft;

	return (
		<>
			<View style={styles.topRow}>
				<View style={styles.identityRow}>
					<View style={[styles.avatar, { backgroundColor: avatarColor }]}>
						<Text style={styles.avatarText}>{initials}</Text>
					</View>

					<View style={styles.titleBlock}>
						<View style={styles.nameRow}>
							<Text numberOfLines={1} ellipsizeMode="tail" style={styles.bankName}>
								{account.bank_name}
							</Text>
							{isDraft ? (
								<View style={styles.draftChip}>
									<Text style={styles.draftChipText}>
										{t("newDraftChip", "New · saved when you continue")}
									</Text>
								</View>
							) : null}
						</View>
						<Text style={styles.maskedNumber}>{maskedFormatted}</Text>
					</View>
				</View>

				<View style={styles.rightControls}>
					{isDraft && onRemoveDraft ? (
						<TouchableOpacity
							accessibilityRole="button"
							accessibilityLabel={t("remove", "Remove")}
							hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
							onPress={() => onRemoveDraft(account.id)}
							style={styles.removeDraftBtn}
						>
							<Ionicons name="close" size={16} color="#64748B" />
						</TouchableOpacity>
					) : null}

					{selected && !isBlacklisted ? (
						<View style={styles.radioSelected}>
							<Ionicons name="checkmark" size={14} color="#FFFFFF" />
						</View>
					) : (
						<View style={styles.radioUnselected} />
					)}
				</View>
			</View>

			<View style={[styles.footerRow, selected && !isBlacklisted && styles.footerRowSelected]}>
				<View style={styles.footerMeta}>
					<View style={styles.typePill}>
						<Text style={styles.typePillText}>{accountTypeLabel}</Text>
					</View>
					<Text numberOfLines={1} style={styles.ifscText}>
						IFSC: {account.ifsc_code}
					</Text>
				</View>
			</View>

			{isBlacklisted && isDraft && account.blacklistError ? (
				<Text accessibilityLiveRegion="polite" style={styles.blacklistedErrorText}>
					{account.blacklistError}
				</Text>
			) : null}
		</>
	);
};

const styles = StyleSheet.create({
	cardOuter: {
		borderRadius: 16,
		overflow: "hidden",
		shadowColor: "#000000",
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.05,
		shadowRadius: 6,
		elevation: 2,
	},
	cardDefaultBorder: {
		borderWidth: 1,
		borderColor: "#E2E8F0",
		backgroundColor: "#FFFFFF",
	},
	cardSelectedBorder: {
		borderWidth: 2,
		borderColor: "#10B981",
		backgroundColor: "#ECFDF5",
	},
	cardBlacklistedBorder: {
		borderWidth: 1.5,
		borderColor: "#FDA4AF",
		backgroundColor: "#FFF1F2",
	},
	cardPressed: {
		opacity: 0.94,
	},
	cardInner: {
		padding: 16,
	},
	defaultBg: {
		backgroundColor: "#FFFFFF",
	},
	blacklistedBg: {
		backgroundColor: "#FFF1F2",
	},
	topRow: {
		flexDirection: "row",
		alignItems: "flex-start",
		justifyContent: "space-between",
		gap: 8,
	},
	identityRow: {
		flex: 1,
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
	},
	avatar: {
		width: 40,
		height: 40,
		borderRadius: 12,
		alignItems: "center",
		justifyContent: "center",
		flexShrink: 0,
	},
	avatarText: {
		...primaryFont("extraBold"),
		fontSize: 12,
		color: "#FFFFFF",
		includeFontPadding: false,
	},
	titleBlock: {
		flex: 1,
		minWidth: 0,
	},
	nameRow: {
		flexDirection: "row",
		alignItems: "center",
		flexWrap: "wrap",
		gap: 6,
	},
	bankName: {
		...primaryFont("bold"),
		fontSize: 14,
		color: "#0F172A",
		flexShrink: 1,
		includeFontPadding: false,
	},
	draftChip: {
		backgroundColor: "#FFFBEB",
		borderWidth: 1,
		borderColor: "#FDE68A",
		borderRadius: 6,
		paddingHorizontal: 6,
		paddingVertical: 2,
	},
	draftChipText: {
		...primaryFont("bold"),
		fontSize: 10,
		color: "#B45309",
		includeFontPadding: false,
	},
	maskedNumber: {
		...primaryFont("bold"),
		fontSize: 12,
		letterSpacing: 0.9,
		color: "#334155",
		marginTop: 3,
		includeFontPadding: false,
	},
	rightControls: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
	},
	removeDraftBtn: {
		width: 32,
		height: 32,
		borderRadius: 16,
		backgroundColor: "#F1F5F9",
		alignItems: "center",
		justifyContent: "center",
	},
	radioSelected: {
		width: 24,
		height: 24,
		borderRadius: 12,
		backgroundColor: "#059669",
		alignItems: "center",
		justifyContent: "center",
	},
	radioUnselected: {
		width: 24,
		height: 24,
		borderRadius: 12,
		borderWidth: 2,
		borderColor: "#CBD5E1",
		backgroundColor: "#FFFFFF",
	},
	footerRow: {
		marginTop: 12,
		paddingTop: 12,
		borderTopWidth: 1,
		borderTopColor: "#F1F5F9",
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},
	footerRowSelected: {
		borderTopColor: "#D1FAE5",
	},
	footerMeta: {
		flexDirection: "row",
		alignItems: "center",
		flexWrap: "wrap",
		gap: 8,
	},
	typePill: {
		backgroundColor: "#F1F5F9",
		paddingHorizontal: 8,
		paddingVertical: 3,
		borderRadius: 6,
	},
	typePillText: {
		...primaryFont("semibold"),
		fontSize: 10,
		color: "#334155",
		includeFontPadding: false,
	},
	ifscText: {
		...primaryFont("medium"),
		fontSize: 11,
		color: "#64748B",
		includeFontPadding: false,
	},
	blacklistedErrorText: {
		...primaryFont("medium"),
		fontSize: 11,
		color: "#BE123C",
		marginTop: 8,
		includeFontPadding: false,
	},
});

export default BankAccountCard;

