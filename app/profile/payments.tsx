import { ApiService } from "@/services/api";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function PaymentsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    accountName: "",
    accountNumber: "",
    ifsc: "",
    upiId: "",
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  useEffect(() => {
    if (profile) {
      setFormData({
        accountName: profile.bankDetails?.accountName || "",
        accountNumber: profile.bankDetails?.accountNumber || "",
        ifsc: profile.bankDetails?.ifsc || "",
        upiId: profile.upiId || "",
      });
    }
  }, [profile]);

  const fetchProfile = async () => {
    try {
      const response = await ApiService.getProfile();
      if (response.success && response.data) {
        setProfile(response.data);
      }
    } catch (error) {
      console.error("Failed to fetch profile:", error);
      Alert.alert("Error", "Failed to fetch profile details");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    // Basic Validation
    if (!formData.accountNumber) {
      Alert.alert("Validation Error", "Account Number is required");
      return;
    }
    if (!formData.ifsc) {
      Alert.alert("Validation Error", "IFSC Code is required");
      return;
    }

    setSaving(true);
    try {
      const updateData = {
        bankAccountName: formData.accountName,
        bankAccountNumber: formData.accountNumber,
        bankIFSC: formData.ifsc,
        upiId: formData.upiId,
      };

      const response = await ApiService.updateProfile(updateData);

      if (response.success) {
        Alert.alert("Success", "Payment details updated successfully");
        setIsEditing(false);
        fetchProfile(); // Refresh data
      } else {
        Alert.alert("Error", response.message || "Failed to update details");
      }
    } catch (error) {
      console.error("Update error:", error);
      Alert.alert("Error", "An unexpected error occurred");
    } finally {
      setSaving(false);
    }
  };

  const renderEditableField = (
    label: string,
    value: string,
    key: keyof typeof formData,
    placeholder: string,
  ) => (
    <View className="mb-4">
      <Text className="text-xs text-gray-500 uppercase tracking-wider mb-2">
        {label}
      </Text>
      <View className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
        <TextInput
          value={value}
          onChangeText={(text) => setFormData({ ...formData, [key]: text })}
          placeholder={placeholder}
          placeholderTextColor="#9CA3AF"
          className="text-base font-semibold text-gray-900"
        />
      </View>
    </View>
  );

  return (
    <View className="flex-1 bg-[#F3E0D9]">
      <View
        style={{ paddingTop: insets.top }}
        className="px-6 pb-4 bg-white/50 border-b border-gray-200/50"
      >
        <View className="flex-row items-center justify-between">
          <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2">
            <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
          </TouchableOpacity>
          <Text className="text-xl font-bold text-[#1A1A1A]">
            Payment Methods
          </Text>
          {/* Edit Button */}
          {!loading && !isEditing && (
            <TouchableOpacity
              onPress={() => setIsEditing(true)}
              className="p-2"
            >
              <Ionicons name="pencil" size={24} color="#1A1A1A" />
            </TouchableOpacity>
          )}
          {/* Placeholder for alignment if editing or loading */}
          {(loading || isEditing) && <View className="w-10" />}
        </View>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#F59E0B" />
        </View>
      ) : (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1"
        >
          <ScrollView
            contentContainerStyle={{ padding: 24, paddingBottom: 100 }}
          >
            {/* Bank Details Card */}
            <View className="bg-white rounded-3xl p-6 shadow-sm mb-6">
              <View className="flex-row items-center justify-between mb-6">
                <Text className="text-lg font-bold text-gray-900">
                  Bank Account
                </Text>
                <Ionicons name="card" size={24} color="#10B981" />
              </View>

              {isEditing ? (
                <>
                  {renderEditableField(
                    "Account Holder",
                    formData.accountName,
                    "accountName",
                    "Enter name",
                  )}
                  {renderEditableField(
                    "Account Number",
                    formData.accountNumber,
                    "accountNumber",
                    "Enter account number",
                  )}
                  {renderEditableField(
                    "IFSC Code",
                    formData.ifsc,
                    "ifsc",
                    "Enter IFSC code",
                  )}
                </>
              ) : profile?.bankDetails?.accountNumber ? (
                <>
                  <View className="mb-4">
                    <Text className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                      Account Holder
                    </Text>
                    <Text className="text-base font-semibold text-gray-900">
                      {profile.bankDetails.accountName || "N/A"}
                    </Text>
                  </View>
                  <View className="mb-4">
                    <Text className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                      Account Number
                    </Text>
                    <Text className="text-base font-semibold text-gray-900">
                      {profile.bankDetails.accountNumber}
                    </Text>
                  </View>
                  <View className="mb-4">
                    <Text className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                      IFSC Code
                    </Text>
                    <Text className="text-base font-semibold text-gray-900">
                      {profile.bankDetails.ifsc || "N/A"}
                    </Text>
                  </View>
                </>
              ) : (
                <Text className="text-gray-500 italic mb-4">
                  No bank details added.
                </Text>
              )}

              {/* Photo Display (Read-Only even in edit mode for now) */}
              {profile?.bankDetails?.photoUrl && (
                <View className="mt-2">
                  <Text className="text-xs text-gray-500 uppercase tracking-wider mb-2">
                    Passbook/Cheque Photo
                  </Text>
                  <Image
                    source={{ uri: profile.bankDetails.photoUrl }}
                    className="w-full h-40 rounded-xl bg-gray-100"
                    resizeMode="cover"
                  />
                  {isEditing && (
                    <Text className="text-xs text-gray-400 mt-1 italic">
                      (Photo cannot be changed here)
                    </Text>
                  )}
                </View>
              )}
            </View>

            {/* UPI ID Card */}
            <View className="bg-white rounded-3xl p-6 shadow-sm mb-6">
              <View className="flex-row items-center justify-between mb-6">
                <Text className="text-lg font-bold text-gray-900">
                  UPI Information
                </Text>
                <Ionicons name="qr-code" size={24} color="#F59E0B" />
              </View>

              {isEditing ? (
                renderEditableField(
                  "UPI ID",
                  formData.upiId,
                  "upiId",
                  "Enter UPI ID",
                )
              ) : profile?.upiId ? (
                <View className="mb-4">
                  <Text className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                    UPI ID
                  </Text>
                  <Text className="text-base font-semibold text-gray-900">
                    {profile.upiId}
                  </Text>
                </View>
              ) : (
                <Text className="text-gray-500 italic">No UPI ID added.</Text>
              )}
            </View>

            {/* Action Buttons for Edit Mode */}
            {isEditing && (
              <View className="flex-row gap-4 mb-8">
                <TouchableOpacity
                  onPress={() => setIsEditing(false)}
                  className="flex-1 bg-gray-200 py-4 rounded-xl items-center"
                  disabled={saving}
                >
                  <Text className="font-bold text-gray-700">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSave}
                  className="flex-1 bg-[#F59E0B] py-4 rounded-xl items-center"
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text className="font-bold text-white">Save Changes</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {!isEditing && (
              <Text className="text-center text-gray-500 text-sm">
                Tap the pencil icon to edit your details.
              </Text>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}
