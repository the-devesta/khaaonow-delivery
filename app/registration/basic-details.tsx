import AnimatedStepIndicator from "@/components/ui/animated-step-indicator";
import PrimaryButton from "@/components/ui/primary-button";
import { ApiService } from "@/services/api";
import { OnboardingStatus, useAuthStore } from "@/store/auth";
import { BasicDetailsSchema } from "@/utils/validations";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Formik } from "formik";
import { useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function BasicDetailsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const { updateOnboardingStatus } = useAuthStore();
  const insets = useSafeAreaInsets();

  const handleNext = async (values: { name: string; email: string }) => {
    setLoading(true);
    try {
      const response = await ApiService.completeProfile(values);
      if (response.success) {
        await updateOnboardingStatus(OnboardingStatus.PERSONAL_INFO, 20);
        router.push({
          pathname: "/registration/kyc-documents",
          params: values,
        });
      } else {
        Alert.alert("Error", response.message || "Failed to save profile");
      }
    } catch (error: any) {
      console.error("Profile completion error:", error);
      Alert.alert("Error", "Failed to complete profile. Please try again.");
    } finally {
      setLoading(false);
    }
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
          source={require("../../assets/images/reg-basic.png")}
          className="w-full h-full"
          resizeMode="cover"
        />
        <BlurView
          intensity={40}
          tint="dark"
          className="absolute w-full h-full"
        />
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.8)"]}
          style={{ position: "absolute", width: "100%", height: "100%" }}
        />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1">
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            paddingTop: insets.top + 10,
            paddingBottom: insets.bottom + 20,
          }}
          showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View className="px-6 mb-6">
            <TouchableOpacity
              onPress={() => router.back()}
              className="w-10 h-10 bg-white rounded-full items-center justify-center border border-white/30 mb-6"
              activeOpacity={0.8}>
              <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
            </TouchableOpacity>

            <View className="items-center">
              <AnimatedStepIndicator currentStep={1} totalSteps={5} />
            </View>
          </View>

          {/* Main Content */}
          <View className="px-6 flex-1 justify-end pb-8">
            <View className="mb-8">
              <Text className="text-4xl font-extrabold text-white mb-2 shadow-sm tracking-tight">
                Personal Info
              </Text>
              <Text className="text-lg text-white/80 font-medium tracking-wide">
                Let's start with the basics.
              </Text>
            </View>

            {/* Glassmorphism Form Card */}
            <View
              className="bg-white rounded-[32px] p-6 border-2 border-white/20 shadow-lg shadow-black/20"
              style={{
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: 0.3,
                shadowRadius: 20,
              }}>
              <Formik
                initialValues={{ name: "", email: "" }}
                validationSchema={BasicDetailsSchema}
                onSubmit={handleNext}>
                {({
                  handleChange,
                  handleBlur,
                  handleSubmit,
                  values,
                  errors,
                  touched,
                }) => (
                  <View>
                    {/* Name Input */}
                    <View className="mb-5">
                      <Text className="text-xs font-bold text-gray-600 mb-2 ml-1 uppercase tracking-wider">
                        Full Name
                      </Text>
                      <View className="flex-row items-center bg-gray-50 rounded-2xl border border-gray-200 h-14 px-4 overflow-hidden">
                        <Ionicons
                          name="person-outline"
                          size={20}
                          color="#6B7280"
                        />
                        <TextInput
                          placeholder="John Doe"
                          placeholderTextColor="#9CA3AF"
                          value={values.name}
                          onChangeText={handleChange("name")}
                          onBlur={handleBlur("name")}
                          className="flex-1 ml-3 text-lg text-gray-900 font-semibold h-full"
                          selectionColor="#F59E0B"
                        />
                      </View>
                      {touched.name && errors.name && (
                        <Text className="text-red-400 text-xs mt-1.5 ml-1 font-medium">
                          {errors.name}
                        </Text>
                      )}
                    </View>

                    {/* Email Input */}
                    <View className="mb-6">
                      <Text className="text-xs font-bold text-gray-600 mb-2 ml-1 uppercase tracking-wider">
                        Email Address
                      </Text>
                      <View className="flex-row items-center bg-gray-50 rounded-2xl border border-gray-200 h-14 px-4 overflow-hidden">
                        <Ionicons
                          name="mail-outline"
                          size={20}
                          color="#6B7280"
                        />
                        <TextInput
                          placeholder="john@example.com"
                          placeholderTextColor="#9CA3AF"
                          keyboardType="email-address"
                          autoCapitalize="none"
                          value={values.email}
                          onChangeText={handleChange("email")}
                          onBlur={handleBlur("email")}
                          className="flex-1 ml-3 text-lg text-gray-900 font-semibold h-full"
                          selectionColor="#F59E0B"
                        />
                      </View>
                      {touched.email && errors.email && (
                        <Text className="text-red-400 text-xs mt-1.5 ml-1 font-medium">
                          {errors.email}
                        </Text>
                      )}
                    </View>

                    {/* Privacy Note */}
                    <View className="flex-row items-center mb-6 bg-blue-500/10 p-3 rounded-xl border border-blue-400/20">
                      <Ionicons
                        name="shield-checkmark"
                        size={14}
                        color="#60A5FA"
                      />
                      <Text className="text-xs text-blue-200 ml-2 font-medium flex-1">
                        Your data is encrypted and secure.
                      </Text>
                    </View>

                    <PrimaryButton
                      title="Continue"
                      onPress={handleSubmit}
                      loading={loading}
                    />
                  </View>
                )}
              </Formik>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
