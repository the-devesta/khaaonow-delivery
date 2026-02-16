import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";

interface EarningSummaryCardProps {
  title: string;
  amount: number;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBg: string;
  trend?: {
    value: string;
    isPositive: boolean;
  };
}

export default function EarningSummaryCard({
  title,
  amount,
  subtitle,
  icon,
  iconColor,
  iconBg,
  trend,
}: EarningSummaryCardProps) {
  return (
    <View className="p-5">
      <View className="flex-row items-center justify-between mb-4">
        <View
          className="w-12 h-12 rounded-2xl items-center justify-center shadow-sm border border-white/20"
          style={{ backgroundColor: iconBg }}
        >
          <Ionicons name={icon} size={24} color={iconColor} />
        </View>
        {trend && (
          <View
            className={`px-3 py-1.5 rounded-full border border-white/20 flex-row items-center gap-1 ${
              trend.isPositive ? "bg-[#D1FAE5]/80" : "bg-[#FEE2E2]/80"
            }`}
          >
            <Ionicons
              name={trend.isPositive ? "trending-up" : "trending-down"}
              size={12}
              color={trend.isPositive ? "#10B981" : "#EF4444"}
            />
            <Text
              className={`text-xs font-bold ${
                trend.isPositive ? "text-[#10B981]" : "text-[#EF4444]"
              }`}
            >
              {trend.value}
            </Text>
          </View>
        )}
      </View>
      <Text className="text-sm font-bold text-[#6B7280] mb-1 uppercase tracking-wide opacity-80">
        {title}
      </Text>
      <Text className="text-4xl font-extrabold text-[#1A1A1A] mb-1 tracking-tight">
        ₹{amount.toLocaleString()}
      </Text>
      <Text className="text-xs font-medium text-[#9CA3AF]">{subtitle}</Text>
    </View>
  );
}
