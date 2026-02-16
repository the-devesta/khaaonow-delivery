import AnimatedStepIndicator from "@/components/ui/animated-step-indicator";
import PrimaryButton from "@/components/ui/primary-button";
import { ApiService } from "@/services/api";
import { uploadImageToFirebase } from "@/services/storage";
import { OnboardingStatus, useAuthStore } from "@/store/auth";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useState } from "react";
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

const PHOTO_GUIDELINES = [
  {
    icon: "sunny-outline",
    text: "Use good natural lighting",
    color: "#F59E0B",
  },
  {
    icon: "eye-outline",
    text: "Face should be clearly visible",
    color: "#3B82F6",
  },
  {
    icon: "glasses-outline",
    text: "Remove sunglasses or hats",
    color: "#10B981",
  },
  {
    icon: "happy-outline",
    text: "Look straight at the camera",
    color: "#8B5CF6",
  },
];

export default function ProfilePhotoScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const { updateOnboardingStatus } = useAuthStore();
  const [profilePhoto, setProfilePhoto] = useState("");
  const insets = useSafeAreaInsets();

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setProfilePhoto(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Camera permission is required");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setProfilePhoto(result.assets[0].uri);
    }
  };

  const showOptions = () => {
    Alert.alert("Profile Photo", "Choose an option", [
      { text: "Take Photo", onPress: takePhoto },
      { text: "Choose from Gallery", onPress: pickImage },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const handleNext = async () => {
    if (!profilePhoto) {
      Alert.alert(
        "Photo Required",
        "Please upload a profile photo to continue.",
      );
      return;
    }

    setLoading(true);
    try {
      // Upload to Firebase
      const photoUrl = await uploadImageToFirebase(
        profilePhoto,
        "profile_photos",
      );

      const response = await ApiService.uploadDocuments({
        profilePhoto: photoUrl,
      });

      if (response.success) {
        await updateOnboardingStatus(OnboardingStatus.BANK_DETAILS, 80);
        router.push({
          pathname: "/registration/bank-details",
          params: { profilePhoto: photoUrl },
        });
      } else {
        Alert.alert(
          "Error",
          response.message || "Failed to upload profile photo",
        );
      }
    } catch (error: any) {
      console.error("Profile photo upload error:", error);
      Alert.alert("Error", "Failed to upload profile photo. Please try again.");
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

      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: insets.top + 10,
          paddingBottom: insets.bottom + 20,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="px-6 mb-6">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-full items-center justify-center border border-white/10 mb-6"
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
          </TouchableOpacity>

          <View className="items-center">
            <AnimatedStepIndicator currentStep={4} totalSteps={5} />
          </View>
        </View>

        {/* Main Content */}
        <View className="px-6 flex-1 justify-end pb-8">
          <View className="mb-8">
            <Text className="text-4xl font-extrabold text-white mb-2 shadow-sm tracking-tight">
              Profile Photo
            </Text>
            <Text className="text-lg text-white/80 font-medium tracking-wide">
              Add a clear photo of yourself
            </Text>
          </View>

          {/* Glassmorphism Card */}
          <View
            className="bg-white/20 backdrop-blur-md rounded-[32px] p-6 border-2 border-white/20 shadow-lg shadow-black/20"
            style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.3,
              shadowRadius: 20,
            }}
          >
            {/* Profile Photo Area */}
            <View className="items-center mb-8">
              <TouchableOpacity
                onPress={showOptions}
                activeOpacity={0.8}
                className="relative"
              >
                {profilePhoto ? (
                  <View className="relative">
                    <Image
                      source={{ uri: profilePhoto }}
                      className="w-44 h-44 rounded-full border-4 border-white/20"
                      resizeMode="cover"
                    />
                    <View className="absolute -bottom-1 -right-1 bg-green-500 rounded-full p-2 border-2 border-black/20">
                      <Ionicons name="checkmark" size={20} color="white" />
                    </View>
                  </View>
                ) : (
                  <View className="w-44 h-44 bg-white/5 rounded-full items-center justify-center border-4 border-dashed border-white/20">
                    <View className="w-16 h-16 bg-white/10 rounded-full items-center justify-center mb-2">
                      <Ionicons
                        name="person"
                        size={32}
                        color="rgba(255,255,255,0.8)"
                      />
                    </View>
                    <Text className="text-sm text-white/60 font-medium">
                      Tap to add
                    </Text>
                  </View>
                )}

                <TouchableOpacity
                  onPress={showOptions}
                  className="absolute bottom-0 right-0 bg-[#F59E0B] rounded-full p-3 shadow-lg border-2 border-white/10"
                  activeOpacity={0.8}
                >
                  <Ionicons name="camera" size={22} color="white" />
                </TouchableOpacity>
              </TouchableOpacity>
            </View>

            {/* Guidelines */}
            <View className="bg-white/5 rounded-2xl p-4 mb-6 border border-white/10">
              <Text className="text-sm font-bold text-white mb-3 uppercase tracking-wider opacity-80">
                Photo Guidelines
              </Text>
              {PHOTO_GUIDELINES.map((item, index) => (
                <View
                  key={index}
                  className={`flex-row items-center ${
                    index < PHOTO_GUIDELINES.length - 1 ? "mb-3" : ""
                  }`}
                >
                  <Ionicons
                    name={item.icon as any}
                    size={16}
                    color={item.color}
                  />
                  <Text className="text-sm text-white/80 ml-3 flex-1">
                    {item.text}
                  </Text>
                </View>
              ))}
            </View>

            {/* Action Buttons */}
            {!profilePhoto && (
              <View className="mb-6 gap-3">
                <TouchableOpacity
                  onPress={takePhoto}
                  className="bg-[#F59E0B] py-4 rounded-2xl flex-row items-center justify-center shadow-lg"
                  activeOpacity={0.8}
                >
                  <Ionicons name="camera-outline" size={22} color="white" />
                  <Text className="ml-2 text-base font-bold text-white">
                    Take Photo
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={pickImage}
                  className="bg-white/10 py-4 rounded-2xl flex-row items-center justify-center border border-white/20"
                  activeOpacity={0.7}
                >
                  <Ionicons name="images-outline" size={22} color="white" />
                  <Text className="ml-2 text-base font-semibold text-white">
                    Choose from Gallery
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            <PrimaryButton
              title="Continue"
              onPress={handleNext}
              loading={loading}
              disabled={!profilePhoto}
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
