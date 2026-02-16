import AnimatedBottomDock from "@/components/AnimatedBottomDock";
import { DockProvider, useDock } from "@/context/DockContext";
import "@/global.css";
import { useOrderStore } from "@/store/orders";
import { Tabs } from "expo-router";
import { useEffect } from "react";

function TabsContent() {
  const { isDockVisible } = useDock();
  const { initializeSocket } = useOrderStore();

  useEffect(() => {
    initializeSocket();
  }, []);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: { display: "none" },
      }}
      tabBar={(props) => (
        <AnimatedBottomDock {...props} isVisible={isDockVisible} />
      )}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: "Orders",
        }}
      />
      <Tabs.Screen
        name="earnings"
        options={{
          title: "Earnings",
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
        }}
      />
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
