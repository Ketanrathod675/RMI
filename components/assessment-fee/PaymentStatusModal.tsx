import { font, height, width } from "@/utils/dimensions";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";

export type PaymentStatusModalType = "cancelled" | "failed" | "expired" | "unconfirmed";

interface Props {
    visible: boolean;
    type: PaymentStatusModalType | null;
    onRetry: () => void; // start a fresh payment
    onCheckAgain: () => void; // re-verify the same transaction
    onContactSupport: () => void;
    onClose: () => void;
}

const COPY: Record<PaymentStatusModalType, { icon: string; color: string; title: string; body: string }> = {
    cancelled: {
        icon: "close-circle",
        color: "#F59E0B",
        title: "Payment not completed",
        body: "It looks like you left the payment page before finishing. No amount was charged. You can try again whenever you are ready.",
    },
    failed: {
        icon: "alert-circle",
        color: "#EF4444",
        title: "Payment failed",
        body: "Your payment could not be completed. If any amount was debited, it will be refunded by your bank automatically. You can try again.",
    },
    expired: {
        icon: "time",
        color: "#F59E0B",
        title: "Payment session expired",
        body: "This payment attempt timed out. Please start a new payment.",
    },
    unconfirmed: {
        icon: "help-circle",
        color: "#3B82F6",
        title: "We could not confirm your payment yet",
        body: "If money was debited, please do NOT pay again. Tap \"Check again\" in a minute. Confirmation can take a little while. If it still does not show, contact support.",
    },
};

export const PaymentStatusModal: React.FC<Props> = ({
    visible,
    type,
    onRetry,
    onCheckAgain,
    onContactSupport,
    onClose,
}) => {
    if (!type) return null;
    const c = COPY[type];
    const unconfirmed = type === "unconfirmed";

    return (
        <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
            <View style={styles.overlay}>
                <View style={styles.card}>
                    <Ionicons name={c.icon as any} size={width(14)} color={c.color} />
                    <Text style={styles.title}>{c.title}</Text>
                    <Text style={styles.body}>{c.body}</Text>

                    {unconfirmed ? (
                        <>
                            <TouchableOpacity style={styles.primary} onPress={onCheckAgain} activeOpacity={0.85}>
                                <Text style={styles.primaryText}>Check again</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.secondary} onPress={onContactSupport} activeOpacity={0.85}>
                                <Text style={styles.secondaryText}>Contact support</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                <Text style={styles.link}>Close</Text>
                            </TouchableOpacity>
                        </>
                    ) : (
                        <>
                            <TouchableOpacity style={styles.primary} onPress={onRetry} activeOpacity={0.85}>
                                <Text style={styles.primaryText}>Try again</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                <Text style={styles.link}>Not now</Text>
                            </TouchableOpacity>
                        </>
                    )}
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", alignItems: "center", padding: width(6) },
    card: { width: "100%", backgroundColor: "#fff", borderRadius: width(5), padding: width(6), alignItems: "center", gap: height(1.4) },
    title: { fontSize: font(2.2), fontWeight: "700", color: "#1E293B", textAlign: "center" },
    body: { fontSize: font(1.75), color: "#64748B", textAlign: "center", lineHeight: font(2.6) },
    primary: { width: "100%", backgroundColor: "#B7FB52", borderRadius: width(5), paddingVertical: height(1.7), alignItems: "center", marginTop: height(1) },
    primaryText: { fontSize: font(1.9), fontWeight: "700", color: "#000" },
    secondary: { width: "100%", borderWidth: 1, borderColor: "#CBD5E1", borderRadius: width(5), paddingVertical: height(1.6), alignItems: "center" },
    secondaryText: { fontSize: font(1.8), fontWeight: "600", color: "#334155" },
    link: { fontSize: font(1.7), color: "#64748B", paddingVertical: height(0.6) },
});

export default PaymentStatusModal;