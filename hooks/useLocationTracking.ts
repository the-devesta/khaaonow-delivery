import { useOrderStore } from "@/store/orders";
import { usePartnerStore } from "@/store/partner";
import * as Location from "expo-location";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, AppState, AppStateStatus } from "react-native";

interface LocationTrackingOptions {
  updateInterval?: number; // in milliseconds
  distanceThreshold?: number; // in meters
  enableBackgroundTracking?: boolean;
}

interface LocationTrackingState {
  isTracking: boolean;
  currentLocation: {
    latitude: number;
    longitude: number;
  } | null;
  error: string | null;
  permissionStatus: "granted" | "denied" | "undetermined";
}

export function useLocationTracking(options: LocationTrackingOptions = {}) {
  const {
    updateInterval = 30000, // 30 seconds default
    distanceThreshold = 50, // 50 meters
  } = options;

  const { isOnline } = usePartnerStore();
  const { updateLocation } = useOrderStore();

  const [state, setState] = useState<LocationTrackingState>({
    isTracking: false,
    currentLocation: null,
    error: null,
    permissionStatus: "undetermined",
  });

  const locationWatchRef = useRef<Location.LocationSubscription | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  // Request location permissions
  const requestPermissions = useCallback(async () => {
    try {
      const { status: foregroundStatus } =
        await Location.requestForegroundPermissionsAsync();

      if (foregroundStatus !== "granted") {
        setState((prev) => ({
          ...prev,
          permissionStatus: "denied",
          error: "Location permission is required to track deliveries",
        }));
        return false;
      }

      setState((prev) => ({
        ...prev,
        permissionStatus: "granted",
        error: null,
      }));

      return true;
    } catch (error) {
      console.error("Error requesting location permissions:", error);
      setState((prev) => ({
        ...prev,
        error: "Failed to request location permissions",
      }));
      return false;
    }
  }, []);

  // Get current location once
  const getCurrentLocation = useCallback(async () => {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const newLocation = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      setState((prev) => ({
        ...prev,
        currentLocation: newLocation,
      }));

      return newLocation;
    } catch (error) {
      console.error("Error getting current location:", error);
      return null;
    }
  }, []);

  // Send location to backend
  const updateBackendLocation = useCallback(
    async (latitude: number, longitude: number) => {
      try {
        if (isOnline) {
          await updateLocation(latitude, longitude);
          console.log("📍 Location updated:", { latitude, longitude });
        }
      } catch (error) {
        console.error("Failed to update location:", error);
      }
    },
    [isOnline, updateLocation],
  );

  // Start location tracking
  const startTracking = useCallback(async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) {
      Alert.alert(
        "Location Permission Required",
        "Please enable location permissions in settings to track deliveries.",
        [{ text: "OK" }],
      );
      return;
    }

    setState((prev) => ({ ...prev, isTracking: true }));

    // Get initial location
    const initialLocation = await getCurrentLocation();
    if (initialLocation) {
      await updateBackendLocation(
        initialLocation.latitude,
        initialLocation.longitude,
      );
    }

    // Set up continuous location watching
    locationWatchRef.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        distanceInterval: distanceThreshold,
        timeInterval: updateInterval,
      },
      async (location) => {
        const newLocation = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        };

        setState((prev) => ({
          ...prev,
          currentLocation: newLocation,
        }));

        // Only update backend if partner is online
        if (isOnline) {
          await updateBackendLocation(
            newLocation.latitude,
            newLocation.longitude,
          );
        }
      },
    );

    // Set up periodic backend updates even if position hasn't changed significantly
    intervalRef.current = setInterval(async () => {
      if (isOnline) {
        const location = await getCurrentLocation();
        if (location) {
          await updateBackendLocation(location.latitude, location.longitude);
        }
      }
    }, updateInterval);
  }, [
    requestPermissions,
    getCurrentLocation,
    updateBackendLocation,
    distanceThreshold,
    updateInterval,
    isOnline,
  ]);

  // Stop location tracking
  const stopTracking = useCallback(() => {
    if (locationWatchRef.current) {
      locationWatchRef.current.remove();
      locationWatchRef.current = null;
    }

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    setState((prev) => ({ ...prev, isTracking: false }));
  }, []);

  // Handle app state changes
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === "active" &&
        isOnline
      ) {
        // App coming to foreground - refresh location
        getCurrentLocation().then((location) => {
          if (location) {
            updateBackendLocation(location.latitude, location.longitude);
          }
        });
      }
      appStateRef.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [isOnline, getCurrentLocation, updateBackendLocation]);

  // Auto-start/stop tracking based on online status
  useEffect(() => {
    if (isOnline && !state.isTracking) {
      startTracking();
    } else if (!isOnline && state.isTracking) {
      stopTracking();
    }
  }, [isOnline, state.isTracking, startTracking, stopTracking]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTracking();
    };
  }, [stopTracking]);

  return {
    ...state,
    startTracking,
    stopTracking,
    getCurrentLocation,
    requestPermissions,
  };
}
