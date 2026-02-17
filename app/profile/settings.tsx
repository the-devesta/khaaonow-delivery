import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Switch, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  return (
    <View className="flex-1 bg-[#F3E0D9]">
      <View
        style={{ paddingTop: insets.top }}
        className="px-6 pb-4 bg-white border-b border-gray-200">
        <View className="flex-row items-center justify-between">
          <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2">
            <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
          </TouchableOpacity>
          <Text className="text-xl font-bold text-[#1A1A1A]">Settings</Text>
          <View className="w-10" />
        </View>
      </View>

      <View className="p-6">
        <View className="bg-white rounded-3xl p-6 shadow-sm mb-6">
          <Text className="text-gray-900 font-bold mb-4 text-base">
            Preferences
          </Text>

          <View className="flex-row items-center justify-between py-3 border-b border-gray-100">
            <View className="flex-row items-center">
              <Ionicons
                name="notifications-outline"
                size={22}
                color="#4B5563"
              />
              <Text className="text-gray-700 ml-3 font-medium">
                Push Notifications
              </Text>
            </View>
            <Switch
              trackColor={{ false: "#E5E7EB", true: "#F59E0B" }}
              thumbColor={"#FFFFFF"}
              onValueChange={setNotificationsEnabled}
              value={notificationsEnabled}
            />
          </View>

          <View className="flex-row items-center justify-between py-3">
            <View className="flex-row items-center">
              <Ionicons name="language-outline" size={22} color="#4B5563" />
              <Text className="text-gray-700 ml-3 font-medium">Language</Text>
            </View>
            <View className="flex-row items-center">
              <Text className="text-gray-500 mr-2">English</Text>
              <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
            </View>
          </View>
        </View>

        <View className="bg-white rounded-3xl p-6 shadow-sm">
          <Text className="text-gray-900 font-bold mb-4 text-base">About</Text>

          <TouchableOpacity className="flex-row items-center justify-between py-3 border-b border-gray-100">
            <Text className="text-gray-700 font-medium ml-1">
              Terms & Conditions
            </Text>
            <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
          </TouchableOpacity>

          <TouchableOpacity className="flex-row items-center justify-between py-3 border-b border-gray-100">
            <Text className="text-gray-700 font-medium ml-1">
              Privacy Policy
            </Text>
            <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
          </TouchableOpacity>

          <View className="flex-row items-center justify-between py-3">
            <Text className="text-gray-700 font-medium ml-1">App Version</Text>
            <Text className="text-gray-500">1.0.0</Text>
          </View>
        </View>
      </View>
    </View>
  );
}
