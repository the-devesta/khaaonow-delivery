import { Colors } from "@/constants/colors";
import React from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";

interface PrimaryButtonProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "outline";
  icon?: React.ReactNode;
}

export default function PrimaryButton({
  title,
  onPress,
  loading = false,
  disabled = false,
  variant = "primary",
  icon,
}: PrimaryButtonProps) {
  const getButtonStyle = () => {
    if (disabled) return "bg-gray-300";
    if (variant === "secondary") return "bg-gray-800";
    if (variant === "outline") return "bg-white border-2 border-[#F59E0B]";
    return "bg-[#F59E0B]";
  };

  const getTextStyle = () => {
    if (disabled) return "text-gray-500";
    if (variant === "outline") return "text-[#F59E0B]";
    return "text-white";
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      className={`w-full py-4 rounded-3xl ${getButtonStyle()}`}
      activeOpacity={0.8}
    >
      <View className="flex-row items-center justify-center">
        {loading ? (
          <ActivityIndicator
            color={variant === "outline" ? Colors.primary : Colors.white}
          />
        ) : (
          <>
            <Text className={`text-center text-lg font-bold ${getTextStyle()}`}>
              {title}
            </Text>
            {icon && <View className="ml-2">{icon}</View>}
          </>
        )}
      </View>
    </TouchableOpacity>
  );
}
