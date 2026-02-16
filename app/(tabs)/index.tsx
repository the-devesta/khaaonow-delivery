import OrderRequestModal from "@/components/orders/OrderRequestModal";
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
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  RefreshControl,
  ScrollView,
  StatusBar,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
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
    estimatedTime?: string;
  } | null;
}

interface ProfileData {
  name?: string;
  phone: string;
}

const { width } = Dimensions.get("window");

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toggleLoading, setToggleLoading] = useState(false);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(
    null,
  );
  const [profile, setProfile] = useState<ProfileData | null>(null);

  const { isOnline, toggleOnline, syncOnlineStatus } = usePartnerStore();
  const { pendingOrder, activeOrder, acceptOrder, rejectOrder } =
    useOrderStore();

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

  // Location tracking
  useLocationTracking({
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

    // Register for push notifications
    const registerPush = async () => {
      try {
        const token = await registerForPushNotificationsAsync();
        if (token) {
          await registerPushTokenWithBackend(token);
        }
      } catch (error) {
        console.error("Failed to register push token:", error);
      }
    };

    registerPush();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAcceptOrder = () => {
    if (pendingOrder) {
      acceptOrder(pendingOrder.id);
      router.push(`/orders/${pendingOrder.id}`);
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
  const currentDate = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  const todayEarnings = dashboardData?.earnings?.today || 0;
  const completedOrders = dashboardData?.stats?.deliveriesToday || 0;

  const currentActiveOrder =
    activeOrder ||
    (dashboardData?.activeOrder
      ? {
          id: dashboardData.activeOrder.id,
          restaurantName: dashboardData.activeOrder.restaurantName,
          customerName: "Customer",
          customerAddress: dashboardData.activeOrder.customerAddress,
          earnings: dashboardData.activeOrder.totalAmount * 0.1,
          status: dashboardData.activeOrder.status,
          estimatedTime: dashboardData.activeOrder.estimatedTime || "15 mins",
        }
      : null);

  if (loading) {
    return (
      <View className="flex-1 bg-[#F3E0D9] items-center justify-center">
        <ActivityIndicator size="large" color="#F59E0B" />
        <Text className="text-gray-500 mt-4 font-medium">
          Loading dashboard...
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
        }}
      >
        <Animated.View
          style={{
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
            paddingHorizontal: 24,
          }}
        >
          {/* Header */}
          <View className="flex-row items-center justify-between mb-8">
            <View className="flex-1">
              <Text className="text-sm font-medium text-[#7A7A7A] uppercase tracking-wider mb-1">
                {currentDate}
              </Text>
              <Text className="text-3xl font-extrabold text-[#1A1A1A]">
                Hello, {partnerName}! 👋
              </Text>
            </View>
            <TouchableOpacity
              className="w-12 h-12 bg-white/60 rounded-full items-center justify-center shadow-sm backdrop-blur-sm border border-white/20"
              activeOpacity={0.7}
              onPress={() => router.push("/(tabs)/profile")}
            >
              <Ionicons
                name="notifications-outline"
                size={24}
                color="#F59E0B"
              />
              <View className="absolute top-3 right-3 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white" />
            </TouchableOpacity>
          </View>

          {/* Status Toggle Card */}
          <View
            className="mb-6 bg-white/70 backdrop-blur-md rounded-[32px] p-1 border border-white/50"
            style={glassStyle}
          >
            <View className="bg-white/40 rounded-[28px] p-5 flex-row items-center justify-between">
              <View className="flex-row items-center flex-1 pr-4">
                <View
                  className={`w-14 h-14 rounded-full items-center justify-center mr-4 shadow-sm ${
                    isOnline ? "bg-[#10B981]" : "bg-[#EF4444]"
                  }`}
                >
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
                    {isOnline ? "You are Online" : "You are Offline"}
                  </Text>
                  <Text className="text-sm text-gray-500 font-medium">
                    {isOnline
                      ? "Ready for orders"
                      : "Go online to start earning"}
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

          {/* Stats Overview */}
          <Text className="text-lg font-bold text-[#1A1A1A] mb-4 ml-1">
            Today's Overview
          </Text>

          <View className="flex-row gap-4 mb-8">
            {/* Earnings Card */}
            <TouchableOpacity
              className="flex-1 bg-white/70 backdrop-blur-sm rounded-[32px] p-5 border border-white/50 relative overflow-hidden"
              style={glassStyle}
              onPress={() => router.push("/(tabs)/earnings")}
              activeOpacity={0.8}
            >
              <View className="absolute right-0 top-0 w-24 h-24 bg-[#10B981]/10 rounded-full -mr-8 -mt-8" />

              <View className="w-12 h-12 bg-[#D1FAE5] rounded-2xl items-center justify-center mb-4">
                <Ionicons name="wallet" size={24} color="#10B981" />
              </View>
              <Text className="text-3xl font-extrabold text-[#1A1A1A] mb-1">
                ₹{todayEarnings.toFixed(0)}
              </Text>
              <Text className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                Earnings
              </Text>
            </TouchableOpacity>

            {/* Orders Card */}
            <TouchableOpacity
              className="flex-1 bg-white/70 backdrop-blur-sm rounded-[32px] p-5 border border-white/50 relative overflow-hidden"
              style={glassStyle}
              onPress={() => router.push("/(tabs)/orders")}
              activeOpacity={0.8}
            >
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
                Delivered
              </Text>
            </TouchableOpacity>
          </View>

          {/* Active Order Section */}
          <Text className="text-lg font-bold text-[#1A1A1A] mb-4 ml-1">
            Active Order
          </Text>

          {currentActiveOrder ? (
            <TouchableOpacity
              onPress={handleViewOrderDetails}
              activeOpacity={0.9}
              className="bg-white/70 backdrop-blur-md rounded-[32px] p-1 border border-white/50 mb-8"
              style={glassStyle}
            >
              <View className="bg-white/40 rounded-[28px] overflow-hidden">
                {/* Status Bar */}
                <LinearGradient
                  colors={["#DBEAFE", "#EFF6FF"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  className="px-5 py-4 flex-row items-center justify-between border-b border-white/50"
                >
                  <View className="flex-row items-center">
                    <View className="w-2 h-2 bg-[#3B82F6] rounded-full mr-2 animate-pulse" />
                    <Text className="text-sm font-bold text-[#3B82F6] tracking-wide">
                      {currentActiveOrder.status === "accepted" &&
                        "ORDER ACCEPTED"}
                      {currentActiveOrder.status === "picked_up" && "PICKED UP"}
                      {currentActiveOrder.status === "on_the_way" &&
                        "ON THE WAY"}
                      {currentActiveOrder.status === "confirmed" && "CONFIRMED"}
                      {currentActiveOrder.status === "preparing" && "PREPARING"}
                      {currentActiveOrder.status === "out_for_delivery" &&
                        "OUT FOR DELIVERY"}
                    </Text>
                  </View>
                  <View className="bg-white/80 px-2.5 py-1 rounded-full flex-row items-center">
                    <Ionicons name="time" size={12} color="#3B82F6" />
                    <Text className="text-xs font-bold text-[#3B82F6] ml-1">
                      {currentActiveOrder.estimatedTime}
                    </Text>
                  </View>
                </LinearGradient>

                <View className="p-5">
                  {/* Restaurant */}
                  <View className="flex-row items-start mb-6">
                    <View className="w-12 h-12 bg-[#FFFBEB] rounded-2xl items-center justify-center shadow-sm">
                      <Ionicons name="restaurant" size={24} color="#F59E0B" />
                    </View>
                    <View className="ml-4 flex-1 justify-center">
                      <Text className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">
                        Pick Up
                      </Text>
                      <Text
                        className="text-lg font-bold text-[#1A1A1A] leading-tight"
                        numberOfLines={1}
                      >
                        {currentActiveOrder.restaurantName}
                      </Text>
                    </View>
                  </View>

                  {/* Connect Line */}
                  <View className="absolute left-[43px] top-[90px] w-[2px] h-8 bg-gray-200" />

                  {/* Customer */}
                  <View className="flex-row items-start mb-6">
                    <View className="w-12 h-12 bg-[#D1FAE5] rounded-2xl items-center justify-center shadow-sm">
                      <Ionicons name="location" size={24} color="#10B981" />
                    </View>
                    <View className="ml-4 flex-1 justify-center">
                      <Text className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">
                        Drop Off
                      </Text>
                      <Text
                        className="text-lg font-bold text-[#1A1A1A] leading-tight"
                        numberOfLines={1}
                      >
                        {currentActiveOrder.customerName}
                      </Text>
                      <Text
                        className="text-sm text-gray-500 mt-0.5"
                        numberOfLines={1}
                      >
                        {currentActiveOrder.customerAddress}
                      </Text>
                    </View>
                  </View>

                  {/* Footer Action */}
                  <View className="flex-row items-center justify-between pt-4 border-t border-gray-100">
                    <View>
                      <Text className="text-xs text-gray-400 font-bold uppercase mb-0.5">
                        Est. Earnings
                      </Text>
                      <Text className="text-xl font-bold text-[#10B981]">
                        ₹{currentActiveOrder.earnings}
                      </Text>
                    </View>

                    <View className="bg-[#F59E0B] px-5 py-2.5 rounded-2xl flex-row items-center shadow-lg shadow-amber-200">
                      <Text className="text-white font-bold mr-2">
                        View Order
                      </Text>
                      <Ionicons name="arrow-forward" size={16} color="white" />
                    </View>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          ) : (
            <View
              className="bg-white/70 backdrop-blur-sm rounded-[32px] p-8 border border-white/50 items-center justify-center mb-8"
              style={glassStyle}
            >
              <View className="w-20 h-20 bg-white/60 rounded-full items-center justify-center mb-4 shadow-sm">
                <Ionicons name="cube-outline" size={36} color="#9CA3AF" />
              </View>
              <Text className="text-lg font-bold text-[#1A1A1A] mb-2">
                No Active Orders
              </Text>
              <Text className="text-gray-500 text-center mb-6 max-w-[250px] leading-5">
                {isOnline
                  ? "Relax! We'll notify you when a new delivery request arrives."
                  : "Go online to start receiving delivery requests nearby."}
              </Text>
              {!isOnline && (
                <TouchableOpacity
                  onPress={handleToggleOnline}
                  className="bg-[#F59E0B] px-8 py-3.5 rounded-full shadow-lg shadow-amber-200"
                  activeOpacity={0.8}
                >
                  <Text className="text-white font-bold text-base">
                    Go Online Now
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Quick Actions */}
          <Text className="text-lg font-bold text-[#1A1A1A] mb-4 ml-1">
            Quick Actions
          </Text>
          <View className="flex-row gap-4 mb-8">
            <TouchableOpacity
              activeOpacity={0.7}
              className="flex-1 bg-white/70 backdrop-blur-sm rounded-[28px] p-5 border border-white/50 items-center"
              style={glassStyle}
              onPress={() => router.push("/(tabs)/orders")}
            >
              <View className="w-14 h-14 bg-[#FFF7ED] rounded-2xl items-center justify-center mb-3 shadow-sm">
                <Ionicons name="time" size={26} color="#F59E0B" />
              </View>
              <Text className="text-sm font-bold text-[#1A1A1A]">History</Text>
              <Text className="text-xs text-gray-400 mt-1">Past orders</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              className="flex-1 bg-white/70 backdrop-blur-sm rounded-[28px] p-5 border border-white/50 items-center"
              style={glassStyle}
              onPress={() => router.push("/(tabs)/earnings")}
            >
              <View className="w-14 h-14 bg-[#EFF6FF] rounded-2xl items-center justify-center mb-3 shadow-sm">
                <Ionicons name="bar-chart" size={26} color="#3B82F6" />
              </View>
              <Text className="text-sm font-bold text-[#1A1A1A]">Reports</Text>
              <Text className="text-xs text-gray-400 mt-1">Check stats</Text>
            </TouchableOpacity>
          </View>

          {/* Pro Tip */}
          <View className="bg-[#F59E0B]/10 rounded-[32px] p-6 flex-row items-center border border-[#F59E0B]/20 mb-6">
            <View className="w-12 h-12 bg-[#F59E0B] rounded-2xl items-center justify-center shadow-lg shadow-amber-200">
              <Ionicons name="bulb" size={24} color="white" />
            </View>
            <View className="ml-5 flex-1">
              <Text className="text-base font-bold text-[#1A1A1A] mb-1">
                Pro Tip
              </Text>
              <Text className="text-sm text-[#7A7A7A] leading-5">
                Going online during peak hours (12-2 PM & 7-9 PM) helps you earn
                more!
              </Text>
            </View>
          </View>
        </Animated.View>
      </ScrollView>

      {/* Order Request Modal */}
      {pendingOrder && !activeOrder && (
        <OrderRequestModal
          order={pendingOrder}
          onAccept={handleAcceptOrder}
          onReject={handleRejectOrder}
        />
      )}
    </View>
  );
}
