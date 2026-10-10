/**
 * Waiting for approval. Checks automatically every 30s (and on "Check now"),
 * and moves into the app the moment an admin approves the rider.
 */
import { Button, Card, ListGroup, ListRow } from "@/components/kit";
import { useAuthStore } from "@/store/auth";
import { color } from "@/theme/tokens";
import { openPhoneDialer } from "@/utils/phone";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, BackHandler, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { signupEdit } from "@/utils/signupEdit";

const SUPPORT_PHONE = "+919875054898";
const PENDING_ROUTE = "/registration/account-pending";

export default function AccountPending() {
  // Back on the review screen: any "edit my details" detour is over.
  useEffect(() => {
    signupEdit.stop();
  }, []);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { logout, fetchProfile, partner } = useAuthStore();
  const [checking, setChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const check = useCallback(
    async (manual = false) => {
      if (manual) setChecking(true);
      try {
        await fetchProfile();
        setLastChecked(new Date());
        const route = useAuthStore.getState().getNavigationRoute();
        if (route !== PENDING_ROUTE) router.replace(route as any);
        else if (manual) Alert.alert(t("pending.stillReviewing"), t("pending.stillReviewingBody"));
      } catch {
        if (manual) Alert.alert(t("common.failed"), t("common.tryAgain"));
      } finally {
        if (manual) setChecking(false);
      }
    },
    [fetchProfile, t],
  );

  useEffect(() => {
    void check();
    const id = setInterval(() => void check(), 30_000);
    // Nothing to go back to from here.
    const sub = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [check]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: color.canvas }}
      contentContainerStyle={{ paddingTop: insets.top + 32, paddingHorizontal: 16, paddingBottom: insets.bottom + 24, gap: 14 }}>
      <View className="items-center gap-3 px-4">
        <View className="w-24 h-24 rounded-full bg-brand items-center justify-center">
          <Ionicons name="hourglass-outline" size={44} color={color.ink} />
        </View>
        <Text className="text-2xl font-extrabold text-ink text-center">{t("pending.title")}</Text>
        <Text className="text-base text-ink-soft text-center">
          {t("pending.body", { name: (partner as any)?.name ? `, ${(partner as any).name}` : "" })}
        </Text>
      </View>

      <Card>
        {[
          { icon: "checkmark-circle" as const, done: true, label: t("pending.stepSubmitted") },
          { icon: "time" as const, done: false, label: t("pending.stepReview") },
          { icon: "bicycle" as const, done: false, label: t("pending.stepStart") },
        ].map((s, i) => (
          <View key={s.label} className={`flex-row items-center gap-3 ${i > 0 ? "mt-3" : ""}`}>
            <Ionicons name={s.icon} size={22} color={s.done ? color.success : i === 1 ? color.warning : color.faint} />
            <Text className={`flex-1 text-base ${s.done || i === 1 ? "font-bold text-ink" : "text-muted"}`}>{s.label}</Text>
          </View>
        ))}
      </Card>

      <Button title={t("pending.checkNow")} icon="refresh" loading={checking} onPress={() => check(true)} />
      {lastChecked ? (
        <Text className="text-xs text-muted text-center">
          {t("pending.autoChecks", { time: lastChecked.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) })}
        </Text>
      ) : null}

      <ListGroup>
        <ListRow icon="call-outline" title={t("order.callSupport")} subtitle="+91 98750 54898" onPress={() => openPhoneDialer(SUPPORT_PHONE)} />
        <ListRow icon="create-outline" title={t("pending.editDetails")} onPress={() => {
            signupEdit.start();
            router.replace("/registration/about");
          }} />
        <ListRow
          icon="log-out-outline"
          title={t("pending.logout")}
          danger
          onPress={() =>
            Alert.alert(t("pending.logout"), t("pending.logoutConfirm"), [
              { text: t("common.cancel"), style: "cancel" },
              {
                text: t("pending.logout"),
                style: "destructive",
                onPress: async () => {
                  await logout();
                  router.replace("/auth/login");
                },
              },
            ])
          }
        />
      </ListGroup>
    </ScrollView>
  );
}
