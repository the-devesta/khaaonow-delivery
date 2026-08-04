/**
 * UPIQRCodeView
 * Generates a Razorpay UPI QR code for the customer to scan,
 * and polls until the payment is confirmed.
 */
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Modal,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { paymentService } from "../../services/paymentService";
import { subscribeToOrderPayment } from "../../services/realtime.service";
import { socketService } from "../../services/socket";

interface Props {
  orderId: string;
  totalAmount: number;
  onPaymentConfirmed: () => void;
}

type Phase = "idle" | "generating" | "waiting" | "paid";

const POLL_INTERVAL_MS = 5000;
const QR_SIZE = Math.min(Dimensions.get("window").width - 96, 220); // cap at 220px so it fits on screen

export default function UPIQRCodeView({
  orderId,
  totalAmount,
  onPaymentConfirmed,
}: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [fullScreenVisible, setFullScreenVisible] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Payment can be detected (socket/Firebase/poll) while the rider is
  // looking at the zoomed QR — close it automatically so the "Payment
  // Done!" state underneath is actually visible.
  useEffect(() => {
    if (phase === "paid") setFullScreenVisible(false);
  }, [phase]);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  useEffect(() => () => stopPolling(), []);

  // Listen for webhook-triggered payment-confirmed socket event so the QR
  // screen reacts instantly (parallel to polling as fallback).
  useEffect(() => {
    const handler = (data: { orderId: string; paymentStatus: string }) => {
      if (data.orderId !== orderId) return;
      stopPolling();
      setPhase("paid");
      setTimeout(onPaymentConfirmed, 800);
    };
    socketService.on("payment-confirmed", handler);
    const unsubscribeFirebase = subscribeToOrderPayment(orderId, () => {
      stopPolling();
      setPhase("paid");
      setTimeout(onPaymentConfirmed, 800);
    });
    return () => {
      socketService.off("payment-confirmed", handler);
      unsubscribeFirebase();
    };
  }, [orderId, onPaymentConfirmed]);

  const startPolling = useCallback(() => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const result = await paymentService.checkPaymentStatus(orderId);
        if (result.paid) {
          stopPolling();
          setPhase("paid");
          setTimeout(onPaymentConfirmed, 800);
        }
      } catch {
        // continue polling silently
      }
    }, POLL_INTERVAL_MS);
  }, [orderId, onPaymentConfirmed]);

  const handleGenerate = async () => {
    setPhase("generating");
    setError("");
    try {
      const result = await paymentService.generatePaymentQR(orderId);
      setQrUrl(result.qrCodeUrl);
      setPhase("waiting");
      startPolling();
    } catch (e: any) {
      setError(e?.message || "Failed to generate QR code. Please try again.");
      setPhase("idle");
    }
  };

  if (phase === "paid") {
    return (
      <View className="px-6 py-6 items-center gap-3">
        <View className="w-16 h-16 bg-green-100 rounded-full items-center justify-center mb-2">
          <Ionicons name="checkmark-circle" size={40} color="#16A34A" />
        </View>
        <Text className="text-xl font-bold text-gray-900">Payment Done!</Text>
        <Text className="text-gray-500 text-center">
          Completing your delivery…
        </Text>
      </View>
    );
  }

  return (
    <View className="px-6">
      {phase === "idle" && (
        <>
          <View className="bg-purple-50 rounded-2xl p-4 mb-5 flex-row gap-3">
            <Ionicons name="qr-code-outline" size={20} color="#7C3AED" />
            <Text className="flex-1 text-purple-700 text-sm leading-5">
              Show this QR code to the customer. They can scan it with any UPI
              app (GPay, PhonePe, Paytm, BHIM…) to pay instantly.
            </Text>
          </View>
          <TouchableOpacity
            onPress={handleGenerate}
            activeOpacity={0.8}
            className="bg-purple-600 rounded-2xl py-4 items-center">
            <Text className="text-white font-bold text-base">
              Generate QR Code
            </Text>
          </TouchableOpacity>
          {error ? (
            <Text className="text-red-500 text-sm text-center mt-3">
              {error}
            </Text>
          ) : null}
        </>
      )}

      {phase === "generating" && (
        <View className="items-center py-8 gap-3">
          <ActivityIndicator size="large" color="#7C3AED" />
          <Text className="text-gray-500">Generating QR code…</Text>
        </View>
      )}

      {phase === "waiting" && qrUrl && (
        <>
          {/* QR image */}
          <View className="items-center mb-4">
            <TouchableOpacity
              onPress={() => setFullScreenVisible(true)}
              activeOpacity={0.85}
              className="bg-white border-2 border-gray-100 rounded-2xl p-3 shadow-sm">
              <Image
                source={{ uri: qrUrl }}
                style={{ width: QR_SIZE, height: QR_SIZE }}
                resizeMode="contain"
              />
            </TouchableOpacity>
            <View className="flex-row items-center gap-1 mt-2">
              <Ionicons name="expand-outline" size={12} color="#9CA3AF" />
              <Text className="text-gray-400 text-xs">Tap to view full screen</Text>
            </View>
            <Text className="text-gray-500 text-xs mt-1">
              Amount: ₹{totalAmount}
            </Text>
          </View>

          {/* Logos row */}
          <View className="flex-row justify-center gap-4 mb-4">
            {["GPay", "PhonePe", "Paytm", "BHIM"].map((app) => (
              <View key={app} className="items-center">
                <View className="w-9 h-9 bg-gray-100 rounded-full items-center justify-center">
                  <Ionicons
                    name="phone-portrait-outline"
                    size={16}
                    color="#6B7280"
                  />
                </View>
                <Text className="text-gray-400 text-xs mt-0.5">{app}</Text>
              </View>
            ))}
          </View>

          {/* Polling status */}
          <View className="bg-purple-50 rounded-2xl p-4 flex-row items-center gap-3">
            <ActivityIndicator size="small" color="#7C3AED" />
            <Text className="flex-1 text-purple-700 text-sm">
              Waiting for customer to scan and pay…
            </Text>
          </View>

          <TouchableOpacity
            onPress={async () => {
              stopPolling();
              const result = await paymentService.checkPaymentStatus(orderId);
              if (result.paid) {
                setPhase("paid");
                setTimeout(onPaymentConfirmed, 800);
              } else {
                startPolling();
              }
            }}
            className="mt-3 items-center py-2">
            <Text className="text-purple-500 font-medium text-sm">
              Check Payment Status
            </Text>
          </TouchableOpacity>
        </>
      )}

      <Modal
        visible={fullScreenVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setFullScreenVisible(false)}>
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setFullScreenVisible(false)}
          className="flex-1 bg-black/95 items-center justify-center px-4">
          {qrUrl && (
            <View className="bg-white rounded-3xl p-4 items-center w-full">
              <Image
                source={{ uri: qrUrl }}
                style={{
                  width: Dimensions.get("window").width - 64,
                  height: Dimensions.get("window").width - 64,
                }}
                resizeMode="contain"
              />
              <Text className="text-gray-500 text-sm mt-3">
                Amount: ₹{totalAmount}
              </Text>
            </View>
          )}
          <TouchableOpacity
            onPress={() => setFullScreenVisible(false)}
            activeOpacity={0.8}
            className="mt-6 w-11 h-11 bg-white/15 rounded-full items-center justify-center">
            <Ionicons name="close" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <Text className="text-white/60 text-xs mt-3">Tap anywhere to close</Text>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}
