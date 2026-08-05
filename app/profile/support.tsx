import { Ionicons } from "@expo/vector-icons";
import { openPhoneDialer } from "@/utils/phone";
import { useRouter } from "expo-router";
import { Linking, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

const SUPPORT_PHONE = "+919875054898";
const SUPPORT_PHONE_DISPLAY = "+91 98750 54898";
const SUPPORT_EMAIL = "support@khaaonow.com";
const SUPPORT_WHATSAPP_PHONE = "919875054898";

export default function SupportScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const handleCall = () => {
    openPhoneDialer(SUPPORT_PHONE);
  };

  const handleEmail = () => {
    const subject = encodeURIComponent("Delivery Partner Support");
    const body = encodeURIComponent(
      "Hi KhaaoNow Support,\n\nI need help with my delivery partner account.\n\nName:\nIssue:\n",
    );
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`);
  };

  const handleWhatsApp = async () => {
    const text = encodeURIComponent(
      "Hi KhaaoNow Support,\n\nI need help with my delivery partner account.\n\nName:\nIssue:\n",
    );
    const appUrl = `whatsapp://send?phone=${SUPPORT_WHATSAPP_PHONE}&text=${text}`;
    const webUrl = `https://api.whatsapp.com/send?phone=${SUPPORT_WHATSAPP_PHONE}&text=${text}`;
    await Linking.openURL((await Linking.canOpenURL(appUrl)) ? appUrl : webUrl);
  };

  return (
    <View className="flex-1 bg-[#F3E0D9]">
      <View
        style={{ paddingTop: insets.top }}
        className="px-6 pb-4 bg-white border-b border-gray-200">
        <View className="flex-row items-center justify-between">
          <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2">
            <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
          </TouchableOpacity>
          <Text className="text-xl font-bold text-[#1A1A1A]">
            {t("profile.helpSupport")}
          </Text>
          <View className="w-10" />
        </View>
      </View>

      <View className="p-6">
        <View className="bg-white rounded-3xl p-6  mb-4">
          <Text className="text-lg font-bold text-gray-900 mb-2">
            {t("profile.contactSupport")}
          </Text>
          <Text className="text-gray-600 mb-6">
            {t("profile.supportHint")}
          </Text>

          <TouchableOpacity
            onPress={handleCall}
            className="flex-row items-center bg-green-50 p-4 rounded-xl mb-3 border border-green-100">
            <View className="w-10 h-10 bg-green-100 rounded-full items-center justify-center mr-4">
              <Ionicons name="call" size={20} color="#10B981" />
            </View>
            <View>
              <Text className="font-bold text-gray-900">{t("profile.callUs")}</Text>
              <Text className="text-gray-500 text-sm">{SUPPORT_PHONE_DISPLAY}</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleEmail}
            className="flex-row items-center bg-blue-50 p-4 rounded-xl mb-3 border border-blue-100">
            <View className="w-10 h-10 bg-blue-100 rounded-full items-center justify-center mr-4">
              <Ionicons name="mail" size={20} color="#3B82F6" />
            </View>
            <View>
              <Text className="font-bold text-gray-900">{t("profile.emailUs")}</Text>
              <Text className="text-gray-500 text-sm">{SUPPORT_EMAIL}</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleWhatsApp}
            className="flex-row items-center bg-emerald-50 p-4 rounded-xl border border-emerald-100">
            <View className="w-10 h-10 bg-emerald-100 rounded-full items-center justify-center mr-4">
              <Ionicons name="logo-whatsapp" size={20} color="#10B981" />
            </View>
            <View>
              <Text className="font-bold text-gray-900">{t("profile.whatsappUs")}</Text>
              <Text className="text-gray-500 text-sm">
                {t("profile.whatsappHint")}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
