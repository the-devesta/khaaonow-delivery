import { useColorScheme } from "@/hooks/use-color-scheme";
import { PortalHost } from "@rn-primitives/portal";
import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider,
} from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import "react-native-reanimated";
import { SafeAreaProvider } from "react-native-safe-area-context";
import AppStatusGate from "@/components/AppStatusGate";
import { loadSavedLanguage } from "@/i18n";
import "../global.css";
// Registers the TaskManager task at module load time so the OS can invoke it
// in a headless JS context (app backgrounded/killed) without this screen
// having ever mounted.
import "@/tasks/backgroundLocationTask";
import { useEffect } from "react";

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    loadSavedLanguage();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <BottomSheetModalProvider>
          <ThemeProvider
            value={colorScheme === "dark" ? DarkTheme : DefaultTheme}
          >
            <AppStatusGate>
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="splash" options={{ headerShown: false }} />
                <Stack.Screen name="index" options={{ headerShown: false }} />
                <Stack.Screen name="auth/login" options={{ headerShown: false }} />
                <Stack.Screen name="auth/otp" options={{ headerShown: false }} />
                <Stack.Screen
                  name="registration"
                  options={{ headerShown: false }}
                />
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen
                  name="modal"
                  options={{
                    presentation: "modal",
                    title: "Profile",
                    headerShown: true,
                  }}
                />
              </Stack>
            </AppStatusGate>
            <StatusBar style="auto" />
            <PortalHost />
          </ThemeProvider>
        </BottomSheetModalProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
