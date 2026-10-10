/**
 * Payment Service — Razorpay pay-at-delivery (via backend)
 * Handles: Prepaid (no-op), COD OTP, Payment Link, UPI QR
 */

import { ApiService } from "./api";

interface PaymentApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

export type PaymentMethod =
  | "prepaid"
  | "cod"
  | "pay_at_delivery_link"
  | "pay_at_delivery_qr";

export interface PaymentLinkResult {
  paymentLinkId: string;
  paymentLinkUrl: string;
}

export interface QRCodeResult {
  qrCodeId: string;
  qrCodeUrl: string;
}

export interface PaymentStatusResult {
  paymentStatus: string;
  paid: boolean;
}

/** Request a COD OTP to be sent to the customer for this order */
export async function sendCodOtp(
  orderId: string,
  method: "app" | "whatsapp" = "app",
): Promise<{ expiresAt: string }> {
  const res = await ApiService.post<PaymentApiResponse<{ expiresAt: string }>>(
    `/delivery-partners/orders/${orderId}/send-cod-otp`,
    { method },
  );
  if (!res.success) throw new Error(res.message || "Failed to send OTP");
  return res.data;
}

/** Submit the OTP the customer tells the driver */
export async function verifyCodOtp(
  orderId: string,
  otp: string,
): Promise<{ paymentStatus: string }> {
  const res = await ApiService.post<
    PaymentApiResponse<{ paymentStatus: string }>
  >(
    `/delivery-partners/orders/${orderId}/verify-cod-otp`,
    { otp },
  );
  if (!res.success) throw new Error(res.message || "Invalid OTP");
  return res.data;
}

/** Generate a Razorpay Payment Link for pay-at-delivery */
export async function generatePaymentLink(
  orderId: string,
): Promise<PaymentLinkResult> {
  const res = await ApiService.post<PaymentApiResponse<PaymentLinkResult>>(
    `/delivery-partners/orders/${orderId}/generate-payment-link`,
  );
  if (!res.success)
    throw new Error(res.message || "Failed to generate payment link");
  return res.data;
}

/** Generate a Razorpay UPI QR Code for pay-at-delivery */
export async function generatePaymentQR(
  orderId: string,
): Promise<QRCodeResult> {
  const res = await ApiService.post<PaymentApiResponse<QRCodeResult>>(
    `/delivery-partners/orders/${orderId}/generate-qr`,
  );
  if (!res.success)
    throw new Error(res.message || "Failed to generate QR code");
  return res.data;
}

/** Poll backend to check if payment has been received */
export async function checkPaymentStatus(
  orderId: string,
): Promise<PaymentStatusResult> {
  const res = await ApiService.get<PaymentApiResponse<PaymentStatusResult>>(
    `/delivery-partners/orders/${orderId}/payment-status`,
  );
  if (!res.success)
    throw new Error(res.message || "Failed to check payment status");
  return res.data;
}

/**
 * Mark an order paid via admin's own personal UPI QR — a manual, out-of-band
 * channel for cases where the customer paid directly to a QR admin gave the
 * rider, not through the app's own Razorpay flow. Photo proof is mandatory.
 */
export async function markAdminQrPaid(
  orderId: string,
  proofPhotoUrl: string,
): Promise<{ paymentStatus: string }> {
  const res = await ApiService.post<
    PaymentApiResponse<{ paymentStatus: string }>
  >(`/delivery-partners/orders/${orderId}/mark-admin-qr-paid`, {
    proofPhotoUrl,
  });
  if (!res.success) throw new Error(res.message || "Failed to mark order paid");
  return res.data;
}

/** Namespace object for convenience imports: import { paymentService } from ... */
export const paymentService = {
  sendCodOtp,
  verifyCodOtp,
  generatePaymentLink,
  generatePaymentQR,
  checkPaymentStatus,
  markAdminQrPaid,
};
