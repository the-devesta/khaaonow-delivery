import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as SplashScreen from "expo-splash-screen";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { router } from "expo-router";
import React, { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { Button } from "@/components/kit";
import settingsService, { PublicAppStatus } from "@/services/settings.service";
import { color } from "@/theme/tokens";

type GateState =
  | { type: "checking" }
  | { type: "ready" }
  | { type: "maintenance"; message: string }
  | { type: "force-update"; message: string; updateUrl?: string };

type SoftUpdateInfo = {
  latestVersion: string;
  updateUrl?: string;
};

type PlatformUpdateTarget = {
  minVersion: string;
  latestVersion: string;
  updateUrl?: string;
};

const DISMISSED_SOFT_UPDATE_KEY = "dismissed_soft_update_version";

// No SafeAreaProvider is mounted at the app root, so use a fixed top offset.
const BANNER_TOP_OFFSET = Platform.OS === "ios" ? 50 : 24;

const compareVersions = (current: string, minimum: string): number => {
  const currentParts = current.split(".").map((part) => Number(part) || 0);
  const minimumParts = minimum.split(".").map((part) => Number(part) || 0);
  const length = Math.max(currentParts.length, minimumParts.length);

  for (let index = 0; index < length; index += 1) {
    const currentPart = currentParts[index] ?? 0;
    const minimumPart = minimumParts[index] ?? 0;

    if (currentPart > minimumPart) return 1;
    if (currentPart < minimumPart) return -1;
  }

  return 0;
};

const getCurrentVersion = () => Constants.expoConfig?.version ?? "0.0.0";

const getPlatformUpdateTarget = (status: PublicAppStatus): PlatformUpdateTarget => {
  const platform = Platform.OS === "ios" ? "ios" : "android";
  const platformTarget = status.deliveryApp.platforms?.[platform];

  return {
    minVersion: platformTarget?.minVersion || status.deliveryApp.minVersion,
    latestVersion: platformTarget?.latestVersion || status.deliveryApp.latestVersion,
    updateUrl:
      platformTarget?.updateUrl ||
      (platform === "ios"
        ? status.deliveryApp.updateUrls.ios
        : status.deliveryApp.updateUrls.android) ||
      undefined,
  };
};

// Gate check runs once at cold launch only (not re-checked mid-navigation),
// so a force-update prompt can't strand a delivery partner mid-delivery.
export default function AppStatusGate({ children }: { children: ReactNode }) {
  const [gateState, setGateState] = useState<GateState>({ type: "checking" });
  const [softUpdate, setSoftUpdate] = useState<SoftUpdateInfo | null>(null);
  const { t } = useTranslation();

  // The native splash is normally hidden by app/splash.tsx, which never mounts
  // while this gate blocks — hide it here or the rider is stuck on the logo.
  useEffect(() => {
    if (gateState.type === "maintenance" || gateState.type === "force-update") {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [gateState.type]);

  const checkStatus = useCallback(async () => {
    setGateState({ type: "checking" });
    setSoftUpdate(null);

    try {
      const status = await settingsService.getPublicAppStatus();

      if (status.maintenance.enabled) {
        setGateState({
          type: "maintenance",
          message: status.maintenance.message,
        });
        return;
      }

      const currentVersion = getCurrentVersion();
      const updateTarget = getPlatformUpdateTarget(status);
      const mustUpdate = compareVersions(currentVersion, updateTarget.minVersion) < 0;

      if (mustUpdate) {
        setGateState({
          type: "force-update",
          message: status.deliveryApp.forceUpdateMessage,
          updateUrl: updateTarget.updateUrl,
        });
        return;
      }

      setGateState({ type: "ready" });

      const latestVersion = updateTarget.latestVersion;
      const hasNewerVersion = compareVersions(currentVersion, latestVersion) < 0;
      if (hasNewerVersion) {
        const dismissedVersion = await AsyncStorage.getItem(
          DISMISSED_SOFT_UPDATE_KEY,
        );
        if (dismissedVersion !== latestVersion) {
          setSoftUpdate({ latestVersion, updateUrl: updateTarget.updateUrl });
        }
      }
    } catch {
      setGateState({ type: "ready" });
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  const dismissSoftUpdate = useCallback(async () => {
    if (!softUpdate) return;
    await AsyncStorage.setItem(DISMISSED_SOFT_UPDATE_KEY, softUpdate.latestVersion);
    setSoftUpdate(null);
  }, [softUpdate]);

  const actionLabel = useMemo(() => {
    if (gateState.type === "force-update") return t("gate.update");
    return t("gate.tryAgain");
  }, [gateState.type, t]);

  if (gateState.type === "ready") {
    if (!softUpdate) {
      return <>{children}</>;
    }
    return (
      <>
        {children}
        <View
          style={{ paddingTop: BANNER_TOP_OFFSET }}
          className="absolute left-0 right-0 top-0 bg-[#111827]">
          <View className="flex-row items-center justify-between px-4 py-3">
            <View className="flex-1 pr-3">
              <Text className="text-white font-bold text-sm">
                Update available
              </Text>
              <Text className="text-white/70 text-xs mt-0.5">
                A newer version of KhaaoNow Delivery is ready.
              </Text>
            </View>
            <View className="flex-row items-center">
              <TouchableOpacity
                onPress={async () => {
                  if (softUpdate.updateUrl) {
                    await Linking.openURL(softUpdate.updateUrl);
                  }
                }}
                className="rounded-full bg-orange-500 px-4 py-2 mr-2">
                <Text className="text-white font-semibold text-xs">
                  Update
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={dismissSoftUpdate} className="p-1">
                <Text className="text-white/70 font-bold text-base">×</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </>
    );
  }

  if (gateState.type === "checking") {
    return (
      <View className="flex-1 items-center justify-center bg-orange-500 px-8">
        <ActivityIndicator color="#ffffff" size="large" />
      </View>
    );
  }

  const handleAction = async () => {
    if (gateState.type === "force-update" && gateState.updateUrl) {
      await Linking.openURL(gateState.updateUrl);
      return;
    }

    if (gateState.type === "force-update") {
      router.replace("/");
      return;
    }

    checkStatus();
  };

  const updating = gateState.type === "force-update";
  return (
    <View style={{ flex: 1, backgroundColor: color.canvas }} className="items-center justify-center px-6">
      <View className="w-full max-w-[380px] items-center gap-3">
        <View className="w-20 h-20 rounded-full bg-brand items-center justify-center mb-2">
          <Ionicons name={updating ? "rocket-outline" : "construct-outline"} size={36} color={color.ink} />
        </View>
        <Text className="text-2xl font-extrabold text-ink text-center">
          {updating ? t("gate.updateTitle") : t("gate.maintenanceTitle")}
        </Text>
        <Text className="text-base text-ink-soft text-center mb-4">
          {updating ? t("gate.updateBody") : t("gate.maintenanceBody")}
        </Text>
        <View className="self-stretch">
          <Button title={actionLabel} icon={updating ? "download-outline" : "refresh"} onPress={handleAction} />
        </View>
      </View>
    </View>
  );
}
