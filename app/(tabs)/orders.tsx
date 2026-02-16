import { useOrderStore } from "@/store/orders";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function OrdersScreen() {
  const router = useRouter();
  const { orderHistory } = useOrderStore();
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<
    "all" | "delivered" | "cancelled"
  >("all");

  const handleRefresh = async () => {
    setRefreshing(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setRefreshing(false);
  };

  const filteredOrders = orderHistory.filter((order) => {
    if (activeFilter === "all") return true;
    return order.status === activeFilter;
  });

  const completedCount = orderHistory.filter(
    (o) => o.status === "delivered",
  ).length;
  const totalEarnings = orderHistory
    .filter((o) => o.status === "delivered")
    .reduce((sum, o) => sum + o.earnings, 0);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "delivered":
        return { bg: "#D1FAE5", text: "#10B981", label: "Completed" };
      case "cancelled":
        return { bg: "#FEE2E2", text: "#EF4444", label: "Cancelled" };
      default:
        return { bg: "#E5E7EB", text: "#6B7280", label: "Unknown" };
    }
  };

  return (
    <View className="flex-1 bg-[#F3E0D9]">
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
        contentContainerStyle={{ paddingBottom: 110 }}
      >
        {/* Header */}
        <View className="px-6 pt-16 pb-5">
          <View className="flex-row items-center justify-between mb-2">
            <View className="flex-1">
              <Text className="text-sm font-medium text-[#7A7A7A] uppercase tracking-wider">
                Order History
              </Text>
              <Text className="text-3xl font-extrabold text-[#1A1A1A] mt-1">
                Your Deliveries 📦
              </Text>
            </View>
            <TouchableOpacity
              className="w-12 h-12 bg-white/60 rounded-full items-center justify-center shadow-sm backdrop-blur-sm border border-white/20"
              activeOpacity={0.7}
            >
              <Ionicons name="search-outline" size={24} color="#F59E0B" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats Cards */}
        <View className="px-6 mt-2 flex-row gap-4">
          <View className="flex-1 bg-white/70 backdrop-blur-md rounded-[32px] p-5 border border-white/50 shadow-sm relative overflow-hidden">
            <View className="absolute right-0 top-0 w-16 h-16 bg-[#10B981]/10 rounded-full -mr-6 -mt-6" />
            <View className="w-10 h-10 bg-[#D1FAE5] rounded-2xl items-center justify-center mb-3">
              <Ionicons
                name="checkmark-done-circle"
                size={20}
                color="#10B981"
              />
            </View>
            <Text className="text-xs font-bold text-[#6B7280] uppercase tracking-wide mb-1">
              Completed
            </Text>
            <Text className="text-2xl font-extrabold text-[#1A1A1A]">
              {completedCount}
            </Text>
          </View>
          <View className="flex-1 bg-white/70 backdrop-blur-md rounded-[32px] p-5 border border-white/50 shadow-sm relative overflow-hidden">
            <View className="absolute right-0 top-0 w-16 h-16 bg-[#F59E0B]/10 rounded-full -mr-6 -mt-6" />
            <View className="w-10 h-10 bg-[#FFFBEB] rounded-2xl items-center justify-center mb-3">
              <Ionicons name="wallet" size={20} color="#F59E0B" />
            </View>
            <Text className="text-xs font-bold text-[#6B7280] uppercase tracking-wide mb-1">
              Total Earned
            </Text>
            <Text className="text-2xl font-extrabold text-[#1A1A1A]">
              ₹{totalEarnings}
            </Text>
          </View>
        </View>

        {/* Filter Tabs */}
        <View className="px-6 mt-6">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 12 }}
          >
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setActiveFilter("all")}
              className={`px-6 py-3 rounded-full border ${
                activeFilter === "all"
                  ? "bg-[#F59E0B] border-[#F59E0B] shadow-lg shadow-amber-200"
                  : "bg-white/60 border-white/40"
              }`}
            >
              <Text
                className={`font-bold ${
                  activeFilter === "all" ? "text-white" : "text-[#7A7A7A]"
                }`}
              >
                All Orders
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setActiveFilter("delivered")}
              className={`px-6 py-3 rounded-full border ${
                activeFilter === "delivered"
                  ? "bg-[#10B981] border-[#10B981] shadow-lg shadow-emerald-200"
                  : "bg-white/60 border-white/40"
              }`}
            >
              <Text
                className={`font-bold ${
                  activeFilter === "delivered" ? "text-white" : "text-[#7A7A7A]"
                }`}
              >
                Completed
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setActiveFilter("cancelled")}
              className={`px-6 py-3 rounded-full border ${
                activeFilter === "cancelled"
                  ? "bg-[#EF4444] border-[#EF4444] shadow-lg shadow-red-200"
                  : "bg-white/60 border-white/40"
              }`}
            >
              <Text
                className={`font-bold ${
                  activeFilter === "cancelled" ? "text-white" : "text-[#7A7A7A]"
                }`}
              >
                Cancelled
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* Orders List */}
        <View className="px-6 mt-6">
          <View className="flex-row items-center justify-between mb-4 ml-1">
            <Text className="text-lg font-bold text-[#1A1A1A]">
              {activeFilter === "all"
                ? "All Orders"
                : activeFilter === "delivered"
                  ? "Completed Orders"
                  : "Cancelled Orders"}
            </Text>
            <View className="bg-white/40 px-3 py-1 rounded-full border border-white/40">
              <Text className="text-xs font-bold text-[#6B7280]">
                {filteredOrders.length}{" "}
                {filteredOrders.length === 1 ? "Order" : "Orders"}
              </Text>
            </View>
          </View>

          {filteredOrders.length === 0 ? (
            <View className="bg-white/70 backdrop-blur-md rounded-[32px] p-8 border border-white/50 shadow-sm items-center">
              <View className="w-20 h-20 bg-white/80 rounded-full items-center justify-center mb-4">
                <Ionicons name="receipt-outline" size={36} color="#9CA3AF" />
              </View>
              <Text className="text-lg font-bold text-[#1A1A1A] mb-2">
                No Orders Yet
              </Text>
              <Text className="text-sm text-[#7A7A7A] text-center max-w-[200px] leading-5">
                Complete your first delivery to see your order history
              </Text>
            </View>
          ) : (
            filteredOrders.map((order) => {
              const statusStyle = getStatusColor(order.status);
              const orderDate = new Date(order.createdAt).toLocaleDateString(
                "en-US",
                {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                },
              );
              return (
                <TouchableOpacity
                  key={order.id}
                  activeOpacity={0.8}
                  className="bg-white/70 backdrop-blur-md rounded-[32px] p-1 border border-white/50 mb-4 shadow-sm"
                  onPress={() => router.push(`/orders/${order.id}`)}
                >
                  <View className="bg-white/40 rounded-[28px] p-5">
                    <View className="flex-row items-center justify-between mb-4">
                      <View className="flex-1">
                        <Text className="text-xs font-bold text-[#9CA3AF] mb-1 tracking-wider">
                          ORDER ID
                        </Text>
                        <Text className="text-sm font-bold text-[#1A1A1A]">
                          #{order.id.slice(-8)}
                        </Text>
                      </View>
                      <View
                        className="px-3 py-1.5 rounded-full"
                        style={{ backgroundColor: statusStyle.bg }}
                      >
                        <Text
                          className="text-xs font-bold"
                          style={{ color: statusStyle.text }}
                        >
                          {statusStyle.label}
                        </Text>
                      </View>
                    </View>

                    <View className="flex-row items-start mb-4">
                      <View className="w-10 h-10 bg-[#FFFBEB] rounded-xl items-center justify-center shadow-sm">
                        <Ionicons name="restaurant" size={24} color="#F59E0B" />
                      </View>
                      <View className="ml-4 flex-1">
                        <Text className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">
                          Pickup From
                        </Text>
                        <Text
                          className="text-base font-bold text-[#1A1A1A] leading-tight"
                          numberOfLines={1}
                        >
                          {order.restaurantName}
                        </Text>
                      </View>
                    </View>

                    <View className="flex-row items-center justify-between pt-4 border-t border-gray-100">
                      <Text className="text-xs font-bold text-[#9CA3AF]">
                        {orderDate}
                      </Text>
                      <Text className="text-lg font-extrabold text-[#1A1A1A]">
                        ₹{order.earnings}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}
