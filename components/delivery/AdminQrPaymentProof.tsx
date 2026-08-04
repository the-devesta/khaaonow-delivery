/**
 * AdminQrPaymentProof
 * For orders where the customer paid directly to admin's own personal UPI
 * QR (not the app's Razorpay flow). Rider takes a photo of the payment
 * confirmation as proof, then marks the order paid.
 */
import { Ionicons } from "@expo/vector-icons";
import * as Device from "expo-device";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { paymentService } from "../../services/paymentService";
import { uploadImageToFirebase } from "../../services/storage";

interface Props {
  orderId: string;
  totalAmount: number;
  onPaymentConfirmed: (proofPhotoUrl?: string) => void;
}

export default function AdminQrPaymentProof({
  orderId,
  totalAmount,
  onPaymentConfirmed,
}: Props) {
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const capturePhoto = async () => {
    setCapturing(true);
    try {
      const usePhotoLibraryOnly = !Device.isDevice;

      if (usePhotoLibraryOnly) {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
          Alert.alert("Photos Required", "Select the payment confirmation screenshot from the photo library.");
          return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          allowsEditing: false,
          quality: 0.65,
        });
        if (!result.canceled && result.assets?.[0]?.uri) {
          setPhotoUri(result.assets[0].uri);
        }
        return;
      }

      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Camera Required", "Take a photo of the payment confirmation as proof.");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 0.65,
      });
      if (!result.canceled && result.assets?.[0]?.uri) {
        setPhotoUri(result.assets[0].uri);
      }
    } finally {
      setCapturing(false);
    }
  };

  const submit = async () => {
    if (!photoUri) return;
    setSubmitting(true);
    try {
      const proofPhotoUrl = await uploadImageToFirebase(photoUri, "admin-qr-payment-proofs");
      await paymentService.markAdminQrPaid(orderId, proofPhotoUrl);
      // Pass the photo up so the delivery-completion step can reuse it
      // instead of asking the rider to take a second, near-identical photo.
      onPaymentConfirmed(proofPhotoUrl);
    } catch (error: any) {
      Alert.alert(
        "Failed to Confirm",
        error?.message || "Could not mark this order paid. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View className="px-6">
      <View className="bg-blue-50 rounded-2xl p-4 mb-5 flex-row gap-3">
        <Ionicons name="qr-code-outline" size={20} color="#2563EB" />
        <Text className="flex-1 text-blue-700 text-sm leading-5">
          Customer paid directly to admin&apos;s own QR code? Take a photo of
          the payment confirmation screen (their UPI app) as proof, then mark
          this order paid.
        </Text>
      </View>

      <TouchableOpacity
        onPress={capturePhoto}
        activeOpacity={0.8}
        disabled={capturing}
        className="bg-white border-2 border-dashed border-gray-200 rounded-2xl items-center justify-center mb-4"
        style={{ height: photoUri ? undefined : 160 }}>
        {photoUri ? (
          <Image
            source={{ uri: photoUri }}
            style={{ width: "100%", height: 220, borderRadius: 14 }}
            resizeMode="cover"
          />
        ) : capturing ? (
          <ActivityIndicator color="#2563EB" />
        ) : (
          <View className="items-center py-8">
            <Ionicons name="camera-outline" size={32} color="#9CA3AF" />
            <Text className="text-gray-400 text-sm mt-2 font-medium">
              Take Payment Proof Photo
            </Text>
          </View>
        )}
      </TouchableOpacity>

      {photoUri && !submitting && (
        <TouchableOpacity onPress={capturePhoto} className="items-center mb-3">
          <Text className="text-blue-600 text-sm font-semibold">Retake Photo</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        onPress={submit}
        activeOpacity={0.8}
        disabled={!photoUri || submitting}
        className="bg-blue-600 rounded-2xl py-4 items-center"
        style={{ opacity: !photoUri || submitting ? 0.5 : 1 }}>
        {submitting ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text className="text-white font-bold text-base">
            Confirm ₹{totalAmount} Paid
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}
