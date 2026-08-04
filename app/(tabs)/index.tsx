import { LanguageSwitchButton } from "@/components/LanguageSwitchButton";
import LocationTrackingBanner from "@/components/LocationTrackingBanner";
import MissedOrderCard from "@/components/orders/MissedOrderCard";
import OrderRequestModal from "@/components/orders/OrderRequestModal";
import UpdateAppDialog from "@/components/UpdateAppDialog";
import { useAppUpdateCheck } from "@/hooks/useAppUpdateCheck";
import { useLocationTracking } from "@/hooks/useLocationTracking";
import { ApiService } from "@/services/api";
import { useOrderStore } from "@/store/orders";
import { usePartnerStore } from "@/store/partner";
import {
  registerForPushNotificationsAsync,
  registerPushTokenWithBackend,
} from "@/utils/notifications";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  RefreshControl,
  ScrollView,
  StatusBar,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface DashboardData {
  earnings: {
    today: number;
    week: number;
    month: number;
  };
  stats: {
    deliveriesToday: number;
    weekOrders: number;
    totalOrders: number;
    completedOrders: number;
    activeOrders: number;
  };
  rating: number;
  onlineStatus: boolean;
  activeOrder: {
    id: string;
    orderNumber: string;
    status: string;
    restaurantName: string;
    customerAddress: string;
    totalAmount: number;
    earnings?: number;
    deliveryEarnings?: number;
    deliveryFee?: number;
    estimatedDeliveryFee?: number;
    estimatedTime?: string;
  } | null;
}

