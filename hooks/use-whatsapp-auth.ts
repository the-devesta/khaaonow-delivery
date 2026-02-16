import { ApiService } from "@/services/api";
import { useCallback, useState } from "react";

interface UseWhatsAppAuthResult {
  sendOtp: (phoneNumber: string) => Promise<boolean>;
  verifyOtp: (
    phoneNumber: string,
    otp: string,
  ) => Promise<{
    success: boolean;
    data?: {
      deliveryPartnerId: string;
      token: string;
      onboardingStatus: string;
      onboardingProgress: number;
      isApproved?: boolean;
      profileComplete: boolean;
    };
    message?: string;
  }>;
  loading: boolean;
  error: string | null;
  clearError: () => void;
}

/**
 * WhatsApp OTP Authentication Hook
 *
 * Uses backend WhatsApp service to send and verify OTPs
 * No Firebase dependency required
 */
export function useWhatsAppAuth(): UseWhatsAppAuthResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  /**
   * Format phone number
   * Ensures we have a 10-digit number for India
   */
  const formatPhoneNumber = (phone: string): string => {
    // Remove any non-digit characters
    let cleaned = phone.replace(/\D/g, "");

    // Remove country code if present
    if (cleaned.startsWith("91") && cleaned.length === 12) {
      cleaned = cleaned.substring(2);
    }

    // Remove leading 0 if present
    if (cleaned.startsWith("0")) {
      cleaned = cleaned.substring(1);
    }

    return cleaned;
  };

  /**
   * Send OTP via WhatsApp
   */
  const sendOtp = async (phone: string): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      const formattedPhone = formatPhoneNumber(phone);

      console.log("📱 [WhatsApp Auth] Sending OTP to:", formattedPhone);

      const response = await ApiService.sendDeliveryPartnerOtp(formattedPhone);

      if (response.success) {
        console.log("✅ [WhatsApp Auth] OTP sent successfully");

        // Log OTP in development for testing
        if (response.data?.otp) {
          console.log("🔑 [WhatsApp Auth] OTP:", response.data.otp);
        }

        setLoading(false);
        return true;
      } else {
        throw new Error(response.message || "Failed to send OTP");
      }
    } catch (err: any) {
      console.error("❌ [WhatsApp Auth] Send OTP error:", err);

      let errorMessage = err.message || "Failed to send OTP. Please try again.";

      // Handle specific error cases
      if (err.response?.status === 429) {
        errorMessage =
          "Too many attempts. Please wait a few minutes and try again.";
      } else if (err.response?.status === 400) {
        errorMessage =
          err.response?.data?.message ||
          "Invalid phone number. Please check and try again.";
      } else if (err.message?.includes("Network")) {
        errorMessage = "Network error. Please check your internet connection.";
      }

      setError(errorMessage);
      setLoading(false);
      return false;
    }
  };

  /**
   * Verify OTP and get authentication token
   */
  const verifyOtp = async (
    phone: string,
    otp: string,
  ): Promise<{
    success: boolean;
    data?: {
      deliveryPartnerId: string;
      token: string;
      onboardingStatus: string;
      onboardingProgress: number;
      isApproved?: boolean;
      profileComplete: boolean;
    };
    message?: string;
  }> => {
    try {
      setLoading(true);
      setError(null);

      const formattedPhone = formatPhoneNumber(phone);

      console.log("🔐 [WhatsApp Auth] Verifying OTP for:", formattedPhone);

      const response = await ApiService.verifyDeliveryPartnerOtp(
        formattedPhone,
        otp,
      );

      if (response.success && response.data) {
        console.log("✅ [WhatsApp Auth] OTP verified successfully");
        console.log("📊 [WhatsApp Auth] Onboarding:", {
          status: response.data.onboardingStatus,
          progress: response.data.onboardingProgress,
          isApproved: response.data.isApproved,
        });

        setLoading(false);
        return {
          success: true,
          data: response.data,
          message: response.message,
        };
      } else {
        throw new Error(response.message || "OTP verification failed");
      }
    } catch (err: any) {
      console.error("❌ [WhatsApp Auth] Verify OTP error:", err);

      let errorMessage =
        err.message || "Failed to verify OTP. Please try again.";

      // Handle specific error cases
      if (err.response?.status === 400) {
        const msg = err.response?.data?.message || "";
        if (msg.includes("expired")) {
          errorMessage = "OTP has expired. Please request a new OTP.";
        } else if (msg.includes("Invalid")) {
          errorMessage = "Invalid OTP. Please try again.";
        } else {
          errorMessage = msg;
        }
      } else if (err.response?.status === 429) {
        errorMessage = "Too many attempts. Please wait and try again.";
      } else if (err.message?.includes("Network")) {
        errorMessage = "Network error. Please check your internet connection.";
      }

      setError(errorMessage);
      setLoading(false);
      return {
        success: false,
        message: errorMessage,
      };
    }
  };

  return {
    sendOtp,
    verifyOtp,
    loading,
    error,
    clearError,
  };
}
