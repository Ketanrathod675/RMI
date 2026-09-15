import { TranslatedText } from "@/components/TranslatedText";
import { Images } from "@/constants/images";
import { useTranslation } from "@/hooks/useTranslation";
import { height, width } from "@/utils/dimensions";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useRef } from "react";
import {
	Animated,
	ImageBackground,
	Linking,
	Modal,
	ScrollView,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface RejectionModalProps {
	visible: boolean;
	countdown: number;
	setCountdown: (cb: (prev: number) => number) => void;
	onClose: () => void;
}

export default function RejectionModal({
	visible,
	countdown,
	setCountdown,
	onClose,
}: RejectionModalProps) {
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const { isHindi } = useTranslation();
	const rejectionScaleAnim = useRef(new Animated.Value(0)).current;

	useEffect(() => {
		if (visible) {
			rejectionScaleAnim.setValue(0);
			Animated.spring(rejectionScaleAnim, {
				toValue: 1,
				useNativeDriver: true,
				tension: 50,
				friction: 7,
			}).start();

			const interval = setInterval(() => {
				setCountdown((prev) => {
					if (prev <= 1) {
						clearInterval(interval);
						setTimeout(() => {
							onClose();
							router.replace("/(tabs)");
						}, 0);
						return 0;
					}
					return prev - 1;
				});
			}, 1000);

			return () => clearInterval(interval);
		}
	}, [visible]);

	return (
		<Modal
			visible={visible}
			transparent={true}
			animationType="fade"
			statusBarTranslucent={true}>
			<StatusBar style="light" />
			<View style={styles.modalOverlay}>
				<Animated.View
					style={[
						styles.rejectionModalContent,
						{ transform: [{ scale: rejectionScaleAnim }] },
					]}>
					<ScrollView
						style={{ flex: 1, width: "100%" }}
						contentContainerStyle={[
							styles.rejectionModalScrollContent,
							{ paddingBottom: insets.bottom + height(4) },
						]}
						showsVerticalScrollIndicator={false}>
						{/* ── Header with BG image behind texts ── */}
						<View style={styles.rejectionHeaderClip}>
							<ImageBackground
								source={Images.REJECTION_BG}
								style={styles.rejectionHeaderBg}
								imageStyle={styles.rejectionBgImage}
								resizeMode="cover">
								<Image
									source={Images.R_BOX_LOGO}
									style={styles.rejectionLogo}
									resizeMode="contain"
								/>
								<Text style={styles.rejectionTitle}>
									<TranslatedText translationKey="sorryBeforeLoan" />{" "}
									<Text style={{ color: "#79CA00" }}>
										<TranslatedText translationKey="loanWord" />
									</Text>{" "}
									<TranslatedText translationKey="sorryAfterLoan" />
								</Text>
								<TranslatedText
									style={styles.rejectionSubtitle}
									translationKey="applicationDidntMeetCriteria"
								/>
							</ImageBackground>
						</View>

						{/* ── Tips card ── */}
						<View style={styles.tipsCard}>
							<View style={styles.tipsHeader}>
								<TranslatedText
									style={styles.tipsHeaderText}
									translationKey="heresHowToBoostChances"
								/>
							</View>

							<View style={styles.tipsList}>
								{/* Tip 1 */}
								<View style={styles.tipItem}>
									<Image
										source={require("@/assets/images/creditscore.png")}
										style={styles.tipIcon}
									/>
									<View style={styles.tipTextContainer}>
										<TranslatedText
											style={styles.tipTitle}
											translationKey="improveCreditScore"
										/>
										<TranslatedText
											style={styles.tipDescription}
											translationKey="buildStrongerCreditScore"
										/>
									</View>
								</View>

								{/* Tip 2 */}
								<View style={styles.tipItem}>
									<Image
										source={require("@/assets/images/reducedebts.png")}
										style={styles.tipIcon}
									/>
									<View style={styles.tipTextContainer}>
										<TranslatedText
											style={styles.tipTitle}
											translationKey="reduceExistingDebts"
										/>
										<TranslatedText
											style={styles.tipDescription}
											translationKey="lowerCurrentLiabilities"
										/>
									</View>
								</View>

								{/* Tip 3 */}
								<View style={styles.tipItem}>
									<Image
										source={require("@/assets/images/kycdetails.png")}
										style={styles.tipIcon}
									/>
									<View style={styles.tipTextContainer}>
										<TranslatedText
											style={styles.tipTitle}
											translationKey="updateKycDetails"
										/>
										<TranslatedText
											style={styles.tipDescription}
											translationKey="keepKycUpdated"
										/>
									</View>
								</View>
							</View>
						</View>

						<View style={styles.tryAgainRow}>
							<Ionicons name="timer-outline" size={22} color="#79CA00" />
							<Text style={styles.tryAgainText}>
								{isHindi ? (
									<>
										<Text style={{ color: "#79CA00", fontWeight: "700" }}>
											<TranslatedText translationKey="days30" />
										</Text>{" "}
										<TranslatedText translationKey="tryAgainIn" />
									</>
								) : (
									<>
										<TranslatedText translationKey="tryAgainIn" />{" "}
										<Text style={{ color: "#79CA00", fontWeight: "700" }}>
											<TranslatedText translationKey="days30" />
										</Text>
									</>
								)}
							</Text>
						</View>

						{/* ── Support rectangle with headphones ── */}
						<View style={styles.supportBox}>
							<Ionicons name="headset-outline" size={24} color="#555" />
							<View style={styles.supportBoxText}>
								<TranslatedText
									style={[styles.supportText, { textAlign: "center" }]}
									translationKey="forAssistanceContact"
								/>
								<TouchableOpacity
									onPress={() => Linking.openURL("mailto:support@rapidmoney.in")}>
									<Text style={[styles.supportEmailText, { textAlign: "center" }]}>
										support@rapidmoney.in
									</Text>
								</TouchableOpacity>
							</View>
						</View>

						{/* ── Redirect countdown ── */}
						<View style={styles.redirectTextContainer}>
							<TranslatedText
								style={styles.redirectText}
								translationKey="redirectingToDashboardNew"
							/>
							<Text style={styles.redirectText}> {countdown} </Text>
							<TranslatedText
								style={styles.redirectText}
								translationKey="seconds"
							/>
							<Text style={styles.redirectText}>...</Text>
						</View>
					</ScrollView>
				</Animated.View>
			</View>
		</Modal>
	);
}

const styles = StyleSheet.create({
	modalOverlay: {
		flex: 1,
		backgroundColor: "rgba(0,0,0,0.08)",
	},
	rejectionModalContent: {
		flex: 1,
		backgroundColor: "#f5f6fa",
		overflow: "hidden",
	},
	rejectionModalScrollContent: {
		flexGrow: 1,
		alignItems: "center",
	},
	rejectionHeaderClip: {
		width: "100%",
		alignItems: "center",
		overflow: "hidden",
		borderBottomLeftRadius: width(9),
		borderBottomRightRadius: width(9),
	},
	rejectionHeaderBg: {
		width: "150%",
		paddingTop: height(10),
		paddingBottom: height(7.5),
		paddingHorizontal: width(7),
		alignItems: "center",
		justifyContent: "center",
		transform: [{ translateY: -height(2) }],
	},
	rejectionBgImage: {
		width: "100%",
		borderBottomLeftRadius: width(9),
		borderBottomRightRadius: width(9),
	},
	rejectionLogo: {
		width: width(15),
		height: width(15),
		marginBottom: height(1.5),
	},
	rejectionTitle: {
		fontSize: 22,
		fontWeight: "700",
		color: "#fff",
		textAlign: "center",
		marginBottom: height(1),
		paddingHorizontal: width(20),
	},
	rejectionSubtitle: {
		fontSize: 13,
		color: "rgba(255,255,255,0.85)",
		textAlign: "center",
		lineHeight: 20,
		paddingHorizontal: width(25),
	},
	tipsCard: {
		backgroundColor: "#ECEBFF",
		borderRadius: width(4),
		width: "90%",
		overflow: "hidden",
		marginTop: height(1.5),
		marginBottom: height(2),
	},
	tipsHeader: {
		backgroundColor: "#B7FB52",
		paddingVertical: height(1.2),
		paddingHorizontal: width(4),
		alignItems: "center",
		justifyContent: "center",
		borderRadius: width(5),
		marginHorizontal: width(4),
		marginTop: height(2),
		marginBottom: height(1),
	},
	tipsHeaderText: {
		fontWeight: "600",
		color: "#333",
		fontSize: 15,
	},
	tipsList: {
		padding: width(4),
		gap: height(1.5),
	},
	tipItem: {
		flexDirection: "row",
		alignItems: "flex-start",
		gap: width(3),
	},
	tipIcon: {
		width: width(6),
		height: width(6),
	},
	tipTextContainer: {
		flex: 1,
	},
	tipTitle: {
		fontSize: 15,
		fontWeight: "700",
		color: "#333",
		marginBottom: height(0.3),
	},
	tipDescription: {
		fontSize: 13,
		color: "#666",
		lineHeight: 18,
	},
	tryAgainRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
		marginTop: height(1),
		marginBottom: height(2),
	},
	tryAgainText: {
		fontSize: 17,
		fontWeight: "700",
		color: "#222",
	},
	supportBox: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		width: "85%",
		alignSelf: "center",
		backgroundColor: "#fff",
		borderRadius: width(3),
		paddingVertical: height(1.2),
		paddingHorizontal: width(4),
		marginBottom: height(2),
	},
	supportBoxText: {
		alignItems: "center",
		marginLeft: width(2),
	},
	supportText: {
		fontSize: 13,
		fontWeight: "600",
		color: "#444",
		textAlign: "center",
	},
	supportEmailText: {
		fontSize: 13,
		fontWeight: "600",
		color: "#00A651",
		marginTop: 2,
		textAlign: "center",
	},
	redirectText: {
		fontSize: 13,
		color: "#999",
		textAlign: "center",
		fontStyle: "italic",
	},
	redirectTextContainer: {
		flexDirection: "row",
		justifyContent: "center",
		alignItems: "center",
		flexWrap: "wrap",
		marginTop: height(0.5),
	},
});
