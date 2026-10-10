/** Inbox — messages KhaaoNow has sent you. */
import { EmptyState, Screen } from "@/components/kit";
import { ApiService } from "@/services/api";
import { color } from "@/theme/tokens";
import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, RefreshControl, Text, View } from "react-native";

export default function Inbox() {
  const { t } = useTranslation();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const res = await ApiService.getNotifications();
    if (res.success && res.data) setItems(res.data.notifications || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Screen
      title={t("me.inbox")}
      back
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
        />
      }>
      {loading ? (
        <ActivityIndicator color={color.ink} style={{ paddingVertical: 32 }} />
      ) : items.length === 0 ? (
        <EmptyState icon="notifications-off-outline" title={t("me.inboxEmpty")} />
      ) : (
        items.map((n) => (
          <View key={n._id} className="bg-surface rounded-2xl border border-line p-4 gap-1">
            <View className="flex-row items-start gap-2">
              <Text className="flex-1 text-base font-bold text-ink">{n.title}</Text>
              <Text className="text-xs text-muted">
                {new Date(n.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
              </Text>
            </View>
            <Text className="text-sm text-ink-soft">{n.body}</Text>
          </View>
        ))
      )}
    </Screen>
  );
}
