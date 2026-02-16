import { useAuthStore } from "@/store/auth";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  Alert,
  Image,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function AccountRejectedScreen() {
  const router = useRouter();
  const { logout } = useAuthStore();
  const insets = useSafeAreaInsets();

  const handleLogout = async () => {
    console.log("🚪 [Rejected] Logging out...");
    await logout();
    router.replace("/auth/login");
  };

  const handleContactSupport = () => {
    Alert.alert(
      "Contact Support",
      "For any queries regarding your application, please contact us at:\n\n📧 support@khaaonow.com\n📞 +91 1800-XXX-XXXX\n\nOur team will help you understand the rejection reason and guide you through the reapplication process.",
      [{ text: "OK" }],
    );
  };

  const handleTryAgain = async () => {
    Alert.alert(
      "Reapply",
      "To apply again, you'll need to logout and register with a different phone number or contact support for help.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Logout & Try Again",
          onPress: handleLogout,
        },
        {
          text: "Contact Support",
          onPress: handleContactSupport,
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
          source={require("../../assets/images/reg-docs.png")}
          className="w-full h-full"
          resizeMode="cover"
        />
        <BlurView
          intensity={50}
          tint="dark"
          className="absolute w-full h-full"
        />
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.9)"]}
          style={{ position: "absolute", width: "100%", height: "100%" }}
        />
        {/* Red tint overlay for rejection state */}
        <View className="absolute w-full h-full bg-red-900/20" />
      </View>

      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: insets.top + 20,
          paddingBottom: insets.bottom + 20,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-1 px-5">
          {/* Header with Logout */}
          <View className="flex-row items-center justify-end mb-8">
            <TouchableOpacity
              onPress={handleLogout}
              className="flex-row items-center px-4 py-2 bg-white/10 backdrop-blur-md rounded-full border border-white/20"
              activeOpacity={0.7}
            >
              <Ionicons name="log-out-outline" size={18} color="#EF4444" />
              <Text className="text-red-400 font-semibold ml-2 text-sm">
                Logout
              </Text>
            </TouchableOpacity>
          </View>

          {/* Rejection Icon */}
          <View className="items-center mb-10">
            <View className="w-32 h-32 bg-red-500/20 rounded-full items-center justify-center mb-6 border border-red-500/30">
              <View className="w-24 h-24 bg-red-500 rounded-full items-center justify-center shadow-lg shadow-red-500/50">
                <Ionicons name="close" size={56} color="white" />
              </View>
            </View>
            <Text className="text-3xl font-extrabold text-white text-center mb-2 tracking-tight">
              Application Not Approved
            </Text>
            <Text className="text-lg text-white/70 text-center leading-6 px-2">
              We're sorry, but we couldn't approve your application at this
              time.
            </Text>
          </View>

          {/* Reason Card */}
          <View className="bg-white/10 backdrop-blur-md rounded-[24px] p-6 mb-4 border border-white/10">
            <View className="flex-row items-start mb-4">
              <View className="w-12 h-12 bg-amber-500/20 rounded-2xl items-center justify-center border border-amber-500/30">
                <Ionicons name="information-circle" size={26} color="#F59E0B" />
              </View>
              <View className="ml-4 flex-1 pt-1">
                <Text className="text-lg font-bold text-white mb-2">
                  Possible Reasons
                </Text>

                <View className="space-y-3">
                  <View className="flex-row items-start">
                    <View className="w-1.5 h-1.5 bg-white/50 rounded-full mt-2.5 mr-3" />
                    <Text className="flex-1 text-[15px] text-white/70 leading-5">
                      Documents were unclear or invalid
                    </Text>
                  </View>
                  <View className="flex-row items-start">
                    <View className="w-1.5 h-1.5 bg-white/50 rounded-full mt-2.5 mr-3" />
                    <Text className="flex-1 text-[15px] text-white/70 leading-5">
                      Information mismatch in submitted documents
                    </Text>
                  </View>
                  <View className="flex-row items-start">
                    <View className="w-1.5 h-1.5 bg-white/50 rounded-full mt-2.5 mr-3" />
                    <Text className="flex-1 text-[15px] text-white/70 leading-5">
                      Background verification did not pass
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </View>

          {/* What You Can Do Card */}
          <View className="bg-white/10 backdrop-blur-md rounded-[24px] p-6 mb-4 border border-white/10">
            <Text className="text-lg font-bold text-white mb-6 uppercase tracking-wider opacity-90">
              What You Can Do
            </Text>

            <View className="space-y-4">
              <TouchableOpacity
                onPress={handleContactSupport}
                className="flex-row items-center p-4 bg-white/5 rounded-2xl border border-white/10"
                activeOpacity={0.7}
              >
                <View className="w-11 h-11 bg-green-500/20 rounded-xl items-center justify-center border border-green-500/30">
                  <Ionicons
                    name="chatbubble-ellipses"
                    size={22}
                    color="#4ADE80"
                  />
                </View>
                <View className="ml-4 flex-1">
                  <Text className="text-[15px] font-bold text-white">
                    Contact Support
                  </Text>
                  <Text className="text-sm text-white/60">
                    Get help with your application
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={22}
                  color="rgba(255,255,255,0.3)"
                />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleTryAgain}
                className="flex-row items-center p-4 bg-white/5 rounded-2xl border border-white/10"
                activeOpacity={0.7}
              >
                <View className="w-11 h-11 bg-indigo-500/20 rounded-xl items-center justify-center border border-indigo-500/30">
                  <Ionicons name="reload" size={22} color="#818CF8" />
                </View>
                <View className="ml-4 flex-1">
                  <Text className="text-[15px] font-bold text-white">
                    Apply Again
                  </Text>
                  <Text className="text-sm text-white/60">
                    Restart the application process
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={22}
                  color="rgba(255,255,255,0.3)"
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Footer Info */}
          <View className="pb-6">
            <View className="bg-amber-500/10 rounded-2xl p-4 border border-amber-500/20 flex-row items-start">
              <Ionicons name="help-circle-outline" size={22} color="#F59E0B" />
              <Text className="flex-1 text-sm text-amber-200 ml-3 leading-5 font-medium">
                If you believe this was a mistake, please contact our support
                team. We're here to help you resolve any issues.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
