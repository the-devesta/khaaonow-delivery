/**
 * Guided hand-over at the customer's door. One decision per screen:
 *
 *   Cash order, unpaid → [Cash] or [UPI QR]
 *     Cash   → collect cash, enter the customer's delivery code → done
 *     UPI QR → customer scans & pays → delivery code (or photo) → done
 *   Prepaid / already paid → delivery code → done
 *
 * A verified code is the delivery proof, so no photo is needed. Only when the
 * customer can't share the code does the rider take a photo instead.
 */
import UPIQRCodeView from "@/components/delivery/UPIQRCodeView";
import { Banner, Button, Choice, rupees } from "@/components/kit";
import { paymentService } from "@/services/paymentService";
import { color } from "@/theme/tokens";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Stage = "method" | "qr" | "code";

export type HandoverResult = { otpVerified: boolean; needPhoto: boolean };

export default function HandoverSheet({
  visible,
  orderId,
  amount,
  isCash,
  isPaid,
  onClose,
  onDone,
}: {
  visible: boolean;
  orderId: string;
  amount: number;
  isCash: boolean;
  isPaid: boolean;
  onClose: () => void;
  onDone: (result: HandoverResult) => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const collectCash = isCash && !isPaid;
  const [stage, setStage] = useState<Stage>(collectCash ? "method" : "code");
  const [paidByQr, setPaidByQr] = useState(false);

  // Code entry state
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!visible) return;
    setStage(isCash && !isPaid ? "method" : "code");
    setPaidByQr(false);
    setSent(false);
    setCode("");
    setError("");
  }, [visible, isCash, isPaid]);

  const sendCode = async (method: "app" | "whatsapp") => {
    setSending(true);
    setError("");
    try {
      await paymentService.sendCodOtp(orderId, method);
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
      await paymentService.verifyCodOtp(orderId, code);
      onDone({ otpVerified: true, needPhoto: false });
    } catch (e: any) {
      setError(e?.message || t("handover.wrongCode"));
    } finally {
      setVerifying(false);
    }
  };

  const title =
    stage === "method"
      ? t("handover.howPaying")
      : stage === "qr"
        ? t("handover.scanToPay")
        : collectCash && !paidByQr
          ? t("handover.collectAndVerify", { amount: rupees(amount) })
          : t("handover.verifyDelivery");

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === "ios" ? "pageSheet" : "fullScreen"}
      onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1, backgroundColor: color.canvas }}>
        <View
          style={{ paddingTop: Platform.OS === "ios" ? 14 : insets.top + 8 }}
          className="flex-row items-center px-4 pb-3 bg-surface border-b border-line">
          {stage !== "method" && collectCash && !paidByQr ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("common.back")}
              onPress={() => setStage("method")}
              hitSlop={10}
              className="mr-2">
              <Ionicons name="chevron-back" size={24} color={color.ink} />
            </Pressable>
          ) : null}
          <Text className="flex-1 text-lg font-bold text-ink" numberOfLines={2}>
            {title}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("common.close")}
            onPress={onClose}
            hitSlop={10}>
            <Ionicons name="close" size={26} color={color.ink} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 24 }}
          keyboardShouldPersistTaps="handled">
          {stage === "method" && (
            <>
              <View className="bg-brand-soft rounded-3xl p-5 items-center">
                <Text className="text-sm font-semibold text-ink-soft">
                  {t("handover.amountToCollect")}
                </Text>
                <Text className="text-4xl font-extrabold text-ink mt-1">{rupees(amount)}</Text>
              </View>
              <View className="flex-row gap-3">
                <Choice
                  icon="cash-outline"
                  title={t("handover.cash")}
                  subtitle={t("handover.cashHint")}
                  selected={false}
                  onPress={() => setStage("code")}
                />
                <Choice
                  icon="qr-code-outline"
                  title={t("handover.upi")}
                  subtitle={t("handover.upiHint")}
                  selected={false}
                  onPress={() => setStage("qr")}
                />
              </View>
            </>
          )}

          {stage === "qr" && (
            <UPIQRCodeView
              orderId={orderId}
              totalAmount={amount}
              onPaymentConfirmed={() => {
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
                <Banner
                  tone="warning"
                  icon="cash-outline"
                  title={t("handover.takeCash", { amount: rupees(amount) })}
                  body={t("handover.thenCode")}
                />
              )}

              <View className="bg-surface rounded-3xl border border-line p-5 gap-4">
                <View className="flex-row items-center gap-3">
                  <View className="w-11 h-11 rounded-full bg-brand items-center justify-center">
                    <Ionicons name="keypad" size={22} color={color.ink} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-base font-bold text-ink">{t("handover.deliveryCode")}</Text>
                    <Text className="text-sm text-muted">
                      {sent ? t("handover.askCustomer") : t("handover.sendFirst")}
                    </Text>
                  </View>
                </View>

                {!sent ? (
                  <Button
                    title={t("handover.sendCode")}
                    icon="send"
                    loading={sending}
                    onPress={() => sendCode("app")}
                  />
                ) : (
                  <>
                    <TextInput
                      ref={inputRef}
                      value={code}
                      onChangeText={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))}
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
                    <Button
                      title={t("handover.verifyAndComplete")}
                      icon="checkmark-circle"
                      variant="success"
                      loading={verifying}
                      disabled={code.length !== 6}
                      onPress={verify}
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

              {(!collectCash || paidByQr) && (
                <Pressable
                  onPress={() => onDone({ otpVerified: false, needPhoto: true })}
                  className="items-center py-3"
                  hitSlop={6}>
                  <Text className="text-sm font-semibold text-muted underline">
                    {t("handover.noCodeTakePhoto")}
                  </Text>
                </Pressable>
              )}
              {collectCash && !paidByQr && (
                <Pressable onPress={() => setStage("qr")} className="items-center py-3" hitSlop={6}>
                  <Text className="text-sm font-semibold text-muted underline">
                    {t("handover.customerPaysUpi")}
                  </Text>
                </Pressable>
              )}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
