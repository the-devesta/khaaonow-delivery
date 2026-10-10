/**
 * Hand-over at the customer's door — its own screen, one decision at a time:
 *
 *   Cash order, unpaid → [Cash] or [UPI QR]
 *     Cash   → take the cash, enter the customer's delivery code → done
 *     UPI QR → customer scans & pays → delivery code (or photo) → done
 *   Prepaid / already paid → delivery code → done
 *
 * A verified code is the delivery proof, so no photo is needed. Only when the
 * customer can't share the code does the rider take a photo instead.
 */
import UPIQRCodeView from "@/components/delivery/UPIQRCodeView";
import { Banner, BottomBar, Button, Choice, rupees, Screen } from "@/components/kit";
import { ApiService } from "@/services/api";
import { paymentService } from "@/services/paymentService";
import { uploadImageToFirebase } from "@/services/storage";
import { Location, useOrderStore } from "@/store/orders";
import { color } from "@/theme/tokens";
import { OrderView, transformApiOrder } from "@/utils/orderView";
import { Ionicons } from "@expo/vector-icons";
import * as Device from "expo-device";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as ExpoLocation from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from "react-native";

type Stage = "method" | "qr" | "code";

export default function HandoverScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const { updateOrderStatus, completeOrder, setDriverLocation } = useOrderStore();

  const [order, setOrder] = useState<OrderView | null>(null);
  const [chosenStage, setStage] = useState<Stage | null>(null);
  const [paidByQr, setPaidByQr] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    ApiService.getOrderById(id).then((res) => {
      if (alive && res.success && res.data) setOrder(transformApiOrder(res.data));
    });
    return () => {
      alive = false;
    };
  }, [id]);

  const isCash = order?.paymentType === "cash";
  const isPaid = order?.paymentStatus === "completed" || order?.paymentStatus === "paid";
  const collectCash = Boolean(isCash && !isPaid);
  const amount = order?.totalAmount ?? 0;
  // Until the rider picks something, the first stage depends on whether
  // money still has to be collected.
  const stage: Stage = chosenStage ?? (collectCash ? "method" : "code");


  /* ------------------------------------------------------------- finishing */

  const currentLocation = async (): Promise<Location | null> => {
    const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(t("order.locationNeeded"), t("order.locationNeededBody"));
      return null;
    }
    const pos = await ExpoLocation.getCurrentPositionAsync({ accuracy: ExpoLocation.Accuracy.High });
    const loc = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
    setDriverLocation(loc);
    return loc;
  };

  const takeProofPhoto = async (): Promise<string | null> => {
    if (!Device.isDevice) {
      // Simulators have no camera; pick from the library instead.
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== "granted") return null;
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.65 });
      if (res.canceled || !res.assets?.[0]?.uri) return null;
      return uploadImageToFirebase(res.assets[0].uri, "delivery_proofs");
    }
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (perm.status !== "granted") {
      Alert.alert(t("order.cameraNeeded"), t("order.cameraNeededBody"));
      return null;
    }
    const res = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.65 });
    if (res.canceled || !res.assets?.[0]?.uri) return null;
    return uploadImageToFirebase(res.assets[0].uri, "delivery_proofs");
  };

  const done = () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    completeOrder(String(id));
    router.dismissAll();
    router.replace({ pathname: "/(tabs)", params: { delivered: String(id) } });
  };

  const finish = async (needPhoto: boolean) => {
    setFinishing(true);
    try {
      const loc = await currentLocation();
      if (!loc) return;

      let proofPhotoUrl: string | undefined;
      if (!needPhoto) {
        // A verified code is the proof. If the server still asks for a
        // photo (older backend), fall back to taking one.
        const res = await ApiService.updateOrderStatus(String(id), "delivered", { currentLocation: loc });
        if (res.success) return done();
        if (!/proof|photo/i.test(res.message || "")) {
          Alert.alert(t("order.couldNotComplete"), res.message || t("common.tryAgain"));
          return;
        }
      }
      proofPhotoUrl = (await takeProofPhoto()) ?? undefined;
      if (!proofPhotoUrl) return;
      const ok = await updateOrderStatus("delivered", { orderId: String(id), currentLocation: loc, proofPhotoUrl });
      if (ok) done();
    } catch (e: any) {
      Alert.alert(t("order.couldNotComplete"), e?.message || t("common.tryAgain"));
    } finally {
      setFinishing(false);
    }
  };

  /* ------------------------------------------------------------ the code */

  const sendCode = async (method: "app" | "whatsapp") => {
    setSending(true);
    setError("");
    try {
      await paymentService.sendCodOtp(String(id), method);
      setSent(true);
      setTimeout(() => inputRef.current?.focus(), 250);
    } catch (e: any) {
      setError(e?.message || t("handover.sendFailed"));
    } finally {
      setSending(false);
    }
  };

  const verify = async () => {
    if (code.length !== 6) {
      setError(t("handover.enterSixDigits"));
      return;
    }
    setVerifying(true);
    setError("");
    try {
      await paymentService.verifyCodOtp(String(id), code);
      await finish(false);
    } catch (e: any) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(e?.message || t("handover.wrongCode"));
    } finally {
      setVerifying(false);
    }
  };

  /* --------------------------------------------------------------- render */

  if (!order) {
    return (
      <Screen back title={t("handover.verifyDelivery")}>
        <ActivityIndicator color={color.ink} style={{ paddingVertical: 48 }} />
      </Screen>
    );
  }

  const title =
    stage === "method"
      ? t("handover.howPaying")
      : stage === "qr"
        ? t("handover.scanToPay")
        : collectCash && !paidByQr
          ? t("handover.collectAndVerify", { amount: rupees(amount) })
          : t("handover.verifyDelivery");

  const back = stage !== "method" && collectCash && !paidByQr ? () => setStage("method") : true;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <Screen
        back={back}
        title={title}
        subtitle={order.customerName}
        footer={
          stage === "code" && sent ? (
            <BottomBar>
              <Button
                title={t("handover.verifyAndComplete")}
                icon="checkmark-circle"
                variant="success"
                loading={verifying || finishing}
                disabled={code.length !== 6}
                onPress={verify}
              />
            </BottomBar>
          ) : undefined
        }>
        {stage === "method" && (
          <>
            <View className="bg-brand-soft rounded-3xl p-5 items-center">
              <Text className="text-sm font-semibold text-ink-soft">{t("handover.amountToCollect")}</Text>
              <Text className="text-4xl font-extrabold text-ink mt-1">{rupees(amount)}</Text>
            </View>
            <View className="flex-row gap-3">
              <Choice icon="cash-outline" title={t("handover.cash")} subtitle={t("handover.cashHint")} selected={false} onPress={() => setStage("code")} />
              <Choice icon="qr-code-outline" title={t("handover.upi")} subtitle={t("handover.upiHint")} selected={false} onPress={() => setStage("qr")} />
            </View>
          </>
        )}

        {stage === "qr" && (
          <UPIQRCodeView
            orderId={String(id)}
            totalAmount={amount}
            onPaymentConfirmed={() => {
              void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              setPaidByQr(true);
              setStage("code");
            }}
          />
        )}

        {stage === "code" && (
          <>
            {paidByQr ? (
              <Banner tone="success" icon="checkmark-circle" title={t("handover.upiReceived")} />
            ) : !collectCash ? (
              <Banner tone="info" icon="card-outline" title={t("handover.alreadyPaid")} body={t("handover.dontCollect")} />
            ) : (
              <Banner tone="warning" icon="cash-outline" title={t("handover.takeCash", { amount: rupees(amount) })} body={t("handover.thenCode")} />
            )}

            <View className="bg-surface rounded-3xl border border-line p-5 gap-4">
              <View className="flex-row items-center gap-3">
                <View className="w-11 h-11 rounded-full bg-brand items-center justify-center">
                  <Ionicons name="keypad" size={22} color={color.ink} />
                </View>
                <View className="flex-1">
                  <Text className="text-base font-bold text-ink">{t("handover.deliveryCode")}</Text>
                  <Text className="text-sm text-muted">{sent ? t("handover.askCustomer") : t("handover.sendFirst")}</Text>
                </View>
              </View>

              {!sent ? (
                <Button title={t("handover.sendCode")} icon="send" loading={sending} onPress={() => sendCode("app")} />
              ) : (
                <>
                  <TextInput
                    ref={inputRef}
                    value={code}
                    onChangeText={(v) => {
                      setError("");
                      setCode(v.replace(/\D/g, "").slice(0, 6));
                    }}
                    keyboardType="number-pad"
                    textContentType="oneTimeCode"
                    maxLength={6}
                    placeholder="• • • • • •"
                    placeholderTextColor={color.faint}
                    accessibilityLabel={t("handover.deliveryCode")}
                    style={{
                      height: 64,
                      borderRadius: 16,
                      borderWidth: 2,
                      borderColor: error ? color.danger : color.ink,
                      textAlign: "center",
                      fontSize: 30,
                      fontWeight: "800",
                      letterSpacing: 10,
                      color: color.ink,
                      backgroundColor: color.surface,
                    }}
                  />
                  <Pressable onPress={() => sendCode("whatsapp")} disabled={sending} hitSlop={8}>
                    <Text className="text-center text-sm font-semibold text-info">
                      {sending ? t("handover.sending") : t("handover.resendWhatsapp")}
                    </Text>
                  </Pressable>
                </>
              )}
              {error ? <Text className="text-sm text-danger text-center">{error}</Text> : null}
            </View>

            {!collectCash || paidByQr ? (
              <Pressable onPress={() => finish(true)} disabled={finishing} className="items-center py-3" hitSlop={6}>
                <Text className="text-sm font-semibold text-muted underline">{t("handover.noCodeTakePhoto")}</Text>
              </Pressable>
            ) : (
              <Pressable onPress={() => setStage("qr")} className="items-center py-3" hitSlop={6}>
                <Text className="text-sm font-semibold text-muted underline">{t("handover.customerPaysUpi")}</Text>
              </Pressable>
            )}
          </>
        )}
      </Screen>
    </KeyboardAvoidingView>
  );
}
