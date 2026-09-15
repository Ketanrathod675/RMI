import * as Application from "expo-application";
import { Dimensions, PixelRatio, Platform } from "react-native";

export type BranchDeviceContext = {
  os: string;
  os_version: string | null;
  environment: string;
  brand: string | null;
  model: string | null;
  app_version: string | null;
  platform: string;
  android_id: string | null;
  aaid: string | null;
  advertising_id: string | null;
  limit_ad_tracking: boolean | null;
  screen_width: number;
  screen_height: number;
  screen_dpi: number;
  randomized_device_token: string | null;
  country: string | null;
  language: string | null;
  local_ip: string | null;
};

export async function collectDeviceContext(
  branchDeviceToken?: string | null
): Promise<BranchDeviceContext> {
  const { width: screenWidth, height: screenHeight } = Dimensions.get("window");
  const pixelRatio = PixelRatio.get();
  const screenDpi = Math.round(pixelRatio * 160);

  let androidId: string | null = null;
  if (Platform.OS === "android") {
    try {
      androidId = Application.getAndroidId() ?? null;
    } catch {
      androidId = null;
    }
  }

  return {
    os: Platform.OS,
    os_version: Platform.Version != null ? String(Platform.Version) : null,
    environment: __DEV__ ? "development" : "production",
    brand: null,
    model: null,
    app_version: Application.nativeApplicationVersion ?? "1.0.0",
    platform: Platform.OS,
    android_id: androidId,
    aaid: null,
    advertising_id: null,
    limit_ad_tracking: null,
    screen_width: screenWidth,
    screen_height: screenHeight,
    screen_dpi: screenDpi,
    randomized_device_token: branchDeviceToken ?? null,
    country: null,
    language: null,
    local_ip: null,
  };
}

export async function getBranchDeviceContext(
  branchDeviceToken?: string | null
): Promise<BranchDeviceContext> {
  return collectDeviceContext(branchDeviceToken);
}
