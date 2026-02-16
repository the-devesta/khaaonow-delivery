import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef } from "react";
import { Animated, Text, View } from "react-native";

interface AnimatedStepIndicatorProps {
  currentStep: number;
  totalSteps?: number;
}

function AnimatedStep({
  step,
  currentStep,
  isLast,
}: {
  step: number;
  currentStep: number;
  isLast: boolean;
}) {
  const isCompleted = step < currentStep;
  const isActive = step === currentStep;
  const isPending = step > currentStep;

  // Animation values
  const scaleAnim = useRef(new Animated.Value(isActive ? 1 : 0.85)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;
  const lineWidthAnim = useRef(new Animated.Value(isCompleted ? 1 : 0)).current;

  useEffect(() => {
    // Scale animation for active step
    Animated.spring(scaleAnim, {
      toValue: isActive ? 1.1 : isPending ? 0.85 : 1,
      friction: 6,
      tension: 80,
      useNativeDriver: true,
    }).start();

    // Pulse effect for active step
    if (isActive) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(opacityAnim, {
            toValue: 0.6,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    } else {
      opacityAnim.setValue(1);
    }

    // Line fill animation
    Animated.timing(lineWidthAnim, {
      toValue: isCompleted ? 1 : 0,
      duration: 600,
      useNativeDriver: false,
    }).start();
  }, [
    currentStep,
    step,
    isActive,
    isCompleted,
    isPending,
    scaleAnim,
    opacityAnim,
    lineWidthAnim,
  ]);

  const lineWidth = lineWidthAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  return (
    <View className="flex-row items-center" style={{ flex: isLast ? 0 : 1 }}>
      {/* Step Circle */}
      <View className="relative items-center justify-center">
        {/* Outer ring for active step */}
        {isActive && (
          <Animated.View
            style={{
              position: "absolute",
              width: 48,
              height: 48,
              borderRadius: 24,
              backgroundColor: "#FFC107",
              opacity: opacityAnim.interpolate({
                inputRange: [0.6, 1],
                outputRange: [0.15, 0.25],
              }),
            }}
          />
        )}

        {/* Main Circle */}
        <Animated.View
          style={{
            transform: [{ scale: scaleAnim }],
          }}
          className={`w-10 h-10 rounded-full items-center justify-center ${
            isCompleted
              ? "bg-[#FFC107] shadow-lg shadow-yellow-500/50"
              : isActive
                ? "bg-[#FFC107] shadow-xl shadow-yellow-500/50"
                : "bg-white/20 border-2 border-white/10"
          }`}
        >
          {isCompleted ? (
            <Ionicons name="checkmark" size={20} color="black" />
          ) : (
            <Text
              className={`text-sm font-bold ${
                isActive ? "text-black" : "text-white/70"
              }`}
            >
              {step}
            </Text>
          )}
        </Animated.View>

        {/* Active step indicator dot */}
        {isActive && (
          <View className="absolute -bottom-3">
            <View className="w-1.5 h-1.5 rounded-full bg-[#FFC107]" />
          </View>
        )}
      </View>

      {/* Connecting Line */}
      {!isLast && (
        <View className="flex-1 h-1 bg-white/20 mx-2 rounded-full overflow-hidden">
          <Animated.View
            style={{
              width: lineWidth,
              height: "100%",
              backgroundColor: "#FFC107",
              borderRadius: 999,
            }}
          />
        </View>
      )}
    </View>
  );
}

export default function AnimatedStepIndicator({
  currentStep,
  totalSteps = 5,
}: AnimatedStepIndicatorProps) {
  const steps = Array.from({ length: totalSteps }, (_, i) => i + 1);

  return (
    <View className="flex-row items-center w-full justify-between">
      {steps.map((step, index) => (
        <AnimatedStep
          key={step}
          step={step}
          currentStep={currentStep}
          isLast={index === steps.length - 1}
        />
      ))}
    </View>
  );
}
