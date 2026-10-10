/**
 * Active order — one clear step at a time.
 *
 *   Step strip  →  "Now" card (where to go, Navigate / Call)  →  money banner
 *   →  items  →  single primary action at the bottom.
 *
 * Everything that isn't the next step (report delay, can't complete, SOS,
 * support) lives behind one "Need help?" sheet. Turn-by-turn navigation is
 * handed to Google Maps, which riders already know.
 */
import DeliveryMap from "@/components/map/DeliveryMap";
import {
  Banner,
  BottomBar,
  Button,
  Card,
  IconButton,
  ListGroup,
  ListRow,
  Pill,
  Screen,
  rupees,
} from "@/components/kit";
import HandoverSheet, { HandoverResult } from "@/components/order/HandoverSheet";
import StepStrip from "@/components/order/StepStrip";
import { useLocationTracking } from "@/hooks/useLocationTracking";
import { ApiService } from "@/services/api";
import { subscribeToOrderPayment } from "@/services/realtime.service";
import { socketService } from "@/services/socket";
import { uploadImageToFirebase } from "@/services/storage";
import { Location, useOrderStore } from "@/store/orders";
import { color } from "@/theme/tokens";
import { formatAddressText, OrderView, transformApiOrder } from "@/utils/orderView";
import { openPhoneDialer } from "@/utils/phone";
import { Ionicons } from "@expo/vector-icons";
import * as Device from "expo-device";
import * as ExpoLocation from "expo-location";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Phase = "to_restaurant" | "at_restaurant" | "to_customer" | "at_customer" | "returning" | "done";

const phaseOf = (status?: string): Phase => {
  switch (status) {
    case "delivery_partner_reached":
      return "at_restaurant";
    case "delivery_partner_picked_up":
    case "picked_up":
      return "to_customer";
    case "delivery_partner_reached_user_dest":
    case "on_the_way":
      return "at_customer";
    case "returning_to_restaurant":
      return "returning";
    case "delivered":
    case "cancelled":
      return "done";
    default:
      return "to_restaurant";
  }
};

const STEP_INDEX: Record<Phase, number> = {
  to_restaurant: 0,
  at_restaurant: 1,
  to_customer: 2,
  at_customer: 3,
  returning: 1,
  done: 4,
};

