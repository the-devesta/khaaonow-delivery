import { color } from "@/theme/tokens";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Text, View } from "react-native";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

/** Four-step progress for an active order; `current` is 0-based. */
export default function StepStrip({
  steps,
  current,
}: {
  steps: Array<{ label: string; icon: IconName }>;
  current: number;
}) {
  return (
    <View className="flex-row items-start">
      {steps.map((step, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <View key={step.label} className="flex-1 items-center">
            <View className="flex-row items-center w-full">
              <View
                className={`flex-1 h-1 ${i === 0 ? "opacity-0" : done || active ? "bg-ink" : "bg-line"}`}
              />
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: done ? color.ink : active ? color.brand : color.surface,
                  borderWidth: active || done ? 0 : 1.5,
                  borderColor: color.line,
                }}>
                <Ionicons
                  name={done ? "checkmark" : step.icon}
                  size={16}
                  color={done ? "#fff" : active ? color.ink : color.faint}
                />
              </View>
              <View
                className={`flex-1 h-1 ${i === steps.length - 1 ? "opacity-0" : done ? "bg-ink" : "bg-line"}`}
              />
            </View>
            <Text
              numberOfLines={2}
              className={`mt-1.5 text-[11px] text-center px-0.5 ${
                active ? "font-bold text-ink" : "text-muted"
              }`}>
              {step.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
