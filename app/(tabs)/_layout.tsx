import AnimatedBottomDock from "@/components/AnimatedBottomDock";
import { DockProvider, useDock } from "@/context/DockContext";
import "@/global.css";
import { socketService } from "@/services/socket";
import { useOrderStore } from "@/store/orders";
import * as Notifications from "expo-notifications";
import { router, Tabs } from "expo-router";
import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { useTranslation } from "react-i18next";

function TabsContent() {
  const { isDockVisible } = useDock();
  const { initializeSocket } = useOrderStore();
  const { t } = useTranslation();

  useEffect(() => {
    initializeSocket();

    // Re-ensure socket is live whenever the app moves back to foreground
    const appStateSub = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        socketService.ensureConnected();
      }
    });

    return () => appStateSub.remove();
  }, [initializeSocket]);

  // Tapping a push: new-order alerts open Home (the request popup shows there);
  // alerts about one of my orders open that order.
  const lastTap = Notifications.useLastNotificationResponse();
  const handledTap = useRef<string | null>(null);
  useEffect(() => {
    if (!lastTap || handledTap.current === lastTap.notification.request.identifier) return;
    handledTap.current = lastTap.notification.request.identifier;
    const data = (lastTap.notification.request.content.data ?? {}) as { orderId?: string; type?: string };
    const store = useOrderStore.getState();
    void (async () => {
      await Promise.all([store.fetchAvailableOrders(), store.fetchAssignedOrders()]);
      const mine = data.orderId && useOrderStore.getState().activeOrders.some((o) => o.id === data.orderId);
      if (mine) router.push(`/orders/${data.orderId}`);
      else router.navigate("/(tabs)");
    })();
  }, [lastTap]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: { display: "none" },
      }}
      tabBar={(props) => (
        <AnimatedBottomDock {...props} isVisible={isDockVisible} />
      )}>
      <Tabs.Screen name="index" options={{ title: t("common.home") }} />
      <Tabs.Screen name="orders" options={{ title: t("common.orders") }} />
      <Tabs.Screen name="earnings" options={{ title: t("common.earnings") }} />
      <Tabs.Screen name="profile" options={{ title: t("common.profile") }} />
    </Tabs>
  );
}

export default function TabLayout() {
  return (
    <DockProvider>
      <TabsContent />
    </DockProvider>
  );
}
