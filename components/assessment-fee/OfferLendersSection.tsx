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
	Easing,
	Modal,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from "react-native";

export type LenderOffer = {
	lender_id: string;
	lender_name: string;
	is_rbi_nbfc: boolean;
	loan_upto: number;
	tenure_upto: number;
	interest_rate_starts_at: string;
};

interface OfferLendersSectionProps {
	primaryLender?: LenderOffer;
	eligibleLenders: LenderOffer[];
	isLoadingFee: boolean;
	processingFeeAmount: number;
	originalPrice?: number;
	discountPercent?: number;
	offerMinutes: string;
	offerSeconds: string;
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
	eligibleLenders,
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
	const [isViewAllVisible, setIsViewAllVisible] = useState(false);
	const [expandedLenders, setExpandedLenders] = useState<Record<string, boolean>>({});

	const actualOriginalPrice = originalPrice || 249;
	const actualDiscountPercent =
		discountPercent ??
		Math.max(
			1,
			Math.round(
				((actualOriginalPrice - processingFeeAmount) / actualOriginalPrice) * 100
			)
		);

	const viewAllTranslateY = useRef(new Animated.Value(600)).current;
	const viewAllBackdropOpacity = useRef(new Animated.Value(0)).current;

	useEffect(() => {
		if (isViewAllVisible) {
			viewAllTranslateY.setValue(600);
			viewAllBackdropOpacity.setValue(0);
			Animated.parallel([
				Animated.timing(viewAllBackdropOpacity, {
					toValue: 1,
					duration: 220,
					useNativeDriver: true,
				}),
				Animated.timing(viewAllTranslateY, {
					toValue: 0,
					duration: 260,
					easing: Easing.out(Easing.cubic),
					useNativeDriver: true,
				}),
			]).start();
		}
	}, [isViewAllVisible, viewAllTranslateY, viewAllBackdropOpacity]);

	const handleCloseViewAll = () => {
		Animated.parallel([
			Animated.timing(viewAllBackdropOpacity, {
				toValue: 0,
				duration: 180,
				useNativeDriver: true,
			}),
			Animated.timing(viewAllTranslateY, {
				toValue: 600,
				duration: 200,
				easing: Easing.in(Easing.cubic),
				useNativeDriver: true,
			}),
		]).start(() => {
			setIsViewAllVisible(false);
		});
	};

	const getLocalText = (key: string, defaultText: string): string => {
		if (isHindi) {
			switch (key) {
				case "eligibleLenders":
					return "योग्य ऋणदाता";
				case "viewAll":
					return "सभी देखें";
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
				case "otherEligibleLenders":
					return "अन्य योग्य ऋणदाता";
				case "okay":
					return "ठीक है";
				default:
					return defaultText;
			}
		}
		return defaultText;
	};

