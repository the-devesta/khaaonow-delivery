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

// Document upload component
function DocumentUploadCard({
  title,
  subtitle,
  imageUri,
  onUpload,
}: {
  title: string;
  subtitle: string;
  imageUri: string;
  onUpload: (uri: string) => void;
}) {
  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      onUpload(result.assets[0].uri);
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
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      onUpload(result.assets[0].uri);
    }
  };

  const showOptions = () => {
    const options = [
      { text: "Take Photo", onPress: takePhoto },
      { text: "Choose from Gallery", onPress: pickImage },
      { text: "Cancel", style: "cancel" as const },
    ];
    Alert.alert("Upload Document", "Choose an option", options);
  };

  return (
    <TouchableOpacity
      onPress={showOptions}
      activeOpacity={0.7}
      className="bg-white/5 rounded-2xl border-2 border-dashed border-white/20 overflow-hidden mb-4 mt-2"
      style={{ minHeight: 140, justifyContent: "center" }}>
      {imageUri ? (
        <View className="relative w-full h-40">
          <Image
            source={{ uri: imageUri }}
            className="w-full h-full"
            resizeMode="cover"
          />
          <View className="absolute top-2 right-2 bg-green-500 rounded-full p-1.5 shadow-sm">
            <Ionicons name="checkmark" size={16} color="white" />
          </View>
          <TouchableOpacity
            onPress={showOptions}
            className="absolute bottom-2 right-2 bg-white rounded-full p-2 border border-white/30">
            <Ionicons name="camera" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      ) : (
        <View className="py-6 px-4 items-center">
          <View className="w-12 h-12 bg-gray-100 rounded-full items-center justify-center mb-3 border border-gray-200">
            <Ionicons name="cloud-upload-outline" size={24} color="#F59E0B" />
          </View>
          <Text className="text-sm font-bold text-white mb-0.5">{title}</Text>
          <Text className="text-xs text-white/50 text-center max-w-[200px]">
            {subtitle}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function KycDocumentsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const { updateOnboardingStatus } = useAuthStore();
  const [aadhaarNumber, setAadhaarNumber] = useState("");
  const [panNumber, setPanNumber] = useState("");
  const [aadhaarPhoto, setAadhaarPhoto] = useState("");
  const [panPhoto, setPanPhoto] = useState("");
  const [errors, setErrors] = useState<{ aadhaar?: string; pan?: string }>({});
  const insets = useSafeAreaInsets();

  const validateAadhaar = (value: string) => {
    if (!/^\d{12}$/.test(value)) {
      return "Aadhaar must be 12 digits";
    }
    return "";
  };

  const validatePan = (value: string) => {
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(value.toUpperCase())) {
      return "Invalid PAN format";
    }
    return "";
  };

  const handleNext = async () => {
    const aadhaarError = validateAadhaar(aadhaarNumber);
    const panError = validatePan(panNumber);

    if (aadhaarError || panError) {
      setErrors({ aadhaar: aadhaarError, pan: panError });
      return;
    }

    if (!aadhaarPhoto || !panPhoto) {
      Alert.alert(
        "Documents Required",
        "Please upload both Aadhaar and PAN card photos to continue.",
      );
      return;
    }

    setLoading(true);
    try {
      // Upload images to Firebase Storage
      const aadhaarUrl = await uploadImageToFirebase(aadhaarPhoto, "kyc_docs");
      const panUrl = await uploadImageToFirebase(panPhoto, "kyc_docs");

      const response = await ApiService.uploadDocuments({
        aadhaarNumber,
        panNumber: panNumber.toUpperCase(),
        aadhaarPhoto: aadhaarUrl,
        panPhoto: panUrl,
      });

      if (response.success) {
        await updateOnboardingStatus(OnboardingStatus.DOCUMENTS, 40);
        router.push({
          pathname: "/registration/vehicle-details",
          params: {
            aadhaarNumber,
            panNumber: panNumber.toUpperCase(),
            aadhaarPhoto: aadhaarUrl,
            panPhoto: panUrl,
          },
        });
      } else {
        Alert.alert("Error", response.message || "Failed to upload documents");
      }
    } catch (error: any) {
      console.error("Document upload error:", error);
      Alert.alert("Error", "Failed to upload documents. Please try again.");
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
          source={require("../../assets/images/reg-docs.png")}
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
              className="w-10 h-10 bg-white rounded-full items-center justify-center border border-white/10 mb-6"
              activeOpacity={0.8}>
              <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
            </TouchableOpacity>

            <View className="items-center">
              <AnimatedStepIndicator currentStep={2} totalSteps={5} />
            </View>
          </View>

          {/* Main Content */}
          <View className="px-6 flex-1 justify-end pb-8">
            <View className="mb-8">
              <Text className="text-4xl font-extrabold text-white mb-2 shadow-sm tracking-tight">
                KYC Documents
              </Text>
              <Text className="text-lg text-white/80 font-medium tracking-wide">
                We need your ID for verification
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
              {/* Aadhaar Section */}
              <View className="mb-6">
                <View className="flex-row items-center mb-3">
                  <Ionicons name="card-outline" size={20} color="#6B7280" />
                  <Text className="ml-2 font-bold text-gray-700 uppercase text-xs tracking-wider">
                    Aadhaar Card
                  </Text>
                </View>

                <View className="flex-row items-center bg-gray-50 rounded-2xl border border-gray-200 h-14 px-4 mb-2 overflow-hidden">
                  <TextInput
                    placeholder="12-digit Aadhaar number"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="number-pad"
                    maxLength={12}
                    value={aadhaarNumber}
                    onChangeText={(text) => {
                      setAadhaarNumber(text);
                      if (errors.aadhaar) setErrors({ ...errors, aadhaar: "" });
                    }}
                    className="flex-1 text-lg text-gray-900 font-semibold h-full"
                    selectionColor="#F59E0B"
                  />
                  {aadhaarNumber.length === 12 &&
                    !validateAadhaar(aadhaarNumber) && (
                      <Ionicons
                        name="checkmark-circle"
                        size={20}
                        color="#10B981"
                      />
                    )}
                </View>
                {errors.aadhaar && (
                  <Text className="text-red-400 text-xs ml-1 mb-2 font-medium">
                    {errors.aadhaar}
                  </Text>
                )}

                <DocumentUploadCard
                  title="Upload Aadhaar Photo"
                  subtitle="Front side clearly visible"
                  imageUri={aadhaarPhoto}
                  onUpload={setAadhaarPhoto}
                />
              </View>

              <View className="h-[1px] bg-white/10 mb-6" />

              {/* PAN Section */}
              <View className="mb-6">
                <View className="flex-row items-center mb-3">
                  <Ionicons
                    name="wallet-outline"
                    size={20}
                    color="rgba(255,255,255,0.8)"
                  />
                  <Text className="ml-2 font-bold text-white/80 uppercase text-xs tracking-wider">
                    PAN Card
                  </Text>
                </View>

                <View className="flex-row items-center bg-white/10 rounded-2xl border border-white/10 h-14 px-4 mb-2 overflow-hidden">
                  <TextInput
                    placeholder="PAN Number (e.g. ABCDE1234F)"
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    autoCapitalize="characters"
                    maxLength={10}
                    value={panNumber}
                    onChangeText={(text) => {
                      setPanNumber(text.toUpperCase());
                      if (errors.pan) setErrors({ ...errors, pan: "" });
                    }}
                    className="flex-1 text-lg text-white font-semibold h-full"
                    selectionColor="#F59E0B"
                  />
                  {panNumber.length === 10 && !validatePan(panNumber) && (
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color="#10B981"
                    />
                  )}
                </View>
                {errors.pan && (
                  <Text className="text-red-400 text-xs ml-1 mb-2 font-medium">
                    {errors.pan}
                  </Text>
                )}

                <DocumentUploadCard
                  title="Upload PAN Photo"
                  subtitle="Front side clearly visible"
                  imageUri={panPhoto}
                  onUpload={setPanPhoto}
                />
              </View>

              <PrimaryButton
                title="Continue"
                onPress={handleNext}
                loading={loading}
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
