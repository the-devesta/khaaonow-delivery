/** OTP — 6 boxes, verifies automatically on the 6th digit. */
import { Button, IconButton } from "@/components/kit";
import { useWhatsAppAuth } from "@/hooks/use-whatsapp-auth";
import { useAuthStore } from "@/store/auth";
import { color } from "@/theme/tokens";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const LENGTH = 6;

export default function OtpScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { phoneNumber } = useLocalSearchParams<{ phoneNumber: string }>();
  const { sendOtp, verifyOtp, loading, error, clearError } = useWhatsAppAuth();
  const { setAuthenticated, fetchProfile } = useAuthStore();

  const [otp, setOtp] = useState("");
  const [message, setMessage] = useState("");
  const [timer, setTimer] = useState(30);
  const [resending, setResending] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const verifyingRef = useRef(false);

  useEffect(() => {
    if (timer <= 0) return;
    const id = setTimeout(() => setTimer((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [timer]);

  const verify = async (code: string) => {
    if (code.length !== LENGTH || verifyingRef.current) return;
    verifyingRef.current = true;
    clearError();
    setMessage("");
    try {
      const response = await verifyOtp(phoneNumber, code);
      if (response.success && response.data) {
        await setAuthenticated(
          true,
          response.data.deliveryPartnerId,
          `+91${phoneNumber}`,
          response.data.token,
          response.data.onboardingStatus,
          response.data.onboardingProgress,
          response.data.isApproved || false,
        );
        // OTP response can be minimal for existing accounts; route on the full profile.
        await fetchProfile();
        router.replace(useAuthStore.getState().getNavigationRoute() as any);
      } else {
        setMessage(response.message || t("login.wrongCode"));
        setOtp("");
      }
    } catch (err: any) {
      setMessage(err?.message || t("login.wrongCode"));
      setOtp("");
    } finally {
      verifyingRef.current = false;
    }
  };

  const resend = async () => {
    setResending(true);
    clearError();
    setMessage("");
    try {
      const ok = await sendOtp(phoneNumber);
      if (ok) {
        setTimer(30);
        setOtp("");
        inputRef.current?.focus();
        setMessage(t("login.codeResent"));
      } else {
        setMessage(error || t("login.sendFailed"));
      }
    } catch (err: any) {
      setMessage(err?.message || t("login.sendFailed"));
    } finally {
      setResending(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: color.canvas }}>
      <View style={{ paddingTop: insets.top + 6 }} className="px-2">
        <IconButton icon="chevron-back" label={t("common.back")} onPress={() => router.back()} />
      </View>
      <View className="flex-1 px-5 pt-4 gap-5">
        <View className="gap-2">
          <Text className="text-3xl font-extrabold text-ink">{t("login.enterCode")}</Text>
          <Text className="text-base text-ink-soft">{t("login.sentTo", { phone: `+91 ${phoneNumber}` })}</Text>
        </View>

        <Pressable onPress={() => inputRef.current?.focus()} className="flex-row justify-between">
          {Array.from({ length: LENGTH }).map((_, i) => {
            const filled = i < otp.length;
            const active = i === otp.length;
            return (
              <View
                key={i}
                style={{
                  width: 48,
                  height: 60,
                  borderRadius: 14,
                  borderWidth: 2,
                  borderColor: active ? color.ink : filled ? color.inkSoft : color.line,
                  backgroundColor: color.surface,
                  alignItems: "center",
                  justifyContent: "center",
                }}>
                <Text className="text-2xl font-extrabold text-ink">{otp[i] ?? ""}</Text>
              </View>
            );
          })}
        </Pressable>
        <TextInput
          ref={inputRef}
          value={otp}
          onChangeText={(v) => {
            const code = v.replace(/\D/g, "").slice(0, LENGTH);
            setOtp(code);
            if (code.length === LENGTH) void verify(code);
          }}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="sms-otp"
          maxLength={LENGTH}
          autoFocus
          accessibilityLabel={t("login.enterCode")}
          style={{ position: "absolute", opacity: 0, width: 1, height: 1 }}
        />

        {message ? <Text className="text-sm text-center text-ink-soft">{message}</Text> : null}

        <Button title={t("login.verify")} icon="checkmark" loading={loading} disabled={otp.length !== LENGTH} onPress={() => verify(otp)} />

        <View className="items-center">
          {timer > 0 ? (
            <Text className="text-sm text-muted">{t("login.resendIn", { seconds: timer })}</Text>
          ) : (
            <Pressable onPress={resend} disabled={resending} hitSlop={10}>
              <Text className="text-sm font-bold text-info">{resending ? t("login.sending") : t("login.resend")}</Text>
            </Pressable>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
