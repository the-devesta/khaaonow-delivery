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
  Pressable,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const VEHICLE_TYPES = [
  { id: "bicycle", name: "Bicycle", icon: "bicycle-outline" },
  { id: "bike", name: "Bike", icon: "bicycle" },
  { id: "scooter", name: "Scooter", icon: "speedometer-outline" },
  { id: "car", name: "Car", icon: "car-sport-outline" },
];

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

export default function VehicleDetailsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const { updateOnboardingStatus } = useAuthStore();
  const [selectedVehicle, setSelectedVehicle] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [dlNumber, setDlNumber] = useState("");
  const [rcPhoto, setRcPhoto] = useState("");
  const [licensePhoto, setLicensePhoto] = useState("");
  const [errors, setErrors] = useState<{
    vehicle?: string;
    vehicleNum?: string;
    dl?: string;
  }>({});
  const insets = useSafeAreaInsets();

  const validateVehicleNumber = (value: string) => {
    if (!/^[A-Z]{2}[0-9]{2}[A-Z]{1,2}[0-9]{4}$/.test(value.toUpperCase())) {
      return "Invalid format (e.g., KA01AB1234)";
    }
    return "";
  };

  const validateDL = (value: string) => {
    if (value.length < 10) {
      return "DL number must be at least 10 characters";
    }
    return "";
  };

  const handleNext = async () => {
    const newErrors: typeof errors = {};

    if (!selectedVehicle) {
      newErrors.vehicle = "Please select a vehicle type";
      setErrors(newErrors);
      return;
    }

    setLoading(true);

    try {
      let vehicleData: any = {
        vehicleType: selectedVehicle,
      };

      // Bicycle doesn't need vehicle documents
      if (selectedVehicle === "bicycle") {
        vehicleData.vehicleNumber = "BICYCLE";
        vehicleData.drivingLicenseNumber = "N/A";
      } else {
        // For motorized vehicles, validate documents
        if (validateVehicleNumber(vehicleNumber)) {
          newErrors.vehicleNum = validateVehicleNumber(vehicleNumber);
        }
        if (validateDL(dlNumber)) {
          newErrors.dl = validateDL(dlNumber);
        }

        if (Object.keys(newErrors).length > 0) {
          setErrors(newErrors);
          setLoading(false);
          return;
        }

        if (!rcPhoto || !licensePhoto) {
          Alert.alert(
            "Documents Required",
            "Please upload both RC Book and Driving License photos.",
          );
          setLoading(false);
          return;
        }

        // Upload images to Firebase
        const rcUrl = await uploadImageToFirebase(rcPhoto, "vehicle_docs");
        const licenseUrl = await uploadImageToFirebase(
          licensePhoto,
          "vehicle_docs",
        );

        vehicleData.vehicleNumber = vehicleNumber.toUpperCase();
        vehicleData.drivingLicenseNumber = dlNumber.toUpperCase();
        vehicleData.rcPhoto = rcUrl;
        vehicleData.drivingLicensePhoto = licenseUrl;
      }

      const response = await ApiService.uploadDocuments(vehicleData);

      if (response.success) {
        await updateOnboardingStatus(OnboardingStatus.VEHICLE_INFO, 60);
        router.push({
          pathname: "/registration/profile-photo",
          params: vehicleData,
        });
      } else {
        Alert.alert(
          "Error",
          response.message || "Failed to save vehicle details",
        );
      }
    } catch (error: any) {
      console.error("Vehicle details upload error:", error);
      Alert.alert("Error", "Failed to save vehicle details. Please try again.");
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
          source={require("../../assets/images/reg-vehicle.png")}
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
              <AnimatedStepIndicator currentStep={3} totalSteps={5} />
            </View>
          </View>

          {/* Main Content */}
          <View className="px-6 flex-1 justify-end pb-8">
            <View className="mb-8">
              <Text className="text-4xl font-extrabold text-white mb-2 shadow-sm tracking-tight">
                Vehicle Details
              </Text>
              <Text className="text-lg text-white/80 font-medium tracking-wide">
                Tell us what you drive
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
              {/* Vehicle Type Selection */}
              <View className="mb-6">
                <Text className="text-xs font-bold text-white/70 mb-3 ml-1 uppercase tracking-wider">
                  Select Vehicle Type
                </Text>
                <View className="flex-row justify-between flex-wrap gap-2">
                  {VEHICLE_TYPES.map((vehicle) => (
                    <Pressable
                      key={vehicle.id}
                      onPress={() => {
                        setSelectedVehicle(vehicle.id);
                        if (errors.vehicle)
                          setErrors({ ...errors, vehicle: "" });
                      }}
                      style={({ pressed }) => ({
                        width: "48%",
                        aspectRatio: 1.3,
                        borderRadius: 16,
                        alignItems: "center",
                        justifyContent: "center",
                        marginBottom: 8,
                        borderWidth: 1,
                        borderColor:
                          selectedVehicle === vehicle.id
                            ? "transparent"
                            : "rgba(255,255,255,0.1)",
                        backgroundColor:
                          selectedVehicle === vehicle.id
                            ? "rgba(255,255,255,0.9)"
                            : "rgba(255,255,255,0.05)",
                        opacity: pressed ? 0.7 : 1,
                      })}>
                      <View className="mb-2">
                        <Ionicons
                          name={vehicle.icon as any}
                          size={32}
                          color={
                            selectedVehicle === vehicle.id
                              ? "#000000"
                              : "rgba(255,255,255,0.7)"
                          }
                        />
                      </View>
                      <Text
                        className={`text-xs font-bold ${
                          selectedVehicle === vehicle.id
                            ? "text-black"
                            : "text-white/60"
                        }`}>
                        {vehicle.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                {errors.vehicle && (
                  <Text className="text-red-400 text-xs mt-1 ml-1 font-medium">
                    {errors.vehicle}
                  </Text>
                )}
              </View>

              {/* Bicycle Info Message */}
              {selectedVehicle === "bicycle" && (
                <View className="bg-green-500/10 rounded-2xl p-4 mb-6 flex-row items-center border border-green-500/20">
                  <View className="w-10 h-10 bg-green-500/20 rounded-full items-center justify-center">
                    <Ionicons name="checkmark" size={20} color="#4ADE80" />
                  </View>
                  <View className="ml-3 flex-1">
                    <Text className="text-sm font-bold text-green-400 mb-0.5">
                      No Documents Required
                    </Text>
                    <Text className="text-xs text-green-300 leading-4">
                      Bicycle riders don't need vehicle registration or license.
                    </Text>
                  </View>
                </View>
              )}

              {/* Vehicle Number & RC - Hidden for Bicycle */}
              {selectedVehicle !== "bicycle" && selectedVehicle !== "" && (
                <View>
                  {/* Vehicle Number */}
                  <View className="mb-6">
                    <Text className="text-xs font-bold text-white/70 mb-2 ml-1 uppercase tracking-wider">
                      Vehicle Number
                    </Text>
                    <View className="flex-row items-center bg-white/10 rounded-2xl border border-white/10 h-14 px-4 shadow-sm">
                      <Ionicons
                        name="car-outline"
                        size={20}
                        color="rgba(255,255,255,0.7)"
                      />
                      <TextInput
                        placeholder="e.g., KA01AB1234"
                        placeholderTextColor="rgba(255,255,255,0.4)"
                        autoCapitalize="characters"
                        maxLength={10}
                        value={vehicleNumber}
                        onChangeText={(text) => {
                          setVehicleNumber(text.toUpperCase());
                          if (errors.vehicleNum)
                            setErrors({ ...errors, vehicleNum: "" });
                        }}
                        className="flex-1 ml-3 text-lg text-white font-semibold h-full"
                        selectionColor="#F59E0B"
                      />
                      {vehicleNumber &&
                        !validateVehicleNumber(vehicleNumber) && (
                          <Ionicons
                            name="checkmark-circle"
                            size={20}
                            color="#10B981"
                          />
                        )}
                    </View>
                    {errors.vehicleNum && (
                      <Text className="text-red-400 text-xs mt-1.5 ml-1 font-medium">
                        {errors.vehicleNum}
                      </Text>
                    )}

                    <DocumentUploadCard
                      title="Upload RC Book"
                      subtitle="Front page of Registration"
                      imageUri={rcPhoto}
                      onUpload={setRcPhoto}
                    />
                  </View>

                  <View className="h-[1px] bg-white/10 mb-6" />

                  {/* Driving License */}
                  <View className="mb-6">
                    <Text className="text-xs font-bold text-white/70 mb-2 ml-1 uppercase tracking-wider">
                      Driving License
                    </Text>
                    <View className="flex-row items-center bg-white/10 rounded-2xl border border-white/10 h-14 px-4 shadow-sm">
                      <Ionicons
                        name="card-outline"
                        size={20}
                        color="rgba(255,255,255,0.7)"
                      />
                      <TextInput
                        placeholder="Enter DL number"
                        placeholderTextColor="rgba(255,255,255,0.4)"
                        autoCapitalize="characters"
                        value={dlNumber}
                        onChangeText={(text) => {
                          setDlNumber(text.toUpperCase());
                          if (errors.dl) setErrors({ ...errors, dl: "" });
                        }}
                        className="flex-1 ml-3 text-lg text-white font-semibold h-full"
                        selectionColor="#F59E0B"
                      />
                      {dlNumber && !validateDL(dlNumber) && (
                        <Ionicons
                          name="checkmark-circle"
                          size={20}
                          color="#10B981"
                        />
                      )}
                    </View>
                    {errors.dl && (
                      <Text className="text-red-400 text-xs mt-1.5 ml-1 font-medium">
                        {errors.dl}
                      </Text>
                    )}

                    <DocumentUploadCard
                      title="Upload Driving License"
                      subtitle="Front side of your DL"
                      imageUri={licensePhoto}
                      onUpload={setLicensePhoto}
                    />
                  </View>
                </View>
              )}

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
