import { ApiService } from "@/services/api";
import { useAuthStore } from "@/store/auth";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

interface ProfileData {
  id: string;
  name?: string;
  email?: string;
  phone: string;
  avatar?: string;
  rating: number;
  totalOrders: number;
  completedOrders: number;
  vehicleType?: string;
  vehicleNumber?: string;
  isApproved: boolean;
  onboardingStatus: string;
}

export default function ProfileScreen() {
  const router = useRouter();
  const { logout, phoneNumber } = useAuthStore();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Animation values
  const [fadeAnim] = useState(new Animated.Value(0));

  const fetchProfile = async () => {
    try {
      const response = await ApiService.getProfile();
      if (response.success && response.data) {
        setProfile(response.data as any);
      }
    } catch (error) {
      console.error("Failed to fetch profile:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }).start();
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchProfile();
  };

  const handleLogout = () => {
    logout();
    router.replace("/auth/login");
  };

  const getInitials = (name?: string) => {
    if (!name) return "DP";
    const parts = name.split(" ");
    return parts.length > 1
      ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
      : name.substring(0, 2).toUpperCase();
  };

  const menuItems = [
    {
      id: 1,
      title: "Edit Profile",
      icon: "person-outline",
      route: "/profile/edit",
      color: "#F59E0B",
      bg: "#FFFBEB",
    },
    {
      id: 2,
      title: "Payment Methods",
      icon: "card-outline",
      route: "/profile/payments",
      color: "#10B981",
      bg: "#ECFDF5",
    },
    {
      id: 3,
      title: "Order History",
      icon: "receipt-outline",
      route: "/(tabs)/orders", // Link to orders tab for now
      color: "#3B82F6",
      bg: "#EFF6FF",
    },
    {
      id: 4,
      title: "Notifications",
      icon: "notifications-outline",
      route: "/profile/notifications",
      color: "#8B5CF6",
      bg: "#EDE9FE",
    },
    {
      id: 5,
      title: "Settings",
      icon: "settings-outline",
      route: "/profile/settings",
      color: "#6B7280",
      bg: "#F3F4F6",
    },
    {
      id: 6,
      title: "Help & Support",
      icon: "help-circle-outline",
      route: "/profile/support",
      color: "#EF4444",
      bg: "#FEE2E2",
    },
  ];

  if (loading) {
    return (
      <View className="flex-1 bg-[#F3E0D9] items-center justify-center">
        <ActivityIndicator size="large" color="#F59E0B" />
        <Text className="text-gray-500 mt-4 font-medium">
          Loading profile...
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#F3E0D9]">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 110 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#F59E0B"
            colors={["#F59E0B"]}
          />
        }>
        {/* Background Gradient */}
        <View className="absolute top-0 left-0 right-0 h-96 opacity-60">
          <LinearGradient
            colors={["#FFF5EB", "transparent"]}
            style={{ flex: 1 }}
          />
        </View>

        <View className="px-6 pt-16 pb-8">
          {/* Header */}
          <Text className="text-sm font-medium text-[#7A7A7A] uppercase tracking-wider mb-1">
            My Account
          </Text>
          <Text className="text-3xl font-extrabold text-[#1A1A1A] mb-8">
            Profile 👤
          </Text>

          {/* Profile Card */}
          <View className="bg-white rounded-[32px] p-1 shadow-sm mb-6">
            <View className="bg-gray-50 rounded-[28px] p-6 flex-row items-center">
              <View className="w-20 h-20 bg-[#F59E0B] rounded-[24px] items-center justify-center mr-5 shadow-lg shadow-amber-200 border-4 border-white">
                <Text className="text-white text-2xl font-bold">
                  {getInitials(profile?.name)}
                </Text>
              </View>
              <View className="flex-1">
                <Text className="text-xl font-bold text-[#1A1A1A] mb-1">
                  {profile?.name || "Delivery Partner"}
                </Text>
                <Text className="text-sm font-medium text-[#7A7A7A]">
                  {profile?.phone || phoneNumber}
                </Text>
                {profile?.email && (
                  <Text className="text-xs text-[#9CA3AF] mt-1">
                    {profile.email}
                  </Text>
                )}
                <View className="flex-row items-center mt-2.5">
                  <View className="px-2.5 py-1 bg-[#10B981]/10 rounded-full border border-[#10B981]/20">
                    <Text className="text-[10px] font-bold text-[#10B981] uppercase tracking-wide">
                      Verified Partner
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </View>

          {/* Stats Card */}
          <View className="bg-white rounded-[32px] p-6 shadow-sm mb-8">
            <View className="flex-row justify-between">
              <View className="items-center flex-1">
                <View className="w-10 h-10 bg-[#FFFBEB] rounded-xl items-center justify-center mb-2">
                  <Ionicons name="star" size={20} color="#F59E0B" />
                </View>
                <Text className="text-2xl font-extrabold text-[#1A1A1A]">
                  {profile?.rating?.toFixed(1) || "0.0"}
                </Text>
                <Text className="text-xs font-bold text-[#9CA3AF] uppercase tracking-wide">
                  Rating
                </Text>
              </View>
              <View className="w-[1px] bg-gray-200/60 my-2" />
              <View className="items-center flex-1">
                <View className="w-10 h-10 bg-[#ECFDF5] rounded-xl items-center justify-center mb-2">
                  <Ionicons name="cube" size={20} color="#10B981" />
                </View>
                <Text className="text-2xl font-extrabold text-[#1A1A1A]">
                  {profile?.completedOrders || 0}
                </Text>
                <Text className="text-xs font-bold text-[#9CA3AF] uppercase tracking-wide">
                  Deliveries
                </Text>
              </View>
              <View className="w-[1px] bg-gray-200/60 my-2" />
              <View className="items-center flex-1">
                <View className="w-10 h-10 bg-[#EFF6FF] rounded-xl items-center justify-center mb-2">
                  <Ionicons name="bicycle" size={20} color="#3B82F6" />
                </View>
                <Text
                  className="text-xl font-extrabold text-[#1A1A1A] text-center"
                  numberOfLines={1}>
                  {profile?.vehicleType || "N/A"}
                </Text>
                <Text className="text-xs font-bold text-[#9CA3AF] uppercase tracking-wide">
                  Vehicle
                </Text>
              </View>
            </View>
          </View>

          {/* Menu Items */}
          <Text className="text-lg font-bold text-[#1A1A1A] mb-4 ml-1">
            General
          </Text>
          <View className="gap-3 mb-8">
            {menuItems.map((item) => (
              <TouchableOpacity
                key={item.id}
                activeOpacity={0.7}
                onPress={() => item.route && router.push(item.route as any)}
                className="flex-row items-center justify-between bg-white rounded-[24px] p-4 shadow-sm">
                <View className="flex-row items-center flex-1">
                  <View
                    className="w-10 h-10 rounded-2xl items-center justify-center mr-4"
                    style={{ backgroundColor: item.bg }}>
                    <Ionicons
                      name={item.icon as any}
                      size={20}
                      color={item.color}
                    />
                  </View>
                  <Text className="text-base font-bold text-[#1A1A1A]">
                    {item.title}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
              </TouchableOpacity>
            ))}
          </View>

          {/* Logout Button */}
          <TouchableOpacity
            onPress={handleLogout}
            activeOpacity={0.8}
            className="bg-white rounded-[24px] py-4 items-center border border-red-100">
            <View className="flex-row items-center">
              <Ionicons name="log-out-outline" size={20} color="#EF4444" />
              <Text className="text-[#EF4444] text-base font-bold ml-2">
                Logout
              </Text>
            </View>
          </TouchableOpacity>

          {/* App Version */}
          <Text className="text-xs text-[#9CA3AF] text-center mt-8 font-medium">
            Khaaonow Delivery Partner v1.0.0
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
