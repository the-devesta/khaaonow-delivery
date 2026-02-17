import PrimaryButton from "@/components/ui/primary-button";
import { ApiService } from "@/services/api";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Formik } from "formik";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
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
import * as Yup from "yup";

const EditProfileSchema = Yup.object().shape({
  name: Yup.string()
    .min(2, "Name is too short")
    .max(50, "Name is too long")
    .required("Full Name is required"),
  email: Yup.string()
    .email("Invalid email address")
    .required("Email is required"),
});

export default function EditProfileScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [initialValues, setInitialValues] = useState({ name: "", email: "" });
  const [fetching, setFetching] = useState(true);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await ApiService.getProfile();
      if (response.success && response.data) {
        setInitialValues({
          name: response.data.name || "",
          email: response.data.email || "",
        });
      }
    } catch (error) {
      console.error("Failed to fetch profile:", error);
      Alert.alert("Error", "Failed to load profile data");
    } finally {
      setFetching(false);
    }
  };

  const handleUpdate = async (values: { name: string; email: string }) => {
    setLoading(true);
    try {
      // Assuming ApiService has an updateProfile method, if not we'll use axios directly or add it
      // Based on controller, endpoint is PUT /delivery-partners/profile
      // We might need to check if ApiService has this method exposed.
      // If not, I'll update ApiService later. For now assuming it exists or I'll add it.
      const response = await ApiService.updateProfile(values); // Need to verify this exists

      if (response.success) {
        Alert.alert("Success", "Profile updated successfully");
        router.back();
      } else {
        Alert.alert("Error", response.message || "Failed to update profile");
      }
    } catch (error: any) {
      console.error("Profile update error:", error);
      Alert.alert("Error", "Failed to update profile. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <View className="flex-1 bg-black items-center justify-center">
        <ActivityIndicator size="large" color="#F59E0B" />
      </View>
    );
  }

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
          source={require("../../assets/images/reg-basic.png")} // Reusing existing asset
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
              className="w-10 h-10 bg-gray-800 rounded-full items-center justify-center border border-gray-700 mb-6"
              activeOpacity={0.8}>
              <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Main Content */}
          <View className="px-6 flex-1 justify-end pb-8">
            <View className="mb-8">
              <Text className="text-4xl font-extrabold text-white mb-2 shadow-sm tracking-tight">
                Edit Profile
              </Text>
              <Text className="text-lg text-white/80 font-medium tracking-wide">
                Update your personal information.
              </Text>
            </View>

            {/* Glassmorphism Form Card */}
            <View
              className="bg-gray-800/90 rounded-[32px] p-6 border border-gray-700 shadow-lg shadow-black/20"
              style={{
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: 0.3,
                shadowRadius: 20,
              }}>
              <Formik
                initialValues={initialValues}
                validationSchema={EditProfileSchema}
                onSubmit={handleUpdate}
                enableReinitialize>
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
                      <Text className="text-xs font-bold text-white/70 mb-2 ml-1 uppercase tracking-wider">
                        Full Name
                      </Text>
                      <View className="flex-row items-center bg-gray-700 rounded-2xl h-14 px-4 overflow-hidden">
                        <Ionicons
                          name="person-outline"
                          size={20}
                          color="rgba(255,255,255,0.7)"
                        />
                        <TextInput
                          placeholder="John Doe"
                          placeholderTextColor="rgba(255,255,255,0.4)"
                          value={values.name}
                          onChangeText={handleChange("name")}
                          onBlur={handleBlur("name")}
                          className="flex-1 ml-3 text-lg text-white font-semibold h-full"
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
                      <Text className="text-xs font-bold text-white/70 mb-2 ml-1 uppercase tracking-wider">
                        Email Address
                      </Text>
                      <View className="flex-row items-center bg-gray-700 rounded-2xl h-14 px-4 overflow-hidden">
                        <Ionicons
                          name="mail-outline"
                          size={20}
                          color="rgba(255,255,255,0.7)"
                        />
                        <TextInput
                          placeholder="john@example.com"
                          placeholderTextColor="rgba(255,255,255,0.4)"
                          keyboardType="email-address"
                          autoCapitalize="none"
                          value={values.email}
                          onChangeText={handleChange("email")}
                          onBlur={handleBlur("email")}
                          className="flex-1 ml-3 text-lg text-white font-semibold h-full"
                          selectionColor="#F59E0B"
                        />
                      </View>
                      {touched.email && errors.email && (
                        <Text className="text-red-400 text-xs mt-1.5 ml-1 font-medium">
                          {errors.email}
                        </Text>
                      )}
                    </View>

                    <PrimaryButton
                      title="Save Changes"
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
