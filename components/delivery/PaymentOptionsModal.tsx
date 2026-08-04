/**
 * PaymentOptionsModal
 * Shows bottom sheet with payment and delivery handoff options.
 * Handles: PREPAID delivery OTP, COD OTP, Payment Link, UPI QR
 */
import { Ionicons } from "@expo/vector-icons";
import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";
import {
  Keyboard,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AdminQrPaymentProof from "./AdminQrPaymentProof";
import CODOtpVerification from "./CODOtpVerification";
import PaymentLinkGenerator from "./PaymentLinkGenerator";
import UPIQRCodeView from "./UPIQRCodeView";

export type DeliveryPaymentType = "prepaid" | "cod" | "pay_at_delivery";

interface Props {
  visible: boolean;
  orderId: string;
  orderNumber: string;
  totalAmount: number;
  paymentMethod: string; // raw field from backend
  paymentStatus: string;
  /**
   * proofPhotoUrl is populated only by the admin-QR payment path — lets the
   * caller reuse that photo as the delivery-completion proof instead of
   * asking the rider to take a second, near-identical one.
   */
  onPaymentConfirmed: (proofPhotoUrl?: string) => void;
  onClose: () => void;
}

type SubView = "menu" | "cod_otp" | "payment_link" | "upi_qr" | "admin_qr_proof";

export type PaymentOptionsModalHandle = {
  present: () => void;
  dismiss: () => void;
};

const debugPaymentSheet = (message: string, details?: Record<string, unknown>) => {
  if (__DEV__) {
    console.log(`[PaymentSheetDebug] ${message}`, details ?? "");
  }
};

function PaymentOptionsModal(
  {
    visible,
    orderId,
    orderNumber,
    totalAmount,
    paymentMethod,
    paymentStatus,
    onPaymentConfirmed,
    onClose,
  }: Props,
  ref: React.ForwardedRef<PaymentOptionsModalHandle>,
) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [subView, setSubView] = useState<SubView>("menu");

  useEffect(() => {
    if (visible) {
      Keyboard.dismiss();
      setSubView("menu");
    }
  }, [orderId, visible]);

  // Determine payment type from order's paymentMethod field.
  // Backend values are not perfectly consistent across old/new orders:
  // examples seen: COD, cash, online, razorpay, pay_at_delivery.
  const normalizedPaymentMethod = paymentMethod?.toLowerCase?.().trim() ?? "";
  const payType: DeliveryPaymentType =
    ["cod", "cash", "cash_on_delivery", "pay_on_delivery"].includes(
      normalizedPaymentMethod,
    )
      ? "cod"
      : ["razorpay", "online", "prepaid", "paid_online"].includes(
            normalizedPaymentMethod,
          )
        ? "prepaid"
        : "pay_at_delivery";

  const handleClose = () => {
    debugPaymentSheet("modal close button pressed", {
      orderId,
      orderNumber,
    });
    Keyboard.dismiss();
    setSubView("menu");
    onClose();
  };

  const alreadyPaid =
    paymentStatus === "paid" ||
    paymentStatus === "completed" ||
    payType === "prepaid";

  useImperativeHandle(
    ref,
    () => ({
      present: () => {
        debugPaymentSheet("imperative present", {
          orderId,
          orderNumber,
          paymentMethod,
          paymentStatus,
          payType,
          visible,
        });
        Keyboard.dismiss();
        setSubView("menu");
      },
      dismiss: () => {
        debugPaymentSheet("imperative dismiss", {
          orderId,
          orderNumber,
        });
        handleClose();
      },
    }),
    [orderId, orderNumber, paymentMethod, paymentStatus, payType, visible],
  );

  return (
    <Modal
      animationType="slide"
      transparent
      visible={visible}
      statusBarTranslucent
      onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <TouchableOpacity
          activeOpacity={1}
          onPress={handleClose}
          style={StyleSheet.absoluteFill}
        />
        <View
          style={[
            styles.sheet,
            {
              maxHeight: subView === "menu" ? "84%" : "94%",
              paddingBottom: Math.max(insets.bottom, 16),
            },
          ]}>
          <View style={styles.handle} />
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 24 }}>
        {/* Handle + Header */}
        <View className="items-center pt-1 pb-4 px-6">
          <View className="flex-row items-center justify-between w-full">
            {subView !== "menu" ? (
              <TouchableOpacity
                onPress={() => {
                  Keyboard.dismiss();
                  setSubView("menu");
                }}
                hitSlop={8}>
                <Ionicons name="arrow-back" size={22} color="#1F2937" />
              </TouchableOpacity>
            ) : (
              <View style={{ width: 22 }} />
            )}
            <Text className="text-lg font-bold text-gray-900">
              {subView === "menu"
                ? t("payment.collectPayment")
                : subView === "cod_otp"
                  ? t("payment.deliveryVerification")
                  : subView === "payment_link"
                    ? t("payment.paymentLink")
                    : subView === "admin_qr_proof"
                      ? "Paid to Admin's QR"
                      : t("payment.upiQrCode")}
            </Text>
            <TouchableOpacity onPress={handleClose} hitSlop={8}>
              <Ionicons name="close" size={22} color="#6B7280" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Amount chip */}
        <View className="mx-6 mb-5 bg-gray-50 rounded-2xl p-4 flex-row items-center justify-between">
          <Text className="text-gray-500 font-medium">
            {t("payment.orderNumber", { number: orderNumber.slice(-6) })}
          </Text>
          <Text className="text-2xl font-bold text-gray-900">
            ₹{totalAmount}
          </Text>
        </View>

        {/* Content by sub-view */}
        {subView === "menu" && (
          <>
            {alreadyPaid ? (
              /* Already paid — still verify customer handoff with OTP */
              <View className="px-6">
                <View className="bg-green-50 rounded-2xl p-4 mb-4 flex-row items-center gap-3">
                  <Ionicons name="checkmark-circle" size={24} color="#16A34A" />
                  <Text className="text-green-700 font-semibold flex-1">
                    {payType === "prepaid"
                      ? t("payment.prepaidHint")
                      : t("payment.paymentConfirmed")}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setSubView("cod_otp")}
                  className="bg-green-600 rounded-2xl py-4 items-center">
                  <Text className="text-white font-bold text-base">
                    {t("payment.verifyDeliveryOtp")}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : payType === "cod" ? (
              /* COD options — cash verification via OTP (mandatory), or offer digital payment alternatives */
              <View className="px-6 gap-3">
                <OptionButton
                  icon="cash-outline"
                  title={t("payment.verifyCashWithOtp")}
                  subtitle={t("payment.cashOtpSubtitle")}
                  onPress={() => {
                    debugPaymentSheet("option selected", {
                      orderId,
                      orderNumber,
                      option: "cod_otp",
                    });
                    setSubView("cod_otp");
                  }}
                />
                <OptionButton
                  icon="qr-code-outline"
                  title={t("payment.acceptUpiQr")}
                  subtitle={t("payment.upiQrSubtitle")}
                  onPress={() => {
                    debugPaymentSheet("option selected", {
                      orderId,
                      orderNumber,
                      option: "upi_qr",
                    });
                    setSubView("upi_qr");
                  }}
                />
                <OptionButton
                  icon="link-outline"
                  title={t("payment.sendPaymentLink")}
                  subtitle={t("payment.linkSubtitle")}
                  onPress={() => {
                    debugPaymentSheet("option selected", {
                      orderId,
                      orderNumber,
                      option: "payment_link",
                    });
                    setSubView("payment_link");
                  }}
                />
                <OptionButton
                  icon="shield-checkmark-outline"
                  title="Paid to Admin's QR"
                  subtitle="Customer paid directly to admin's own QR — upload proof"
                  onPress={() => {
                    debugPaymentSheet("option selected", {
                      orderId,
                      orderNumber,
                      option: "admin_qr_proof",
                    });
                    setSubView("admin_qr_proof");
                  }}
                />
              </View>
            ) : (
              /* pay_at_delivery options */
              <View className="px-6 gap-3">
                <OptionButton
                  icon="link-outline"
                  title={t("payment.sendPaymentLink")}
                  subtitle={t("payment.linkSubtitleShort")}
                  onPress={() => {
                    debugPaymentSheet("option selected", {
                      orderId,
                      orderNumber,
                      option: "payment_link",
                    });
                    setSubView("payment_link");
                  }}
                />
                <OptionButton
                  icon="qr-code-outline"
                  title={t("payment.showUpiQr")}
                  subtitle={t("payment.showUpiQrSubtitle")}
                  onPress={() => {
                    debugPaymentSheet("option selected", {
                      orderId,
                      orderNumber,
                      option: "upi_qr",
                    });
                    setSubView("upi_qr");
                  }}
                />
              </View>
            )}
          </>
        )}

        {subView === "cod_otp" && (
          <CODOtpVerification
            orderId={orderId}
            onVerified={() => {
              setSubView("menu");
              onPaymentConfirmed();
            }}
          />
        )}

        {subView === "payment_link" && (
          <PaymentLinkGenerator
            orderId={orderId}
            totalAmount={totalAmount}
            onPaymentConfirmed={() => {
              setSubView("menu");
              onPaymentConfirmed();
            }}
          />
        )}

        {subView === "upi_qr" && (
          <UPIQRCodeView
            orderId={orderId}
            totalAmount={totalAmount}
            onPaymentConfirmed={() => {
              setSubView("menu");
              onPaymentConfirmed();
            }}
          />
        )}

        {subView === "admin_qr_proof" && (
          <AdminQrPaymentProof
            orderId={orderId}
            totalAmount={totalAmount}
            onPaymentConfirmed={(proofPhotoUrl) => {
              setSubView("menu");
              onPaymentConfirmed(proofPhotoUrl);
            }}
          />
        )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(17, 24, 39, 0.52)",
  },
  sheet: {
    width: "100%",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: "#FFFFFF",
    paddingTop: 10,
  },
  handle: {
    alignSelf: "center",
    width: 42,
    height: 5,
    borderRadius: 999,
    backgroundColor: "#D1D5DB",
    marginBottom: 10,
  },
});

function OptionButton({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      className="bg-gray-50 border border-gray-100 rounded-2xl p-4 flex-row items-center gap-4">
      <View className="w-12 h-12 bg-orange-50 rounded-xl items-center justify-center">
        <Ionicons name={icon} size={22} color="#FF6A00" />
      </View>
      <View className="flex-1">
        <Text className="font-bold text-gray-900 text-base">{title}</Text>
        <Text className="text-gray-500 text-xs mt-0.5" numberOfLines={2}>
          {subtitle}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
    </TouchableOpacity>
  );
}

export default forwardRef<PaymentOptionsModalHandle, Props>(PaymentOptionsModal);
