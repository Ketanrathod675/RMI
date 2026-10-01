/**
 * Branch MMP — Deep Linking + Attribution Integration
 * Scope: Install / App-Open / Reinstall tracking, UTM attribution mapping, and auto-routing.
 *
 * Debug mode is enabled natively via AndroidManifest.xml:
 *   <meta-data android:name="io.branch.sdk.TestMode" android:value="true"/>
 *
 * branch.setDebugMode() was removed in react-native-branch v6.
 * Do NOT call it — use the manifest flag instead.
 */

import { NativeModules, Platform } from "react-native";
import { router } from "expo-router";

export type BranchAttribution = {
  source?: string;
  campaign_id?: string;
  sub_source?: string;
  medium?: string;
  campaign_name?: string;
};

// ─── Native Module Availability Check ─────────────────────────────────────────
// In Expo Go or development runs before a new native binary is compiled,
// NativeModules.RNBranch is null. Top-level importing react-native-branch when
// RNBranch is null causes TypeError: Cannot read property 'STANDARD_EVENT_ADD_TO_CART' of null.
// Dynamically requiring it only when RNBranch is linked prevents crashes during development.

const hasNativeBranch = Boolean(
  (Platform.OS === "android" || Platform.OS === "ios") &&
    NativeModules &&
    NativeModules.RNBranch
);

let branch: any = null;
if (hasNativeBranch) {
  try {
    const branchModule = require("react-native-branch");
    branch = branchModule.default || branchModule;
  } catch (err) {
    console.warn("[Branch] ⚠️ Failed to load native react-native-branch module:", err);
    branch = null;
  }
}

// ─── Module-level state ───────────────────────────────────────────────────────
// Populated once Branch session fires (onOpenComplete).
// Read by getBranchDeviceToken() / getBranchAttribution() from anywhere in the app.

let _branchDeviceToken: string | null = null;
let _branchAttribution: BranchAttribution | null = null;

/**
 * Returns the Branch randomized_device_token captured from the last session.
 * Will be null until the first onOpenComplete fires after app boot.
 */
export function getBranchDeviceToken(): string | null {
  return _branchDeviceToken;
}

/**
 * Returns the captured Branch attribution object (UTM parameters).
 */
export function getBranchAttribution(): BranchAttribution | null {
  return _branchAttribution;
}

/**
 * Manually updates the Branch attribution object.
 */
export function setBranchAttribution(attribution: BranchAttribution): void {
  _branchAttribution = attribution;
}

/**
 * Initialize Branch SDK session listener.
 *
 * This MUST be called once, as early as possible in the app lifecycle
 * (inside the root layout component's useEffect on mount).
 *
 * Returns a cleanup function that removes the subscription.
 */
