/** Application not approved — explain and offer support. */
import { Button, ListGroup, ListRow } from "@/components/kit";
import { useAuthStore } from "@/store/auth";
import { color } from "@/theme/tokens";
import { openPhoneDialer } from "@/utils/phone";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function AccountRejected() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { logout } = useAuthStore();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: color.canvas }}
      contentContainerStyle={{ paddingTop: insets.top + 32, paddingHorizontal: 16, paddingBottom: insets.bottom + 24, gap: 14 }}>
      <View className="items-center gap-3 px-4">
        <View className="w-24 h-24 rounded-full bg-danger-soft items-center justify-center">
          <Ionicons name="close-circle-outline" size={48} color={color.danger} />
        </View>
        <Text className="text-2xl font-extrabold text-ink text-center">{t("rejected.title")}</Text>
        <Text className="text-base text-ink-soft text-center">{t("rejected.body")}</Text>
      </View>
      <Button title={t("order.callSupport")} icon="call" onPress={() => openPhoneDialer("+919875054898")} />
      <ListGroup>
        <ListRow
          icon="log-out-outline"
          title={t("pending.logout")}
          danger
          onPress={async () => {
            await logout();
            router.replace("/auth/login");
          }}
        />
      </ListGroup>
    </ScrollView>
  );
}
