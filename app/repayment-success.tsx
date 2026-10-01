import { dark, primary, white } from "@/constants/Colors";
import { useTranslation } from "@/hooks/useTranslation";
import { font, height, width } from "@/utils/dimensions";
import { STORAGE_KEYS, removeStorageItem } from "@/utils/storage";
import * as Linking from "expo-linking";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { Animated, DeviceEventEmitter, Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function RepaymentSuccess() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(true);
  const [paymentStatus, setPaymentStatus] = useState<"success" | "failure" | null>(null);
  const [loanNumber, setLoanNumber] = useState<string>("");
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const failureScaleAnim = useRef(new Animated.Value(0)).current;
  const params = useLocalSearchParams<{ loanNumber?: string, status?: string, txnid?: string }>();
  const processedRef = useRef(false); // Prevent duplicate processing

  // Parse URL and determine status
  useEffect(() => {
    const parsePaymentStatus = async () => {
      // Prevent duplicate processing
      if (processedRef.current) {
        return;
      }

      const status = params.status;
      const loanNum = params.loanNumber || "";
      
      if (!status) {
        return; // Wait for params to populate
      }

      console.log("=== REPAYMENT SUCCESS - PARAMS PARSED ===");
      console.log("Status:", status);
      console.log("Params:", JSON.stringify(params, null, 2));
      console.log("================================================");
      
      // Mark as processed to prevent duplicate runs
      processedRef.current = true;
      setLoanNumber(loanNum);
      
      // Check failure FIRST to prevent any success UI from showing
      if (status === "failure" || status === "failed") {
        console.log("❌ Payment FAILURE detected - Params:", JSON.stringify(params));
        
        // Clear flag and hide loader
        await removeStorageItem(STORAGE_KEYS["@repayment-status"]);
        DeviceEventEmitter.emit("HIDE_GLOBAL_LOADER");
        
        // Hide the global loader first, then set local state
        setTimeout(() => {
          setPaymentStatus("failure");
        }, 100);
      } else if (status === "success") {
        console.log("✅ Payment SUCCESS - Params:", JSON.stringify(params));
        
        // Clear flag and hide loader
        await removeStorageItem(STORAGE_KEYS["@repayment-status"]);
        DeviceEventEmitter.emit("HIDE_GLOBAL_LOADER");
        
        // Hide the global loader first, then set local state
        setTimeout(() => {
          setPaymentStatus("success");
        }, 100);
      }
    };

    parsePaymentStatus();
  }, [params.status, params.loanNumber]);

  useEffect(() => {
    if (paymentStatus === "success") {
      console.log("✅ Repayment Success screen mounted - SUCCESS");
      
      // Animate the success icon
      const timeout1 = setTimeout(() => {
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 120,
          useNativeDriver: true,
        }).start();
      }, 400);

      // Auto close after 3 seconds and navigate to dashboard
      const timeout2 = setTimeout(() => {
        setVisible(false);
        // Small delay before navigation to prevent flickering
        setTimeout(() => {
          router.replace("/(tabs)");
        }, 100);
      }, 3000);

      return () => {
        clearTimeout(timeout1);
        clearTimeout(timeout2);
      };
    } else if (paymentStatus === "failure") {
      console.log("❌ Repayment Success screen mounted - FAILURE");
      
      // Animate the failure icon
      const timeout1 = setTimeout(() => {
        Animated.timing(failureScaleAnim, {
          toValue: 1,
          duration: 120,
          useNativeDriver: true,
        }).start();
      }, 400);

      return () => {
        clearTimeout(timeout1);
      };
    }
  }, [paymentStatus, scaleAnim, failureScaleAnim]);

  const handleRetryPayment = () => {
    if (loanNumber) {
      router.replace({
        pathname: "/repayment-options",
        params: { loanNumber },
      });
    } else {
      router.replace("/(tabs)");
    }
  };

  const handleBackToDashboard = () => {
    router.replace("/(tabs)");
  };

  // Show loading state while determining status
  if (!paymentStatus) {
    return (
      <View style={{ flex: 1, backgroundColor: white, justifyContent: "center", alignItems: "center" }}>
        <Text style={{ fontSize: font(1.8), color: dark }}>Processing...</Text>
      </View>
    );
  }

  // Show failure UI
  if (paymentStatus === "failure") {
    return (
      <View style={styles.container}>
        <View style={styles.content}>
          <Animated.View style={[styles.failureCircle, { transform: [{ scale: failureScaleAnim }] }]}>
            <Text style={styles.failureCross}>✕</Text>
          </Animated.View>
          <Text style={styles.title}>{t("repaymentFailed" as any)}</Text>
          <Text style={styles.subtitle}>{t("couldntProcessRepayment" as any)}</Text>
          
          <TouchableOpacity style={styles.retryButton} onPress={handleRetryPayment}>
            <Text style={styles.retryButtonText}>{t("retryPayment" as any)}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.dashboardButton} onPress={handleBackToDashboard}>
            <Text style={styles.dashboardButtonText}>{t("backToDashboard")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Show success UI
  return (
    <View style={{ flex: 1, backgroundColor: white }}>
      <Modal visible={visible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Animated.View style={[styles.successCircle, { transform: [{ scale: scaleAnim }] }]}>
              <Text style={styles.successTick}>✓</Text>
            </Animated.View>
            <Text style={styles.title}>{t("paymentSuccessful") || "Payment Successful"}</Text>
            <Text style={styles.subtitle}>Processing your request...</Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: white,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: width(6),
  },
  content: {
    width: "100%",
    alignItems: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: width(6),
  },
  modalContent: {
    width: "100%",
    backgroundColor: white,
    borderRadius: width(3),
    paddingVertical: height(3),
    paddingHorizontal: width(6),
    alignItems: "center",
  },
  successCircle: {
    width: width(20),
    height: width(20),
    borderRadius: width(10),
    backgroundColor: "#E6F6EA",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: height(2),
  },
  successTick: {
    color: primary,
    fontSize: width(10),
    lineHeight: width(10),
    textAlign: "center",
  },
  failureCircle: {
    width: width(20),
    height: width(20),
    borderRadius: width(10),
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: height(3),
  },
  failureCross: {
    color: "#EF4444",
    fontSize: width(10),
    lineHeight: width(10),
    textAlign: "center",
    fontWeight: "bold",
  },
  title: {
    fontSize: font(2.2),
    fontWeight: "700",
    color: dark,
    textAlign: "center",
    marginBottom: height(1),
  },
  subtitle: {
    fontSize: font(1.8),
    color: "#6B7280",
    textAlign: "center",
    marginBottom: height(5),
  },
  retryButton: {
    backgroundColor: primary,
    paddingVertical: height(2.5),
    paddingHorizontal: width(8),
    borderRadius: width(3),
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: height(2),
  },
  retryButtonText: {
    color: dark,
    fontSize: font(1.9),
    fontWeight: "600",
  },
  dashboardButton: {
    backgroundColor: "#E5E7EB",
    paddingVertical: height(2.5),
    paddingHorizontal: width(8),
    borderRadius: width(3),
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  dashboardButtonText: {
    color: dark,
    fontSize: font(1.9),
    fontWeight: "600",
  },
});