interface ProfileData {
  name?: string;
  phone: string;
}

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toggleLoading, setToggleLoading] = useState(false);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(
    null,
  );
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const appUpdate = useAppUpdateCheck();
  const [updateDialogDismissed, setUpdateDialogDismissed] = useState(false);

  const { isOnline, toggleOnline, syncOnlineStatus } = usePartnerStore();
  const {
    pendingOrder,
    pendingOrderReceivedAt,
    activeOrder,
    activeOrders,
    routePlan,
    missedOrders,
    acceptOrder,
    rejectOrder,
    fetchAssignedOrders,
    fetchRoutePlan,
    fetchAvailableOrders,
    dismissMissedOrder,
    pruneMissedOrders,
  } = useOrderStore();

  // Only show active (still-acceptable) orders in "Pending Requests" on the home screen.
  // Expired / cancelled ones are visible in the Orders tab.
  const activePendingRequests = missedOrders.filter(
    (m) => m.expiresAt.getTime() > Date.now() && m.stillAvailable,
  );

  // Remaining seconds for a persisted pendingOrder (so the modal starts the timer at the right point)
  const pendingInitialTimeLeft = useMemo(() => {
    if (!pendingOrder || !pendingOrderReceivedAt) return undefined;
    const elapsed = Math.floor((Date.now() - pendingOrderReceivedAt) / 1000);
    return Math.max(0, (pendingOrder.acceptanceTimeoutSeconds ?? 30) - elapsed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingOrder?.id, pendingOrderReceivedAt]);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  // One check per app open/login — this screen is the first thing a
  // logged-in rider lands on, whether from a fresh login or reopening the
  // app with a persisted session.
  useEffect(() => {
    appUpdate.check();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Location tracking
  const locationTracking = useLocationTracking({
    updateInterval: 30000,
    distanceThreshold: 50,
  });

  const fetchDashboard = async () => {
    try {
      const dashboardResponse = await ApiService.getDashboardData();
      if (dashboardResponse.success && dashboardResponse.data) {
        setDashboardData(dashboardResponse.data);
        if (dashboardResponse.data.onlineStatus !== undefined) {
          syncOnlineStatus(dashboardResponse.data.onlineStatus);
        }
      }

      const profileResponse = await ApiService.getProfile();
      if (profileResponse.success && profileResponse.data) {
        setProfile(profileResponse.data as any);
      }
    } catch (error) {
      console.error("Failed to fetch dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
    fetchAssignedOrders();
    fetchRoutePlan();
    fetchAvailableOrders(); // immediately surface any waiting orders from the backend

    // Poll available orders every 60s so "stillAvailable" stays accurate
    const availablePoll = setInterval(() => {
      fetchAvailableOrders();
      pruneMissedOrders();
    }, 60_000);

    // Register for push notifications
    const registerPush = async () => {
      try {
        const token = await registerForPushNotificationsAsync({
          requestPermission: true,
        });
        if (token) {
          await registerPushTokenWithBackend(token);
        }
      } catch (error) {
        console.error("Failed to register push token:", error);
      }
    };

    registerPush();
    return () => clearInterval(availablePoll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAcceptOrder = async () => {
    if (pendingOrder) {
      const id = pendingOrder.id;
      await acceptOrder(id);
      // Only navigate if accept succeeded (activeOrder will be set)
      const { activeOrder: newActive } = useOrderStore.getState();
      if (newActive?.id === id) {
        router.push(`/orders/${id}`);
      }
    }
  };

  const handleRejectOrder = () => {
    if (pendingOrder) rejectOrder(pendingOrder.id);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchDashboard();
    setRefreshing(false);
  };

  const handleToggleOnline = async () => {
    setToggleLoading(true);
    try {
      await toggleOnline();
      await fetchDashboard();
      if (!isOnline) {
        Alert.alert(
          "You're Online! 🎉",
          "You'll start receiving order requests now.",
        );
      }
    } catch (error) {
      console.error("Toggle online error:", error);
      Alert.alert("Error", "Failed to update status. Please try again.");
    } finally {
      setToggleLoading(false);
    }
  };

  const handleViewOrderDetails = () => {
    if (activeOrder) {
      router.push(`/orders/${activeOrder.id}`);
    } else if (dashboardData?.activeOrder) {
      router.push(`/orders/${dashboardData.activeOrder.id}`);
    }
  };

  const partnerName = profile?.name || "Delivery Partner";
  const currentDate = new Date().toLocaleDateString(i18n.language || "en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  const todayEarnings = dashboardData?.earnings?.today || 0;
  const completedOrders = dashboardData?.stats?.deliveriesToday || 0;
  const activeBatchCount =
    activeOrders.length || dashboardData?.stats?.activeOrders || 0;

  const currentActiveOrder =
    activeOrder && activeOrder.status !== "delivered"
      ? activeOrder
      : dashboardData?.activeOrder &&
          dashboardData.activeOrder.status !== "delivered"
        ? {
            id: dashboardData.activeOrder.id,
            restaurantName: dashboardData.activeOrder.restaurantName,
            customerName: "Customer",
            customerAddress: dashboardData.activeOrder.customerAddress,
            earnings:
              dashboardData.activeOrder.earnings ??
              dashboardData.activeOrder.deliveryEarnings ??
              dashboardData.activeOrder.estimatedDeliveryFee ??
              dashboardData.activeOrder.deliveryFee ??
              0,
            status: dashboardData.activeOrder.status,
            estimatedTime: dashboardData.activeOrder.estimatedTime || "15 mins",
          }
        : null;

  if (loading) {
    return (
      <View className="flex-1 bg-[#F3E0D9] items-center justify-center">
        <ActivityIndicator size="large" color="#F59E0B" />
        <Text className="text-gray-500 mt-4 font-medium">
          {t("common.loadingDashboard")}
        </Text>
      </View>
    );
  }

  const glassStyle = {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 5,
  };

  return (
    <View className="flex-1 bg-[#F3E0D9]">
      <StatusBar barStyle="dark-content" backgroundColor="#F3E0D9" />

      {/* Background Gradient Elements for depth */}
      <View className="absolute top-0 left-0 right-0 h-96 opacity-60">
        <LinearGradient
          colors={["#FFF5EB", "transparent"]}
          style={{ flex: 1 }}
        />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#F59E0B"
            colors={["#F59E0B"]}
          />
        }
        contentContainerStyle={{
          paddingBottom: 110,
          paddingTop: insets.top + 10,
        }}>
        <Animated.View
          style={{
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
            paddingHorizontal: 24,
          }}>
          {/* Header */}
          <View className="flex-row items-center justify-between mb-8">
            <View className="flex-1">
              <Text className="text-sm font-medium text-[#7A7A7A] uppercase tracking-wider mb-1">
                {currentDate}
              </Text>
              <Text className="text-3xl font-extrabold text-[#1A1A1A]">
                {t("home.welcomeBack")} {partnerName}
              </Text>
            </View>
            <View className="flex-row items-center" style={{ gap: 10 }}>
              <LanguageSwitchButton />
              <TouchableOpacity
                className="w-12 h-12 bg-white rounded-full items-center justify-center "
                activeOpacity={0.7}
                onPress={() => router.push("/(tabs)/profile")}>
                <Ionicons
                  name="notifications-outline"
                  size={24}
                  color="#F59E0B"
                />
                <View className="absolute top-3 right-3 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white" />
              </TouchableOpacity>
            </View>
          </View>

          <LocationTrackingBanner
            className="mb-6"
            isOnline={isOnline}
            isTracking={locationTracking.isTracking}
            permissionStatus={locationTracking.permissionStatus}
            backgroundPermissionDenied={
              locationTracking.backgroundPermissionDenied
            }
            lastSuccessfulUpdateAt={locationTracking.lastSuccessfulUpdateAt}
            onRetry={() => {
              // stopTracking() then startTracking() instead of starting on top
              // of an already-running session — startTracking() doesn't clear
              // its own watchers/intervals first, so calling it twice would
              // leak an orphaned duplicate watcher.
              locationTracking.stopTracking();
              void locationTracking.startTracking();
            }}
          />

          {/* Status Toggle Card */}
          <View className="mb-6 bg-white rounded-[32px] p-1" style={glassStyle}>
            <View className="bg-gray-50 rounded-[28px] p-5 flex-row items-center justify-between">
              <View className="flex-row items-center flex-1 pr-4">
                <View
                  className={`w-14 h-14 rounded-full items-center justify-center mr-4  ${
                    isOnline ? "bg-[#10B981]" : "bg-[#EF4444]"
                  }`}>
                  {toggleLoading ? (
                    <ActivityIndicator color="white" size="small" />
                  ) : (
                    <Ionicons
                      name={isOnline ? "power" : "power-outline"}
                      size={28}
                      color="white"
                    />
                  )}
                </View>
                <View className="flex-1">
                  <Text className="text-lg font-bold text-[#1A1A1A]">
                    {isOnline ? t("home.youAreOnline") : t("home.youAreOffline")}
                  </Text>
                  <Text className="text-sm text-gray-500 font-medium">
                    {isOnline
                      ? t("home.readyForOrders")
                      : t("home.goOnlineToStartEarning")}
                  </Text>
                </View>
              </View>

              <Switch
                value={isOnline}
                onValueChange={handleToggleOnline}
                trackColor={{ false: "#E5E7EB", true: "#FCD34D" }}
                thumbColor={isOnline ? "#F59E0B" : "#FFFFFF"}
                ios_backgroundColor="#E5E7EB"
                style={{ transform: [{ scale: 0.9 }] }}
              />
            </View>
          </View>

          {/* Pending Requests - only show actively-available orders */}
          {activePendingRequests.length > 0 && (
            <>
              <Text className="text-lg font-bold text-[#1A1A1A] mb-4 ml-1">
                {t("home.pendingRequests")}
              </Text>
              {activePendingRequests.map((missed) => (
                <MissedOrderCard key={missed.order.id} missed={missed} />
              ))}
              <View className="mb-4" />
            </>
          )}

          {/* Stats Overview */}
          <Text className="text-lg font-bold text-[#1A1A1A] mb-4 ml-1">
            {t("home.todaysPerformance")}
          </Text>

          <View className="flex-row gap-4 mb-8">
            {/* Earnings Card */}
            <TouchableOpacity
              className="flex-1 bg-white rounded-[32px] p-5 border border-gray-100 relative overflow-hidden"
              style={glassStyle}
              onPress={() => router.push("/(tabs)/earnings")}
              activeOpacity={0.8}>
              <View className="absolute right-0 top-0 w-24 h-24 bg-[#10B981]/10 rounded-full -mr-8 -mt-8" />

              <View className="w-12 h-12 bg-[#D1FAE5] rounded-2xl items-center justify-center mb-4">
                <Ionicons name="wallet" size={24} color="#10B981" />
              </View>
              <Text className="text-3xl font-extrabold text-[#1A1A1A] mb-1">
                ₹{todayEarnings.toFixed(0)}
              </Text>
              <Text className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                {t("common.earnings")}
              </Text>
            </TouchableOpacity>

            {/* Orders Card */}
            <TouchableOpacity
              className="flex-1 bg-white rounded-[32px] p-5 border border-gray-100 relative overflow-hidden"
              style={glassStyle}
              onPress={() => router.push("/(tabs)/orders")}
              activeOpacity={0.8}>
              <View className="absolute right-0 top-0 w-24 h-24 bg-[#3B82F6]/10 rounded-full -mr-8 -mt-8" />

              <View className="w-12 h-12 bg-[#DBEAFE] rounded-2xl items-center justify-center mb-4">
                <Ionicons
                  name="checkmark-done-circle"
                  size={24}
                  color="#3B82F6"
                />
              </View>
              <Text className="text-3xl font-extrabold text-[#1A1A1A] mb-1">
                {completedOrders}
              </Text>
              <Text className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                {t("earnings.completed")}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Active Order Section */}
          <View className="flex-row items-center justify-between mb-4 ml-1">
            <Text className="text-lg font-bold text-[#1A1A1A]">
              {t("home.activeOrders")}
            </Text>
            {activeBatchCount > 1 && (
              <View className="bg-orange-100 px-3 py-1 rounded-full">
                <Text className="text-xs font-bold text-orange-600">
                  {t("home.batch")} {activeBatchCount}
                </Text>
              </View>
            )}
          </View>

          {currentActiveOrder ? (
            <TouchableOpacity
              onPress={handleViewOrderDetails}
              activeOpacity={0.9}
              className="bg-white rounded-[32px] p-1 mb-8"
              style={glassStyle}>
              <View className="bg-gray-50 rounded-[28px] overflow-hidden">
                <View className="p-5" style={{ position: "relative" }}>
                  {/* Status & Time Pills */}
                  <View className="flex-row items-center justify-between mb-5">
                    <View className="bg-blue-50 px-3 py-1.5 rounded-full flex-row items-center border border-blue-100">
                      <View className="w-2 h-2 bg-[#3B82F6] rounded-full mr-2" />
                      <Text className="text-sm font-bold text-[#3B82F6]">
                        {(() => {
                          const s = currentActiveOrder.status;
                          const labels: Record<string, string> = {
                            delivery_partner_accepted: t("status.accepted"),
                            accepted: t("status.accepted"),
                            delivery_partner_reached: t("status.atRestaurant"),
                            delivery_partner_picked_up: t("status.pickedUp"),
                            picked_up: t("status.pickedUp"),
                            delivery_partner_reached_user_dest: t("status.onTheWay"),
                            on_the_way: t("status.onTheWay"),
                            delivered: t("status.delivered"),
                            confirmed: t("status.confirmed"),
                            preparing: t("status.preparing"),
                            ready: t("status.ready"),
                            out_for_delivery: t("status.outForDelivery"),
                          };
                          return (
                            labels[s] ??
                            s
                              .replace(/_/g, " ")
                              .replace(/\b\w/g, (c) => c.toUpperCase())
                          );
                        })()}
                      </Text>
                    </View>

                    <View className="bg-blue-50 px-3 py-1.5 rounded-full flex-row items-center border border-blue-100">
                      <Ionicons name="time" size={14} color="#3B82F6" />
                      <Text className="text-xs font-bold text-[#3B82F6] ml-1.5">
                        {(() => {
                          const t = currentActiveOrder.estimatedTime;
                          if (!t) return "–";
                          if (typeof t === "string" && t.includes("min"))
                            return t;
                          const num = parseFloat(String(t));
                          if (isNaN(num)) return t;
                          if (num > 120) return `${Math.ceil(num / 60)} min`;
                          return `${Math.ceil(num)} min`;
                        })()}
                      </Text>
                    </View>
                  </View>

                  {/* Restaurant */}
                  <View className="flex-row items-start mb-2">
                    <View className="w-12 h-12 bg-[#FFFBEB] rounded-2xl items-center justify-center ">
                      <Ionicons name="restaurant" size={24} color="#F59E0B" />
                    </View>
                    <View className="ml-4 flex-1 justify-center">
                      <Text className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">
                        {t("home.pickup")}
                      </Text>
                      <Text
                        className="text-lg font-bold text-[#1A1A1A] leading-tight"
                        numberOfLines={1}>
                        {currentActiveOrder.restaurantName}
                      </Text>
                    </View>
                  </View>

                  {/* Connect Line */}
                  <View className="ml-5 pl-[3.5px] py-1">
                    <View className="w-[2px] h-6 bg-gray-200 ml-3" />
                  </View>

                  {/* Customer */}
                  <View className="flex-row items-start mb-6">
                    <View className="w-12 h-12 bg-[#D1FAE5] rounded-2xl items-center justify-center ">
                      <Ionicons name="location" size={24} color="#10B981" />
                    </View>
                    <View className="ml-4 flex-1 justify-center">
                      <Text className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">
                        {t("home.dropoff")}
                      </Text>
                      <Text
                        className="text-lg font-bold text-[#1A1A1A] leading-tight"
                        numberOfLines={1}>
                        {currentActiveOrder.customerName}
                      </Text>
                      <Text
                        className="text-sm text-gray-500 mt-0.5"
                        numberOfLines={1}>
                        {currentActiveOrder.customerAddress}
                      </Text>
                    </View>
                  </View>

                  {/* Footer Action */}
                  <View className="flex-row items-center justify-between pt-4 border-t border-gray-100">
                    <View>
                      <Text className="text-xs text-gray-400 font-bold uppercase mb-0.5">
                        {t("common.earnings")}
                      </Text>
                      <Text className="text-xl font-bold text-[#10B981]">
                        ₹{currentActiveOrder.earnings || 0}
                      </Text>
                    </View>

                    <View className="bg-[#F59E0B] px-5 py-2.5 rounded-2xl flex-row items-center shadow-lg shadow-amber-200">
                      <Text className="text-white font-bold mr-2">
                        {t("home.viewOrder")}
                      </Text>
                      <Ionicons name="arrow-forward" size={16} color="white" />
                    </View>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          ) : (
            <View
              className="bg-white rounded-[32px] p-8 items-center justify-center mb-8"
              style={glassStyle}>
              <View className="w-20 h-20 bg-gray-100 rounded-full items-center justify-center mb-4 ">
                <Ionicons name="cube-outline" size={36} color="#9CA3AF" />
              </View>
              <Text className="text-lg font-bold text-[#1A1A1A] mb-2">
                {t("home.noActiveOrders")}
              </Text>
              <Text className="text-gray-500 text-center mb-6 max-w-[250px] leading-5">
                {isOnline
                  ? t("home.noActiveOrdersOnline")
                  : t("home.noActiveOrdersOffline")}
              </Text>
              {!isOnline && (
                <TouchableOpacity
                  onPress={handleToggleOnline}
                  className="bg-[#F59E0B] px-8 py-3.5 rounded-full shadow-lg shadow-amber-200"
                  activeOpacity={0.8}>
                  <Text className="text-white font-bold text-base">
                    {t("home.goOnlineNow")}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {routePlan && routePlan.stops.length > 1 && (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => router.push("/(tabs)/orders")}
              className="bg-white rounded-[28px] p-5 mb-8 border border-orange-100"
              style={glassStyle}>
              <View className="flex-row items-center justify-between mb-3">
                <View>
                  <Text className="text-xs font-bold text-[#9CA3AF] uppercase tracking-wider">
                    {t("common.routeSequence")}
                  </Text>
                  <Text className="text-lg font-extrabold text-[#1A1A1A] mt-1">
                    {routePlan.stops.length} {t("common.stops")} • {routePlan.totalDistanceKm} km
                  </Text>
                </View>
                <Ionicons name="git-branch-outline" size={22} color="#F59E0B" />
              </View>
              {routePlan.stops.slice(0, 3).map((stop) => (
                <View
                  key={`${stop.orderId}-${stop.type}-${stop.sequence}`}
                  className="flex-row items-center py-2">
                  <View className="w-7 h-7 rounded-full bg-orange-50 items-center justify-center mr-3">
                    <Text className="text-xs font-extrabold text-orange-600">
                      {stop.sequence}
                    </Text>
                  </View>
                  <Text className="flex-1 text-sm font-semibold text-[#1A1A1A]" numberOfLines={1}>
                    {stop.type === "pickup" ? t("ordersScreen.pickup") : t("ordersScreen.drop")} •{" "}
                    {stop.type === "pickup" ? stop.restaurantName : stop.customerName}
                  </Text>
                  <Text className="text-xs font-bold text-[#9CA3AF]">
                    {stop.distanceKm} km
                  </Text>
                </View>
              ))}
            </TouchableOpacity>
          )}

          {/* Quick Actions */}
          <Text className="text-lg font-bold text-[#1A1A1A] mb-4 ml-1">
            {t("home.quickActions")}
          </Text>
          <View className="flex-row gap-4 mb-8">
            <TouchableOpacity
              activeOpacity={0.7}
              className="flex-1 bg-white rounded-[28px] p-5 items-center"
              style={glassStyle}
              onPress={() => router.push("/(tabs)/orders")}>
              <View className="w-14 h-14 bg-[#FFF7ED] rounded-2xl items-center justify-center mb-3 ">
                <Ionicons name="time" size={26} color="#F59E0B" />
              </View>
              <Text className="text-sm font-bold text-[#1A1A1A]">{t("home.history")}</Text>
              <Text className="text-xs text-gray-400 mt-1">{t("home.pastOrders")}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              className="flex-1 bg-white rounded-[28px] p-5 items-center"
              style={glassStyle}
              onPress={() => router.push("/(tabs)/earnings")}>
              <View className="w-14 h-14 bg-[#EFF6FF] rounded-2xl items-center justify-center mb-3 ">
                <Ionicons name="bar-chart" size={26} color="#3B82F6" />
              </View>
              <Text className="text-sm font-bold text-[#1A1A1A]">{t("home.reports")}</Text>
              <Text className="text-xs text-gray-400 mt-1">{t("home.checkStats")}</Text>
            </TouchableOpacity>
          </View>

          {/* Pro Tip */}
          <View className="bg-[#F59E0B]/10 rounded-[32px] p-6 flex-row items-center border border-[#F59E0B]/20 mb-6">
            <View className="w-12 h-12 bg-[#F59E0B] rounded-2xl items-center justify-center shadow-lg shadow-amber-200">
              <Ionicons name="bulb" size={24} color="white" />
            </View>
            <View className="ml-5 flex-1">
              <Text className="text-base font-bold text-[#1A1A1A] mb-1">
                {t("home.proTip")}
              </Text>
              <Text className="text-sm text-[#7A7A7A] leading-5">
                {t("home.proTipText")}
              </Text>
            </View>
          </View>
        </Animated.View>
      </ScrollView>

      {/* Order Request Modal */}
      {pendingOrder && (
        <OrderRequestModal
          order={pendingOrder}
          onAccept={handleAcceptOrder}
          onReject={handleRejectOrder}
          initialTimeLeft={pendingInitialTimeLeft}
        />
      )}

      {appUpdate.result?.status === "update_available" && !updateDialogDismissed && (
        <UpdateAppDialog
          visible
          updateInfo={appUpdate.result}
          onDismiss={() => setUpdateDialogDismissed(true)}
        />
      )}
    </View>
  );
}
