/**
 * Profile — one list: your details, payout account, language, alerts, help,
 * app version, log out. Delete account sits at the very bottom.
 */
import { Card, ListGroup, ListRow, Pill, SectionTitle, TabScreen } from "@/components/kit";
import UpdateAppDialog from "@/components/UpdateAppDialog";
import { useAppUpdateCheck } from "@/hooks/useAppUpdateCheck";
import { AppLanguage, getLanguageLabel, LANGUAGES, setSavedLanguage } from "@/i18n";
import { ApiService } from "@/services/api";
import { useAuthStore } from "@/store/auth";
import { color } from "@/theme/tokens";
import {
  getPushNotificationPermissionStatus,
  registerForPushNotificationsAsync,
  registerPushTokenWithBackend,
} from "@/utils/notifications";
import { openPhoneDialer } from "@/utils/phone";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Image, Linking, RefreshControl, ScrollView, Switch, Text, View } from "react-native";

const SUPPORT_PHONE = "+919875054898";
const SUPPORT_WHATSAPP = "919875054898";

const initials = (name?: string) =>
  (name || "KN")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");

export default function ProfileScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { partner, phoneNumber, fetchProfile, logout } = useAuthStore();
  const p = partner as any;
  const appUpdate = useAppUpdateCheck();
  const [showUpdate, setShowUpdate] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pushOn, setPushOn] = useState(false);
  const [stats, setStats] = useState<{ rating?: number; completedOrders?: number }>({});

  const loadStats = async () => {
    const res = await ApiService.getProfile();
    if (res.success && res.data) setStats(res.data as any);
  };

  useEffect(() => {
    void loadStats();
    appUpdate.check();
    getPushNotificationPermissionStatus().then((s) => setPushOn(s === "granted"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const togglePush = async (on: boolean) => {
    if (!on) {
      // OS owns the permission; send the rider there to turn it off.
      Linking.openSettings();
      return;
    }
    const token = await registerForPushNotificationsAsync({ requestPermission: true });
    if (token) {
      await registerPushTokenWithBackend(token);
      setPushOn(true);
    } else {
      Alert.alert(t("me.alertsOffTitle"), t("me.alertsOffBody"), [
        { text: t("common.close"), style: "cancel" },
        { text: t("me.openSettings"), onPress: () => Linking.openSettings() },
      ]);
    }
  };

  const pickLanguage = () =>
    Alert.alert(t("me.language"), "", [
      ...LANGUAGES.map((l) => ({ text: l.nativeLabel, onPress: () => setSavedLanguage(l.code as AppLanguage) })),
      { text: t("common.close"), style: "cancel" as const },
    ]);

  const whatsapp = async () => {
    const text = encodeURIComponent(t("me.whatsappText", { name: p?.name || "", phone: phoneNumber || "" }));
    const app = `whatsapp://send?phone=${SUPPORT_WHATSAPP}&text=${text}`;
    Linking.openURL((await Linking.canOpenURL(app)) ? app : `https://api.whatsapp.com/send?phone=${SUPPORT_WHATSAPP}&text=${text}`);
  };

  const confirmLogout = () =>
    Alert.alert(t("pending.logout"), t("pending.logoutConfirm"), [
      { text: t("common.close"), style: "cancel" },
      {
        text: t("pending.logout"),
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/auth/login");
        },
      },
    ]);

  const confirmDelete = () =>
    Alert.alert(t("me.deleteTitle"), t("me.deleteBody"), [
      { text: t("common.close"), style: "cancel" },
      {
        text: t("me.deleteConfirm"),
        style: "destructive",
        onPress: async () => {
          const res = await ApiService.deleteAccount();
          if (!res.success) {
            Alert.alert(t("common.failed"), res.message || t("common.tryAgain"));
            return;
          }
          await logout();
          router.replace("/auth/login");
        },
      },
    ]);

  const updateReady = appUpdate.result?.status === "update_available";
  const vehicle = [p?.vehicleType, p?.vehicleNumber].filter(Boolean).join(" · ");
  const photo = p?.profilePhoto || p?.avatar;
  const payoutLabel = p?.upiId || (p?.bankAccountNumber ? `•••• ${String(p.bankAccountNumber).slice(-4)}` : t("me.notAdded"));

  return (
    <View style={{ flex: 1, backgroundColor: color.canvas }}>
      <TabScreen
        title={t("me.title")}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await Promise.all([fetchProfile(), loadStats()]);
              setRefreshing(false);
            }}
          />
        }>
        <Card>
          <View className="flex-row items-center gap-4">
            {photo && /^https?:/.test(photo) ? (
              <Image source={{ uri: photo }} style={{ width: 64, height: 64, borderRadius: 32 }} />
            ) : (
              <View className="w-16 h-16 rounded-full bg-brand items-center justify-center">
                <Text className="text-xl font-extrabold text-ink">{initials(p?.name)}</Text>
              </View>
            )}
            <View className="flex-1 gap-1">
              <Text className="text-xl font-extrabold text-ink" numberOfLines={1}>
                {p?.name || t("home.rider")}
              </Text>
              <Text className="text-sm text-muted">{p?.phone || phoneNumber}</Text>
              {p?.isApproved ? <Pill label={t("me.verified")} tone="success" /> : null}
            </View>
          </View>
          <View className="flex-row mt-4 pt-4 border-t border-line">
            <View className="flex-1 items-center">
              <Text className="text-lg font-extrabold text-ink">{stats.completedOrders ?? p?.completedOrders ?? 0}</Text>
              <Text className="text-xs text-muted">{t("me.deliveries")}</Text>
            </View>
            <View className="flex-1 items-center border-l border-line">
              <Text className="text-lg font-extrabold text-ink">
                {stats.rating ? `${Number(stats.rating).toFixed(1)} ★` : "—"}
              </Text>
              <Text className="text-xs text-muted">{t("me.rating")}</Text>
            </View>
          </View>
        </Card>

        <SectionTitle title={t("me.account")} />
        <ListGroup>
          <ListRow icon="person-outline" title={t("me.details")} subtitle={vehicle || undefined} onPress={() => router.push("/profile/edit")} />
          <ListRow icon="wallet-outline" title={t("me.payout")} subtitle={payoutLabel} onPress={() => router.push("/profile/payments")} />
          <ListRow icon="notifications-outline" title={t("me.inbox")} onPress={() => router.push("/profile/notifications")} />
        </ListGroup>

        <SectionTitle title={t("me.app")} />
        <ListGroup>
          <ListRow icon="language-outline" title={t("me.language")} value={getLanguageLabel(i18n.language)} onPress={pickLanguage} />
          <View className="flex-row items-center gap-3 px-4 py-3" style={{ minHeight: 52 }}>
            <View className="w-10 h-10 rounded-full items-center justify-center bg-canvas">
              <Ionicons name="megaphone-outline" size={20} color={color.ink} />
            </View>
            <View className="flex-1">
              <Text className="text-base font-semibold text-ink">{t("me.orderAlerts")}</Text>
              <Text className="text-sm text-muted">{t("me.orderAlertsHint")}</Text>
            </View>
            <Switch value={pushOn} onValueChange={togglePush} trackColor={{ true: color.success }} />
          </View>
          <ListRow
            icon={updateReady ? "rocket-outline" : "phone-portrait-outline"}
            title={updateReady ? t("me.updateReady", { version: appUpdate.result?.status === "update_available" ? appUpdate.result.latestVersion : "" }) : t("me.version")}
            value={`v${appUpdate.currentVersion}`}
            onPress={updateReady ? () => setShowUpdate(true) : () => appUpdate.check()}
            chevron={updateReady}
          />
        </ListGroup>

        <SectionTitle title={t("me.help")} />
        <ListGroup>
          <ListRow icon="call-outline" title={t("me.callSupport")} subtitle="+91 98750 54898" onPress={() => openPhoneDialer(SUPPORT_PHONE)} />
          <ListRow icon="logo-whatsapp" title={t("me.whatsappSupport")} onPress={whatsapp} />
        </ListGroup>

        <ListGroup>
          <ListRow icon="log-out-outline" title={t("pending.logout")} danger chevron={false} onPress={confirmLogout} />
        </ListGroup>

        <Text onPress={confirmDelete} className="text-sm text-muted text-center underline py-2">
          {t("me.deleteTitle")}
        </Text>
      </TabScreen>

      {updateReady && appUpdate.result ? (
        <UpdateAppDialog visible={showUpdate} updateInfo={appUpdate.result as any} onDismiss={() => setShowUpdate(false)} />
      ) : null}
    </View>
  );
}
