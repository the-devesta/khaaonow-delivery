import Constants from "expo-constants";
import { Platform } from "react-native";
import SettingsService from "./settings.service";

export type AppUpdateCheckResult =
  | { status: "up_to_date" }
  | {
      status: "update_available";
      latestVersion: string;
      url: string;
      notes?: string;
      forceUpdate: boolean;
    };

/**
 * Numeric per-segment comparison so "1.10.0" is correctly newer than
 * "1.9.0" (a plain string compare would get this backwards).
 */
export const compareVersions = (a: string, b: string): number => {
  const segmentsA = String(a || "0").split(".");
  const segmentsB = String(b || "0").split(".");
  const length = Math.max(segmentsA.length, segmentsB.length);

  for (let i = 0; i < length; i += 1) {
    const numA = Number.parseInt(segmentsA[i] ?? "0", 10) || 0;
    const numB = Number.parseInt(segmentsB[i] ?? "0", 10) || 0;
    if (numA !== numB) return numA - numB;
  }
  return 0;
};

/** This app's version as declared in app.json — works identically in Expo
 * Go and real builds, unlike expo-application's native version (which in
 * Expo Go reflects the Expo Go host app, not this project). */
export function getCurrentAppVersion(): string {
  return Constants.expoConfig?.version || "0.0.0";
}

/**
 * Reads the existing admin-configured min/latest version + update URL +
 * force-update message (Settings collection, admin panel's "App" tab —
 * already live infra, not something new). currentVersion < minVersion is
 * treated as mandatory (forceUpdate: true); currentVersion < latestVersion
 * but >= minVersion is a dismissible "update available" prompt.
 */
export async function checkForAppUpdate(): Promise<AppUpdateCheckResult> {
  const status = await SettingsService.getPublicAppStatus();
  const platform = Platform.OS === "ios" ? "ios" : "android";
  const platformTarget = status.deliveryApp.platforms?.[platform];

  const minVersion = platformTarget?.minVersion || status.deliveryApp.minVersion;
  const latestVersion =
    platformTarget?.latestVersion || status.deliveryApp.latestVersion;
  const url =
    platformTarget?.updateUrl ||
    (platform === "ios"
      ? status.deliveryApp.updateUrls.ios
      : status.deliveryApp.updateUrls.android);
  const currentVersion = getCurrentAppVersion();

  if (!url || compareVersions(currentVersion, latestVersion) >= 0) {
    return { status: "up_to_date" };
  }

  return {
    status: "update_available",
    latestVersion,
    url,
    notes:
      compareVersions(currentVersion, minVersion) < 0
        ? status.deliveryApp.forceUpdateMessage
        : undefined,
    forceUpdate: compareVersions(currentVersion, minVersion) < 0,
  };
}
