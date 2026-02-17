// Dynamic Expo config that conditionally loads native Firebase plugins
// In Expo Go, the native modules aren't available, so we skip them

const IS_DEV_BUILD = process.env.EAS_BUILD || process.env.EXPO_DEV_CLIENT;

const plugins = [
  "expo-router",
  [
    "expo-splash-screen",
    {
      image: "./assets/images/logo2.png",
      imageWidth: 200,
      resizeMode: "contain",
      backgroundColor: "#ffffff",
      dark: {
        backgroundColor: "#000000",
      },
    },
  ],
];

// Only add native Firebase plugins for development/production builds (not Expo Go)
if (IS_DEV_BUILD) {
  plugins.push("@react-native-firebase/app");
  plugins.push("@react-native-firebase/auth");
}

module.exports = {
  expo: {
    name: "KhaaoNow Delivery",
    slug: "khaaonow-delivery",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/logo2.png",
    scheme: "khaaonowdelivery",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    extra: {
      eas: {
        projectId: "e80586c0-7ca7-4966-af42-488b6535dd2f",
      },
    },
    ios: {
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
      },
      supportsTablet: true,
      bundleIdentifier: "com.khaaonow.delivery",
      googleServicesFile:
        process.env.IOS_GOOGLE_SERVICES_PLIST || "./GoogleService-Info.plist",
    },
    android: {
      package: "com.khaaonow.delivery",
      googleServicesFile:
        process.env.ANDROID_GOOGLE_SERVICES_JSON || "./google-services.json",
      adaptiveIcon: {
        backgroundColor: "#E6F4FE",
        foregroundImage: "./assets/images/logo2.png",
        backgroundImage: "./assets/images/logo2.png",
        monochromeImage: "./assets/images/logo2.png",
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
      favicon: "./assets/images/favicon.png",
    },
    plugins: plugins,
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
  },
};
