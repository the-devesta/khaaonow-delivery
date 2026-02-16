import { useAuthStore } from "@/store/auth";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";

// Prevent auto-hiding of splash screen
SplashScreen.preventAutoHideAsync();

export default function CustomSplashScreen() {
  const router = useRouter();
  const { isAuthenticated, initializeAuth, getNavigationRoute, loading } =
    useAuthStore();

  // Animation values
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const initialize = async () => {
      console.log("🚀 [Splash] Starting initialization...");

      // Hide the Expo splash screen
      await SplashScreen.hideAsync();

      // Initialize auth state from storage
      await initializeAuth();

      console.log("✅ [Splash] Auth initialized, starting animation...");

      // Smooth fade in and scale sequence
      Animated.sequence([
        // Initial fade in
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        // Hold for a moment
        Animated.delay(600),
        // Main zoom out effect with better timing
        Animated.parallel([
          // Logo zooms from normal to larger
          Animated.timing(scaleAnim, {
            toValue: 3.8,
            duration: 1000,
            useNativeDriver: true,
          }),
          // Logo fades out as it zooms
          Animated.timing(opacityAnim, {
            toValue: 0,
            duration: 900,
            useNativeDriver: true,
          }),
        ]),
      ]).start(() => {
        // Get the appropriate route based on auth state
        const route = getNavigationRoute();
        console.log("🧭 [Splash] Navigating to:", route);
        router.replace(route as any);
      });
    };

    initialize();
  }, [opacityAnim, router, scaleAnim, initializeAuth, getNavigationRoute]);

  // Dynamic shadow based on scale
  const shadowOpacity = scaleAnim.interpolate({
    inputRange: [1, 3.5],
    outputRange: [0.25, 0],
  });

  const shadowRadius = scaleAnim.interpolate({
    inputRange: [1, 3.5],
    outputRange: [30, 0],
  });

  return (
    <View style={styles.container}>
      {/* Animated logo container with zoom-out effect */}
      <Animated.View
        style={[
          styles.logoContainer,
          {
            opacity: opacityAnim,
            transform: [{ scale: scaleAnim }],
            shadowOpacity: shadowOpacity,
            shadowRadius: shadowRadius,
          },
        ]}
      >
        {/* Main logo */}
        <Image
          source={require("../assets/images/logo1.png")}
          style={styles.logo}
          contentFit="contain"
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFD600", // Yellow primary
    alignItems: "center",
    justifyContent: "center",
  },
  logoContainer: {
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#F57F17", // darker yellow/orange shadow
    shadowOffset: {
      width: 0,
      height: 15,
    },
    elevation: 15,
  },
  logo: {
    width: 280,
    height: 280,
    borderRadius: 140,
  },
});
