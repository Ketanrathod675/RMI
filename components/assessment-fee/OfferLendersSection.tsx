import { TranslatedText } from "@/components/TranslatedText";
import { dark, white } from "@/constants/Colors";
import { Images } from "@/constants/images";
import { useTranslation } from "@/hooks/useTranslation";
import { font, height, width } from "@/utils/dimensions";
import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import React, { useEffect, useRef, useState } from "react";
import {
	ActivityIndicator,
	Animated,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from "react-native";

export type LenderOffer = {
	lender_id: string;
	lender_name: string;
	is_rbi_nbfc?: boolean;
	loan_upto?: number;
	tenure_upto?: number;
	interest_rate_starts_at?: string;
};

interface OfferLendersSectionProps {
	primaryLender?: LenderOffer;
	isLoadingLender?: boolean;
	lenderLookupFailed?: boolean;
	onRetryLender?: () => void;
	isLoadingFee: boolean;
	processingFeeAmount: number;
	originalPrice?: number;
	discountPercent?: number;
	offerMinutes?: string;
	offerSeconds?: string;
	onBackPress: () => void;
}

const formatAmount = (amount: number): string => {
	return new Intl.NumberFormat("en-IN", {
		style: "currency",
		currency: "INR",
		minimumFractionDigits: 0,
		maximumFractionDigits: 0,
	}).format(amount);
};

export const OfferLendersSection: React.FC<OfferLendersSectionProps> = ({
	primaryLender,
	isLoadingLender,
	lenderLookupFailed,
	onRetryLender,
	isLoadingFee,
	processingFeeAmount,
	originalPrice,
	discountPercent,
	offerMinutes,
	offerSeconds,
	onBackPress,
}) => {
	const { t, isHindi } = useTranslation();
	const [isLenderExpanded, setIsLenderExpanded] = useState(false);
	const shimmerAnim = useRef(new Animated.Value(0.35)).current;

	useEffect(() => {
		let anim: Animated.CompositeAnimation | null = null;
		if (isLoadingLender && !primaryLender) {
			anim = Animated.loop(
				Animated.sequence([
					Animated.timing(shimmerAnim, {
						toValue: 1,
						duration: 800,
						useNativeDriver: true,
					}),
					Animated.timing(shimmerAnim, {
						toValue: 0.35,
						duration: 800,
						useNativeDriver: true,
					}),
				])
			);
			anim.start();
		}
		return () => {
			if (anim) anim.stop();
		};
	}, [isLoadingLender, primaryLender, shimmerAnim]);

	const actualOriginalPrice = originalPrice;
	const actualDiscountPercent =
		discountPercent ??
		(actualOriginalPrice && actualOriginalPrice > processingFeeAmount
			? Math.max(
				1,
				Math.round(
					((actualOriginalPrice - processingFeeAmount) / actualOriginalPrice) * 100
				)
			)
			: 0);

	const getLocalText = (key: string, defaultText: string): string => {
		if (isHindi) {
			switch (key) {
				case "eligibleLenders":
					return "योग्य ऋणदाता";
				case "approvedLenders":
					return "स्वीकृत ऋणदाता";
				case "loanUpto":
					return "ऋण सीमा";
				case "tenureUpto":
					return "अवधि सीमा";
				case "interestRate":
					return "ब्याज दर";
				case "rbiRegisteredNbfc":
					return "आरबीआई पंजीकृत एनबीएफसी";
				case "assessmentFee":
					return "मूल्यांकन शुल्क";
				case "assessmentFeeNonRefundable":
					return "नोट: मूल्यांकन शुल्क गैर-वापसी योग्य है";
				case "offerEndsIn":
					return "ऑफ़र समाप्त होने में समय:";
				default:
					return defaultText;
			}
		}
		return defaultText;
	};

	const getLenderLogo = (name?: string) => {
		const lowerName = (name || "").toLowerCase();
		if (lowerName.includes("ru loans") || lowerName.includes("ruloans")) {
			return require("@/assets/images/ruloans.png");
		}
		if (lowerName.includes("fintree")) {
			return require("@/assets/images/fintree.png");
		}
		if (lowerName.includes("emkay")) {
			return require("@/assets/images/emkaylogo.png");
		}
		return require("@/assets/images/rapid-money-logo.png");
	};

	const formatTenureValue = (tenure: number) => {
		return `${tenure} ${t("days") || "Days"}`;
	};

	const displayLoanAmount = primaryLender?.loan_upto
		? formatAmount(primaryLender.loan_upto) + "/-"
		: undefined;

	const hasDetails = Boolean(
		primaryLender &&
		(primaryLender.loan_upto !== undefined ||
			primaryLender.tenure_upto !== undefined ||
			primaryLender.interest_rate_starts_at !== undefined ||
			primaryLender.is_rbi_nbfc === true)
	);

	return (
		<View>
			{/* Top Banner with coins and pre-qualified amount */}
			<View style={styles.bannerContainer}>
				<Image
					source={Images.NEW_ASSESSMENT_BANNER}
					style={styles.banner}
					contentFit="cover"
				/>
				<Image
					source={Images.RUPEE_COIN}
					style={[styles.coin, styles.rupeeCoin1]}
					contentFit="contain"
				/>
				<Image
					source={Images.RUPEE_COIN}
					style={[styles.coin, styles.rupeeCoin3]}
					contentFit="contain"
				/>
				<Image
					source={Images.RUPEE_COIN}
					style={[styles.coin, styles.rupeeCoin4]}
					contentFit="contain"
				/>
				<Image
					source={Images.RUPEE_COIN}
					style={[styles.coin, styles.rupeeCoin6]}
					contentFit="contain"
				/>

				{/* Back button */}
				<TouchableOpacity style={styles.backButton} onPress={onBackPress}>
					<MaterialIcons name="arrow-back" size={24} color="white" />
				</TouchableOpacity>

				{/* Congratulations text */}
				<View style={styles.textContainer}>
					<Text style={styles.congratsText}>
						<TranslatedText translationKey="congratulations" />
					</Text>

					<Text style={styles.subText}>
						<TranslatedText translationKey="youArePreQualifiedForLoanUpTo" />
						<Text style={styles.boldGreenText}>
							<TranslatedText translationKey="preQualified" />
						</Text>
						<TranslatedText translationKey="forLoanFromOurLendingPartner" />
					</Text>

					{displayLoanAmount ? (
						<View style={styles.amountBlockCentered}>
							<View style={styles.loanAmountContainer}>
								<Text style={styles.loanAmountText}>{displayLoanAmount}</Text>
							</View>
						</View>
					) : null}
				</View>
			</View>

			{/* Assessment Fee Card */}
			<View style={styles.assessmentFeeContainer}>
				{actualOriginalPrice && actualDiscountPercent > 0 ? (
					<View style={styles.discountBadge}>
						<Text style={styles.discountBadgeText}>{actualDiscountPercent}% Off</Text>
					</View>
				) : null}
				{offerMinutes && offerSeconds ? (
					<View style={styles.offerEndsContainer}>
						<Image
							source={Images.TIMER_ICON}
							style={{ width: width(4), height: width(4) }}
						/>
						<Text style={styles.offerEndsText}>
							{getLocalText("offerEndsIn", "Offer ends in")} {offerMinutes}:{offerSeconds}
						</Text>
					</View>
				) : null}
				<View style={styles.assessmentFeeRow}>
					{isLoadingFee ? (
						<ActivityIndicator size="small" color="#333" />
					) : (
						<>
							<Text style={styles.feeLabel}>
								{getLocalText("assessmentFee", "Assessment Fee")} :
							</Text>
							<View style={styles.assessmentFeePriceRow}>
								{actualOriginalPrice && actualOriginalPrice > processingFeeAmount ? (
									<Text style={styles.strikethroughPrice}>₹{actualOriginalPrice}</Text>
								) : null}
								<Text style={styles.actualPrice}>₹{processingFeeAmount}/-</Text>
							</View>
						</>
					)}
				</View>
			</View>

			<Text style={styles.nonRefundableText}>
				{getLocalText("assessmentFeeNonRefundable", "Note: Assessment fee is non-refundable")}
			</Text>

			{/* Primary Eligible Lender Card Section */}
			<View style={styles.lendersSection}>
				<View style={styles.lendersHeader}>
					<Text style={styles.lendersTitle}>
						{getLocalText("eligibleLenders", "Eligible Lenders")}
					</Text>
				</View>

				{isLoadingLender && !primaryLender ? (
					/* Skeleton / Shimmer Card */
					<Animated.View style={[styles.lenderCard, { opacity: shimmerAnim }]}>
						<View style={styles.lenderCardHeader}>
							<View style={styles.skeletonLogo} />
							<View style={styles.lenderHeaderInfo}>
								<View style={styles.skeletonLineShort} />
								<View style={styles.skeletonLineLong} />
							</View>
						</View>
					</Animated.View>
				) : lenderLookupFailed && !primaryLender ? (
					/* Neutral Card when lookup failed */
					<View style={[styles.lenderCard, styles.failedCard]}>
						<View style={styles.failedRow}>
							<MaterialCommunityIcons name="clock-outline" size={22} color="#64748B" />
							<Text style={styles.failedText}>
								{t("yourLenderIsBeingAssigned", "Your lender is being assigned")}
							</Text>
							{onRetryLender && (
								<TouchableOpacity
									onPress={onRetryLender}
									style={styles.retryBtn}
									hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
									<Text style={styles.retryBtnText}>{t("tryAgain", "Retry")}</Text>
								</TouchableOpacity>
							)}
						</View>
					</View>
				) : primaryLender ? (
					/* Known Assigned Lender Card */
					<TouchableOpacity
						style={[
							styles.lenderCard,
							hasDetails && isLenderExpanded && styles.lenderCardExpanded,
						]}
						onPress={() => hasDetails && setIsLenderExpanded(!isLenderExpanded)}
						activeOpacity={hasDetails ? 0.9 : 1}
						disabled={!hasDetails}>
						<View style={styles.lenderCardHeader}>
							<Image
								source={getLenderLogo(primaryLender.lender_name)}
								style={
									primaryLender.lender_name.toLowerCase().includes("emkay")
										? styles.emkayLenderLogo
										: styles.lenderLogo
								}
								contentFit="contain"
							/>
							<View style={styles.lenderHeaderInfo}>
								<Text style={styles.approvedLendersLabel}>
									{getLocalText("approvedLenders", "Approved Lenders")}
								</Text>
								<Text style={styles.lenderNameText}>
									{primaryLender.lender_name}
								</Text>
							</View>
							{hasDetails && (
								<MaterialIcons
									name={isLenderExpanded ? "keyboard-arrow-up" : "keyboard-arrow-down"}
									size={24}
									color="#333"
								/>
							)}
						</View>

						{hasDetails && isLenderExpanded && (
							<View style={styles.lenderDetailsContainer}>
								{(primaryLender.loan_upto !== undefined ||
									primaryLender.tenure_upto !== undefined ||
									primaryLender.interest_rate_starts_at !== undefined) && (
									<View style={styles.whiteDetailsCard}>
										<View style={styles.detailsGrid}>
											{primaryLender.loan_upto !== undefined && (
												<View style={styles.detailsColumnLeft}>
													<Text style={styles.detailLabel}>
														{getLocalText("loanUpto", "Loan Upto")}
													</Text>
													<Text style={styles.detailValue}>
														{formatAmount(primaryLender.loan_upto)}
													</Text>
												</View>
											)}
											{primaryLender.tenure_upto !== undefined && (
												<View style={styles.detailsColumnCenter}>
													<Text style={[styles.detailLabel, { textAlign: "center" }]}>
														{getLocalText("tenureUpto", "Tenure Upto")}
													</Text>
													<Text style={[styles.detailValue, { textAlign: "center" }]}>
														{formatTenureValue(primaryLender.tenure_upto)}
													</Text>
												</View>
											)}
											{primaryLender.interest_rate_starts_at !== undefined && (
												<View style={styles.detailsColumnRight}>
													<Text style={[styles.detailLabel, { textAlign: "right" }]}>
														{getLocalText("interestRate", "Interest Rate")}
													</Text>
													<Text style={[styles.detailValue, { textAlign: "right" }]}>
														{primaryLender.interest_rate_starts_at}
													</Text>
												</View>
											)}
										</View>
									</View>
								)}

								{primaryLender.is_rbi_nbfc === true && (
									<View style={styles.nbfcBadgeContainer}>
										<MaterialCommunityIcons
											name="shield-check"
											size={18}
											color="#005BBA"
										/>
										<Text style={styles.nbfcBadgeText}>
											{getLocalText("rbiRegisteredNbfc", "RBI Registered NBFC")}
										</Text>
									</View>
								)}
							</View>
						)}
					</TouchableOpacity>
				) : null}
			</View>

			{/* Consent Disclaimer */}
			<View style={styles.consentContainer}>
				<Text style={styles.consentText}>
					{t("consentAssessmentFeeNew")}
				</Text>
			</View>
		</View>
	);
};

const styles = StyleSheet.create({
	bannerContainer: {
		width: "100%",
		alignItems: "center",
		position: "relative",
		backgroundColor: "#EAF2D7",
		zIndex: 10,
	},
	banner: {
		width: "100%",
		height: height(40),
		overflow: "hidden",
		borderBottomLeftRadius: width(10),
		borderBottomRightRadius: width(10),
		backgroundColor: "#033120",
	},
	coin: {
		position: "absolute",
		width: width(6),
		height: width(6),
	},
	rupeeCoin1: {
		top: height(8),
		left: width(15),
	},
	rupeeCoin3: {
		bottom: height(10),
		left: width(8),
	},
	rupeeCoin4: {
		bottom: height(15),
		right: width(20),
	},
	rupeeCoin6: {
		bottom: height(25),
		right: width(8),
	},
	backButton: {
		position: "absolute",
		top: height(4),
		left: width(4),
		zIndex: 50,
		padding: width(2),
	},
	textContainer: {
		position: "absolute",
		top: height(4.5),
		alignItems: "center",
		zIndex: 20,
		width: "100%",
	},
	congratsText: {
		fontSize: font(3.2),
		fontWeight: "bold",
		color: "white",
		textAlign: "center",
		marginBottom: height(1),
	},
	subText: {
		fontSize: font(1.8),
		color: "white",
		textAlign: "center",
		marginBottom: height(2),
		lineHeight: 22,
		paddingHorizontal: width(6),
	},
	boldGreenText: {
		color: "#fff",
	},
	amountBlockCentered: {
		alignItems: "center",
		marginBottom: height(1.5),
	},
	loanAmountContainer: {
		flexDirection: "row",
		alignItems: "center",
	},
	loanAmountText: {
		fontSize: font(5),
		fontWeight: "bold",
		color: "white",
		textAlign: "center",
	},
	assessmentFeeContainer: {
		backgroundColor: white,
		borderRadius: width(2),
		marginHorizontal: width(8),
		borderWidth: 1,
		borderColor: "#33333366",
		marginTop: height(2),
		position: "relative",
	},
	discountBadge: {
		position: "absolute",
		top: -height(1.2),
		right: width(3),
		backgroundColor: "#00B200",
		paddingHorizontal: width(2.5),
		paddingVertical: height(0.3),
		borderRadius: width(3),
		zIndex: 10,
	},
	discountBadgeText: {
		color: white,
		fontSize: width(2.5),
		fontWeight: "bold",
	},
	offerEndsContainer: {
		flexDirection: "row",
		borderTopRightRadius: width(2),
		borderTopLeftRadius: width(2),
		padding: width(2),
		backgroundColor: "#FFDBDC",
		justifyContent: "center",
		alignItems: "center",
		gap: width(2),
	},
	offerEndsText: {
		color: "#D50004",
		fontWeight: "bold",
		fontSize: font(1.6),
	},
	assessmentFeeRow: {
		flexDirection: "row",
		paddingVertical: height(1.5),
		paddingHorizontal: width(3.5),
		justifyContent: "space-between",
		alignItems: "center",
		minHeight: height(6),
	},
	feeLabel: {
		color: "#1F2937",
		fontSize: font(1.8),
		fontWeight: "600",
	},
	assessmentFeePriceRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: width(2),
	},
	strikethroughPrice: {
		color: "#DC2626",
		textDecorationLine: "line-through",
		fontSize: font(1.6),
		fontWeight: "500",
	},
	actualPrice: {
		color: "#059669",
		fontWeight: "bold",
		fontSize: font(2.4),
	},
	nonRefundableText: {
		marginHorizontal: width(8),
		marginTop: height(1),
		fontSize: font(1.4),
		color: "#000",
		textAlign: "center",
		fontWeight: "bold",
	},
	lendersSection: {
		marginHorizontal: width(8),
		marginTop: height(2.5),
	},
	lendersHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		marginBottom: height(1.5),
	},
	lendersTitle: {
		fontSize: font(2),
		fontWeight: "bold",
		color: "#333",
	},
	lenderCard: {
		backgroundColor: "#F2F5FA",
		borderRadius: width(3),
		padding: width(4),
		borderWidth: 1,
		borderColor: "#E1E8F5",
		elevation: 1,
	},
	lenderCardExpanded: {
		borderColor: "#D0DDF2",
	},
	lenderCardHeader: {
		flexDirection: "row",
		alignItems: "center",
	},
	lenderLogo: {
		width: width(25),
		height: width(8.5),
		marginRight: width(3),
		borderRadius: width(1),
	},
	emkayLenderLogo: {
		width: width(25),
		height: width(8.5),
		marginRight: width(3),
		borderRadius: width(1),
		transform: [{ scale: 2.5 }],
	},
	lenderHeaderInfo: {
		flex: 1,
	},
	approvedLendersLabel: {
		fontSize: font(1.3),
		color: "#8E9AA0",
		fontWeight: "500",
	},
	lenderNameText: {
		fontSize: font(1.8),
		fontWeight: "bold",
		color: "#333",
		marginTop: height(0.2),
	},
	lenderDetailsContainer: {
		marginTop: height(1),
	},
	whiteDetailsCard: {
		backgroundColor: white,
		borderRadius: width(2),
		borderWidth: 1,
		borderColor: "#E1E8F5",
		paddingVertical: height(1.2),
		paddingHorizontal: width(3),
		marginTop: height(1.2),
		marginBottom: height(1),
	},
	detailsGrid: {
		flexDirection: "row",
		justifyContent: "space-between",
		paddingHorizontal: width(2),
	},
	detailsColumnLeft: {
		flex: 1.1,
		alignItems: "flex-start",
	},
	detailsColumnCenter: {
		flex: 0.9,
		alignItems: "center",
	},
	detailsColumnRight: {
		flex: 1.2,
		alignItems: "flex-end",
	},
	detailLabel: {
		fontSize: font(1.3),
		color: "#8E9AA0",
		marginBottom: height(0.5),
		fontWeight: "500",
	},
	detailValue: {
		fontSize: font(1.6),
		fontWeight: "bold",
		color: "#333",
	},
	nbfcBadgeContainer: {
		flexDirection: "row",
		alignItems: "center",
		marginTop: height(1),
		alignSelf: "flex-start",
		gap: width(1.5),
	},
	nbfcBadgeText: {
		fontSize: font(1.4),
		color: "#8E9AA0",
		fontWeight: "500",
	},
	skeletonLogo: {
		width: width(25),
		height: width(8.5),
		marginRight: width(3),
		borderRadius: width(1),
		backgroundColor: "#CBD5E1",
	},
	skeletonLineShort: {
		width: width(22),
		height: height(1.4),
		borderRadius: 4,
		backgroundColor: "#CBD5E1",
		marginBottom: height(0.6),
	},
	skeletonLineLong: {
		width: width(42),
		height: height(1.8),
		borderRadius: 4,
		backgroundColor: "#CBD5E1",
	},
	failedCard: {
		backgroundColor: "#F8FAFC",
		borderColor: "#E2E8F0",
	},
	failedRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: width(2.5),
	},
	failedText: {
		flex: 1,
		fontSize: font(1.6),
		color: "#64748B",
		fontWeight: "500",
	},
	retryBtn: {
		paddingHorizontal: width(2.8),
		paddingVertical: height(0.7),
		backgroundColor: "#E2E8F0",
		borderRadius: 6,
	},
	retryBtnText: {
		fontSize: font(1.4),
		fontWeight: "600",
		color: "#0F172A",
	},
	consentContainer: {
		paddingHorizontal: width(6),
		marginTop: height(3),
		alignItems: "center",
	},
	consentText: {
		color: "#333333",
		fontSize: font(1.4),
		textAlign: "center",
		lineHeight: font(2.0),
	},
});

export default OfferLendersSection;
