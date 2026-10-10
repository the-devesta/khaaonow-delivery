/**
 * An order the rider didn't answer in time. While it's still open they can
 * take it from Home; otherwise it just says what happened and can be cleared.
 */
import { Button, Card, Pill, rupees } from "@/components/kit";
import { MissedOrder, useOrderStore } from "@/store/orders";
import { color } from "@/theme/tokens";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

function useSecondsLeft(expiresAt: Date) {
  const calc = () => Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
  const [seconds, setSeconds] = useState(calc);
  useEffect(() => {
    const id = setInterval(() => {
      const left = calc();
      setSeconds(left);
      if (left <= 0) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expiresAt]);
  return seconds;
}

export default function MissedOrderCard({ missed }: { missed: MissedOrder }) {
  const router = useRouter();
  const { t } = useTranslation();
  const { acceptMissedOrder, dismissMissedOrder } = useOrderStore();
  const secondsLeft = useSecondsLeft(missed.expiresAt);
  const [accepting, setAccepting] = useState(false);
  const { order } = missed;

  const expired = secondsLeft <= 0;
  const canTake = missed.stillAvailable && missed.reason === "timeout" && !expired;
  const status = expired
    ? { label: t("missedOrder.expired"), tone: "neutral" as const }
    : missed.reason === "taken"
      ? { label: t("missedOrder.takenByAnother"), tone: "neutral" as const }
      : missed.reason === "cancelled"
        ? { label: t("missedOrder.cancelled"), tone: "danger" as const }
        : { label: t("missedOrder.stillOpen", { count: Math.ceil(secondsLeft / 60) }), tone: "warning" as const };

  const take = async () => {
    setAccepting(true);
    await acceptMissedOrder(order.id);
    setAccepting(false);
    if (useOrderStore.getState().activeOrder?.id === order.id) router.push(`/orders/${order.id}`);
  };

  return (
    <Card>
      <View className="flex-row items-center justify-between mb-2">
        <Pill label={status.label} tone={status.tone} />
        <Pressable onPress={() => dismissMissedOrder(order.id)} hitSlop={10} accessibilityLabel={t("missedOrder.dismiss")}>
          <Ionicons name="close" size={20} color={color.faint} />
        </Pressable>
      </View>
      <View className="flex-row items-center gap-2">
        <Ionicons name="restaurant" size={16} color={color.muted} />
        <Text className="flex-1 text-base font-bold text-ink" numberOfLines={1}>
          {order.restaurantName}
        </Text>
        <Text className="text-base font-extrabold text-success">{order.earnings > 0 ? rupees(order.earnings) : ""}</Text>
      </View>
      <View className="flex-row items-center gap-2 mt-1">
        <Ionicons name="location" size={16} color={color.muted} />
        <Text className="flex-1 text-sm text-ink-soft" numberOfLines={1}>
          {order.customerAddress}
        </Text>
        {order.distance > 0 ? <Text className="text-sm text-muted">{order.distance.toFixed(1)} km</Text> : null}
      </View>
      {canTake ? (
        <View className="mt-3">
          <Button title={t("missedOrder.accept")} icon="checkmark-circle" variant="success" size="md" loading={accepting} onPress={take} />
        </View>
      ) : null}
    </Card>
  );
}
