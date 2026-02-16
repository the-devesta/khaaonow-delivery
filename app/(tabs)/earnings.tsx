import EarningBarChart from "@/components/earnings/EarningBarChart";
import EarningListItem from "@/components/earnings/EarningListItem";
import EarningSummaryCard from "@/components/earnings/EarningSummaryCard";
import { useOrderStore } from "@/store/orders";
import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function EarningsScreen() {
  const { orderHistory } = useOrderStore();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setRefreshing(false);
  };

  const { todayEarnings, weeklyData, earningsHistory, completedOrders } =
    useMemo(() => {
      const completedOrders = orderHistory.filter(
        (o) => o.status === "delivered",
      );

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const todayOrders = completedOrders.filter((o) => {
        const orderDate = new Date(o.createdAt);
        orderDate.setHours(0, 0, 0, 0);
        return orderDate.getTime() === today.getTime();
      });

      const todayEarnings = todayOrders.reduce((sum, o) => sum + o.earnings, 0);

      // Calculate weekly data (last 7 days)
      const weeklyData: { label: string; value: number }[] = [];
      const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);

        const dayOrders = completedOrders.filter((o) => {
          const orderDate = new Date(o.createdAt);
          orderDate.setHours(0, 0, 0, 0);
          return orderDate.getTime() === date.getTime();
        });

        const dayEarnings = dayOrders.reduce((sum, o) => sum + o.earnings, 0);
        weeklyData.push({
          label: dayLabels[date.getDay()],
          value: dayEarnings,
        });
      }

      // Group earnings by date for history
      const earningsByDate = new Map<
        string,
        { amount: number; count: number }
      >();
      completedOrders.forEach((order) => {
        const dateKey = new Date(order.createdAt).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
        const existing = earningsByDate.get(dateKey) || { amount: 0, count: 0 };
        earningsByDate.set(dateKey, {
          amount: existing.amount + order.earnings,
          count: existing.count + 1,
        });
      });

      const earningsHistory = Array.from(earningsByDate.entries())
        .map(([date, data]) => ({
          date,
          amount: data.amount,
          orderCount: data.count,
        }))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 7);

      return {
        todayEarnings,
        weeklyData,
        earningsHistory,
        completedOrders: todayOrders.length,
      };
    }, [orderHistory]);

  const weeklyEarnings = weeklyData.reduce((sum, day) => sum + day.value, 0);
  const maxValue = Math.max(...weeklyData.map((d) => d.value), 100);

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
                Earnings Overview
              </Text>
              <Text className="text-3xl font-extrabold text-[#1A1A1A] mt-1">
                Track Your Income 💰
              </Text>
            </View>
            <TouchableOpacity
              className="w-12 h-12 bg-white/60 rounded-full items-center justify-center shadow-sm backdrop-blur-sm border border-white/20"
              activeOpacity={0.7}
            >
              <Ionicons name="download-outline" size={24} color="#F59E0B" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Summary Cards */}
        <View className="px-6 mt-2">
          <View className="bg-white/70 backdrop-blur-md rounded-[32px] p-1 border border-white/50 shadow-sm">
            <View className="bg-white/40 rounded-[28px] overflow-hidden">
              <EarningSummaryCard
                title="Today's Earnings"
                amount={todayEarnings}
                subtitle={`From ${completedOrders} deliveries`}
                icon="trending-up"
                iconColor="#F59E0B"
                iconBg="#FFFBEB"
                trend={{ value: "12%", isPositive: true }}
              />
            </View>
          </View>
        </View>

        <View className="px-6 mt-4 flex-row gap-4">
          <View className="flex-1">
            <View className="bg-white/70 backdrop-blur-sm rounded-[32px] p-5 border border-white/50 shadow-sm relative overflow-hidden">
              <View className="absolute right-0 top-0 w-16 h-16 bg-[#3B82F6]/10 rounded-full -mr-6 -mt-6" />
              <View className="w-10 h-10 bg-[#DBEAFE] rounded-2xl items-center justify-center mb-3">
                <Ionicons name="calendar" size={20} color="#3B82F6" />
              </View>
              <Text className="text-xs font-bold text-[#6B7280] mb-1 uppercase tracking-wide">
                Weekly Total
              </Text>
              <Text className="text-2xl font-extrabold text-[#1A1A1A]">
                ₹{weeklyEarnings.toLocaleString()}
              </Text>
            </View>
          </View>
          <View className="flex-1">
            <View className="bg-white/70 backdrop-blur-sm rounded-[32px] p-5 border border-white/50 shadow-sm relative overflow-hidden">
              <View className="absolute right-0 top-0 w-16 h-16 bg-[#10B981]/10 rounded-full -mr-6 -mt-6" />
              <View className="w-10 h-10 bg-[#D1FAE5] rounded-2xl items-center justify-center mb-3">
                <Ionicons name="checkmark-done" size={20} color="#10B981" />
              </View>
              <Text className="text-xs font-bold text-[#6B7280] mb-1 uppercase tracking-wide">
                Completed
              </Text>
              <Text className="text-2xl font-extrabold text-[#1A1A1A]">
                {orderHistory.filter((o) => o.status === "delivered").length}
              </Text>
            </View>
          </View>
        </View>

        {/* Bar Chart */}
        <View className="px-6 mt-6">
          <View className="bg-white/70 backdrop-blur-md rounded-[32px] p-6 border border-white/50 shadow-sm">
            <EarningBarChart data={weeklyData} maxValue={maxValue} />
          </View>
        </View>

        {/* Earnings History */}
        <View className="px-6 mt-8">
          <View className="flex-row items-center justify-between mb-4 ml-1">
            <Text className="text-lg font-bold text-[#1A1A1A]">
              Earnings History
            </Text>
            <TouchableOpacity activeOpacity={0.7}>
              <Text className="text-sm font-bold text-[#F59E0B]">See All</Text>
            </TouchableOpacity>
          </View>
          {earningsHistory.length === 0 ? (
            <View className="bg-white/70 backdrop-blur-sm rounded-[32px] p-8 border border-white/50 shadow-sm items-center">
              <View className="w-20 h-20 bg-white/60 rounded-full items-center justify-center mb-4">
                <Ionicons name="wallet-outline" size={36} color="#9CA3AF" />
              </View>
              <Text className="text-lg font-bold text-[#1A1A1A] mb-2">
                No Earnings Yet
              </Text>
              <Text className="text-sm text-[#7A7A7A] text-center max-w-[200px] leading-5">
                Complete deliveries to start earning
              </Text>
            </View>
          ) : (
            <View className="bg-white/70 backdrop-blur-md rounded-[32px] overflow-hidden border border-white/50 shadow-sm">
              <View className="bg-white/40 p-2">
                {earningsHistory.map((item, index) => (
                  <EarningListItem
                    key={index}
                    date={item.date}
                    amount={item.amount}
                    orderCount={item.orderCount}
                  />
                ))}
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