export default function OrderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const {
    activeOrder,
    activeOrders,
    updateOrderStatus,
    completeOrder,
    releaseActiveOrder,
    setDriverLocation,
    confirmReturnedToRestaurant,
  } = useOrderStore();
  const locationTracking = useLocationTracking();

  const [apiOrder, setApiOrder] = useState<OrderView | null>(null);
  const [driverLocation, setDriverLoc] = useState<Location | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [paidNow, setPaidNow] = useState(false);
  const [handoverOpen, setHandoverOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [itemsOpen, setItemsOpen] = useState(false);

  const matchedActiveOrder =
    activeOrders.find((order) => order.id === id) || (activeOrder?.id === id ? activeOrder : null);
  const isActiveOrder = Boolean(matchedActiveOrder);

  const fetchOrder = useCallback(async () => {
    if (!id) return;
    try {
      const res = await ApiService.getOrderById(id);
      if (res.success && res.data) setApiOrder(transformApiOrder(res.data));
    } catch (err) {
      console.error("Failed to fetch order details:", err);
    }
  }, [id]);

  useEffect(() => {
    void fetchOrder();
  }, [fetchOrder]);

  // Payment confirmations for UPI QR arrive over socket and Firebase.
  useEffect(() => {
    if (!id) return;
    socketService.joinOrderRoom(id);
    const onPaid = (data: { orderId: string }) => {
      if (data.orderId !== id) return;
      void fetchOrder();
      setPaidNow(true);
    };
    socketService.on("payment-confirmed", onPaid);
    const unsubscribe = subscribeToOrderPayment(id, () => {
      void fetchOrder();
      setPaidNow(true);
    });
    return () => {
      socketService.off("payment-confirmed", onPaid);
      socketService.leaveOrderRoom(id);
      unsubscribe?.();
    };
  }, [id, fetchOrder]);

  // Reuse the shared GPS watcher rather than starting another one here.
  useEffect(() => {
    if (!isActiveOrder || !locationTracking.currentLocation) return;
    setDriverLoc(locationTracking.currentLocation);
    setDriverLocation(locationTracking.currentLocation);
  }, [isActiveOrder, locationTracking.currentLocation, setDriverLocation]);

  const order = apiOrder
    ? {
        ...apiOrder,
        // The store status is more up to date than the last fetch.
        status: isActiveOrder ? matchedActiveOrder?.status ?? apiOrder.status : apiOrder.status,
      }
    : null;

  // Leave if the order can't be found at all (e.g. reassigned).
  useEffect(() => {
    if (apiOrder || matchedActiveOrder || !id) return;
    const timer = setTimeout(() => router.back(), 4000);
    return () => clearTimeout(timer);
  }, [apiOrder, matchedActiveOrder, id, router]);

  if (!order) {
    return (
      <View style={{ flex: 1, backgroundColor: color.canvas }} className="items-center justify-center gap-3">
        <ActivityIndicator size="large" color={color.ink} />
        <Text className="text-muted">{t("order.loading")}</Text>
      </View>
    );
  }

  const phase = phaseOf(order.status);
  const toCustomer = phase === "to_customer" || phase === "at_customer";
  const isCash = order.paymentType === "cash";
  const isPaid = paidNow || order.paymentStatus === "completed" || order.paymentStatus === "paid";
  const collectAmount = isCash && !isPaid ? order.totalAmount : 0;

  const place = toCustomer
    ? {
        kicker: t("order.deliverTo"),
        name: order.customerName,
        address: formatAddressText(order.customerAddress, t("order.addressUnavailable")),
        phone: order.customerPhone || order.restaurantPhone,
        location: order.dropLocation,
        icon: "person" as const,
      }
    : {
        kicker: t("order.pickUpFrom"),
        name: order.restaurantName,
        address: formatAddressText(order.restaurantAddress, t("order.addressUnavailable")),
        phone: order.restaurantPhone || order.customerPhone,
        location: order.pickupLocation,
        icon: "restaurant" as const,
      };

  const steps = [
    { label: t("order.stepGoRestaurant"), icon: "navigate" as const },
    { label: t("order.stepPickUp"), icon: "bag-handle" as const },
    { label: t("order.stepGoCustomer"), icon: "bicycle" as const },
    { label: t("order.stepHandOver"), icon: "home" as const },
  ];

  /* ------------------------------------------------------------ actions */

  const openMaps = () => {
    const dest = place.location;
    if (!dest) {
      Alert.alert(t("order.locationUnavailable"), t("order.locationUnavailableBody"));
      return;
    }
    const web = `https://www.google.com/maps/dir/?api=1&destination=${dest.latitude},${dest.longitude}&travelmode=driving`;
    const native = `comgooglemaps://?daddr=${dest.latitude},${dest.longitude}&directionsmode=driving`;
    if (Platform.OS === "ios") {
      Linking.canOpenURL("comgooglemaps://")
        .then((ok) => Linking.openURL(ok ? native : web))
        .catch(() => Alert.alert(t("order.mapsUnavailable")));
      return;
    }
    Linking.openURL(web).catch(() => Alert.alert(t("order.mapsUnavailable")));
  };

  const call = () => {
    if (!place.phone) {
      Alert.alert(t("order.phoneUnavailable"));
      return;
    }
    openPhoneDialer(place.phone);
  };

  const advance = async (next: "delivery_partner_reached" | "delivery_partner_picked_up" | "delivery_partner_reached_user_dest") => {
    setBusy(true);
    try {
      const ok = await updateOrderStatus(next, { orderId: String(order.id) });
      if (ok) await fetchOrder();
    } finally {
      setBusy(false);
    }
  };

  const ensureLocation = async (): Promise<Location | null> => {
    if (driverLocation) return driverLocation;
    const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(t("order.locationNeeded"), t("order.locationNeededBody"));
      return null;
    }
    const pos = await ExpoLocation.getCurrentPositionAsync({ accuracy: ExpoLocation.Accuracy.High });
    const loc = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
    setDriverLoc(loc);
    setDriverLocation(loc);
    return loc;
  };

  const takeProofPhoto = async (): Promise<string | null> => {
    if (!Device.isDevice) {
      // Simulators have no camera; pick from the library instead.
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== "granted") return null;
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.65 });
      if (res.canceled || !res.assets?.[0]?.uri) return null;
      return uploadImageToFirebase(res.assets[0].uri, "delivery_proofs");
    }
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (perm.status !== "granted") {
      Alert.alert(t("order.cameraNeeded"), t("order.cameraNeededBody"));
      return null;
    }
    const res = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.65 });
    if (res.canceled || !res.assets?.[0]?.uri) return null;
    return uploadImageToFirebase(res.assets[0].uri, "delivery_proofs");
  };

  const finishDelivery = async ({ otpVerified, needPhoto }: HandoverResult) => {
    setHandoverOpen(false);
    if (otpVerified) setPaidNow(true);
    setBusy(true);
    try {
      const loc = await ensureLocation();
      if (!loc) return;

      let proofPhotoUrl: string | undefined;
      if (needPhoto) {
        proofPhotoUrl = (await takeProofPhoto()) ?? undefined;
        if (!proofPhotoUrl) return;
      } else {
        // A verified code is the proof. If the server still asks for a
        // photo (older backend), fall back to taking one.
        const res = await ApiService.updateOrderStatus(String(order.id), "delivered", {
          currentLocation: loc,
        });
        if (res.success) {
          completeOrder(String(order.id));
          router.replace({ pathname: "/(tabs)", params: { delivered: String(order.id) } });
          return;
        }
        if (!/proof|photo/i.test(res.message || "")) {
          Alert.alert(t("order.couldNotComplete"), res.message || t("common.tryAgain"));
          return;
        }
        proofPhotoUrl = (await takeProofPhoto()) ?? undefined;
        if (!proofPhotoUrl) return;
      }

      const ok = await updateOrderStatus("delivered", {
        orderId: String(order.id),
        currentLocation: loc,
        proofPhotoUrl,
      });
      if (ok) {
        completeOrder(String(order.id));
        router.replace({ pathname: "/(tabs)", params: { delivered: String(order.id) } });
      }
    } catch (error: any) {
      Alert.alert(t("order.couldNotComplete"), error?.message || t("common.tryAgain"));
    } finally {
      setBusy(false);
    }
  };

  const reportDelay = () => {
    setHelpOpen(false);
    Alert.alert(t("order.reportDelay"), t("order.reportDelayBody"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("order.report"),
        onPress: async () => {
          const res = await ApiService.reportDeliveryDelay(String(order.id), "Traffic or operational delay");
          Alert.alert(res.success ? t("order.delayReported") : t("common.failed"), res.message || "");
        },
      },
    ]);
  };

  const cantComplete = () => {
    setHelpOpen(false);
    Alert.alert(t("order.cantComplete"), t("order.cantCompleteBody"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("order.releaseOrder"),
        style: "destructive",
        onPress: async () => {
          const res = await ApiService.requestOrderReassignment(String(order.id), "Rider unable to continue delivery");
          if (res.success) {
            releaseActiveOrder(String(order.id));
            router.replace("/(tabs)");
          } else {
            Alert.alert(t("common.failed"), res.message || t("common.tryAgain"));
          }
        },
      },
    ]);
  };

  const confirmReturned = () => {
    Alert.alert(t("order.confirmReturn"), t("order.confirmReturnBody"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.confirm"),
        onPress: async () => {
          setBusy(true);
          try {
            const ok = await confirmReturnedToRestaurant(String(order.id));
            if (ok) router.replace("/(tabs)");
            else Alert.alert(t("common.failed"), t("common.tryAgain"));
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  /* ------------------------------------------------------- primary action */

  const primary: { title: string; icon: React.ComponentProps<typeof Ionicons>["name"]; variant: "primary" | "success" | "danger"; onPress: () => void } | null =
    !isActiveOrder
      ? null
      : phase === "to_restaurant"
        ? { title: t("order.reachedRestaurant"), icon: "location", variant: "primary", onPress: () => advance("delivery_partner_reached") }
        : phase === "at_restaurant"
          ? { title: t("order.pickedUp"), icon: "bag-check", variant: "primary", onPress: () => advance("delivery_partner_picked_up") }
          : phase === "to_customer"
            ? { title: t("order.reachedCustomer"), icon: "location", variant: "primary", onPress: () => advance("delivery_partner_reached_user_dest") }
            : phase === "at_customer"
              ? {
                  title: collectAmount ? t("order.collectAndDeliver", { amount: rupees(collectAmount) }) : t("order.handOver"),
                  icon: "checkmark-circle",
                  variant: "success",
                  onPress: () => setHandoverOpen(true),
                }
              : phase === "returning"
                ? { title: t("order.returnedToRestaurant"), icon: "return-up-back", variant: "danger", onPress: confirmReturned }
                : null;

  /* --------------------------------------------------------------- render */

  return (
    <>
      <Screen
        back
        title={t("order.title", { number: String(order.orderNumber || order.id).slice(-6) })}
        subtitle={order.restaurantName}
        right={<IconButton icon="help-buoy-outline" label={t("order.needHelp")} onPress={() => setHelpOpen(true)} />}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await fetchOrder();
              setRefreshing(false);
            }}
          />
        }
        footer={
          primary ? (
            <BottomBar>
              <Button title={primary.title} icon={primary.icon} variant={primary.variant} loading={busy} onPress={primary.onPress} />
            </BottomBar>
          ) : undefined
        }>
        {phase !== "done" && phase !== "returning" ? (
          <Card>
            <StepStrip steps={steps} current={STEP_INDEX[phase]} />
          </Card>
        ) : null}

        {phase === "returning" ? (
          <Banner
            tone="danger"
            icon="return-up-back"
            title={t("order.returnTitle")}
            body={order.returnReason || t("order.returnBody")}
          />
        ) : null}

        {phase === "done" ? (
          <Banner
            tone={order.status === "cancelled" ? "danger" : "success"}
            icon={order.status === "cancelled" ? "close-circle" : "checkmark-circle"}
            title={order.status === "cancelled" ? t("order.cancelled") : t("order.delivered")}
          />
        ) : null}

        {/* Where to go now */}
        <Card padded={false}>
          {isActiveOrder && place.location ? (
            <View style={{ height: 170, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: "hidden" }}>
              <DeliveryMap
                driverLocation={driverLocation}
                pickupLocation={order.pickupLocation}
                dropLocation={order.dropLocation}
                showRoute
                activePhase={toCustomer ? "dropoff" : "pickup"}
              />
            </View>
          ) : null}
          <View className="p-4 gap-3">
            <View className="flex-row items-start gap-3">
              <View className="w-11 h-11 rounded-full bg-brand items-center justify-center">
                <Ionicons name={place.icon} size={20} color={color.ink} />
              </View>
              <View className="flex-1">
                <Text className="text-xs font-bold uppercase tracking-wide text-muted">{place.kicker}</Text>
                <Text className="text-lg font-bold text-ink" numberOfLines={1}>
                  {place.name}
                </Text>
                <Text className="text-sm text-ink-soft" numberOfLines={3}>
                  {place.address}
                </Text>
              </View>
            </View>
            {isActiveOrder && phase !== "done" ? (
              <View className="flex-row gap-2">
                <View className="flex-1">
                  <Button title={t("order.navigate")} icon="navigate" variant="dark" size="md" onPress={openMaps} />
                </View>
                <View className="flex-1">
                  <Button title={t("order.call")} icon="call" variant="outline" size="md" onPress={call} />
                </View>
              </View>
            ) : null}
          </View>
        </Card>

        {/* Money — the one thing riders must not get wrong */}
        {phase !== "done" ? (
          collectAmount ? (
            <View className="bg-brand rounded-3xl p-4 flex-row items-center gap-3">
              <Ionicons name="cash" size={28} color={color.ink} />
              <View className="flex-1">
                <Text className="text-sm font-semibold text-ink">{t("order.collectCash")}</Text>
                <Text className="text-3xl font-extrabold text-ink">{rupees(collectAmount)}</Text>
              </View>
              <Pill label={t("order.cod")} tone="neutral" />
            </View>
          ) : (
            <Banner tone="success" icon="card" title={t("order.paidOnline")} body={t("order.dontCollect")} />
          )
        ) : null}

        {/* Items */}
        <Card onPress={() => setItemsOpen((v) => !v)}>
          <View className="flex-row items-center">
            <Ionicons name="receipt-outline" size={20} color={color.ink} />
            <Text className="flex-1 ml-2 text-base font-bold text-ink">
              {t("order.items", { count: order.items.length })}
            </Text>
            <Ionicons name={itemsOpen || phase === "at_restaurant" ? "chevron-up" : "chevron-down"} size={18} color={color.muted} />
          </View>
          {(itemsOpen || phase === "at_restaurant") && order.items.length > 0 ? (
            <View className="mt-3 gap-2">
              {order.items.map((item: { name: string; quantity: number }, i: number) => (
                <View key={`${item.name}-${i}`} className="flex-row items-center gap-3">
                  <View className="min-w-[34px] h-8 px-2 rounded-lg bg-brand-soft items-center justify-center">
                    <Text className="text-sm font-extrabold text-ink">{item.quantity}×</Text>
                  </View>
                  <Text className="flex-1 text-base text-ink" numberOfLines={2}>
                    {item.name}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </Card>

        {/* Earnings for this trip */}
        <Card>
          <View className="flex-row items-center justify-between">
            <Text className="text-sm text-muted">{t("order.youEarn")}</Text>
            <Text className="text-lg font-extrabold text-success">{rupees(order.earnings)}</Text>
          </View>
          {order.distance ? (
            <Text className="text-xs text-muted mt-1">{t("order.tripDistance", { km: Number(order.distance).toFixed(1) })}</Text>
          ) : null}
        </Card>
      </Screen>

      <HandoverSheet
        visible={handoverOpen}
        orderId={String(order.id)}
        amount={order.totalAmount}
        isCash={isCash}
        isPaid={isPaid}
        onClose={() => setHandoverOpen(false)}
        onDone={finishDelivery}
      />

      {/* Need help? — every non-primary action lives here */}
      <Modal visible={helpOpen} transparent animationType="fade" onRequestClose={() => setHelpOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: color.overlay }} onPress={() => setHelpOpen(false)} />
        <View style={{ paddingBottom: insets.bottom + 12 }} className="bg-canvas rounded-t-3xl px-4 pt-4 gap-3">
          <Text className="text-lg font-bold text-ink px-1">{t("order.needHelp")}</Text>
          <ListGroup>
            {isActiveOrder && phase !== "returning" ? (
              <ListRow icon="time-outline" title={t("order.reportDelay")} subtitle={t("order.reportDelayHint")} onPress={reportDelay} />
            ) : null}
            <ListRow
              icon="headset-outline"
              title={t("order.callSupport")}
              subtitle="+91 98750 54898"
              onPress={() => {
                setHelpOpen(false);
                openPhoneDialer("+919875054898");
              }}
            />
            {isActiveOrder && phase !== "returning" ? (
              <ListRow icon="close-circle-outline" title={t("order.cantComplete")} subtitle={t("order.cantCompleteHint")} danger onPress={cantComplete} />
            ) : null}
            <ListRow
              icon="warning-outline"
              title={t("order.sos")}
              subtitle={t("order.sosHint")}
              danger
              onPress={() => {
                setHelpOpen(false);
                Alert.alert(t("order.sos"), t("order.sosConfirm"), [
                  { text: t("common.cancel"), style: "cancel" },
                  { text: t("order.call112"), style: "destructive", onPress: () => openPhoneDialer("112") },
                ]);
              }}
            />
          </ListGroup>
          <Button title={t("common.close")} variant="outline" onPress={() => setHelpOpen(false)} />
        </View>
      </Modal>
    </>
  );
}
