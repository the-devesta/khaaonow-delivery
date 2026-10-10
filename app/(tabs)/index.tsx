/**
 * Home — what a rider needs at a glance:
 *   1. Online / offline (one big control)
 *   2. Active order(s) and the next thing to do
 *   3. Order requests still waiting
 *   4. Today's earnings and deliveries
 */
import { Banner, Button, Card, Pill, SectionTitle, TabScreen, rupees } from "@/components/kit";
import { LanguageSwitchButton } from "@/components/LanguageSwitchButton";
import LocationTrackingBanner from "@/components/LocationTrackingBanner";
import MissedOrderCard from "@/components/orders/MissedOrderCard";
import OrderRequestModal from "@/components/orders/OrderRequestModal";
import UpdateAppDialog from "@/components/UpdateAppDialog";
import { useAppUpdateCheck } from "@/hooks/useAppUpdateCheck";
import { useLocationTracking } from "@/hooks/useLocationTracking";
import { ApiService } from "@/services/api";
import { useOrderStore } from "@/store/orders";
import { NEXT_STEP_KEY } from "@/utils/orderView";
import { usePartnerStore } from "@/store/partner";
import { color } from "@/theme/tokens";
import { registerForPushNotificationsAsync, registerPushTokenWithBackend } from "@/utils/notifications";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StatusBar, Text, View } from "react-native";

interface DashboardData {
  earnings: { today: number; week: number; month: number };
  stats: { deliveriesToday: number; activeOrders: number };
  onlineStatus: boolean;
  activeOrder: {
    id: string;
    status: string;
    restaurantName: string;
    customerAddress: string;
    earnings?: number;
    deliveryEarnings?: number;
    deliveryFee?: number;
    estimatedDeliveryFee?: number;
  } | null;
}

