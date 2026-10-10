/**
 * Bottom tab bar — four big, always-labelled tabs. Slides away when a screen
 * hides the dock (see DockContext). Trips shows a count while orders are live.
 */
import { useOrderStore } from "@/store/orders";
import { color } from "@/theme/tokens";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import type { BottomTabBarProps } from "expo-router/build/react-navigation/bottom-tabs";
import React, { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Animated, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

const TABS: Record<string, { labelKey: string; icon: IconName; iconActive: IconName }> = {
  index: { labelKey: "common.home", icon: "home-outline", iconActive: "home" },
  orders: { labelKey: "trips.title", icon: "bicycle-outline", iconActive: "bicycle" },
  earnings: { labelKey: "earn.title", icon: "wallet-outline", iconActive: "wallet" },
  profile: { labelKey: "me.title", icon: "person-outline", iconActive: "person" },
};

export default function AnimatedBottomDock({
  state,
  descriptors,
  navigation,
  isVisible,
}: BottomTabBarProps & { isVisible: boolean }) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const liveCount = useOrderStore((s) => s.activeOrders.length);
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(translateY, { toValue: isVisible ? 0 : 140, duration: 200, useNativeDriver: true }).start();
  }, [isVisible, translateY]);

  return (
    <Animated.View
      pointerEvents={isVisible ? "auto" : "none"}
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        transform: [{ translateY }],
        backgroundColor: color.surface,
        borderTopWidth: 1,
        borderTopColor: color.line,
        paddingBottom: Math.max(insets.bottom, 8),
        paddingTop: 6,
        flexDirection: "row",
      }}>
      {state.routes.map((route, index) => {
        const meta = TABS[route.name];
        if (!meta) return null;
        const focused = state.index === index;
        const label = t(meta.labelKey);
        const badge = route.name === "orders" && liveCount > 0 ? liveCount : 0;

        const onPress = () => {
          Haptics.selectionAsync().catch(() => {});
          const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
        };

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            onLongPress={() => navigation.emit({ type: "tabLongPress", target: route.key })}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={descriptors[route.key]?.options.tabBarAccessibilityLabel ?? label}
            style={{ flex: 1, alignItems: "center", minHeight: 52, justifyContent: "center" }}>
            <View
              style={{
                width: 56,
                height: 30,
                borderRadius: 15,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: focused ? color.brand : "transparent",
              }}>
              <Ionicons name={focused ? meta.iconActive : meta.icon} size={22} color={focused ? color.ink : color.muted} />
              {badge ? (
                <View
                  style={{ position: "absolute", top: -4, right: 6, backgroundColor: color.danger }}
                  className="min-w-[18px] h-[18px] rounded-full items-center justify-center px-1">
                  <Text className="text-[11px] font-bold text-white">{badge}</Text>
                </View>
              ) : null}
            </View>
            <Text
              numberOfLines={1}
              style={{ fontSize: 12, marginTop: 3, fontWeight: focused ? "800" : "600", color: focused ? color.ink : color.muted }}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </Animated.View>
  );
}
