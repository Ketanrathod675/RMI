import React, { useCallback, useEffect, useRef, useState } from "react";
import {
	ActivityIndicator,
	Keyboard,
	Platform,
	Pressable,
	StyleSheet,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import Toast from "react-native-toast-message";
import { primaryFont } from "@/constants/typography";
import { useMountedRef } from "@/hooks/useMountedRef";
import { useTranslation } from "@/hooks/useTranslation";
import type { ScrollViewRef } from "@/types/rn-refs";
import { lookupIFSC, type IFSCLookupResponseType } from "@/utils/api/bank";
import {
	IFSC_REGEX,
	validateBankFormFields,
	type BankFormErrorKey,
	type BankFormValues,
} from "@/utils/bankAccountPicker";
import Logger from "@/utils/logger";

export interface UseBankFormControllerResult {
	values: BankFormValues;
	errors: Partial<Record<BankFormErrorKey, string>>;
	isLookingUpIFSC: boolean;
	ifscLookupError: string | null;
	handleFieldChange: (
		field:
			| "accountHolderName"
			| "accountNumber"
			| "confirmAccountNumber"
			| "ifscCode"
			| "accountType",
		rawValue: string,
	) => void;
	setFieldErrors: React.Dispatch<React.SetStateAction<Partial<Record<BankFormErrorKey, string>>>>;
	validate: () => boolean;
	reset: (nextAccountHolderName?: string) => void;
}

const INITIAL_VALUES: BankFormValues = {
	accountHolderName: "",
	accountNumber: "",
	confirmAccountNumber: "",
	accountType: "savings",
	ifscCode: "",
	bankName: "",
	branchName: "",
	city: "",
	isIFSCValid: false,
	ifscBlacklistedError: null,
};

/**
 * Shared bank form state hook: editable holder name pre-filled from profile,
 * paste block (+2 delta rule), debounced IFSC lookup, blacklist awareness,
 * and inline validation (never logs sensitive account numbers).
 */
export function useBankAccountForm(initialAccountHolderName = ""): UseBankFormControllerResult {
	const mountedRef = useMountedRef();
	const { t } = useTranslation();

	const [values, setValues] = useState<BankFormValues>(() => ({
		...INITIAL_VALUES,
		accountHolderName: String(initialAccountHolderName || "").trim(),
	}));
	const [errors, setErrors] = useState<Partial<Record<BankFormErrorKey, string>>>({});
	const [isLookingUpIFSC, setIsLookingUpIFSC] = useState(false);
	const [ifscLookupError, setIfscLookupError] = useState<string | null>(null);

	const hasUserEditedHolderRef = useRef(false);
	const latestNumbersRef = useRef({ accountNumber: "", confirmAccountNumber: "" });
	const ifscTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const requestedIfscRef = useRef("");

	useEffect(() => {
		const trimmed = String(initialAccountHolderName || "").trim();
		if (trimmed && !hasUserEditedHolderRef.current) {
			setValues((prev) =>
				prev.accountHolderName === trimmed ? prev : { ...prev, accountHolderName: trimmed },
			);
		}
	}, [initialAccountHolderName]);

	useEffect(() => {
		return () => {
			if (ifscTimerRef.current) clearTimeout(ifscTimerRef.current);
		};
	}, []);

	const runIfscLookup = useCallback(
		async (code: string) => {
			setIsLookingUpIFSC(true);
			setIfscLookupError(null);
			try {
				const data: IFSCLookupResponseType = await lookupIFSC(code);
				if (!mountedRef.current || requestedIfscRef.current !== code) {
					return;
				}
				if (data.is_blacklisted) {
					const blacklistMsg =
						data.message ||
						t("blacklistedBankHint", "Choose an account from a supported bank");
					setValues((prev) => ({
						...prev,
						bankName: data.bank_details?.bank_name || "",
						branchName: data.bank_details?.branch_name || "",
						city: data.bank_details?.city || "",
						isIFSCValid: false,
						ifscBlacklistedError: blacklistMsg,
					}));
					setIfscLookupError(blacklistMsg);
					setErrors((prev) => ({ ...prev, ifscCode: blacklistMsg }));
					return;
				}

				if (data.success && data.bank_details) {
					setValues((prev) => ({
						...prev,
						bankName: data.bank_details?.bank_name || "",
						branchName: data.bank_details?.branch_name || "",
						city: data.bank_details?.city || "",
						isIFSCValid: true,
						ifscBlacklistedError: null,
					}));
					setErrors((prev) => {
						const next = { ...prev };
						delete next.ifscCode;
						return next;
					});
					Keyboard.dismiss();
				} else {
					const invalidMsg = t("pleaseCheckAndEnterValidIFSC", "Please check and enter a valid IFSC code");
					setValues((prev) => ({
						...prev,
						bankName: "",
						branchName: "",
						city: "",
						isIFSCValid: false,
						ifscBlacklistedError: null,
					}));
					setIfscLookupError(invalidMsg);
					setErrors((prev) => ({ ...prev, ifscCode: invalidMsg }));
				}
			} catch {
				if (!mountedRef.current || requestedIfscRef.current !== code) return;
				const errMsg = t("pleaseEnterValidIFSCCode", "Please enter a valid IFSC code");
				setValues((prev) => ({
					...prev,
					bankName: "",
					branchName: "",
					city: "",
					isIFSCValid: false,
					ifscBlacklistedError: null,
				}));
				setIfscLookupError(errMsg);
				setErrors((prev) => ({ ...prev, ifscCode: errMsg }));
			} finally {
				if (mountedRef.current && requestedIfscRef.current === code) {
					setIsLookingUpIFSC(false);
				}
			}
		},
		[mountedRef, t],
	);

	const handleFieldChange = useCallback(
		(
			field:
				| "accountHolderName"
				| "accountNumber"
				| "confirmAccountNumber"
				| "ifscCode"
				| "accountType",
			rawValue: string,
		) => {
			if (field === "accountHolderName") {
				hasUserEditedHolderRef.current = true;
				setValues((prev) => ({ ...prev, accountHolderName: rawValue }));
				setErrors((prev) => {
					const next = { ...prev };
					delete next.accountHolderName;
					return next;
				});
				return;
			}

			if (field === "accountNumber" || field === "confirmAccountNumber") {
				const digits = rawValue.replace(/[^0-9]/g, "");
				const prevValue = latestNumbersRef.current[field];
				if (digits.length > prevValue.length + 2) {
					Toast.show({
						type: "info",
						position: "bottom",
						text1: t("copyPasteDisabled", "Copy/Paste is not allowed"),
						text2: t("enterAccountNumberManually", "Please type your account number manually"),
					});
					return;
				}
				latestNumbersRef.current[field] = digits;
				setValues((prev) => ({ ...prev, [field]: digits }));
				setErrors((prev) => {
					const next = { ...prev };
					delete next[field];
					if (field === "accountNumber") delete next.confirmAccountNumber;
					return next;
				});
				return;
			}

			if (field === "ifscCode") {
				const cleaned = rawValue.toUpperCase().replace(/[^A-Z0-9]/g, "");
				if (ifscTimerRef.current) clearTimeout(ifscTimerRef.current);

				setIfscLookupError(null);
				setValues((prev) => ({
					...prev,
					ifscCode: cleaned,
					bankName: "",
					branchName: "",
					city: "",
					isIFSCValid: false,
					ifscBlacklistedError: null,
				}));
				setErrors((prev) => {
					const next = { ...prev };
					delete next.ifscCode;
					return next;
				});

				if (cleaned.length === 11 && IFSC_REGEX.test(cleaned)) {
					requestedIfscRef.current = cleaned;
					ifscTimerRef.current = setTimeout(() => {
						Logger.debug("Looking up IFSC (debounced)", { ifsc: cleaned });
						void runIfscLookup(cleaned);
					}, 300);
				} else {
					requestedIfscRef.current = "";
					setIsLookingUpIFSC(false);
				}
				return;
			}

			if (field === "accountType") {
				const normalized = rawValue === "current" ? "current" : "savings";
				setValues((prev) => ({ ...prev, accountType: normalized }));
				setErrors((prev) => {
					const next = { ...prev };
					delete next.accountType;
					return next;
				});
			}
		},
		[runIfscLookup, t],
	);

	const validate = useCallback((): boolean => {
		const res = validateBankFormFields(values);
		if (!res.isValid) {
			const translated: Partial<Record<BankFormErrorKey, string>> = {};
			(Object.entries(res.errors) as [BankFormErrorKey, string][]).forEach(([k, val]) => {
				if (k === "ifscCode" && values.ifscBlacklistedError === val) {
					translated[k] = val;
				} else {
					translated[k] = t(val as any, val);
				}
			});
			setErrors(translated);
		} else {
			setErrors({});
		}
		return res.isValid;
	}, [t, values]);

	const reset = useCallback(
		(nextAccountHolderName?: string) => {
			if (ifscTimerRef.current) clearTimeout(ifscTimerRef.current);
			requestedIfscRef.current = "";
			latestNumbersRef.current = { accountNumber: "", confirmAccountNumber: "" };
			hasUserEditedHolderRef.current = false;
			const seed = String(
				nextAccountHolderName !== undefined ? nextAccountHolderName : initialAccountHolderName,
			).trim();
			setValues({ ...INITIAL_VALUES, accountHolderName: seed });
			setErrors({});
			setIsLookingUpIFSC(false);
			setIfscLookupError(null);
		},
		[initialAccountHolderName],
	);

	return {
		values,
		errors,
		isLookingUpIFSC,
		ifscLookupError,
		handleFieldChange,
		setFieldErrors: setErrors,
		validate,
		reset,
	};
}

interface BankAccountFormProps {
	accountHolderName?: string;
	form: UseBankFormControllerResult;
	disabled?: boolean;
	scrollViewRef?: React.RefObject<ScrollViewRef | null>;
	scrollYRef?: React.RefObject<number>;
}

export const BankAccountForm: React.FC<BankAccountFormProps> = ({
	form,
	disabled = false,
	scrollViewRef,
	scrollYRef,
}) => {
	const { t } = useTranslation();
	const { values, errors, isLookingUpIFSC, ifscLookupError, handleFieldChange } = form;

	const [showAccountNumber, setShowAccountNumber] = useState(false);
	const [showConfirmAccountNumber, setShowConfirmAccountNumber] = useState(false);
	const [focusedField, setFocusedField] = useState<string | null>(null);
	const fieldOffsetsRef = useRef<Record<string, number>>({});
	const cardOffsetsRef = useRef<{ holder: number; details: number }>({ holder: 0, details: 0 });
	const fieldNodesRef = useRef<Record<string, React.ComponentRef<typeof View> | null>>({});
	const activeFieldRef = useRef<string | null>(null);
	const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const scrollFieldIntoView = useCallback(
		(key: string) => {
			const scrollNode = scrollViewRef?.current as any;
			if (!scrollNode || typeof scrollNode.scrollTo !== "function") return;

			const scrollToFallback = () => {
				const sectionY =
					key === "accountHolderName"
						? cardOffsetsRef.current.holder
						: cardOffsetsRef.current.details;
				const innerY = fieldOffsetsRef.current[key] ?? 0;
				scrollNode.scrollTo({
					y: Math.max(0, sectionY + innerY - 12),
					animated: true,
				});
			};

			const targetNode = fieldNodesRef.current[key] as any;
			if (
				targetNode &&
				typeof targetNode.measure === "function" &&
				typeof scrollNode.measure === "function"
			) {
				try {
					targetNode.measure(
						(_x: number, _y: number, _w: number, h: number, _px: number, fieldPageY: number) => {
							if (typeof fieldPageY !== "number" || fieldPageY <= 0) {
								scrollToFallback();
								return;
							}
							scrollNode.measure(
								(
									_sx: number,
									_sy: number,
									_sw: number,
									scrollHeight: number,
									_spx: number,
									scrollPageY: number,
								) => {
									if (typeof scrollPageY !== "number" || typeof scrollHeight !== "number" || scrollHeight <= 0) {
										scrollToFallback();
										return;
									}
									const distanceInView = fieldPageY - scrollPageY;
									const extraBottomClearance = key === "ifscCode" ? 96 : 24;
									const currentScrollY = scrollYRef?.current ?? 0;
									if (
										distanceInView < 12 ||
										distanceInView + h + extraBottomClearance > scrollHeight
									) {
										const targetY = Math.max(0, currentScrollY + distanceInView - 16);
										scrollNode.scrollTo({ y: targetY, animated: true });
									}
								},
							);
						},
					);
					return;
				} catch {
					scrollToFallback();
					return;
				}
			}

			scrollToFallback();
		},
		[scrollViewRef, scrollYRef],
	);

	useEffect(() => {
		const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
		const sub = Keyboard.addListener(showEvent, () => {
			const activeKey = activeFieldRef.current;
			if (!activeKey) return;
			if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
			focusTimerRef.current = setTimeout(() => {
				if (activeFieldRef.current === activeKey) {
					scrollFieldIntoView(activeKey);
				}
			}, 90);
		});
		return () => {
			sub.remove();
			if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
		};
	}, [scrollFieldIntoView]);

	const scrollToField = (key: string) => {
		setFocusedField(key);
		activeFieldRef.current = key;
		if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
		focusTimerRef.current = setTimeout(() => {
			if (activeFieldRef.current === key) {
				scrollFieldIntoView(key);
			}
		}, 120);
	};

	const handleFieldBlur = (key: string) => {
		setFocusedField((prev) => (prev === key ? null : prev));
		if (activeFieldRef.current === key) {
			activeFieldRef.current = null;
		}
	};

	const accLen = values.accountNumber.length;
	const isAccLengthValid = accLen >= 9 && accLen <= 18;
	const hasConfirm = values.confirmAccountNumber.length > 0;
	const numbersMatch = hasConfirm && values.accountNumber === values.confirmAccountNumber;

	return (
		<View style={styles.root}>
			{/* Section 1: Editable Account Holder Card */}
			<View style={styles.sectionHeader}>
				<Text style={styles.sectionEyebrow}>
					{t("accountHolderSectionLabel", "ACCOUNT HOLDER")}
				</Text>
			</View>

			<View
				style={styles.card}
				onLayout={(e) => {
					cardOffsetsRef.current.holder = e.nativeEvent.layout.y;
				}}
			>
				<View
					ref={(node) => {
						fieldNodesRef.current.accountHolderName = node;
					}}
					collapsable={false}
					onLayout={(e) => {
						fieldOffsetsRef.current.accountHolderName = e.nativeEvent.layout.y;
					}}
				>
					<View style={styles.labelRow}>
						<Text style={styles.fieldLabel}>
							{t("accountHolderName", "Account Holder Name")}
						</Text>
					</View>

					<View
						style={[
							styles.inputWrapper,
							focusedField === "accountHolderName" && styles.inputWrapperFocused,
							Boolean(errors.accountHolderName) && styles.inputWrapperError,
						]}
					>
						<TextInput
							style={styles.input}
							value={values.accountHolderName}
							onChangeText={(val) => handleFieldChange("accountHolderName", val)}
							onFocus={() => scrollToField("accountHolderName")}
							onBlur={() => handleFieldBlur("accountHolderName")}
							placeholder={t("accountHolderNamePlaceholder", "Enter account holder name")}
							placeholderTextColor="#94A3B8"
							autoCapitalize="words"
							autoCorrect={false}
							maxLength={100}
							editable={!disabled}
							accessibilityLabel={t("accountHolderName", "Account Holder Name")}
						/>
					</View>

					<Text style={styles.holderHelperText}>
						{t("accountHolderHint", "Enter the name as registered on your bank account.")}
					</Text>

					{errors.accountHolderName ? (
						<Text accessibilityLiveRegion="polite" style={styles.errorText}>
							{errors.accountHolderName}
						</Text>
					) : null}
				</View>
			</View>

			{/* Section 2: Bank Account Details Card */}
			<View
				style={styles.card}
				onLayout={(e) => {
					cardOffsetsRef.current.details = e.nativeEvent.layout.y;
				}}
			>
				{/* Bank Account Number */}
				<View
					ref={(node) => {
						fieldNodesRef.current.accountNumber = node;
					}}
					collapsable={false}
					onLayout={(e) => {
						fieldOffsetsRef.current.accountNumber = e.nativeEvent.layout.y;
					}}
				>
					<View style={styles.labelRow}>
						<Text style={styles.fieldLabel}>
							{t("bankAccountNumber", "Bank Account Number")}
						</Text>
						<View style={[styles.countPill, isAccLengthValid && styles.countPillValid]}>
							<Text style={[styles.countPillText, isAccLengthValid && styles.countPillTextValid]}>
								{accLen}/18 {t("digitsSuffix", "Digits")}
							</Text>
						</View>
					</View>

					<View
						style={[
							styles.inputWrapper,
							focusedField === "accountNumber" && styles.inputWrapperFocused,
							Boolean(errors.accountNumber) && styles.inputWrapperError,
						]}
					>
						<TextInput
							style={[styles.input, !showAccountNumber && styles.maskedTracking]}
							value={values.accountNumber}
							onChangeText={(val) => handleFieldChange("accountNumber", val)}
							onFocus={() => scrollToField("accountNumber")}
							onBlur={() => handleFieldBlur("accountNumber")}
							placeholder={t("bankAccountNumberPlaceholder", "Enter 9 to 18 digit account number")}
							placeholderTextColor="#94A3B8"
							keyboardType="number-pad"
							maxLength={18}
							secureTextEntry={!showAccountNumber}
							contextMenuHidden={true}
							selectTextOnFocus={false}
							editable={!disabled}
							accessibilityLabel={t("bankAccountNumber", "Bank Account Number")}
						/>
						<TouchableOpacity
							accessibilityRole="button"
							accessibilityLabel={showAccountNumber ? "Hide account number" : "Show account number"}
							hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
							onPress={() => setShowAccountNumber((p) => !p)}
							style={styles.inputIconBtn}
							disabled={disabled}
						>
							<Ionicons
								name={showAccountNumber ? "eye-outline" : "eye-off-outline"}
								size={19}
								color="#64748B"
							/>
						</TouchableOpacity>
					</View>

					<View style={styles.safetyHintRow}>
						<Ionicons name="lock-closed-outline" size={12} color="#64748B" />
						<Text style={styles.safetyHintText}>
							{t("pasteDisabledSafety", "Please type it manually; pasting is disabled for safety.")}
						</Text>
					</View>

					{errors.accountNumber ? (
						<Text accessibilityLiveRegion="polite" style={styles.errorText}>
							{errors.accountNumber}
						</Text>
					) : null}
				</View>

				{/* Re-enter Account Number */}
				<View
					ref={(node) => {
						fieldNodesRef.current.confirmAccountNumber = node;
					}}
					collapsable={false}
					onLayout={(e) => {
						fieldOffsetsRef.current.confirmAccountNumber = e.nativeEvent.layout.y;
					}}
				>
					<View style={styles.labelRow}>
						<Text style={styles.fieldLabel}>
							{t("reEnterBankAccountNumber", "Re-enter Account Number")}
						</Text>
						{hasConfirm ? (
							<View style={[styles.matchPill, numbersMatch ? styles.matchPillOk : styles.matchPillBad]}>
								<Ionicons
									name={numbersMatch ? "checkmark" : "close"}
									size={12}
									color={numbersMatch ? "#047857" : "#B91C1C"}
								/>
								<Text
									style={[
										styles.matchPillText,
										numbersMatch ? styles.matchPillTextOk : styles.matchPillTextBad,
									]}
								>
									{numbersMatch
										? t("numbersMatch", "Numbers match")
										: t("numbersDontMatch", "Numbers don't match")}
								</Text>
							</View>
						) : null}
					</View>

					<View
						style={[
							styles.inputWrapper,
							focusedField === "confirmAccountNumber" && styles.inputWrapperFocused,
							numbersMatch && styles.inputWrapperMatch,
							(Boolean(errors.confirmAccountNumber) || (hasConfirm && !numbersMatch)) &&
								styles.inputWrapperError,
						]}
					>
						<TextInput
							style={[styles.input, !showConfirmAccountNumber && styles.maskedTracking]}
							value={values.confirmAccountNumber}
							onChangeText={(val) => handleFieldChange("confirmAccountNumber", val)}
							onFocus={() => scrollToField("confirmAccountNumber")}
							onBlur={() => handleFieldBlur("confirmAccountNumber")}
							placeholder={t("reEnterBankAccountNumber", "Re-enter account number")}
							placeholderTextColor="#94A3B8"
							keyboardType="number-pad"
							maxLength={18}
							secureTextEntry={!showConfirmAccountNumber}
							contextMenuHidden={true}
							selectTextOnFocus={false}
							editable={!disabled}
							accessibilityLabel={t("reEnterBankAccountNumber", "Re-enter Account Number")}
						/>
						<TouchableOpacity
							accessibilityRole="button"
							accessibilityLabel={
								showConfirmAccountNumber
									? "Hide confirmation number"
									: "Show confirmation number"
							}
							hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
							onPress={() => setShowConfirmAccountNumber((p) => !p)}
							style={styles.inputIconBtn}
							disabled={disabled}
						>
							<Ionicons
								name={showConfirmAccountNumber ? "eye-outline" : "eye-off-outline"}
								size={19}
								color={numbersMatch ? "#059669" : "#64748B"}
							/>
						</TouchableOpacity>
					</View>

					{errors.confirmAccountNumber ? (
						<Text accessibilityLiveRegion="polite" style={styles.errorText}>
							{errors.confirmAccountNumber}
						</Text>
					) : null}
				</View>

				{/* Account Type Chips (Savings / Current only) */}
				<View>
					<Text style={[styles.fieldLabel, { marginBottom: 8 }]}>
						{t("accountType", "Account Type")}
					</Text>
					<View style={styles.typeGrid}>
						{(["savings", "current"] as const).map((typeKey) => {
							const selected = values.accountType === typeKey;
							const label =
								typeKey === "savings"
									? t("savingsShort", "Savings")
									: t("currentShort", "Current");
							return (
								<Pressable
									key={typeKey}
									accessibilityRole="radio"
									accessibilityState={{ selected, disabled }}
									accessibilityLabel={label}
									disabled={disabled}
									onPress={() => handleFieldChange("accountType", typeKey)}
									style={[
										styles.typeChip,
										selected ? styles.typeChipSelected : styles.typeChipDefault,
									]}
								>
									<View style={selected ? styles.typeRadioSelected : styles.typeRadioDefault}>
										{selected ? <View style={styles.typeRadioInner} /> : null}
									</View>
									<Text
										style={[
											styles.typeChipText,
											selected ? styles.typeChipTextSelected : styles.typeChipTextDefault,
										]}
									>
										{label}
									</Text>
								</Pressable>
							);
						})}
					</View>
					{errors.accountType ? (
						<Text accessibilityLiveRegion="polite" style={styles.errorText}>
							{errors.accountType}
						</Text>
					) : null}
				</View>

				{/* IFSC Code + Instant Lookup Mini-Card */}
				<View
					ref={(node) => {
						fieldNodesRef.current.ifscCode = node;
					}}
					collapsable={false}
					onLayout={(e) => {
						fieldOffsetsRef.current.ifscCode = e.nativeEvent.layout.y;
					}}
				>
					<View style={styles.labelRow}>
						<Text style={styles.fieldLabel}>{t("ifscCode", "IFSC Code")}</Text>
						<Text style={styles.ifscFormatHint}>
							{t("ifscHelperFormat", "11 characters (e.g. HDFC0000128)")}
						</Text>
					</View>

					<View
						style={[
							styles.inputWrapper,
							focusedField === "ifscCode" && styles.inputWrapperFocused,
							values.isIFSCValid && styles.inputWrapperMatch,
							Boolean(errors.ifscCode || ifscLookupError) && styles.inputWrapperError,
						]}
					>
						<TextInput
							style={[styles.input, styles.ifscInput]}
							value={values.ifscCode}
							onChangeText={(val) => handleFieldChange("ifscCode", val)}
							onFocus={() => scrollToField("ifscCode")}
							onBlur={() => handleFieldBlur("ifscCode")}
							placeholder="e.g. HDFC0000128"
							placeholderTextColor="#94A3B8"
							autoCapitalize="characters"
							autoCorrect={false}
							maxLength={11}
							editable={!disabled}
							accessibilityLabel={t("ifscCode", "IFSC Code")}
						/>
						<View style={styles.ifscRightSlot}>
							{isLookingUpIFSC ? (
								<ActivityIndicator size="small" color="#059669" />
							) : values.isIFSCValid ? (
								<Ionicons name="checkmark-circle" size={20} color="#059669" />
							) : null}
						</View>
					</View>

					{/* Shimmer placeholder while looking up IFSC */}
					{isLookingUpIFSC ? (
						<View style={styles.shimmerCard}>
							<View style={styles.shimmerIcon} />
							<View style={styles.shimmerLines}>
								<View style={styles.shimmerLineWide} />
								<View style={styles.shimmerLineNarrow} />
							</View>
						</View>
					) : null}

					{/* Auto-filled Bank Mini-Card (strictly Bank Name, Branch, City + Auto-filled chip) */}
					{!isLookingUpIFSC && values.isIFSCValid && values.bankName ? (
						<View style={styles.ifscSuccessCard}>
							<View style={styles.ifscBankIcon}>
								<MaterialCommunityIcons name="bank-outline" size={18} color="#FFFFFF" />
							</View>
							<View style={styles.ifscDetailsCol}>
								<View style={styles.ifscTitleRow}>
									<Text numberOfLines={1} style={styles.ifscBankName}>
										{values.bankName}
									</Text>
									<View style={styles.autoFilledChip}>
										<Text style={styles.autoFilledChipText}>
											{t("autoFilledChip", "Auto-filled")}
										</Text>
									</View>
								</View>
								<Text numberOfLines={2} style={styles.ifscBranchCity}>
									{[values.branchName, values.city].filter(Boolean).join(" · ")}
								</Text>
							</View>
						</View>
					) : null}

					{errors.ifscCode || ifscLookupError ? (
						<Text accessibilityLiveRegion="polite" style={styles.errorText}>
							{errors.ifscCode || ifscLookupError}
						</Text>
					) : null}
				</View>
			</View>
		</View>
	);
};

const styles = StyleSheet.create({
	root: {
		gap: 12,
	},
	sectionHeader: {
		paddingHorizontal: 4,
	},
	sectionEyebrow: {
		...primaryFont("bold"),
		fontSize: 11,
		letterSpacing: 0.7,
		color: "#64748B",
		textTransform: "uppercase",
		includeFontPadding: false,
	},
	card: {
		backgroundColor: "#FFFFFF",
		borderRadius: 16,
		padding: 16,
		borderWidth: 1,
		borderColor: "#E2E8F0",
		shadowColor: "#000000",
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.04,
		shadowRadius: 4,
		elevation: 1,
		gap: 16,
	},
	labelRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		marginBottom: 6,
		gap: 8,
		flexWrap: "wrap",
	},
	fieldLabel: {
		...primaryFont("bold"),
		fontSize: 12,
		color: "#334155",
		includeFontPadding: false,
	},
	holderHelperText: {
		...primaryFont("medium"),
		fontSize: 11,
		color: "#64748B",
		marginTop: 6,
		includeFontPadding: false,
	},
	countPill: {
		backgroundColor: "#F1F5F9",
		borderRadius: 6,
		paddingHorizontal: 6,
		paddingVertical: 2,
	},
	countPillValid: {
		backgroundColor: "#ECFDF5",
	},
	countPillText: {
		...primaryFont("medium"),
		fontSize: 11,
		color: "#64748B",
		includeFontPadding: false,
	},
	countPillTextValid: {
		color: "#047857",
	},
	inputWrapper: {
		height: 48,
		borderRadius: 12,
		borderWidth: 1,
		borderColor: "#CBD5E1",
		backgroundColor: "#FFFFFF",
		flexDirection: "row",
		alignItems: "center",
		paddingLeft: 14,
		paddingRight: 8,
	},
	inputWrapperFocused: {
		borderWidth: 2,
		borderColor: "#059669",
	},
	inputWrapperMatch: {
		borderColor: "#10B981",
	},
	inputWrapperError: {
		borderWidth: 1.5,
		borderColor: "#E5484D",
	},
	input: {
		flex: 1,
		height: "100%",
		...primaryFont("semibold"),
		fontSize: 14,
		color: "#0F172A",
		paddingVertical: 0,
	},
	maskedTracking: {
		letterSpacing: 1.4,
	},
	ifscInput: {
		...primaryFont("bold"),
		letterSpacing: 0.8,
	},
	inputIconBtn: {
		width: 40,
		height: 40,
		alignItems: "center",
		justifyContent: "center",
	},
	ifscRightSlot: {
		width: 32,
		height: 32,
		alignItems: "center",
		justifyContent: "center",
	},
	safetyHintRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 4,
		marginTop: 6,
	},
	safetyHintText: {
		...primaryFont("regular"),
		fontSize: 11,
		color: "#64748B",
		flex: 1,
		includeFontPadding: false,
	},
	matchPill: {
		flexDirection: "row",
		alignItems: "center",
		gap: 4,
		paddingHorizontal: 8,
		paddingVertical: 2,
		borderRadius: 999,
		borderWidth: 1,
	},
	matchPillOk: {
		backgroundColor: "#ECFDF5",
		borderColor: "#A7F3D0",
	},
	matchPillBad: {
		backgroundColor: "#FEF2F2",
		borderColor: "#FECACA",
	},
	matchPillText: {
		...primaryFont("bold"),
		fontSize: 11,
		includeFontPadding: false,
	},
	matchPillTextOk: {
		color: "#047857",
	},
	matchPillTextBad: {
		color: "#B91C1C",
	},
	typeGrid: {
		flexDirection: "row",
		gap: 10,
	},
	typeChip: {
		flex: 1,
		minHeight: 48,
		borderRadius: 12,
		paddingHorizontal: 12,
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
	},
	typeChipSelected: {
		borderWidth: 2,
		borderColor: "#059669",
		backgroundColor: "#ECFDF5",
	},
	typeChipDefault: {
		borderWidth: 1,
		borderColor: "#E2E8F0",
		backgroundColor: "#F8FAFC",
	},
	typeRadioSelected: {
		width: 16,
		height: 16,
		borderRadius: 8,
		backgroundColor: "#059669",
		alignItems: "center",
		justifyContent: "center",
	},
	typeRadioInner: {
		width: 6,
		height: 6,
		borderRadius: 3,
		backgroundColor: "#FFFFFF",
	},
	typeRadioDefault: {
		width: 16,
		height: 16,
		borderRadius: 8,
		borderWidth: 1.5,
		borderColor: "#94A3B8",
		backgroundColor: "#FFFFFF",
	},
	typeChipText: {
		fontSize: 13,
		includeFontPadding: false,
	},
	typeChipTextSelected: {
		...primaryFont("bold"),
		color: "#0F172A",
	},
	typeChipTextDefault: {
		...primaryFont("semibold"),
		color: "#334155",
	},
	ifscFormatHint: {
		...primaryFont("medium"),
		fontSize: 11,
		color: "#64748B",
		includeFontPadding: false,
	},
	shimmerCard: {
		marginTop: 10,
		borderRadius: 12,
		padding: 12,
		borderWidth: 1,
		borderColor: "#E2E8F0",
		backgroundColor: "#F8FAFC",
		flexDirection: "row",
		alignItems: "center",
		gap: 10,
	},
	shimmerIcon: {
		width: 32,
		height: 32,
		borderRadius: 8,
		backgroundColor: "#E2E8F0",
	},
	shimmerLines: {
		flex: 1,
		gap: 6,
	},
	shimmerLineWide: {
		height: 12,
		width: "65%",
		borderRadius: 6,
		backgroundColor: "#E2E8F0",
	},
	shimmerLineNarrow: {
		height: 10,
		width: "45%",
		borderRadius: 5,
		backgroundColor: "#E2E8F0",
	},
	ifscSuccessCard: {
		marginTop: 10,
		borderRadius: 12,
		padding: 12,
		borderWidth: 1,
		borderColor: "#A7F3D0",
		backgroundColor: "#F8FAFC",
		flexDirection: "row",
		alignItems: "flex-start",
		gap: 10,
	},
	ifscBankIcon: {
		width: 32,
		height: 32,
		borderRadius: 8,
		backgroundColor: "#059669",
		alignItems: "center",
		justifyContent: "center",
		flexShrink: 0,
	},
	ifscDetailsCol: {
		flex: 1,
		minWidth: 0,
	},
	ifscTitleRow: {
		flexDirection: "row",
		alignItems: "center",
		flexWrap: "wrap",
		gap: 6,
	},
	ifscBankName: {
		...primaryFont("bold"),
		fontSize: 12,
		color: "#0F172A",
		flexShrink: 1,
		includeFontPadding: false,
	},
	autoFilledChip: {
		backgroundColor: "#DCFCE7",
		paddingHorizontal: 6,
		paddingVertical: 2,
		borderRadius: 4,
	},
	autoFilledChipText: {
		...primaryFont("extraBold"),
		fontSize: 9,
		color: "#065F46",
		textTransform: "uppercase",
		includeFontPadding: false,
	},
	ifscBranchCity: {
		...primaryFont("medium"),
		fontSize: 11,
		color: "#475569",
		marginTop: 3,
		includeFontPadding: false,
	},
	errorText: {
		...primaryFont("medium"),
		fontSize: 11,
		color: "#E5484D",
		marginTop: 5,
		includeFontPadding: false,
	},
});

export default BankAccountForm;
