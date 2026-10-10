/**
 * New order popup — rings until the rider decides. Shows only what matters
 * for the decision: what you earn, how far, cash or paid, pickup and drop.
 * One big Accept button; Skip or the timer running out passes the order on.
 */
import { Button, rupees } from "@/components/kit";
import { Order } from "@/store/orders";
import { color } from "@/theme/tokens";
import { playRingtone, stopRingtone } from "@/utils/ringtone";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface OrderRequestModalProps {
  order: Order | null;
  onAccept: () => void;
  onReject: () => void;
  /** Override initial countdown (seconds). Pass remaining time when restoring from persisted state. */
  initialTimeLeft?: number;
}

export default function OrderRequestModal({ order, onAccept, onReject, initialTimeLeft }: OrderRequestModalProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const visible = order !== null;
  const timeout = order?.acceptanceTimeoutSeconds || 30;
  const [timeLeft, setTimeLeft] = useState(initialTimeLeft ?? timeout);

  // Accept hits the API and navigates; a double tap must not fire it twice.
  const latched = useRef(false);
  useEffect(() => {
    latched.current = false;
  }, [order?.id]);
  const accept = () => {
    if (latched.current) return;
    latched.current = true;
    void stopRingtone();
    onAccept();
  };
  const skip = () => {
    if (latched.current) return;
    latched.current = true;
    void stopRingtone();
    onReject();
  };

  useEffect(() => {
    if (visible) void playRingtone();
    else void stopRingtone();
    return () => {
      void stopRingtone();
    };
  }, [visible]);

  useEffect(() => {
    if (!visible || !order) return;
    setTimeLeft(initialTimeLeft ?? timeout);
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setTimeout(skip, 0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, order?.id]);

  if (!order) return null;
  const cash = order.paymentType === "cash" && order.paymentStatus !== "paid" && order.paymentStatus !== "completed";
  const urgent = timeLeft <= 10;

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={skip}>
      <View style={{ flex: 1, backgroundColor: color.overlay, justifyContent: "flex-end" }}>
        <View
          style={{ paddingBottom: Math.max(insets.bottom, 16), backgroundColor: color.surface }}
          className="rounded-t-[32px] px-5 pt-5 gap-4">
          {/* Title + countdown */}
          <View className="flex-row items-center justify-between">
            <Text className="text-xl font-extrabold text-ink">{t("orderRequest.newOrderRequest")}</Text>
            <View className={`px-3 py-1.5 rounded-full ${urgent ? "bg-danger-soft" : "bg-canvas"}`}>
              <Text className={`text-base font-extrabold ${urgent ? "text-danger" : "text-ink"}`}>{timeLeft}s</Text>
            </View>
          </View>
          <View className="h-1.5 rounded-full bg-canvas overflow-hidden">
            <View
              style={{ width: `${Math.max(0, (timeLeft / timeout) * 100)}%`, backgroundColor: urgent ? color.danger : color.brand }}
              className="h-full rounded-full"
            />
          </View>

          {/* The decision numbers */}
          <View className="rounded-3xl p-4 gap-3" style={{ backgroundColor: color.brandSoft }}>
            <View className="flex-row items-end justify-between">
              <View>
                <Text className="text-sm font-semibold text-ink-soft">{t("orderRequest.earnings")}</Text>
                <Text className="text-4xl font-extrabold text-ink">{order.earnings > 0 ? rupees(order.earnings) : "—"}</Text>
              </View>
              <View className="items-end">
                <Text className="text-sm font-semibold text-ink-soft">{t("orderRequest.distance")}</Text>
                <Text className="text-2xl font-extrabold text-ink">
                  {order.distance > 0 ? `${order.distance.toFixed(1)} km` : "—"}
                </Text>
              </View>
            </View>
            <View className="flex-row items-center gap-2">
              <Ionicons name={cash ? "cash-outline" : "checkmark-circle"} size={18} color={cash ? color.warning : color.success} />
              <Text className="text-sm font-bold text-ink">
                {cash ? `${t("order.cod")}${order.totalAmount ? ` · ${rupees(order.totalAmount)}` : ""}` : t("order.paidOnline")}
              </Text>
            </View>
          </View>

          {/* Route */}
          <View className="gap-3">
            <Stop icon="restaurant" tint={color.brandDark} title={order.restaurantName} body={order.restaurantAddress} />
            <View className="ml-[15px] h-3 border-l-2 border-dashed border-line" />
            <Stop icon="location" tint={color.success} title={order.customerName} body={order.customerAddress} />
          </View>

          <Button title={t("orderRequest.accept")} icon="checkmark-circle" variant="success" onPress={accept} />
          <Pressable onPress={skip} hitSlop={8} className="items-center py-1">
            <Text className="text-base font-bold text-muted">{t("orderRequest.skip")}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function Stop({ icon, tint, title, body }: { icon: "restaurant" | "location"; tint: string; title: string; body?: string }) {
  return (
    <View className="flex-row items-start gap-3">
      <View className="w-8 h-8 rounded-full bg-canvas items-center justify-center">
        <Ionicons name={icon} size={16} color={tint} />
      </View>
      <View className="flex-1">
        <Text className="text-base font-bold text-ink" numberOfLines={1}>
          {title}
        </Text>
        {body ? (
          <Text className="text-sm text-muted" numberOfLines={2}>
            {body}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
