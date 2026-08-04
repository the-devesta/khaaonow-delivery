import { ApiService } from "@/services/api";
import { getCurrentAppVersion } from "@/services/appUpdateService";
import { useAuthStore } from "@/store/auth";
import { AppLanguage, getLanguageLabel, LANGUAGES, setSavedLanguage } from "@/i18n";
import {
  getPushNotificationPermissionStatus,
  registerForPushNotificationsAsync,
  registerPushTokenWithBackend,
} from "@/utils/notifications";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  ActivityIndicator,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const { logout } = useAuthStore();
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  useEffect(() => {
    getPushNotificationPermissionStatus().then((status) => {
      setNotificationsEnabled(status === "granted");
    });
  }, []);

  const handleNotificationToggle = async (enabled: boolean) => {
    if (!enabled) {
      setNotificationsEnabled(false);
      return;
    }

    const token = await registerForPushNotificationsAsync({
      requestPermission: true,
    });

    if (token) {
      await registerPushTokenWithBackend(token);
      setNotificationsEnabled(true);
    } else {
      setNotificationsEnabled(false);
      Alert.alert(
        t("settings.notificationsOff"),
        t("settings.notificationsOffMessage"),
      );
    }
  };

  const handleLanguagePress = () => {
    Alert.alert(
      t("settings.chooseLanguage"),
      "",
      [
        ...LANGUAGES.map((language) => ({
          text: language.nativeLabel,
          onPress: () => setSavedLanguage(language.code as AppLanguage),
        })),
        { text: t("common.cancel"), style: "cancel" as const },
      ],
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      t("settings.deleteAccount"),
      t("settings.deleteConfirm"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("settings.deleteAccount"),
          style: "destructive",
          onPress: confirmDeleteAccount,
        },
      ],
    );
  };

  const confirmDeleteAccount = async () => {
    try {
      setDeletingAccount(true);
      const response = await ApiService.deleteAccount();

      if (response.success) {
        // Clear local auth state
        await logout();
        // Navigate to login, replacing the whole stack so user can't go back
        router.replace("/auth/login");
      } else {
        Alert.alert(
          t("settings.error"),
          response.message || t("settings.failedDelete"),
        );
      }
    } catch (error: any) {
      Alert.alert(
        t("settings.error"),
        error?.message || t("settings.genericError"),
      );
    } finally {
      setDeletingAccount(false);
    }
  };

  return (
    <View className="flex-1 bg-[#F3E0D9]">
      <View
        style={{ paddingTop: insets.top }}
        className="px-6 pb-4 bg-white border-b border-gray-200">
        <View className="flex-row items-center justify-between">
          <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2">
            <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
          </TouchableOpacity>
          <Text className="text-xl font-bold text-[#1A1A1A]">
            {t("common.settings")}
          </Text>
          <View className="w-10" />
        </View>
      </View>

      <View className="p-6">
        <View className="bg-white rounded-3xl p-6  mb-6">
          <Text className="text-gray-900 font-bold mb-4 text-base">
            {t("settings.preferences")}
          </Text>

          <View className="flex-row items-center justify-between py-3 border-b border-gray-100">
            <View className="flex-row items-center">
              <Ionicons
                name="notifications-outline"
                size={22}
                color="#4B5563"
              />
              <Text className="text-gray-700 ml-3 font-medium">
                {t("settings.pushNotifications")}
              </Text>
            </View>
            <Switch
              trackColor={{ false: "#E5E7EB", true: "#F59E0B" }}
              thumbColor={"#FFFFFF"}
              onValueChange={handleNotificationToggle}
              value={notificationsEnabled}
            />
          </View>

          <TouchableOpacity
            onPress={handleLanguagePress}
            activeOpacity={0.75}
            className="flex-row items-center justify-between py-3">
            <View className="flex-row items-center">
              <Ionicons name="language-outline" size={22} color="#4B5563" />
              <Text className="text-gray-700 ml-3 font-medium">
                {t("common.language")}
              </Text>
            </View>
            <View className="flex-row items-center">
              <Text className="text-gray-500 mr-2">
                {getLanguageLabel(i18n.language)}
              </Text>
              <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
            </View>
          </TouchableOpacity>
        </View>

        <View className="bg-white rounded-3xl p-6 mb-6">
          <Text className="text-gray-900 font-bold mb-4 text-base">
            {t("settings.about")}
          </Text>

          <TouchableOpacity className="flex-row items-center justify-between py-3 border-b border-gray-100">
            <Text className="text-gray-700 font-medium ml-1">
              {t("settings.terms")}
            </Text>
            <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
          </TouchableOpacity>

          <TouchableOpacity className="flex-row items-center justify-between py-3 border-b border-gray-100">
            <Text className="text-gray-700 font-medium ml-1">
              {t("settings.privacy")}
            </Text>
            <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
          </TouchableOpacity>

          <View className="flex-row items-center justify-between py-3">
            <Text className="text-gray-700 font-medium ml-1">
              {t("settings.appVersion")}
            </Text>
            <Text className="text-gray-500">{getCurrentAppVersion()}</Text>
          </View>
        </View>

        {/* Danger Zone */}
        <View className="bg-red-50 rounded-3xl p-6 border border-red-100">
          <View className="flex-row items-center mb-1">
            <Ionicons name="warning-outline" size={18} color="#EF4444" />
            <Text className="text-red-600 font-bold text-base ml-2">
              {t("settings.dangerZone")}
            </Text>
          </View>
          <Text className="text-red-400 text-xs mb-4 font-medium">
            {t("settings.dangerDescription")}
          </Text>

          <TouchableOpacity
            onPress={handleDeleteAccount}
            disabled={deletingAccount}
            activeOpacity={0.8}
            className="bg-red-500 rounded-2xl py-4 items-center flex-row justify-center"
            style={{ opacity: deletingAccount ? 0.6 : 1 }}
          >
            {deletingAccount ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="trash-outline" size={20} color="#FFFFFF" />
            )}
            <Text className="text-white font-bold text-base ml-2">
              {deletingAccount
                ? t("settings.deletingAccount")
                : t("settings.deleteAccount")}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
