export type UserType = "new_user" | "repeat_user";

const firedEvents = new Set<string>();

const getFirebaseAnalytics = () => {
  try {
    const firebaseAnalytics = require("@react-native-firebase/analytics");
    return firebaseAnalytics.default || firebaseAnalytics;
  } catch {
    return () => ({
      setUserProperty: async () => {},
      logEvent: async () => {},
      setUserId: async () => {},
      getAppInstanceId: async () => null,
    });
  }
};

const analytics = getFirebaseAnalytics();

const logAnalytics = (eventName: string, params?: Record<string, any>) => {
  if (__DEV__) {
    console.log(
      `🔥 [Analytics] Event: ${eventName}`,
      params ? JSON.stringify(params, null, 2) : ""
    );
  }
};

const logDuplicate = (key: string) => {
  if (__DEV__) {
    console.warn(`🔥 [Analytics] DUPLICATE BLOCKED → key already fired: "${key}"`);
  }
};

export const setUserType = async (type: UserType): Promise<void> => {
  try {
    await analytics().setUserProperty("user_type", type);
    logAnalytics("setUserProperty", { user_type: type });
  } catch (err) {
    if (__DEV__) console.error("🔥 [Analytics] setUserType error:", err);
  }
};

export const trackInstall = async (): Promise<void> => {
  const key = "rapid_install";
  if (firedEvents.has(key)) { logDuplicate(key); return; }
  firedEvents.add(key);

  try {
    await analytics().logEvent("rapid_install", { method: "organic" });
    logAnalytics("rapid_install", { method: "organic" });
  } catch (err) {
    firedEvents.delete(key);
    if (__DEV__) console.error("🔥 [Analytics] trackInstall error:", err);
  }
};

export const trackSignup = async (userId: string): Promise<void> => {
  if (__DEV__) {
    console.log("🔥 [Analytics] trackSignup called for user:", userId);
  }
};

export const trackAssessmentFeePaid = async (amount: number, txnId: string): Promise<void> => {
  if (__DEV__) {
    console.log("🔥 [Analytics] trackAssessmentFeePaid called:", { amount, txnId });
  }
};

export const trackDisbursement = async (txnId: string): Promise<void> => {
  if (__DEV__) {
    console.log("🔥 [Analytics] trackDisbursement called:", txnId);
  }
};

export const resetAnalyticsSession = async (): Promise<void> => {
  firedEvents.clear();
  try {
    await analytics().setUserId(null);
    logAnalytics("resetAnalyticsSession");
  } catch (err) {
    if (__DEV__) console.error("🔥 [Analytics] resetAnalyticsSession error:", err);
  }
};

export default analytics;
