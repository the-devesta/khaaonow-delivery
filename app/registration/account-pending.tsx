import { useAuthStore } from "@/store/auth";
import { Ionicons } from "@expo/vector-icons";
import { SafeBlurView } from "@/components/ui/safe-blur-view";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Image,
  Linking,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

const SUPPORT_PHONE = "+919875054898";
const SUPPORT_EMAIL = "support@khaaonow.com";
const SUPPORT_WHATSAPP_PHONE = "919875054898";

function StatusStep({
  icon,
  title,
  description,
  status,
  last = false,
}: {
  icon: string;
  title: string;
  description: string;
  status: "completed" | "in-progress" | "pending";
  last?: boolean;
}) {
  const getIconColor = () => {
    if (status === "completed") return "#16A34A"; // green-600
    if (status === "in-progress") return "#D97706"; // amber-600
    return "#9CA3AF"; // gray-400
  };

  const getBgColor = () => {
    if (status === "completed") return "#DCFCE7"; // green-100
    if (status === "in-progress") return "#FEF3C7"; // amber-100
    return "#F3F4F6"; // gray-100
  };

  const getBorderColor = () => {
    if (status === "completed") return "#86EFAC"; // green-300
    if (status === "in-progress") return "#FCD34D"; // amber-300
    return "#E5E7EB"; // gray-200
  };

  const getLineColor = () => {
    if (status === "completed") return "#4ADE80";
    return "#E5E7EB"; // gray-200 — visible on white card
  };

  return (
    <View className={`flex-row items-start ${!last ? "mb-6" : ""}`}>
      <View className="items-center mr-4">
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 14,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: getBgColor(),
            borderWidth: 1,
            borderColor: getBorderColor(),
          }}
        >
          <Ionicons name={icon as any} size={22} color={getIconColor()} />
        </View>
        {!last && (
          <View
            className="w-0.5 h-10 mt-2 rounded-full"
            style={{ backgroundColor: getLineColor() }}
          />
        )}
      </View>
      <View className="flex-1 pt-1.5">
        <View className="flex-row items-center mb-1">
          <Text
            style={{
              fontSize: 15,
              fontWeight: "700",
              color: "#1F2937",
              flex: 1,
            }}
          >
            {title}
          </Text>
          {status === "completed" && (
            <View className="bg-green-100 rounded-full px-3 py-1 border border-green-300">
              <Text
                style={{ fontSize: 11, color: "#16A34A", fontWeight: "700" }}
              >
                Done
              </Text>
            </View>
          )}
          {status === "in-progress" && (
            <View className="bg-amber-100 rounded-full px-3 py-1 border border-amber-300">
              <Text
                style={{ fontSize: 11, color: "#D97706", fontWeight: "700" }}
              >
                In Progress
              </Text>
            </View>
          )}
          {status === "pending" && (
            <View className="bg-gray-100 rounded-full px-3 py-1 border border-gray-200">
              <Text
                style={{ fontSize: 11, color: "#6B7280", fontWeight: "700" }}
              >
                Pending
              </Text>
            </View>
          )}
        </View>
        <Text style={{ fontSize: 13, color: "#6B7280", lineHeight: 20 }}>
          {description}
        </Text>
      </View>
    </View>
  );
}

