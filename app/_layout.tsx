import { useColorScheme } from "@/hooks/use-color-scheme";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import { SafeAreaProvider } from "react-native-safe-area-context";
import "../global.css";

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider
          value={colorScheme === "dark" ? DarkTheme : DefaultTheme}
        >
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="splash" options={{ headerShown: false }} />
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="auth/login" options={{ headerShown: false }} />
            <Stack.Screen name="auth/otp" options={{ headerShown: false }} />
            <Stack.Screen
              name="registration/basic-details"
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="registration/vehicle-details"
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="registration/kyc-documents"
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="registration/profile-photo"
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="registration/review-submit"
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="registration/account-pending"
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="registration/account-rejected"
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
          <StatusBar style="auto" />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