export default function HomeScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { delivered } = useLocalSearchParams<{ delivered?: string }>();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [name, setName] = useState<string>("");
  const [justDelivered, setJustDelivered] = useState(Boolean(delivered));
  const appUpdate = useAppUpdateCheck();
  const [updateDismissed, setUpdateDismissed] = useState(false);

  const { isOnline, toggleOnline, syncOnlineStatus } = usePartnerStore();
  const {
    pendingOrder,
    pendingOrderReceivedAt,
    activeOrder,
    activeOrders,
    missedOrders,
    acceptOrder,
    rejectOrder,
    fetchAssignedOrders,
    fetchRoutePlan,
    fetchAvailableOrders,
    pruneMissedOrders,
  } = useOrderStore();

  const waitingRequests = missedOrders.filter((m) => m.expiresAt.getTime() > Date.now() && m.stillAvailable);

  // Remaining seconds for a persisted offer so the timer resumes correctly.
  const pendingInitialTimeLeft = useMemo(() => {
    if (!pendingOrder || !pendingOrderReceivedAt) return undefined;
    const elapsed = Math.floor((Date.now() - pendingOrderReceivedAt) / 1000);
    return Math.max(0, (pendingOrder.acceptanceTimeoutSeconds ?? 30) - elapsed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingOrder?.id, pendingOrderReceivedAt]);

  const locationTracking = useLocationTracking({ updateInterval: 30000, distanceThreshold: 50 });

  useEffect(() => {
    appUpdate.check();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!delivered) return;
    setJustDelivered(true);
    const timer = setTimeout(() => setJustDelivered(false), 6000);
    return () => clearTimeout(timer);
  }, [delivered]);

  const fetchDashboard = async () => {
    try {
      const res = await ApiService.getDashboardData();
      if (res.success && res.data) {
        setDashboard(res.data as DashboardData);
        if (res.data.onlineStatus !== undefined) syncOnlineStatus(res.data.onlineStatus);
      }
      const profile = await ApiService.getProfile();
      if (profile.success && profile.data) setName((profile.data as any).name || "");
    } catch (error) {
      console.error("Failed to fetch dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchDashboard();
    fetchAssignedOrders();
    fetchRoutePlan();
    fetchAvailableOrders();

    // Keep "still available" accurate on waiting requests.
    const poll = setInterval(() => {
      fetchAvailableOrders();
      pruneMissedOrders();
    }, 60_000);

    (async () => {
      try {
        const token = await registerForPushNotificationsAsync({ requestPermission: true });
        if (token) await registerPushTokenWithBackend(token);
      } catch (error) {
        console.error("Failed to register push token:", error);
      }
    })();

    return () => clearInterval(poll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const acceptPending = async () => {
    if (!pendingOrder) return;
    const id = pendingOrder.id;
    await acceptOrder(id);
    if (useOrderStore.getState().activeOrder?.id === id) router.push(`/orders/${id}`);
  };

  const toggleDuty = async () => {
    setToggling(true);
    try {
      await toggleOnline();
      await fetchDashboard();
    } catch (error) {
      Alert.alert(t("common.failed"), (error as Error)?.message || t("common.tryAgain"));
    } finally {
      setToggling(false);
    }
  };

  // Active orders from the store; fall back to the dashboard's single one.
  const myOrders =
    activeOrders.length > 0
      ? activeOrders.filter((o) => o.status !== "delivered")
      : activeOrder && activeOrder.status !== "delivered"
        ? [activeOrder]
        : dashboard?.activeOrder && dashboard.activeOrder.status !== "delivered"
          ? [
              {
                id: dashboard.activeOrder.id,
                status: dashboard.activeOrder.status,
                restaurantName: dashboard.activeOrder.restaurantName,
                customerAddress: dashboard.activeOrder.customerAddress,
                earnings:
                  dashboard.activeOrder.earnings ??
                  dashboard.activeOrder.deliveryEarnings ??
                  dashboard.activeOrder.estimatedDeliveryFee ??
                  dashboard.activeOrder.deliveryFee ??
                  0,
              } as any,
            ]
          : [];

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: color.canvas }} className="items-center justify-center gap-3">
        <ActivityIndicator size="large" color={color.ink} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: color.canvas }}>
      <StatusBar barStyle="dark-content" />
      <TabScreen
        kicker={t("home.hello")}
        title={name || t("home.rider")}
        right={<LanguageSwitchButton />}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await fetchDashboard();
              fetchAssignedOrders();
              setRefreshing(false);
            }}
          />
        }>
        {justDelivered ? (
          <Banner tone="success" icon="checkmark-circle" title={t("home.deliveredTitle")} body={t("home.deliveredBody")} />
        ) : null}

        {/* Duty */}
        {isOnline ? (
          <Card>
            <View className="flex-row items-center gap-3">
              <View className="w-12 h-12 rounded-full bg-success-soft items-center justify-center">
                <View className="w-4 h-4 rounded-full bg-success" />
              </View>
              <View className="flex-1">
                <Text className="text-lg font-extrabold text-ink">{t("home.onlineTitle")}</Text>
                <Text className="text-sm text-muted">
                  {myOrders.length ? t("home.onlineBusy") : t("home.onlineWaiting")}
                </Text>
              </View>
              <Pressable
                onPress={toggleDuty}
                disabled={toggling}
                accessibilityRole="button"
                className="px-4 py-2.5 rounded-full border border-line bg-surface">
                {toggling ? (
                  <ActivityIndicator size="small" color={color.ink} />
                ) : (
                  <Text className="text-sm font-bold text-ink">{t("home.goOffline")}</Text>
                )}
              </Pressable>
            </View>
          </Card>
        ) : (
          <Card>
            <View className="items-center gap-1 pb-3">
              <Text className="text-lg font-extrabold text-ink">{t("home.offlineTitle")}</Text>
              <Text className="text-sm text-muted text-center">{t("home.offlineBody")}</Text>
            </View>
            <Button title={t("home.goOnline")} icon="power" loading={toggling} onPress={toggleDuty} />
          </Card>
        )}

        <LocationTrackingBanner
          isOnline={isOnline}
          isTracking={locationTracking.isTracking}
          permissionStatus={locationTracking.permissionStatus}
          backgroundPermissionDenied={locationTracking.backgroundPermissionDenied}
          lastSuccessfulUpdateAt={locationTracking.lastSuccessfulUpdateAt}
          onRetry={() => {
            // stop first: startTracking() doesn't clear its own watchers.
            locationTracking.stopTracking();
            void locationTracking.startTracking();
          }}
        />

        {/* Active orders */}
        {myOrders.length > 0 ? (
          <>
            <SectionTitle title={myOrders.length > 1 ? t("home.yourOrders", { count: myOrders.length }) : t("home.yourOrder")} />
            {myOrders.map((order: any) => (
              <Card key={order.id} onPress={() => router.push(`/orders/${order.id}`)}>
                <View className="flex-row items-center justify-between mb-2">
                  <Pill label={t(NEXT_STEP_KEY[order.status] || "home.nextGoRestaurant")} tone="brand" />
                  <Text className="text-base font-extrabold text-success">{rupees(order.earnings)}</Text>
                </View>
                <View className="flex-row items-center gap-2">
                  <Ionicons name="restaurant" size={16} color={color.muted} />
                  <Text className="flex-1 text-base font-bold text-ink" numberOfLines={1}>
                    {order.restaurantName}
                  </Text>
                </View>
                {order.customerAddress ? (
                  <View className="flex-row items-center gap-2 mt-1">
                    <Ionicons name="location" size={16} color={color.muted} />
                    <Text className="flex-1 text-sm text-ink-soft" numberOfLines={1}>
                      {order.customerAddress}
                    </Text>
                  </View>
                ) : null}
                <View className="mt-3">
                  <Button title={t("home.openOrder")} icon="arrow-forward" variant="dark" size="md" onPress={() => router.push(`/orders/${order.id}`)} />
                </View>
              </Card>
            ))}
          </>
        ) : null}

        {/* Requests still open */}
        {waitingRequests.length > 0 ? (
          <>
            <SectionTitle title={t("home.newRequests", { count: waitingRequests.length })} />
            {waitingRequests.map((missed) => (
              <MissedOrderCard key={missed.order.id} missed={missed} />
            ))}
          </>
        ) : null}

        {isOnline && myOrders.length === 0 && waitingRequests.length === 0 ? (
          <Card>
            <View className="items-center py-4 gap-2">
              <Ionicons name="radio-outline" size={30} color={color.faint} />
              <Text className="text-base font-bold text-ink">{t("home.waitingTitle")}</Text>
              <Text className="text-sm text-muted text-center">{t("home.waitingBody")}</Text>
            </View>
          </Card>
        ) : null}

        {/* Today */}
        <SectionTitle title={t("home.today")} />
        <View className="flex-row gap-3">
          <View className="flex-1">
            <Card onPress={() => router.push("/(tabs)/earnings")}>
              <Text className="text-sm text-muted">{t("home.earnedToday")}</Text>
              <Text className="text-2xl font-extrabold text-ink mt-1">{rupees(dashboard?.earnings?.today)}</Text>
            </Card>
          </View>
          <View className="flex-1">
            <Card onPress={() => router.push("/(tabs)/orders")}>
              <Text className="text-sm text-muted">{t("home.deliveriesToday")}</Text>
              <Text className="text-2xl font-extrabold text-ink mt-1">{dashboard?.stats?.deliveriesToday ?? 0}</Text>
            </Card>
          </View>
        </View>
      </TabScreen>

      {pendingOrder ? (
        <OrderRequestModal
          order={pendingOrder}
          onAccept={acceptPending}
          onReject={() => rejectOrder(pendingOrder.id)}
          initialTimeLeft={pendingInitialTimeLeft}
        />
      ) : null}

      {appUpdate.result?.status === "update_available" && !updateDismissed ? (
        <UpdateAppDialog visible updateInfo={appUpdate.result} onDismiss={() => setUpdateDismissed(true)} />
      ) : null}
    </View>
  );
}
