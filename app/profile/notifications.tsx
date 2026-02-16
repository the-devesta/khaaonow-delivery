import { ApiService } from "@/services/api";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const response = await ApiService.getNotifications();
      if (response.success && response.data) {
        setNotifications(response.data.notifications || []);
      }
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchNotifications();
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
            Notifications
          </Text>
          <View className="w-10" />
        </View>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#F59E0B" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 24, paddingBottom: 100 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#F59E0B"
            />
          }
        >
          {notifications.length === 0 ? (
            <View className="items-center justify-center py-20">
              <Ionicons
                name="notifications-off-outline"
                size={64}
                color="#9CA3AF"
              />
              <Text className="text-gray-500 mt-4 text-center">
                No notifications yet
              </Text>
            </View>
          ) : (
            notifications.map((notification) => (
              <View
                key={notification._id}
                className="bg-white/80 backdrop-blur-md rounded-3xl p-4 mb-4 shadow-sm border border-gray-100"
              >
                <View className="flex-row items-start justify-between mb-2">
                  <Text className="text-base font-bold text-gray-900 flex-1 mr-2">
                    {notification.title}
                  </Text>
                  <Text className="text-xs text-gray-500">
                    {new Date(notification.createdAt).toLocaleDateString()}
                  </Text>
                </View>
                <Text className="text-gray-600 leading-5">
                  {notification.body}
                </Text>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}
