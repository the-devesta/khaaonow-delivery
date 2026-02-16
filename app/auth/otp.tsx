import PrimaryButton from "@/components/ui/primary-button";
import { useWhatsAppAuth } from "@/hooks/use-whatsapp-auth";
import { useAuthStore } from "@/store/auth";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function OtpScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const phoneNumber = params.phoneNumber as string;

  const { sendOtp, verifyOtp, loading, error, clearError } = useWhatsAppAuth();
  const { setAuthenticated, getNavigationRoute } = useAuthStore();

  const [resendLoading, setResendLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(30);
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  const handleOtpChange = (value: string, index: number) => {
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOtp = async () => {
    const otpValue = otp.join("");
    if (otpValue.length !== 6) return;

    try {
      clearError();
      console.log("🔐 [OTP] Verifying OTP...");

      // Verify OTP with WhatsApp backend
      const response = await verifyOtp(phoneNumber, otpValue);

      if (response.success && response.data) {
        console.log("✅ [OTP] Verification successful:", {
          deliveryPartnerId: response.data.deliveryPartnerId,
          onboardingStatus: response.data.onboardingStatus,
          onboardingProgress: response.data.onboardingProgress,
          isApproved: response.data.isApproved,
          profileComplete: response.data.profileComplete,
        });

        const formattedPhone = `+91${phoneNumber}`;

        // Store full authentication data including onboarding status
        // Backend now returns isApproved directly
        await setAuthenticated(
          true,
          response.data.deliveryPartnerId,
          formattedPhone,
          response.data.token,
          response.data.onboardingStatus,
          response.data.onboardingProgress,
          response.data.isApproved || false,
        );

        // Get the correct navigation route based on state
        const route = getNavigationRoute();
        console.log("🧭 [OTP] Navigating to:", route);

        router.replace(route as any);
      } else {
        Alert.alert(
          "Verification Failed",
          response.message || "Failed to verify OTP. Please try again.",
        );
      }
    } catch (err: any) {
      console.error("❌ [OTP] Verification error:", err);
      Alert.alert("Error", err.message || "Invalid OTP. Please try again.");
    }
  };

  const handleResendOtp = async () => {
    setResendLoading(true);
    try {
      clearError();
      console.log("📤 [OTP] Resending OTP...");
      const success = await sendOtp(phoneNumber);

      if (success) {
        setResendTimer(30);
        setOtp(["", "", "", "", "", ""]);
        Alert.alert("Success", "OTP sent successfully!");
      } else if (error) {
        Alert.alert("Error", error);
      }
    } catch (err: any) {
      console.error("❌ [OTP] Resend error:", err);
      Alert.alert("Error", err.message || "Failed to resend OTP.");
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1">
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="always"
          showsVerticalScrollIndicator={false}>
          <View className="flex-1 px-6 pt-12">
            {/* Back Button */}
            <TouchableOpacity
              onPress={() => router.back()}
              className="w-12 h-12 bg-[#F8F8F8] rounded-full items-center justify-center mb-8"
              activeOpacity={0.7}>
              <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
            </TouchableOpacity>

            {/* Header */}
            <View className="mb-8">
              <Text className="text-3xl font-bold text-[#1A1A1A] mb-3">
                Verify OTP
              </Text>
              <Text className="text-base text-[#7A7A7A]">
                Enter the 6-digit code sent to{"\n"}
                <Text className="font-semibold text-[#1A1A1A]">
                  +91 {phoneNumber}
                </Text>
              </Text>
            </View>

            {/* OTP Input */}
            <View className="flex-row justify-between mb-8">
              {otp.map((digit, index) => (
                <View
                  key={index}
                  className="w-14 h-16 bg-[#F8F8F8] rounded-2xl border-2 items-center justify-center"
                  style={{
                    borderColor: digit ? "#FF6A00" : "#E5E5E5",
                  }}>
                  <TextInput
                    ref={(ref) => {
                      inputRefs.current[index] = ref;
                    }}
                    value={digit}
                    onChangeText={(value) => handleOtpChange(value, index)}
                    onKeyPress={(e) => handleKeyPress(e, index)}
                    keyboardType="number-pad"
                    maxLength={1}
                    className="text-2xl font-bold text-[#1A1A1A] text-center"
                    style={{
                      width: "100%",
                      height: "100%",
                      padding: 0,
                      textAlign: "center",
                    }}
                    autoFocus={index === 0}
                    selectTextOnFocus
                  />
                </View>
              ))}
            </View>

            {/* Resend OTP */}
            <View className="flex-row items-center justify-center mb-8">
              {resendTimer > 0 ? (
                <Text className="text-sm text-[#7A7A7A]">
                  Resend OTP in{" "}
                  <Text className="font-semibold text-[#FF6A00]">
                    {resendTimer}s
                  </Text>
                </Text>
              ) : resendLoading ? (
                <Text className="text-sm text-[#7A7A7A]">Sending...</Text>
              ) : (
                <TouchableOpacity
                  onPress={handleResendOtp}
                  activeOpacity={0.7}
                  disabled={resendLoading}>
                  <Text className="text-sm font-semibold text-[#FF6A00]">
                    Resend OTP
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Verify Button */}
            <PrimaryButton
              title="Verify & Continue"
              onPress={handleVerifyOtp}
              loading={loading}
              disabled={otp.join("").length !== 6}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
