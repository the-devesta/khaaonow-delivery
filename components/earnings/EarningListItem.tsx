import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";

interface EarningListItemProps {
  date: string;
  amount: number;
  orderCount: number;
}

export default function EarningListItem({
  date,
  amount,
  orderCount,
}: EarningListItemProps) {
  return (
    <View className="bg-white/40 rounded-2xl p-4 mb-3 border border-white/20 flex-row items-center justify-between shadow-sm">
      <View className="flex-row items-center flex-1">
        <View className="w-12 h-12 bg-[#FFFBEB] rounded-xl items-center justify-center shadow-sm border border-amber-100/50">
          <Ionicons name="calendar-outline" size={20} color="#F59E0B" />
        </View>
        <View className="ml-3 flex-1">
          <Text className="text-sm font-bold text-[#1A1A1A] mb-0.5">
            {date}
          </Text>
          <Text className="text-xs font-medium text-[#6B7280]">
            {orderCount} {orderCount === 1 ? "order" : "orders"}
          </Text>
        </View>
      </View>
      <View className="items-end bg-white/50 px-3 py-1 rounded-full border border-white/40">
        <Text className="text-sm font-bold text-[#10B981]">₹{amount}</Text>
      </View>
    </View>
  );
}