export default function AccountPendingScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { logout, fetchProfile, partner, isApproved, getNavigationRoute } =
    useAuthStore();
  const [refreshing, setRefreshing] = useState(false);
  const [checking, setChecking] = useState(false);
  const insets = useSafeAreaInsets();

  // Animated pulse for the clock icon
  const pulseScale = useSharedValue(1);

  useEffect(() => {
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.1, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );

    // Block Android hardware back button — no screen to go back to
    const sub = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => sub.remove();
  }, []);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const handleRefresh = async () => {
    console.log("🔄 [Pending] Refreshing profile...");
    setRefreshing(true);

    try {
      const latestPartner = await fetchProfile();
      const approved =
        latestPartner?.isApproved ?? useAuthStore.getState().isApproved;

      if (approved) {
        console.log("✅ [Pending] User approved! Navigating to home...");
        router.replace(useAuthStore.getState().getNavigationRoute() as any);
      }
    } catch (error) {
      console.error("❌ [Pending] Failed to refresh:", error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleCheckStatus = async () => {
    console.log("🔍 [Pending] Checking status...");
    setChecking(true);

    try {
      await fetchProfile();
      const route = getNavigationRoute();
      if (route !== "/registration/account-pending") {
        console.log("🧭 [Pending] Status changed, navigating to:", route);
        router.replace(route as any);
      } else {
        Alert.alert(
          "Still Under Review",
          "Your application is still being reviewed. We'll notify you once approved.",
          [{ text: "OK" }],
        );
      }
    } catch (error) {
      console.error("❌ [Pending] Failed to check status:", error);
      Alert.alert("Error", "Failed to check status. Please try again.");
    } finally {
      setChecking(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          console.log("🚪 [Pending] Logging out...");
          await logout();
          router.replace("/auth/login");
        },
      },
    ]);
  };

  const handleContactSupport = () => {
    const emailSubject = encodeURIComponent(
      "Delivery Partner Application Support",
    );
    const emailBody = encodeURIComponent(
      "Hi KhaaoNow Support,\n\nI need help with my delivery partner application.\n\nApplication status: Pending\nName:\nIssue:\n",
    );
    const whatsappText = encodeURIComponent(
      "Hi KhaaoNow Support,\n\nI need help with my delivery partner application.\n\nApplication status: Pending\nName:\nIssue:\n",
    );
    Alert.alert(
      t("profile.contactSupport"),
      t("profile.supportHint"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: "Call",
          onPress: () => Linking.openURL(`tel:${SUPPORT_PHONE}`),
        },
        {
          text: "Email",
          onPress: () =>
            Linking.openURL(
              `mailto:${SUPPORT_EMAIL}?subject=${emailSubject}&body=${emailBody}`,
            ),
        },
        {
          text: "WhatsApp",
          onPress: () =>
            Linking.openURL(
              `https://api.whatsapp.com/send?phone=${SUPPORT_WHATSAPP_PHONE}&text=${whatsappText}`,
            ),
        },
      ],
    );
  };

  return (
    <View className="flex-1 bg-black">
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent
      />

      {/* Background Image with Blur */}
      <View className="absolute w-full h-full overflow-hidden">
        <Image
          source={require("../../assets/images/background.png")}
          className="w-full h-full"
          resizeMode="cover"
        />
        {Platform.OS === "ios" ? (
          <SafeBlurView
            intensity={40}
            tint="dark"
            className="absolute w-full h-full"
          />
        ) : (
          <View
            className="absolute w-full h-full"
            style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
          />
        )}
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.8)"]}
          style={{ position: "absolute", width: "100%", height: "100%" }}
        />
      </View>

      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: insets.top + 20,
          paddingBottom: insets.bottom + 20,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={["#F59E0B"]}
            tintColor="#F59E0B"
          />
        }
      >
        <View className="flex-1 px-5">
          {/* Header with Logout */}
          <View className="flex-row items-center justify-end mb-8">
            <TouchableOpacity
              onPress={handleLogout}
              className="flex-row items-center px-4 py-2 bg-white rounded-full border border-white/20"
              activeOpacity={0.7}
            >
              <Ionicons name="log-out-outline" size={18} color="#EF4444" />
              <Text className="text-red-400 font-semibold ml-2 text-sm">
                Logout
              </Text>
            </TouchableOpacity>
          </View>

          {/* Success Animation Area */}
          <View className="items-center mb-10">
            <View className="w-32 h-32 bg-yellow-500/20 rounded-full items-center justify-center mb-6 border border-yellow-500/30">
              <Animated.View
                style={[
                  {
                    width: 96,
                    height: 96,
                    backgroundColor: "#F59E0B", // Amber 500
                    borderRadius: 48,
                    alignItems: "center",
                    justifyContent: "center",
                    shadowColor: "#F59E0B",
                    shadowOffset: { width: 0, height: 10 },
                    shadowOpacity: 0.5,
                    shadowRadius: 20,
                  },
                  pulseStyle,
                ]}
              >
                <Ionicons name="hourglass-outline" size={48} color="white" />
              </Animated.View>
            </View>
            <Text className="text-3xl font-extrabold text-white text-center mb-2 tracking-tight">
              Application Under Review
            </Text>
            <Text className="text-lg text-white/70 text-center leading-6 px-4">
              Thank you for registering! Our team is reviewing your documents.
            </Text>
          </View>

          {/* Estimated Time Card */}
          <View className="bg-white rounded-[24px] p-5 mb-4 border border-gray-200 flex-row items-center">
            <View className="w-14 h-14 bg-indigo-100 rounded-2xl items-center justify-center border border-indigo-200">
              <Ionicons name="time-outline" size={28} color="#818CF8" />
            </View>
            <View className="ml-4 flex-1">
              <Text className="text-lg font-bold text-gray-900">
                Estimated Wait Time
              </Text>
              <Text className="text-base text-gray-500">
                24-48 business hours
              </Text>
            </View>
          </View>

          {/* Status Steps Card */}
          <View className="bg-white rounded-[24px] p-6 mb-4 border border-gray-200">
            <Text className="text-lg font-bold text-gray-900 mb-6 uppercase tracking-wider opacity-90">
              Verification Progress
            </Text>

            <StatusStep
              icon="document-text-outline"
              title="Application Submitted"
              description="Your documents have been received"
              status="completed"
            />
            <StatusStep
              icon="shield-checkmark-outline"
              title="Document Verification"
              description="We're reviewing your KYC documents"
              status="in-progress"
            />
            <StatusStep
              icon="checkmark-circle-outline"
              title="Account Activation"
              description="You'll be notified when approved"
              status="pending"
              last
            />
          </View>

          {/* Check Status Button */}
          <TouchableOpacity
            onPress={handleCheckStatus}
            disabled={checking}
            className="bg-[#F59E0B] rounded-2xl py-4 px-6 mb-4 flex-row items-center justify-center shadow-lg"
            style={{
              shadowColor: "#F59E0B",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 8,
            }}
            activeOpacity={0.8}
          >
            {checking ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <>
                <Ionicons name="refresh-outline" size={22} color="white" />
                <Text className="text-white font-bold text-base ml-2">
                  {t("onboarding.checkApplicationStatus")}
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* Contact Support Card */}
          <TouchableOpacity
            onPress={handleContactSupport}
            className="bg-white/5 backdrop-blur-sm rounded-2xl p-4 mb-8 border border-white/5"
            activeOpacity={0.7}
          >
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center">
                <View className="w-11 h-11 bg-white/10 rounded-xl items-center justify-center">
                  <Ionicons
                    name="chatbubble-ellipses-outline"
                    size={22}
                    color="rgba(255,255,255,0.7)"
                  />
                </View>
                <View className="ml-3">
                  <Text className="text-[15px] font-semibold text-white">
                    {t("onboarding.needHelp")}
                  </Text>
                  <Text className="text-sm text-white/50">
                    {t("onboarding.contactSupportTeam")}
                  </Text>
                </View>
              </View>
              <Ionicons
                name="chevron-forward"
                size={22}
                color="rgba(255,255,255,0.3)"
              />
            </View>
          </TouchableOpacity>

          {/* Info Message */}
          <View className="pb-6">
            <View className="bg-indigo-500/10 rounded-2xl p-4 border border-indigo-500/20 flex-row items-start">
              <Ionicons
                name="notifications-outline"
                size={22}
                color="#818CF8"
              />
              <Text className="flex-1 text-sm text-indigo-200 ml-3 leading-5 font-medium">
                We&apos;ll send you a notification and SMS once your account is
                approved. Pull down to refresh status.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
