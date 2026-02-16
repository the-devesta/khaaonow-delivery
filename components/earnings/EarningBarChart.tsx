import { Text, View } from "react-native";

interface BarData {
  label: string;
  value: number;
}

interface EarningBarChartProps {
  data: BarData[];
  maxValue: number;
}

export default function EarningBarChart({
  data,
  maxValue,
}: EarningBarChartProps) {
  return (
    <View className="w-full">
      <Text className="text-lg font-bold text-[#1A1A1A] mb-6 tracking-wide">
        Weekly Earnings
      </Text>
      <View className="flex-row items-end justify-between h-48 w-full">
        {data.map((item, index) => {
          const heightPercentage = (item.value / maxValue) * 100;
          // Ensure min height for visibility
          const barHeight = Math.max((heightPercentage / 100) * 180, 8);

          return (
            <View key={index} className="items-center flex-1 mx-1">
              <View className="items-center justify-end flex-1 w-full">
                {item.value > 0 && (
                  <Text className="text-[10px] font-bold text-[#6B7280] mb-1">
                    ₹{item.value}
                  </Text>
                )}
                <View
                  className="w-full rounded-t-lg shadow-sm"
                  style={{
                    height: barHeight,
                    backgroundColor: "#F59E0B", // Amber/Yellow
                    opacity: item.value > 0 ? 1 : 0.3,
                  }}
                />
              </View>
              <Text className="text-[10px] font-medium text-[#9CA3AF] mt-2 uppercase tracking-wider">
                {item.label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
