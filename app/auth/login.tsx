import PrimaryButton from "@/components/ui/primary-button";
import { useWhatsAppAuth } from "@/hooks/use-whatsapp-auth";
import { LoginSchema } from "@/utils/validations";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Formik } from "formik";
import { useEffect, useRef } from "react";
import {
  Alert,
  Animated,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function LoginScreen() {
  const router = useRouter();
  const { sendOtp, loading, error, clearError } = useWhatsAppAuth();
  const insets = useSafeAreaInsets();

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  return (
    <View className="flex-1 bg-[#F3E0D9]">
      <StatusBar barStyle="dark-content" backgroundColor="#F3E0D9" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1">
        <ScrollView
          contentContainerStyle={{
            paddingBottom: insets.bottom || 20,
            paddingTop: insets.top + 20,
            flexGrow: 1,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <Animated.View
            style={{
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
              width: "100%",
              flex: 1,
              justifyContent: "center",
            }}>
            {/* Header Section */}
            <View className="items-center mb-8 px-6">
              <Text className="text-3xl font-extrabold text-[#1A1A1A] mb-2 text-center">
                Hello Again! 👋
              </Text>
              <Text className="text-base text-gray-500 font-medium text-center">
                Welcome back to KhaaoNow
              </Text>

              <View className="mt-8 mb-4 rounded-2xl drop-shadow-xl shadow-amber-100">
                <Image
                  className="rounded-2xl"
                  source={require("../../assets/images/login-illustration.png")}
                  style={{ width: 200, height: 200, resizeMode: "contain" }}
                />
              </View>
            </View>

            {/* Login Card */}
            <View
              className="bg-white mx-6 rounded-[32px] p-6"
              style={{
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: 0.05,
                shadowRadius: 20,
                elevation: 5,
              }}>
              <View className="items-center mb-6">
                <Text className="text-xl font-bold text-[#1A1A1A]">Login</Text>
                <View className="h-1 w-8 bg-[#F59E0B] rounded-full mt-2" />
              </View>

              <Formik
                initialValues={{ phoneNumber: "" }}
                validationSchema={LoginSchema}
                onSubmit={async (values) => {
                  try {
                    clearError();
                    const success = await sendOtp(values.phoneNumber);
                    if (success) {
                      router.push({
                        pathname: "/auth/otp",
                        params: { phoneNumber: values.phoneNumber },
                      });
                    } else if (error) {
                      Alert.alert("Error", error);
                    }
                  } catch (err: any) {
                    Alert.alert("Error", err.message || "Failed to send OTP.");
                  }
                }}>
                {({
                  handleChange,
                  handleBlur,
                  handleSubmit,
                  values,
                  errors,
                  touched,
                }) => (
                  <View>
                    {/* Phone Input */}
                    <View className="mb-6">
                      <Text className="text-xs font-bold text-gray-400 mb-2 ml-1 uppercase tracking-wider">
                        Phone Number
                      </Text>
                      <View
                        className="flex-row items-center bg-gray-50 rounded-2xl border border-gray-100 overflow-hidden h-14"
                        style={{
                          shadowColor: "#000",
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: 0.03,
                          shadowRadius: 4,
                          elevation: 1,
                        }}>
                        <View className="px-4 border-r border-gray-200 h-full justify-center bg-white">
                          <Text className="text-lg font-bold text-[#1A1A1A]">
                            +91
                          </Text>
                        </View>
                        <TextInput
                          placeholder="Enter your number"
                          keyboardType="number-pad"
                          maxLength={10}
                          value={values.phoneNumber}
                          onChangeText={(text) => {
                            // Only allow numeric characters and max 10 digits
                            const numericText = text
                              .replace(/[^0-9]/g, "")
                              .slice(0, 10);
                            handleChange("phoneNumber")(numericText);
                          }}
                          onBlur={handleBlur("phoneNumber")}
                          placeholderTextColor="#9CA3AF"
                          className="flex-1 px-4 text-lg text-[#1A1A1A] font-semibold h-full"
                          style={{
                            includeFontPadding: false,
                            paddingTop: 0,
                            paddingBottom: 0,
                            textAlignVertical: "center",
                          }}
                          selectionColor="#F59E0B"
                        />
                        <View className="pr-4">
                          <Ionicons
                            name="call-outline"
                            size={20}
                            color="#9CA3AF"
                          />
                        </View>
                      </View>
                      {touched.phoneNumber && errors.phoneNumber && (
                        <View className="flex-row items-center mt-2 ml-1">
                          <Ionicons
                            name="alert-circle"
                            size={14}
                            color="#EF4444"
                          />
                          <Text className="text-red-500 text-xs ml-1.5 font-medium">
                            {errors.phoneNumber}
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* WhatsApp Notice - Simplified */}
                    <View className="flex-row items-center justify-center mb-6 opacity-80">
                      <Ionicons
                        name="logo-whatsapp"
                        size={14}
                        color="#16A34A"
                      />
                      <Text className="text-xs text-gray-400 ml-2 font-medium">
                        OTP will be sent via WhatsApp
                      </Text>
                    </View>

                    <PrimaryButton
                      title="Send OTP"
                      onPress={handleSubmit}
                      loading={loading}
                    />
                  </View>
                )}
              </Formik>
            </View>

            {/* Footer */}
            <View className="mt-8 items-center">
              <Text className="text-xs text-gray-400 text-center font-medium px-10 leading-5">
                By continuing you agree to our{" "}
                <Text className="text-[#F59E0B] font-bold">Terms</Text> &{" "}
                <Text className="text-[#F59E0B] font-bold">Privacy Policy</Text>
              </Text>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
