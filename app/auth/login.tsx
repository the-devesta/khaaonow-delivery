/** Login — phone number, code arrives on WhatsApp. */
import { Button } from "@/components/kit";
import { LanguageSwitchButton } from "@/components/LanguageSwitchButton";
import { useWhatsAppAuth } from "@/hooks/use-whatsapp-auth";
import { color, TOUCH } from "@/theme/tokens";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Image, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { sendOtp, loading, error, clearError } = useWhatsAppAuth();
  const [phone, setPhone] = useState("");
  const [localError, setLocalError] = useState("");

  const valid = /^[6-9]\d{9}$/.test(phone);

  const submit = async () => {
    if (!valid) {
      setLocalError(t("login.invalidPhone"));
      return;
    }
    clearError();
    setLocalError("");
    try {
      const ok = await sendOtp(phone);
      if (ok) router.push({ pathname: "/auth/otp", params: { phoneNumber: phone } });
      else setLocalError(error || t("login.sendFailed"));
    } catch (err: any) {
      setLocalError(err?.message || t("login.sendFailed"));
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: color.brand }}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }}>
        <View className="flex-row justify-end px-4">
          <LanguageSwitchButton variant="light" />
        </View>

        <View className="items-center px-6 pt-10 pb-8 gap-3">
          <Image source={require("@/assets/images/DeliveryKhaaoNow.png")} style={{ width: 84, height: 84, borderRadius: 22 }} />
          <Text className="text-3xl font-extrabold text-ink text-center">{t("login.title")}</Text>
          <Text className="text-base text-ink-soft text-center">{t("login.subtitle")}</Text>
        </View>

        <View className="flex-1 bg-canvas rounded-t-[32px] px-5 pt-7 gap-4">
          <Text className="text-lg font-bold text-ink">{t("login.enterPhone")}</Text>
          <View
            style={{ minHeight: TOUCH + 8, borderColor: localError ? color.danger : color.ink }}
            className="flex-row items-center bg-surface rounded-2xl border-2 px-4">
            <Text className="text-lg font-bold text-ink mr-2">+91</Text>
            <View className="w-px h-6 bg-line mr-3" />
            <TextInput
              value={phone}
              onChangeText={(v) => {
                setPhone(v.replace(/\D/g, "").slice(0, 10));
                setLocalError("");
              }}
              keyboardType="phone-pad"
              textContentType="telephoneNumber"
              autoComplete="tel"
              placeholder="98765 43210"
              placeholderTextColor={color.faint}
              maxLength={10}
              accessibilityLabel={t("login.enterPhone")}
              style={{ flex: 1, fontSize: 20, fontWeight: "700", color: color.ink, letterSpacing: 1 }}
              onSubmitEditing={submit}
              returnKeyType="done"
            />
          </View>
          {localError ? <Text className="text-sm text-danger">{localError}</Text> : null}

          <Button title={t("login.getCode")} icon="logo-whatsapp" loading={loading} disabled={!valid} onPress={submit} />

          <View className="flex-row items-center gap-2 justify-center">
            <Ionicons name="lock-closed-outline" size={14} color={color.muted} />
            <Text className="text-xs text-muted">{t("login.whatsappNote")}</Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
