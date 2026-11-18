import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import Toast from "react-native-toast-message";
import { useAuth } from "@/hooks/useAuth";
import { useMountedRef } from "@/hooks/useMountedRef";
import { useNetworkAwareQuery } from "@/hooks/useNetworkAwareQuery";
import { useTranslation } from "@/hooks/useTranslation";
import { getUserProfile } from "@/utils/api";
import {
	getBankAccounts,
	selectBankAccount,
	type BankAccount,
} from "@/utils/api/bank";
import { getFriendlyError } from "@/utils/api/core/friendlyError";
import { getApiErrorInfo } from "@/utils/api/errors";
import {
	buildSelectAccountPayload,
	canAddDraftAccount,
	classifyBankSelectError,
	formatMaskedAccountNumber,
	MAX_DRAFT_ACCOUNTS,
	type BankFormValues,
	type DraftBankAccount,
	type PickerAccountItem,
	type SavedPickerAccount,
} from "@/utils/bankAccountPicker";
import Logger from "@/utils/logger";

export function useBankAccountPicker() {
	const router = useRouter();
	const queryClient = useQueryClient();
	const mountedRef = useMountedRef();
	const { t } = useTranslation();
	const { userId } = useAuth();

	const [draftAccounts, setDraftAccounts] = useState<DraftBankAccount[]>([]);
	const [removedSavedIds, setRemovedSavedIds] = useState<string[]>([]);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [sheetOpen, setSheetOpen] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [selectionError, setSelectionError] = useState<string | null>(null);
	const submitGuardRef = useRef(false);
	const draftSeqRef = useRef(0);

	// User profile for read-only account holder name
	const { data: userProfile } = useNetworkAwareQuery({
		queryKey: ["userProfile", userId],
		queryFn: getUserProfile,
		enabled: !!userId,
		staleTime: 300000,
	});

	const cachedDashboard = userId
		? queryClient.getQueryData<any>(["user", "dashboard", userId])
		: undefined;
	const dashboardName = String(cachedDashboard?.user_summary?.name || "").trim();
	const accountHolderName =
		String(userProfile?.personal_details?.full_name || "").trim() ||
		(dashboardName && dashboardName !== "Applicant" ? dashboardName : "");

	const activeLoanMeta = useMemo(() => {
		const loanNum =
			cachedDashboard?.active_loan?.loan_number ||
			cachedDashboard?.loan_offer?.loan_number ||
			null;
		const loanAmt =
			cachedDashboard?.active_loan?.loan_amount ||
			cachedDashboard?.loan_offer?.loan_amount ||
			cachedDashboard?.loan_offer?.approved_amount ||
			null;
		return {
			loanNumber: loanNum ? String(loanNum) : null,
			loanAmount:
				loanAmt !== null && loanAmt !== undefined && Number.isFinite(Number(loanAmt))
					? Number(loanAmt)
					: null,
		};
	}, [cachedDashboard]);

	// Fetch saved bank accounts on mount
	const {
		data: rawSavedAccounts,
		isLoading: isLoadingAccounts,
		isError: isAccountsError,
		error: accountsError,
		refetch: refetchAccounts,
	} = useNetworkAwareQuery<BankAccount[]>({
		queryKey: ["bankAccounts", userId],
		queryFn: getBankAccounts,
		enabled: !!userId,
		staleTime: 30_000,
	});

	const savedAccounts: SavedPickerAccount[] = useMemo(() => {
		const list = Array.isArray(rawSavedAccounts) ? rawSavedAccounts : [];
		return list
			.filter((acc) => acc.id && !removedSavedIds.includes(acc.id))
			.map((acc) => ({
				...acc,
				isDraft: false as const,
				last4: formatMaskedAccountNumber(acc.account_number_masked).last4,
			}));
	}, [rawSavedAccounts, removedSavedIds]);

	const accounts: PickerAccountItem[] = useMemo(
		() => [...draftAccounts, ...savedAccounts],
		[draftAccounts, savedAccounts],
	);

	// Pre-select the first saved account returned (backend sorts most recently used first)
	useEffect(() => {
		if (isSubmitting) return;
		if (accounts.length === 0) {
			if (selectedId !== null) setSelectedId(null);
			return;
		}
		if (!selectedId || !accounts.some((a) => a.id === selectedId)) {
			setSelectedId(accounts[0].id);
		}
	}, [accounts, selectedId, isSubmitting]);

	const selectedAccount: PickerAccountItem | null = useMemo(
		() => accounts.find((a) => a.id === selectedId) ?? null,
		[accounts, selectedId],
	);

	const showPicker = accounts.length > 0;
	const hasUnsavedDrafts = draftAccounts.length > 0;

	const openAddSheet = useCallback(() => {
		if (!canAddDraftAccount(draftAccounts.length)) {
			Toast.show({
				type: "info",
				position: "bottom",
				text1: t(
					"maxDraftAccountsReached",
					`You can add up to ${MAX_DRAFT_ACCOUNTS} new accounts at a time.`,
				),
			});
			return;
		}
		setSelectionError(null);
		setSheetOpen(true);
	}, [draftAccounts.length, t]);

	const closeAddSheet = useCallback(() => {
		setSheetOpen(false);
	}, []);

	/**
	 * Adds a validated draft ONLY in memory (no API call, no storage, no account-number logging).
	 */
	const addDraftAccount = useCallback(
		(values: BankFormValues): boolean => {
			if (!canAddDraftAccount(draftAccounts.length)) {
				Toast.show({
					type: "info",
					position: "bottom",
					text1: t(
						"maxDraftAccountsReached",
						`You can add up to ${MAX_DRAFT_ACCOUNTS} new accounts at a time.`,
					),
				});
				return false;
			}

			draftSeqRef.current += 1;
			const id = `draft_${Date.now()}_${draftSeqRef.current}`;
			const { last4 } = formatMaskedAccountNumber(values.accountNumber);

			const draft: DraftBankAccount = {
				id,
				isDraft: true,
				account_holder_name: values.accountHolderName.trim() || undefined,
				accountNumber: values.accountNumber.trim(),
				confirmAccountNumber: values.confirmAccountNumber.trim(),
				account_number_masked: `XXXXXXXX${last4}`,
				last4,
				ifsc_code: values.ifscCode.trim().toUpperCase(),
				bank_name: values.bankName.trim() || "Bank",
				branch_name: values.branchName.trim(),
				city: values.city.trim(),
				account_type: values.accountType,
			};

			setDraftAccounts((prev) => [draft, ...prev]);
			setSelectedId(draft.id);
			setSelectionError(null);
			setSheetOpen(false);

			Toast.show({
				type: "success",
				position: "bottom",
				text1: t("accountAdded", "Account added"),
			});
			return true;
		},
		[draftAccounts.length, t],
	);

	const removeDraftAccount = useCallback((draftId: string) => {
		setDraftAccounts((prev) => prev.filter((d) => d.id !== draftId));
		setSelectionError(null);
	}, []);

	const selectAccount = useCallback((id: string) => {
		setSelectedId(id);
		setSelectionError(null);
	}, []);

	const submitSelection = useCallback(
		async (
			payloadSource: PickerAccountItem | BankFormValues,
			onFieldErrors?: (fields: Record<string, string>) => void,
		): Promise<void> => {
			if (submitGuardRef.current) return;
			submitGuardRef.current = true;
			setIsSubmitting(true);
			setSelectionError(null);

			try {
				const isPickerItem = "isDraft" in payloadSource;
				const body = isPickerItem
					? buildSelectAccountPayload(payloadSource)
					: buildSelectAccountPayload({
							isDraft: true,
							account_holder_name: payloadSource.accountHolderName,
							accountNumber: payloadSource.accountNumber,
							confirmAccountNumber: payloadSource.confirmAccountNumber,
							ifsc_code: payloadSource.ifscCode,
							account_type: payloadSource.accountType,
					  });

				const res = await selectBankAccount(body);

				if (!mountedRef.current) return;

				// Optimistically update saved bank accounts cache if backend returned created/selected account
				const newBankDetails =
					res?.bank_details && typeof res.bank_details === "object"
						? res.bank_details.bank_details || res.bank_details
						: undefined;
				const newBankId = newBankDetails?.id || newBankDetails?.uuid;
				if (newBankId && userId) {
					queryClient.setQueryData<BankAccount[]>(["bankAccounts", userId], (prev) => {
						const existing = Array.isArray(prev) ? prev : [];
						const masked =
							String(newBankDetails.account_number_masked || "").trim() ||
							(isPickerItem
								? payloadSource.account_number_masked
								: `XXXXXXXX${payloadSource.accountNumber.slice(-4)}`);
						const createdAccount: BankAccount = {
							id: String(newBankId),
							account_number_masked: masked,
							ifsc_code: String(
								newBankDetails.ifsc_code ||
									(isPickerItem ? payloadSource.ifsc_code : payloadSource.ifscCode) ||
									"",
							)
								.trim()
								.toUpperCase(),
							bank_name: String(
								newBankDetails.bank_name ||
									(isPickerItem ? payloadSource.bank_name : payloadSource.bankName) ||
									"Bank",
							),
							branch_name: String(
								newBankDetails.branch_name ||
									(isPickerItem ? payloadSource.branch_name : payloadSource.branchName) ||
									"",
							),
							city: String(
								newBankDetails.city ||
									(isPickerItem ? payloadSource.city : payloadSource.city) ||
									"",
							),
							account_type: String(
								newBankDetails.account_type ||
									(isPickerItem ? payloadSource.account_type : payloadSource.accountType) ||
									"savings",
							).toLowerCase(),
							last_used_at: new Date().toISOString(),
						};
						return [createdAccount, ...existing.filter((a) => a.id !== createdAccount.id)];
					});
					setSelectedId(String(newBankId));
				}

				// Discard remaining drafts on success
				setDraftAccounts([]);

				// Invalidate in background without blocking navigation
				void queryClient.invalidateQueries({ queryKey: ["user", "dashboard"] });
				void queryClient.invalidateQueries({ queryKey: ["bankAccounts"] });

				Toast.show({
					type: "success",
					position: "bottom",
					text1: t("bankDetailsSubmittedSuccessfully", "Bank details submitted successfully"),
					text2: t("proceedingToNextStep", "Proceeding to next step"),
				});

				router.push("/verifying-bank");
			} catch (err: any) {
				if (!mountedRef.current) return;
				if (err?.isApplicationRejected) return;

				const info = getApiErrorInfo(err);
				Logger.error("Bank account selection failed", { status: info.status });

				const classified = classifyBankSelectError(err);

				if (classified.kind === "blacklisted") {
					setSelectionError(classified.message);
					if ("isDraft" in payloadSource && payloadSource.isDraft) {
						setDraftAccounts((prev) =>
							prev.map((d) =>
								d.id === payloadSource.id
									? { ...d, isBlacklisted: true, blacklistError: classified.message }
									: d,
							),
						);
					}
					onFieldErrors?.({ ifscCode: classified.message });
					Toast.show({
						type: "error",
						position: "bottom",
						text1: t("bankSubmissionFailed", "Bank submission failed"),
						text2: classified.message,
					});
					return;
				}

				if (classified.kind === "rejected_earlier") {
					setSelectionError(classified.message);
					if ("isDraft" in payloadSource) {
						if (payloadSource.isDraft) {
							setDraftAccounts((prev) => prev.filter((d) => d.id !== payloadSource.id));
						} else {
							setRemovedSavedIds((prev) =>
								prev.includes(payloadSource.id) ? prev : [...prev, payloadSource.id],
							);
						}
					}
					Toast.show({
						type: "error",
						position: "bottom",
						text1: t("bankSubmissionFailed", "Bank submission failed"),
						text2: classified.message,
					});
					return;
				}

				if (classified.kind === "validation") {
					onFieldErrors?.(classified.fields);
					setSelectionError(classified.message);
					Toast.show({
						type: "error",
						position: "bottom",
						text1: t("bankSubmissionFailed", "Bank submission failed"),
						text2: classified.message,
					});
					return;
				}

				const friendlyMsg = getFriendlyError(err).message;
				setSelectionError(friendlyMsg);
				Toast.show({
					type: "error",
					position: "bottom",
					text1: t("bankSubmissionFailed", "Bank submission failed"),
					text2: friendlyMsg,
				});
			} finally {
				submitGuardRef.current = false;
				if (mountedRef.current) {
					setIsSubmitting(false);
				}
			}
		},
		[mountedRef, queryClient, router, t, userId],
	);

	const handleContinueSelected = useCallback(async () => {
		if (!selectedAccount) return;
		if (selectedAccount.isDraft && selectedAccount.isBlacklisted) {
			setSelectionError(
				selectedAccount.blacklistError ||
					t("blacklistedBankHint", "Choose an account from a supported bank"),
			);
			return;
		}
		await submitSelection(selectedAccount);
	}, [selectedAccount, submitSelection, t]);

	const confirmDiscardDrafts = useCallback(
		(onDiscard: () => void) => {
			if (!hasUnsavedDrafts) {
				onDiscard();
				return;
			}
			Alert.alert(
				t("discardDraftTitle", "Discard unsaved account?"),
				t("discardTheAccountYouAdded", "Discard the account you added?"),
				[
					{ text: t("keepEditingButton", "Keep editing"), style: "cancel" },
					{
						text: t("discardButton", "Discard"),
						style: "destructive",
						onPress: () => {
							setDraftAccounts([]);
							onDiscard();
						},
					},
				],
			);
		},
		[hasUnsavedDrafts, t],
	);

	return {
		accountHolderName,
		activeLoanMeta,
		accounts,
		selectedAccount,
		selectedId,
		showPicker,
		isLoadingAccounts,
		isAccountsError,
		accountsError,
		refetchAccounts,
		sheetOpen,
		openAddSheet,
		closeAddSheet,
		addDraftAccount,
		removeDraftAccount,
		selectAccount,
		submitSelection,
		handleContinueSelected,
		isSubmitting,
		selectionError,
		hasUnsavedDrafts,
		confirmDiscardDrafts,
	};
}

