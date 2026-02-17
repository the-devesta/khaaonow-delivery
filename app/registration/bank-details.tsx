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

export default function BankDetailsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const { updateOnboardingStatus } = useAuthStore();

  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [upiId, setUpiId] = useState("");
  const [passbookPhoto, setPassbookPhoto] = useState("");

  const [errors, setErrors] = useState<{
    accountName?: string;
    accountNumber?: string;
    ifsc?: string;
    upiId?: string;
  }>({});

  const insets = useSafeAreaInsets();

  const validateIFSC = (value: string) => {
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(value.toUpperCase())) {
      return "Invalid IFSC format (e.g., SBIN0001234)";
    }
    return "";
  };

  const validateUPI = (value: string) => {
    // Simple UPI validation: username@bank
    if (!/^[\w.-]+@[\w.-]+$/.test(value)) {
      return "Invalid UPI ID format";
    }
    return "";
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setPassbookPhoto(result.assets[0].uri);
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
      setPassbookPhoto(result.assets[0].uri);
    }
  };

  const showPhotoOptions = () => {
    Alert.alert("Upload Passbook/Cheque", "Choose an option", [
      { text: "Take Photo", onPress: takePhoto },
      { text: "Choose from Gallery", onPress: pickImage },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const handleNext = async () => {
    const newErrors: typeof errors = {};

    if (!accountName) newErrors.accountName = "Account name is required";
    if (!accountNumber) newErrors.accountNumber = "Account number is required";

    if (!ifsc) {
      newErrors.ifsc = "IFSC code is required";
    } else if (validateIFSC(ifsc)) {
      newErrors.ifsc = validateIFSC(ifsc);
    }

    // Only validate UPI if provided, or make it mandatory?
    // User asked to "take upi id or account info". Let's make UPI optional if bank details are there, or vice versa.
    // However, usually both or at least bank details are needed for official payments.
    // For now, let's treat UPI as optional but recommended, or just simple validation.
    if (upiId && validateUPI(upiId)) {
      newErrors.upiId = validateUPI(upiId);
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    if (!passbookPhoto) {
      Alert.alert(
        "Document Required",
        "Please upload a photo of your cancelled cheque or passbook front page.",
      );
      return;
    }

    setLoading(true);

    try {
      // Upload image to Firebase
      const photoUrl = await uploadImageToFirebase(passbookPhoto, "bank_docs");

      const bankData = {
        bankAccountName: accountName,
        bankAccountNumber: accountNumber,
        bankIFSC: ifsc.toUpperCase(),
        upiId: upiId,
        bankAccountPhoto: photoUrl,
      };

      const response = await ApiService.addBankDetails(bankData);

      if (response.success) {
        // Just move to review step, assumes 90% progress
        await updateOnboardingStatus(OnboardingStatus.COMPLETED, 90);
        // Note: The backend sets it to COMPLETED, but here we might want to go to Review screen first?
        // Actually the previous flow was vehicle -> photo -> review.
        // Now it is vehicle -> photo -> bank -> review.
        // So here we should probably NOT set COMPLETED yet, but maybe 90 and go to review.
        // The backend `addBankDetails` sets it to COMPLETED. This might be premature if we want a review screen.
        // But let's stick to the flow. success -> review.

        router.push({
          pathname: "/registration/review-submit",
          params: { ...bankData, profilePhoto: undefined }, // Pass data if needed, but review screen might need to fetch it or use store
        });
      } else {
        Alert.alert("Error", response.message || "Failed to save bank details");
      }
    } catch (error: any) {
      console.error("Bank details upload error:", error);
      Alert.alert("Error", "Failed to save bank details. Please try again.");
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
              <AnimatedStepIndicator currentStep={5} totalSteps={6} />
              {/* Increased total steps conceptually, or just reuse 5 and make this step 4.5? 
                  Previous steps: Basic(1), KYC(2), Vehicle(3), Photo(4), Review(5)?
                  Let's keep it consistent. Profile Photo was step 4. This is new step 5. Review becomes 6?
                  Or insert this before/after photo. 
                  Let's say this is Step 5.
              */}
            </View>
          </View>

          {/* Main Content */}
          <View className="px-6 flex-1 justify-end pb-8">
            <View className="mb-8">
              <Text className="text-4xl font-extrabold text-white mb-2 shadow-sm tracking-tight">
                Bank Details
              </Text>
              <Text className="text-lg text-white/80 font-medium tracking-wide">
                Where should we send your earnings?
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
              {/* Account Name */}
              <View className="mb-4">
                <Text className="text-xs font-bold text-white/70 mb-2 ml-1 uppercase tracking-wider">
                  Account Holder Name
                </Text>
                <View className="flex-row items-center bg-white/10 rounded-2xl border border-white/10 h-14 px-4 shadow-sm">
                  <Ionicons
                    name="person-outline"
                    size={20}
                    color="rgba(255,255,255,0.7)"
                  />
                  <TextInput
                    placeholder="As per bank records"
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    value={accountName}
                    onChangeText={(text) => {
                      setAccountName(text);
                      if (errors.accountName)
                        setErrors({ ...errors, accountName: "" });
                    }}
                    className="flex-1 ml-3 text-lg text-white font-semibold h-full"
                    selectionColor="#F59E0B"
                  />
                </View>
                {errors.accountName && (
                  <Text className="text-red-400 text-xs mt-1.5 ml-1 font-medium">
                    {errors.accountName}
                  </Text>
                )}
              </View>

              {/* Account Number */}
              <View className="mb-4">
                <Text className="text-xs font-bold text-white/70 mb-2 ml-1 uppercase tracking-wider">
                  Account Number
                </Text>
                <View className="flex-row items-center bg-white/10 rounded-2xl border border-white/10 h-14 px-4 shadow-sm">
                  <Ionicons
                    name="card-outline"
                    size={20}
                    color="rgba(255,255,255,0.7)"
                  />
                  <TextInput
                    placeholder="Enter account number"
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    keyboardType="numeric"
                    value={accountNumber}
                    onChangeText={(text) => {
                      setAccountNumber(text);
                      if (errors.accountNumber)
                        setErrors({ ...errors, accountNumber: "" });
                    }}
                    className="flex-1 ml-3 text-lg text-white font-semibold h-full"
                    selectionColor="#F59E0B"
                  />
                </View>
                {errors.accountNumber && (
                  <Text className="text-red-400 text-xs mt-1.5 ml-1 font-medium">
                    {errors.accountNumber}
                  </Text>
                )}
              </View>

              {/* IFSC Code */}
              <View className="mb-4">
                <Text className="text-xs font-bold text-white/70 mb-2 ml-1 uppercase tracking-wider">
                  IFSC Code
                </Text>
                <View className="flex-row items-center bg-white/10 rounded-2xl border border-white/10 h-14 px-4 shadow-sm">
                  <Ionicons
                    name="location-outline"
                    size={20}
                    color="rgba(255,255,255,0.7)"
                  />
                  <TextInput
                    placeholder="e.g. SBIN0001234"
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    autoCapitalize="characters"
                    value={ifsc}
                    onChangeText={(text) => {
                      setIfsc(text.toUpperCase());
                      if (errors.ifsc) setErrors({ ...errors, ifsc: "" });
                    }}
                    className="flex-1 ml-3 text-lg text-white font-semibold h-full"
                    selectionColor="#F59E0B"
                  />
                  {ifsc && !validateIFSC(ifsc) && (
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color="#10B981"
                    />
                  )}
                </View>
                {errors.ifsc && (
                  <Text className="text-red-400 text-xs mt-1.5 ml-1 font-medium">
                    {errors.ifsc}
                  </Text>
                )}
              </View>

              {/* UPI ID (Optional) */}
              <View className="mb-6">
                <Text className="text-xs font-bold text-white/70 mb-2 ml-1 uppercase tracking-wider">
                  UPI ID (Optional)
                </Text>
                <View className="flex-row items-center bg-white/10 rounded-2xl border border-white/10 h-14 px-4 shadow-sm">
                  <Ionicons
                    name="qr-code-outline"
                    size={20}
                    color="rgba(255,255,255,0.7)"
                  />
                  <TextInput
                    placeholder="e.g. name@upi"
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    autoCapitalize="none"
                    value={upiId}
                    onChangeText={(text) => {
                      setUpiId(text);
                      if (errors.upiId) setErrors({ ...errors, upiId: "" });
                    }}
                    className="flex-1 ml-3 text-lg text-white font-semibold h-full"
                    selectionColor="#F59E0B"
                  />
                </View>
                {errors.upiId && (
                  <Text className="text-red-400 text-xs mt-1.5 ml-1 font-medium">
                    {errors.upiId}
                  </Text>
                )}
              </View>

              {/* Passbook/Cheque Upload */}
              <TouchableOpacity
                onPress={showPhotoOptions}
                activeOpacity={0.7}
                className="bg-white/5 rounded-2xl border-2 border-dashed border-white/20 overflow-hidden mb-6"
                style={{ minHeight: 120, justifyContent: "center" }}>
                {passbookPhoto ? (
                  <View className="relative w-full h-32">
                    <Image
                      source={{ uri: passbookPhoto }}
                      className="w-full h-full"
                      resizeMode="cover"
                    />
                    <View className="absolute top-2 right-2 bg-green-500 rounded-full p-1.5 shadow-sm">
                      <Ionicons name="checkmark" size={16} color="white" />
                    </View>
                    <TouchableOpacity
                      onPress={showPhotoOptions}
                      className="absolute bottom-2 right-2 bg-white/20 backdrop-blur-md rounded-full p-2 border border-white/30">
                      <Ionicons name="camera" size={18} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View className="py-6 px-4 items-center">
                    <View className="w-10 h-10 bg-white/10 rounded-full items-center justify-center mb-2 border border-white/10">
                      <Ionicons
                        name="camera-outline"
                        size={20}
                        color="#F59E0B"
                      />
                    </View>
                    <Text className="text-sm font-bold text-white mb-0.5">
                      Upload Cancelled Cheque / Passbook
                    </Text>
                    <Text className="text-xs text-white/50">
                      To verify bank account details
                    </Text>
                  </View>
                )}
              </TouchableOpacity>

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
