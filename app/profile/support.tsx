import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Linking, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function SupportScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handleCall = () => {
    Linking.openURL("tel:+919876543210");
  };

  const handleEmail = () => {
    Linking.openURL("mailto:support@khaaonow.com");
  };

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
            Help & Support
          </Text>
          <View className="w-10" />
        </View>
      </View>

      <View className="p-6">
        <View className="bg-white rounded-3xl p-6 shadow-sm mb-4">
          <Text className="text-lg font-bold text-gray-900 mb-2">
            Contact Support
          </Text>
          <Text className="text-gray-600 mb-6">
            Need help with an order or your account? Our team is available 24/7.
          </Text>

          <TouchableOpacity
            onPress={handleCall}
            className="flex-row items-center bg-green-50 p-4 rounded-xl mb-3 border border-green-100"
          >
            <View className="w-10 h-10 bg-green-100 rounded-full items-center justify-center mr-4">
              <Ionicons name="call" size={20} color="#10B981" />
            </View>
            <View>
              <Text className="font-bold text-gray-900">Call Us</Text>
              <Text className="text-gray-500 text-sm">+91 98765 43210</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleEmail}
            className="flex-row items-center bg-blue-50 p-4 rounded-xl border border-blue-100"
          >
            <View className="w-10 h-10 bg-blue-100 rounded-full items-center justify-center mr-4">
              <Ionicons name="mail" size={20} color="#3B82F6" />
            </View>
            <View>
              <Text className="font-bold text-gray-900">Email Us</Text>
              <Text className="text-gray-500 text-sm">
                support@khaaonow.com
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