export function initBranch(): () => void {
  if (!branch) {
    if (__DEV__) {
      console.log(
        "[Branch] ℹ️ Native RNBranch module not linked in this binary (requires native build/prebuild). Session subscription skipped."
      );
    }
    return () => {};
  }

  console.log("[Branch] 🌿 Subscribing to Branch session...");

  const unsubscribe = branch.subscribe({
    onOpenStart: ({ uri, cachedInitialEvent }: { uri?: string; cachedInitialEvent?: boolean }) => {
      // Fires when Branch begins processing a URI.
      // cachedInitialEvent=true means this is the very first open on install.
      console.log(
        `[Branch] 🔗 onOpenStart | uri=${uri} | cached=${cachedInitialEvent}`
      );
    },

    onOpenComplete: ({ error, params, uri }: { error?: any; params?: any; uri?: string }) => {
      if (error) {
        // Branch emits this as a string warning (not a real error) when the
        // native session is already active and JS re-subscribes (e.g. Fast
        // Refresh in dev). Safe to ignore — session & events are unaffected.
        if (
          typeof error === "string" &&
          error.includes("Session initialization already happened")
        ) {
          console.log(
            "[Branch] ℹ️ Session already initialized (expected in dev — no action needed)"
          );
        } else {
          console.error("[Branch] ❌ onOpenComplete error:", error);
          return;
        }
      }

      // Log Branch params for validation in adb logcat / Branch Liveview.
      console.log("[Branch] ✅ onOpenComplete | uri:", uri);
      console.log("[Branch] 📦 Session params:", JSON.stringify(params, null, 2));

      // +is_first_session → true on fresh install
      // ~channel           → traffic source channel
      // ~campaign          → campaign name
      if (params?.["+is_first_session"]) {
        console.log("[Branch] 🎉 INSTALL detected — first session flag is true");
      } else {
        console.log("[Branch] 🔄 OPEN / REINSTALL — existing session");
      }

      // Store the randomized_device_token so it can be included in API calls.
      // This token uniquely identifies this device in Branch's system and is
      // used by the backend for attribution enrichment.
      const token = (params?.["randomized_device_token"] as string) ?? null;
      if (token) {
        _branchDeviceToken = token;
        console.log(
          "[Branch] 🔑 randomized_device_token stored:",
          `${String(token).slice(0, 10)}...`
        );
      }

      // ── Attribution Mapping (UTM parameters) ───────────────────────────────
      // Extract custom UTM query parameters merged by Branch
      const utmSource = (params?.["utm_source"] as string)?.trim() || undefined;
      const utmExtSource = (params?.["utm_extsource"] as string)?.trim() || undefined;
      const utmMedium = (params?.["utm_medium"] as string)?.trim() || undefined;
      const utmCampaign = (params?.["utm_campaign"] as string)?.trim() || undefined;
      const utmCampaignId = (params?.["utm_campaignID"] as string)?.trim() || undefined;

      if (utmSource || utmExtSource || utmMedium || utmCampaign || utmCampaignId) {
        const attribution: BranchAttribution = {
          source: utmSource,
          sub_source: utmExtSource,
          medium: utmMedium,
          campaign_name: utmCampaign,
          campaign_id: utmCampaignId,
        };
        setBranchAttribution(attribution);
        console.log(
          "[Branch] 🎯 Attribution captured from link params:",
          JSON.stringify(attribution)
        );
      }

      // ── Branch Link Auto-Routing ───────────────────────────────────────────
      const isBranchLink = uri && (
        uri.includes("app.link") || 
        uri.includes("test-app.link") || 
        uri.includes("rapid-money://open")
      );
      
      if (isBranchLink) {
        console.log("[Branch] 🔗 Branch link launch detected. Routing to /welcome...");
        router.replace("/welcome");
      }
    },
  });

  console.log("[Branch] 🌿 Branch subscriber registered successfully");

  return unsubscribe;
}

/**
 * Sets the identity of the user in Branch.
 * This should be called after a successful OTP verification when a customer_id is received.
 */
export function setBranchIdentity(customerId: string): void {
  if (!customerId) {
    console.warn("[Branch] ⚠️ Attempted to set identity with an empty or invalid customer_id.");
    return;
  }
  if (!branch) {
    if (__DEV__) {
      console.log(
        `[Branch] ℹ️ setBranchIdentity(${customerId}) skipped (native module not available in this build)`
      );
    }
    return;
  }
  console.log(`[Branch] 👤 Setting identity to: ${customerId}`);
  branch.setIdentity(customerId);
}

/**
 * Alias for setBranchIdentity for backwards-compatibility with existing calls.
 */
export function identifyBranchUser(userId: string): void {
  setBranchIdentity(userId);
}

/**
 * Clears the identity of the user in Branch and resets local token/attribution state on logout.
 */
export function logoutBranch(): void {
  console.log("[Branch] 🚪 Clearing user identity on logout");
  _branchDeviceToken = null;
  _branchAttribution = null;
  if (branch) {
    branch.logout();
  }
}
