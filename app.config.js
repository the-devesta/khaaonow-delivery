// Dynamic Expo config for EAS/Expo builds.

const FALLBACK_GOOGLE_MAPS_API_KEY = "AIzaSyAgvK2OviEztEkLdb3dAizrEdLDtP12pzU";
const GOOGLE_MAPS_ANDROID_API_KEY =
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY ||
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
  FALLBACK_GOOGLE_MAPS_API_KEY;
const GOOGLE_MAPS_IOS_API_KEY =
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_IOS_API_KEY ||
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
  FALLBACK_GOOGLE_MAPS_API_KEY;

if (!GOOGLE_MAPS_ANDROID_API_KEY || !GOOGLE_MAPS_IOS_API_KEY) {
  throw new Error(
    "Google Maps API key is required for native map builds. Configure EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY and EXPO_PUBLIC_GOOGLE_MAPS_IOS_API_KEY, or EXPO_PUBLIC_GOOGLE_MAPS_API_KEY.",
  );
}

const plugins = [
  "expo-router",
  [
    "expo-splash-screen",
    {
      image: "./assets/images/DeliveryKhaaoNow.png",
      imageWidth: 260,
      resizeMode: "contain",
      backgroundColor: "#FFD230",
    },
  ],
  "expo-font",
  "expo-image",
  [
    "expo-location",
    {
      locationAlwaysAndWhenInUsePermission:
        "Allow KhaaoNow Delivery to use your location in the background so nearby orders can find you even when the app isn't open.",
      isAndroidBackgroundLocationEnabled: true,
      isAndroidForegroundServiceEnabled: true,
    },
  ],
  [
    "expo-notifications",
    {
      icon: "./assets/images/DeliveryKhaaoNow.png",
      color: "#FFD230",
    },
  ],
  "expo-secure-store",
  "expo-status-bar",
  "expo-web-browser",
  [
    "expo-build-properties",
    {
      ios: {
        useFrameworks: "static",
        newArchEnabled: true,
        deploymentTarget: "16.4",
      },
      android: {
        newArchEnabled: true,
      },
    },
  ],
  [
    "react-native-maps",
    {
      iosGoogleMapsApiKey: GOOGLE_MAPS_IOS_API_KEY,
      androidGoogleMapsApiKey: GOOGLE_MAPS_ANDROID_API_KEY,
    },
  ],
  "./plugins/withPodfileFix.js",
  "./plugins/withAndroidGradleMemory.js",
];

module.exports = {
  expo: {
    name: "KhaaoNow Delivery",
    slug: "khaaonow-delivery",
    version: "1.0.15",
    orientation: "portrait",
    icon: "./assets/images/DeliveryKhaaoNow.png",
    scheme: "khaaonowdelivery",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    autolinking: {
      // @expo/ui excluded here previously, but expo-router's own internals
      // (route-tree loading, native tabs support) reference ExpoUI's native
      // module regardless of whether the app uses it directly - excluding it
      // from autolinking meant the JS bridge call had nothing to resolve to,
      // crashing the entire app on startup (FATAL EXCEPTION: Cannot find
      // native module 'ExpoUI'). The restaurant app doesn't exclude it and
      // builds/runs fine, so only the two genuinely iOS-only, unused
      // packages stay excluded here.
      ios: {
        exclude: ["expo-glass-effect", "expo-symbols"],
      },
      android: {
        exclude: ["expo-glass-effect", "expo-symbols"],
      },
    },
    extra: {
      eas: {
        projectId: "56f92eae-29a4-46fc-94b2-623d2e2d3a72",
      },
    },
    ios: {
      supportsTablet: false,
      requireFullScreen: true,
      bundleIdentifier: "com.khaaonow.delivery",
      buildNumber: "2026110601",
      config: {
        googleMapsApiKey: GOOGLE_MAPS_IOS_API_KEY,
      },
      googleServicesFile:
        process.env.IOS_GOOGLE_SERVICES_PLIST || "./GoogleService-Info.plist",
      entitlements: {
        "aps-environment": "production",
      },
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        GMSApiKey: GOOGLE_MAPS_IOS_API_KEY,
        LSApplicationQueriesSchemes: ["comgooglemaps"],
        NSLocationWhenInUseUsageDescription:
          "Allow KhaaoNow Delivery to use your location to navigate to pickup and drop-off points.",
        NSLocationAlwaysAndWhenInUseUsageDescription:
          "Allow KhaaoNow Delivery to use your location in the background so nearby orders can find you even when the app isn't open.",
        NSLocationAlwaysUsageDescription:
          "Allow KhaaoNow Delivery to use your location in the background so nearby orders can find you even when the app isn't open.",
        UIBackgroundModes: ["location"],
        NSCameraUsageDescription:
          "Allow KhaaoNow Delivery to access your camera to upload delivery photos.",
        NSPhotoLibraryUsageDescription:
          "Allow KhaaoNow Delivery to access your photos to upload delivery photos.",
        NSMicrophoneUsageDescription:
          "Allow KhaaoNow Delivery to access your microphone.",
      },
    },
    android: {
      package: "com.khaaonow.delivery",
      softwareKeyboardLayoutMode: "resize",
      versionCode: 2026110601,
      config: {
        googleMaps: {
          apiKey: GOOGLE_MAPS_ANDROID_API_KEY,
        },
      },
      googleServicesFile:
        process.env.ANDROID_GOOGLE_SERVICES_JSON || "./google-services.json",
      adaptiveIcon: {
        backgroundColor: "#FFD230",
        foregroundImage: "./assets/images/DeliveryKhaaoNow.png",
      },
      edgeToEdgeEnabled: true,
      intentFilters: [
        {
          action: "VIEW",
          autoVerify: true,
          data: [
            {
              scheme: "khaaonowdelivery",
              host: "auth",
              pathPrefix: "/callback",
            },
          ],
          category: ["BROWSABLE", "DEFAULT"],
        },
      ],
    },
    web: {
      output: "static",
      favicon: "./assets/images/DeliveryKhaaoNow.png",
    },
    plugins: plugins,
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
  },
};