	const toggleLenderExpand = (key: string) => {
		setExpandedLenders((prev) => ({
			...prev,
			[key]: !prev[key],
		}));
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
		: "₹ 15,000/-";

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

					<View style={styles.amountBlockCentered}>
						<View style={styles.loanAmountContainer}>
							<Text style={styles.loanAmountText}>{displayLoanAmount}</Text>
						</View>
					</View>
				</View>
			</View>

			{/* Assessment Fee Card */}
			<View style={styles.assessmentFeeContainer}>
				<View style={styles.discountBadge}>
					<Text style={styles.discountBadgeText}>{actualDiscountPercent}% Off</Text>
				</View>
				<View style={styles.offerEndsContainer}>
					<Image
						source={Images.TIMER_ICON}
						style={{ width: width(4), height: width(4) }}
					/>
					<Text style={styles.offerEndsText}>
						{t("offerEndsIn")} {offerMinutes}:{offerSeconds}
					</Text>
				</View>
				<View style={styles.assessmentFeeRow}>
					{isLoadingFee ? (
						<ActivityIndicator size="small" color="#333" />
					) : (
						<>
							<Text style={{ color: "#333333" }}>{t("assessmentFee")} :</Text>
							<View style={styles.assessmentFeePriceRow}>
								<Text style={styles.strikethroughPrice}>₹{actualOriginalPrice}</Text>
								<Text style={styles.actualPrice}>₹{processingFeeAmount}/-</Text>
							</View>
						</>
					)}
				</View>
			</View>

			<Text style={styles.nonRefundableText}>
				{t("assessmentFeeNonRefundable")}
			</Text>

			{/* Primary Eligible Lender Card */}
			{primaryLender && (
				<View style={styles.lendersSection}>
					<View style={styles.lendersHeader}>
						<Text style={styles.lendersTitle}>
							{getLocalText("eligibleLenders", "Eligible Lenders")}
						</Text>
					</View>

					<TouchableOpacity
						style={[
							styles.lenderCard,
							isLenderExpanded && styles.lenderCardExpanded,
						]}
						onPress={() => setIsLenderExpanded(!isLenderExpanded)}
						activeOpacity={0.9}>
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
							<MaterialIcons
								name={isLenderExpanded ? "keyboard-arrow-up" : "keyboard-arrow-down"}
								size={24}
								color="#333"
							/>
						</View>

						{isLenderExpanded && (
							<View style={styles.lenderDetailsContainer}>
								<View style={styles.whiteDetailsCard}>
									<View style={styles.detailsGrid}>
										<View style={styles.detailsColumnLeft}>
											<Text style={styles.detailLabel}>
												{getLocalText("loanUpto", "Loan Upto")}
											</Text>
											<Text style={styles.detailValue}>
												{formatAmount(primaryLender.loan_upto)}
											</Text>
										</View>
										<View style={styles.detailsColumnCenter}>
											<Text style={[styles.detailLabel, { textAlign: "center" }]}>
												{getLocalText("tenureUpto", "Tenure Upto")}
											</Text>
											<Text style={[styles.detailValue, { textAlign: "center" }]}>
												{formatTenureValue(primaryLender.tenure_upto)}
											</Text>
										</View>
										<View style={styles.detailsColumnRight}>
											<Text style={[styles.detailLabel, { textAlign: "right" }]}>
												{getLocalText("interestRate", "Interest Rate")}
											</Text>
											<Text style={[styles.detailValue, { textAlign: "right" }]}>
												{primaryLender.interest_rate_starts_at.includes("Starts")
													? primaryLender.interest_rate_starts_at
													: `Starts @ ${primaryLender.interest_rate_starts_at}${primaryLender.interest_rate_starts_at.includes("p.m.") ||
														primaryLender.interest_rate_starts_at.includes("p.a.")
														? ""
														: " p.m."
													}`}
											</Text>
										</View>
									</View>
								</View>

								{(primaryLender.is_rbi_nbfc ||
									primaryLender.lender_name.toLowerCase().includes("fintree") ||
									primaryLender.lender_name.toLowerCase().includes("ru loans") ||
									primaryLender.lender_name.toLowerCase().includes("ruloans")) && (
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
				</View>
			)}

			{/* Consent Disclaimer */}
			<View style={styles.consentContainer}>
				<Text style={styles.consentText}>
					{t("consentAssessmentFeeNew")}
				</Text>
			</View>

			{/* View All Lenders Bottom Sheet Modal */}
			<Modal
				visible={isViewAllVisible}
				transparent={true}
				animationType="none"
				onRequestClose={handleCloseViewAll}
				statusBarTranslucent={true}>
				<View style={styles.bottomSheetOverlay}>
					{/* Fading Backdrop (Fades in place - does NOT slide up with modal) */}
					<Animated.View
						style={[
							StyleSheet.absoluteFill,
							styles.backdrop,
							{ opacity: viewAllBackdropOpacity },
						]}>
						<Pressable style={StyleSheet.absoluteFill} onPress={handleCloseViewAll} />
					</Animated.View>

					{/* Bottom Sheet that slides up independently from bottom */}
					<Animated.View
						style={[
							styles.bottomSheetContainer,
							{ transform: [{ translateY: viewAllTranslateY }] },
						]}>
						<View style={styles.bottomSheetHeader}>
							<Text style={styles.bottomSheetTitle}>
								{getLocalText("otherEligibleLenders", "Other Eligible Lenders")}
							</Text>
							<TouchableOpacity
								onPress={handleCloseViewAll}
								style={styles.closeButtonTouch}>
								<MaterialIcons name="close" size={24} color="#333" />
							</TouchableOpacity>
						</View>

						<ScrollView
							style={styles.lendersListScroll}
							showsVerticalScrollIndicator={false}>
							{eligibleLenders.map((lender, index) => {
								const uniqueKey = `${lender.lender_id}-${index}`;
								const isExpanded = !!expandedLenders[uniqueKey];
								return (
									<TouchableOpacity
										key={uniqueKey}
										style={[
											styles.modalLenderCard,
											isExpanded && styles.modalLenderCardExpanded,
										]}
										onPress={() => toggleLenderExpand(uniqueKey)}
										activeOpacity={0.9}>
										<View style={styles.lenderCardHeader}>
											<Image
												source={getLenderLogo(lender.lender_name)}
												style={
													lender.lender_name.toLowerCase().includes("emkay")
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
													{lender.lender_name}
												</Text>
											</View>
											<MaterialIcons
												name={
													isExpanded
														? "keyboard-arrow-up"
														: "keyboard-arrow-down"
												}
												size={24}
												color="#333"
											/>
										</View>

										{isExpanded && (
											<View style={styles.lenderDetailsContainer}>
												<View style={styles.whiteDetailsCard}>
													<View style={styles.detailsGrid}>
														<View style={styles.detailsColumnLeft}>
															<Text style={styles.detailLabel}>
																{getLocalText("loanUpto", "Loan Upto")}
															</Text>
															<Text style={styles.detailValue}>
																{formatAmount(lender.loan_upto)}
															</Text>
														</View>
														<View style={styles.detailsColumnCenter}>
															<Text
																style={[
																	styles.detailLabel,
																	{ textAlign: "center" },
																]}>
																{getLocalText("tenureUpto", "Tenure Upto")}
															</Text>
															<Text
																style={[
																	styles.detailValue,
																	{ textAlign: "center" },
																]}>
																{formatTenureValue(lender.tenure_upto)}
															</Text>
														</View>
														<View style={styles.detailsColumnRight}>
															<Text
																style={[
																	styles.detailLabel,
																	{ textAlign: "right" },
																]}>
																{getLocalText("interestRate", "Interest Rate")}
															</Text>
															<Text
																style={[
																	styles.detailValue,
																	{ textAlign: "right" },
																]}>
																{lender.interest_rate_starts_at}
															</Text>
														</View>
													</View>
												</View>

												{lender.is_rbi_nbfc && (
													<View style={styles.nbfcBadgeContainer}>
														<MaterialCommunityIcons
															name="shield-check"
															size={18}
															color="#005BBA"
														/>
														<Text style={styles.nbfcBadgeText}>
															{getLocalText(
																"rbiRegisteredNbfc",
																"RBI Registered NBFC",
															)}
														</Text>
													</View>
												)}
											</View>
										)}
									</TouchableOpacity>
								);
							})}
						</ScrollView>

						<TouchableOpacity
							style={styles.modalCloseButton}
							onPress={handleCloseViewAll}
							activeOpacity={0.8}>
							<Text style={styles.modalCloseButtonText}>
								{getLocalText("okay", "Okay")}
							</Text>
						</TouchableOpacity>
					</Animated.View>
				</View>
			</Modal>
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
		padding: width(2.5),
		justifyContent: "space-between",
		alignItems: "center",
	},
	assessmentFeePriceRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: width(2),
	},
	strikethroughPrice: {
		color: "#D50004",
		textDecorationLine: "line-through",
		fontSize: font(1.8),
	},
	actualPrice: {
		color: "#1D7505",
		fontWeight: "bold",
		fontSize: font(2.0),
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
	viewAllText: {
		fontSize: font(1.6),
		color: "#1D7505",
		fontWeight: "bold",
		textDecorationLine: "underline",
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
	bottomSheetOverlay: {
		flex: 1,
		justifyContent: "flex-end",
	},
	backdrop: {
		backgroundColor: "rgba(0,0,0,0.5)",
	},
	bottomSheetContainer: {
		backgroundColor: white,
		borderTopLeftRadius: width(6),
		borderTopRightRadius: width(6),
		paddingHorizontal: width(6),
		paddingTop: height(3),
		paddingBottom: height(4),
		maxHeight: height(75),
	},
	bottomSheetHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		marginBottom: height(2.5),
	},
	bottomSheetTitle: {
		fontSize: font(2.2),
		fontWeight: "bold",
		color: "#333",
		textAlign: "center",
		flex: 1,
	},
	closeButtonTouch: {
		position: "absolute",
		right: 0,
		padding: width(1),
	},
	lendersListScroll: {
		marginBottom: height(2.5),
	},
	modalLenderCard: {
		backgroundColor: "#F2F5FA",
		borderRadius: width(3),
		padding: width(4),
		borderWidth: 1,
		borderColor: "#E1E8F5",
		marginBottom: height(1.5),
	},
	modalLenderCardExpanded: {
		borderColor: "#D0DDF2",
	},
	modalCloseButton: {
		backgroundColor: "#B7FB52",
		borderRadius: 20,
		paddingVertical: height(2),
		width: "100%",
		alignItems: "center",
		justifyContent: "center",
		elevation: 3,
	},
	modalCloseButtonText: {
		color: dark,
		fontSize: font(2),
		fontWeight: "bold",
		letterSpacing: 1,
	},
});

export default OfferLendersSection;
