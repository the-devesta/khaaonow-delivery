/** Trips — current deliveries (with the stop order when batched) and history. */
import { Card, EmptyState, Pill, rupees, SectionTitle, Segmented } from "@/components/kit";
import { useOrderStore } from "@/store/orders";
import { color } from "@/theme/tokens";
import { NEXT_STEP_KEY } from "@/utils/orderView";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Tab = "active" | "delivered" | "cancelled";

const when = (value?: string | Date) =>
  value
    ? new Date(value).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })
    : "";

export default function TripsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { orderHistory, activeOrder, activeOrders, routePlan, fetchOrderHistory, fetchAssignedOrders, fetchRoutePlan } =
    useOrderStore();
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<Tab | null>(null);

  useEffect(() => {
    fetchOrderHistory();
    fetchAssignedOrders();
    fetchRoutePlan();
  }, [fetchOrderHistory, fetchAssignedOrders, fetchRoutePlan]);

  const all = useMemo(
    () =>
      Array.from(
        new Map([...orderHistory, ...activeOrders, ...(activeOrder ? [activeOrder] : [])].map((o) => [o.id, o])).values(),
      ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [orderHistory, activeOrders, activeOrder],
  );
  const active = all.filter((o) => !["delivered", "cancelled"].includes(o.status));
  const current: Tab = tab ?? (active.length ? "active" : "delivered");
  const list = current === "active" ? active : all.filter((o) => o.status === current);

  return (
    <View style={{ flex: 1, backgroundColor: color.canvas }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await Promise.all([fetchOrderHistory(), fetchAssignedOrders(), fetchRoutePlan()]);
              setRefreshing(false);
            }}
          />
        }
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: 120, gap: 12 }}>
        <Text className="text-2xl font-extrabold text-ink">{t("trips.title")}</Text>

        <Segmented
          value={current}
          onChange={setTab}
          options={[
            { value: "active", label: active.length ? t("trips.activeCount", { count: active.length }) : t("trips.active") },
            { value: "delivered", label: t("trips.delivered") },
            { value: "cancelled", label: t("trips.cancelled") },
          ]}
        />

        {/* Stop order when carrying more than one order */}
        {current === "active" && routePlan && routePlan.activeOrderCount > 1 && routePlan.stops.length > 0 ? (
          <>
            <SectionTitle title={t("trips.stopOrder", { km: routePlan.totalDistanceKm })} />
            <Card padded={false}>
              {routePlan.stops.map((stop, i) => {
                const pickup = stop.type === "pickup";
                return (
                  <Pressable
                    key={`${stop.orderId}-${stop.type}-${stop.sequence}`}
                    onPress={() => router.push(`/orders/${stop.orderId}`)}
                    className={`flex-row items-center gap-3 px-4 py-3 ${i ? "border-t border-line" : ""}`}>
                    <View
                      className={`w-8 h-8 rounded-full items-center justify-center ${pickup ? "bg-brand-soft" : "bg-success-soft"}`}>
                      <Text className="text-sm font-extrabold text-ink">{stop.sequence}</Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-sm font-bold text-ink" numberOfLines={1}>
                        {pickup ? t("trips.pickup") : t("trips.drop")} · {pickup ? stop.restaurantName : stop.customerName}
                      </Text>
                      {stop.address ? (
                        <Text className="text-xs text-muted" numberOfLines={1}>
                          {stop.address}
                        </Text>
                      ) : null}
                    </View>
                    <Text className="text-xs font-bold text-muted">{stop.distanceKm} km</Text>
                  </Pressable>
                );
              })}
            </Card>
          </>
        ) : null}

        {list.length === 0 ? (
          <EmptyState
            icon={current === "active" ? "bicycle-outline" : "receipt-outline"}
            title={current === "active" ? t("trips.noActive") : t("trips.none")}
            body={current === "active" ? t("trips.noActiveBody") : undefined}
          />
        ) : (
          list.map((order: any) => (
            <Card key={order.id} onPress={() => router.push(`/orders/${order.id}`)}>
              <View className="flex-row items-center justify-between mb-2">
                {current === "active" ? (
                  <Pill label={t(NEXT_STEP_KEY[order.status] || "home.nextGoRestaurant")} tone="brand" />
                ) : current === "delivered" ? (
                  <Pill label={t("trips.delivered")} tone="success" />
                ) : (
                  <Pill label={t("trips.cancelled")} tone="danger" />
                )}
                <Text className="text-xs text-muted">{when(order.createdAt)}</Text>
              </View>
              <View className="flex-row items-center gap-2">
                <Ionicons name="restaurant" size={16} color={color.muted} />
                <Text className="flex-1 text-base font-bold text-ink" numberOfLines={1}>
                  {order.restaurantName}
                </Text>
                {current !== "cancelled" ? (
                  <Text className="text-base font-extrabold text-success">{rupees(order.earnings)}</Text>
                ) : null}
              </View>
              {order.customerAddress ? (
                <View className="flex-row items-center gap-2 mt-1">
                  <Ionicons name="location" size={16} color={color.muted} />
                  <Text className="flex-1 text-sm text-ink-soft" numberOfLines={1}>
                    {order.customerAddress}
                  </Text>
                </View>
              ) : null}
            </Card>
          ))
        )}
      </ScrollView>
    </View>
  );
}
