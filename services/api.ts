import AsyncStorage from "@react-native-async-storage/async-storage";
import axios, { AxiosError, AxiosInstance } from "axios";
import Constants from "expo-constants";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { parseApiError } from "@/utils/errorHandler";

const getApiUrl = () => {
  // Check environment variable first (set in .env.local or eas.json)
  const envApiUrl =
    Constants.expoConfig?.extra?.apiUrl || process.env.EXPO_PUBLIC_API_URL;

  if (envApiUrl) {
    console.log("🌐 [API] Using environment API URL:", envApiUrl);
    return envApiUrl;
  }

  const message =
    "EXPO_PUBLIC_API_URL is required. Refusing to use a hardcoded backend fallback.";
  console.error(`🌐 [API] ${message}`);
  throw new Error(message);
};

export const API_BASE_URL = getApiUrl();
const TOKEN_KEY = "delivery_partner_token";
const AUTH_SESSION_KEYS = [
  "isAuthenticated",
  "userId",
  "phoneNumber",
  "partnerData",
  "onboardingStatus",
  "onboardingProgress",
  "isApproved",
];

console.log("🌐 [API] Final backend URL:", API_BASE_URL);

export const storeDeliveryPartnerToken = async (token: string): Promise<void> => {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
  await AsyncStorage.removeItem(TOKEN_KEY);
};

export const getDeliveryPartnerToken = async (): Promise<string | null> => {
  const secureToken = await SecureStore.getItemAsync(TOKEN_KEY);
  if (secureToken) return secureToken;

  const legacyToken = await AsyncStorage.getItem(TOKEN_KEY);
  if (!legacyToken) return null;

  await SecureStore.setItemAsync(TOKEN_KEY, legacyToken);
  await AsyncStorage.removeItem(TOKEN_KEY);
  return legacyToken;
};

export const removeDeliveryPartnerToken = async (): Promise<void> => {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await AsyncStorage.removeItem(TOKEN_KEY);
};

const clearAuthSession = async () => {
  await Promise.all([
    AsyncStorage.multiRemove(AUTH_SESSION_KEYS),
    removeDeliveryPartnerToken(),
  ]);
};

// Interfaces
interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

interface LoginResponse {
  success: boolean;
  exists?: boolean;
  partnerId?: string;
  message?: string;
  data?: {
    phone: string;
    deliveryPartnerId: string;
    token: string;
    onboardingStatus: string;
    onboardingProgress: number;
    isApproved?: boolean;
    profileComplete: boolean;
  };
}

interface ProfileData {
  name: string;
  email?: string;
}

export type DeliveryPayoutPeriod = "today" | "week" | "month" | "all";

export interface DeliveryPayoutLedgerOrder {
  id: string;
  orderNumber: string;
  restaurantName: string;
  deliveredAt: string;
  totalAmount: number;
  subtotal?: number | null;
  couponCode?: string | null;
  couponDiscount?: number;
  paymentMethod: string;
  paymentStatus: string;
  cashCollected: number;
  earning: number;
  distanceKm?: number | null;
  slabLabel?: string | null;
  fallbackApplied?: boolean;
}

export interface DeliveryPayoutSettlement {
  id: string;
  source?: "settlement" | "legacy_payout";
  payeeType?: "delivery_partner";
  amount: number;
  status: "pending" | "paid";
  cycle?: "daily" | "weekly" | "manual";
  periodStart: string;
  periodEnd: string;
  paidAt?: string;
  proofUrl?: string;
  notes?: string;
  breakdown?: {
    orderCount?: number;
    grossAmount?: number;
    platformCommission?: number;
    restaurantEarnings?: number;
    deliveryEarnings?: number;
  };
  createdAt: string;
}

export interface DeliveryCashRemittance {
  id: string;
  amount: number;
  remittedAt: string;
  notes?: string;
  createdAt: string;
}

export interface DeliveryPayoutLedger {
  period: {
    label: DeliveryPayoutPeriod | string;
    start: string;
    end: string;
  };
  summary: {
    totalEarned: number;
    periodEarned: number;
    grossPayableAmount?: number;
    payableAmount: number;
    paidAmount: number;
    scheduledAmount: number;
    deliveredOrders: number;
    periodOrders: number;
    nextPayoutDate?: string;
  };
  cash: {
    cashInHand: number;
    totalCollected: number;
    totalRemitted: number;
    deliveredCashOrders: number;
    remittances: DeliveryCashRemittance[];
  };
  settlements: DeliveryPayoutSettlement[];
  orders: DeliveryPayoutLedgerOrder[];
}

interface DocumentsData {
  aadhaarNumber?: string;
  panNumber?: string;
  aadhaarPhoto?: string;
  panPhoto?: string;
  vehicleType?: string;
  vehicleNumber?: string;
  rcPhoto?: string;
  drivingLicenseNumber?: string;
  drivingLicensePhoto?: string;
  profilePhoto?: string;
}

interface BankDetailsData {
  bankAccountName?: string;
  bankAccountNumber?: string;
  bankIFSC?: string;
  bankAccountPhoto?: string;
  upiId?: string;
}

interface DeliveryPartner {
  id: string;
  phone: string;
  email?: string;
  name?: string;
  avatar?: string;
  provider: string;
  isPhoneVerified: boolean;
  isEmailVerified: boolean;
  isApproved: boolean;
  onboardingStatus: string;
  onboardingProgress: number;
  rating: number;
  totalOrders: number;
  completedOrders: number;
  isActive: boolean;
  vehicleType?: string;
  vehicleNumber?: string;
  bankDetails?: {
    accountName: string;
    accountNumber: string;
    ifsc: string;
    photoUrl?: string;
  };
  upiId?: string;
}

interface GoogleLoginApiResponse {
  success: boolean;
  message: string;
  data?: {
    token?: string;
    onboardingProgress?: number;
    partner?: Partial<DeliveryPartner> & {
      id?: string;
      _id?: string;
      onboardingStatus?: string;
    };
  };
}

// Axios Instance
class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: {
        "Content-Type": "application/json",
      },
    });

    // Request Interceptor
    this.client.interceptors.request.use(
      async (config) => {
        const token = await getDeliveryPartnerToken();
        if (token) {
          console.log("🔑 [API] Attaching token to request:", config.url);
          config.headers.Authorization = `Bearer ${token}`;
        } else {
          console.warn(
            "⚠️ [API] No token found in storage for request:",
            config.url,
          );
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      },
    );

    // Response Interceptor
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const status = error.response?.status;
        const requestUrl = error.config?.url || "";
        const isAuthEndpoint = requestUrl.includes("/auth/");

        if (status === 401 && !isAuthEndpoint) {
          console.warn("🚪 [API] Session expired; clearing auth state");
          await clearAuthSession();
          router.replace("/auth/login" as any);
        }

        return Promise.reject(error);
      },
    );
  }

  async get<T = unknown>(url: string, config?: any): Promise<T> {
    const response = await this.client.get<T>(url, config);
    return response.data;
  }

  async post<T = unknown>(url: string, data?: any, config?: any): Promise<T> {
    const response = await this.client.post<T>(url, data, config);
    return response.data;
  }

  async put<T = unknown>(url: string, data?: any, config?: any): Promise<T> {
    const response = await this.client.put<T>(url, data, config);
    return response.data;
  }

  async patch<T = unknown>(url: string, data?: any, config?: any): Promise<T> {
    const response = await this.client.patch<T>(url, data, config);
    return response.data;
  }

  async delete<T = unknown>(url: string, config?: any): Promise<T> {
    const response = await this.client.delete<T>(url, config);
    return response.data;
  }
}

export const apiClient = new ApiClient();

const getApiErrorMessage = (error: any, fallback: string) => {
  const parsed = parseApiError(error);
  return parsed.message || fallback;
};

// API Service
export const ApiService = {
  // ==================== AUTHENTICATION ====================

  /**
   * Verify Firebase Phone Token
   * This is the primary authentication method using Firebase
   */
  async verifyPhoneToken(
    idToken: string,
    phone: string,
  ): Promise<LoginResponse> {
    try {
      const response = await apiClient.post<LoginResponse>(
        "/delivery-partners/auth/verify-phone-token",
        { idToken, phone },
      );

      // Store token if available
      if (response.data?.token) {
        await storeDeliveryPartnerToken(response.data.token);
      }

      return response;
    } catch (error: any) {
      console.error("Verify phone token error:", error);

      // Check if this is an "account already exists" error - treat as successful login
      const errorMessage = error.response?.data?.message || "";
      const errorData = error.response?.data?.data;

      if (errorMessage.toLowerCase().includes("already exists") && errorData) {
        // Backend returned existing account data - treat as successful login
        console.log("📱 [Auth] Existing account detected, treating as login");

        if (errorData.token) {
          await storeDeliveryPartnerToken(errorData.token);
        }

        return {
          success: true,
          message: "Login successful",
          data: errorData,
        };
      }

      // Also check if the error response contains success data (some API versions)
      if (error.response?.data?.success && error.response?.data?.data) {
        const data = error.response.data.data;
        if (data.token) {
          await storeDeliveryPartnerToken(data.token);
        }
        return {
          success: true,
          message: error.response.data.message || "Login successful",
          data: data,
        };
      }

      return {
        success: false,
        message: getApiErrorMessage(error, "Failed to verify phone token"),
      };
    }
  },

  /**
   * Send OTP to phone number
   * Backend handles OTP generation and storage
   */
  async sendOtp(phoneNumber: string): Promise<LoginResponse> {
    try {
      // Format phone number to E.164 format (+91XXXXXXXXXX)
      const phone = phoneNumber.startsWith("+")
        ? phoneNumber
        : `+91${phoneNumber}`;

      const response = await apiClient.post<LoginResponse>(
        "/delivery-partners/auth/send-otp",
        { phone },
      );

      return response;
    } catch (error: any) {
      console.error("Send OTP error:", error);
      return {
        success: false,
        message: getApiErrorMessage(error, "Failed to send OTP"),
      };
    }
  },

  /**
   * Verify OTP and authenticate
   * Returns JWT token on success
   */
  async verifyOtp(phoneNumber: string, otp: string): Promise<LoginResponse> {
    try {
      // Format phone number to E.164 format (+91XXXXXXXXXX)
      const phone = phoneNumber.startsWith("+")
        ? phoneNumber
        : `+91${phoneNumber}`;

      const response = await apiClient.post<LoginResponse>(
        "/delivery-partners/auth/verify-otp",
        { phone, otp },
      );

      // Store token if available
      if (response.data?.token) {
        await storeDeliveryPartnerToken(response.data.token);
      }

      return response;
    } catch (error: any) {
      console.error("Verify OTP error:", error);
      return {
        success: false,
        message: getApiErrorMessage(error, "Failed to verify OTP"),
      };
    }
  },

  // ==================== PROFILE MANAGEMENT ====================

  /**
   * Complete delivery partner profile
   */
  async completeProfile(
    data: ProfileData,
  ): Promise<ApiResponse<{ partner: DeliveryPartner; token: string }>> {
    try {
      console.log(
        "📤 [API] Completing profile with data:",
        JSON.stringify(data, null, 2),
      );
      const response = await apiClient.post<
        ApiResponse<{ partner: DeliveryPartner; token: string }>
      >(
        "/delivery-partners/profile/complete",
        data,
      );

      // Update token if new one is provided
      if (response.data?.token) {
        await storeDeliveryPartnerToken(response.data.token);
      }

      console.log("✅ [API] Profile completion successful:", response);
      return response;
    } catch (error: any) {
      console.error("❌ [API] Complete profile error:", error);
      console.error("❌ [API] Error Response Data:", error.response?.data);
      console.error("❌ [API] Error Status:", error.response?.status);
      return {
        success: false,
        message: getApiErrorMessage(error, "Failed to complete profile"),
      };
    }
  },

  /**
   * Upload registration documents
   */
  async uploadDocuments(
    data: DocumentsData,
  ): Promise<ApiResponse<{ partner: DeliveryPartner }>> {
    try {
      const response = await apiClient.post<
        ApiResponse<{ partner: DeliveryPartner }>
      >(
        "/delivery-partners/documents/upload",
        data,
      );
      return response;
    } catch (error: any) {
      console.error("Upload documents error:", error);
      return {
        success: false,
        message: getApiErrorMessage(error, "Failed to upload documents"),
      };
    }
  },

  /**
   * Add bank details
   */
  async addBankDetails(
    data: BankDetailsData,
  ): Promise<ApiResponse<{ partner: DeliveryPartner }>> {
    try {
      const response = await apiClient.post<
        ApiResponse<{ partner: DeliveryPartner }>
      >(
        "/delivery-partners/bank-details",
        data,
      );
      return response;
    } catch (error: any) {
      console.error("Add bank details error:", error);
      return {
        success: false,
        message: getApiErrorMessage(error, "Failed to add bank details"),
      };
    }
  },

  /**
   * Submit complete registration (combines all steps)
   * Legacy method - kept for backward compatibility
   */
  async submitRegistration(
    data: any,
  ): Promise<{ success: boolean; message: string; partnerId?: string }> {
    try {
      // Step 1: Complete Profile
      await this.completeProfile({
        name: data.name,
        email: data.email,
      });

      // Step 2: Upload Documents
      await this.uploadDocuments({
        aadhaarNumber: data.aadhaarNumber,
        panNumber: data.panNumber,
        aadhaarPhoto: data.aadhaarPhoto,
        panPhoto: data.panPhoto,
        vehicleType: data.vehicleType,
        vehicleNumber: data.vehicleNumber,
        rcPhoto: data.rcPhoto,
        drivingLicenseNumber: data.drivingLicenseNumber,
        drivingLicensePhoto: data.drivingLicensePhoto,
        profilePhoto: data.profilePhoto,
      });

      return {
        success: true,
        message: "Registration submitted successfully",
      };
    } catch (error: any) {
      console.error("Submit registration error:", error);
      return {
        success: false,
        message: getApiErrorMessage(error, "Failed to submit registration"),
      };
    }
  },

  // ==================== PARTNER PROFILE ====================

  /**
   * Get current partner profile
   */
  async getProfile(): Promise<ApiResponse<DeliveryPartner>> {
    try {
      const response = await apiClient.get<ApiResponse<DeliveryPartner>>(
        "/delivery-partners/profile",
      );
      return response;
    } catch (error: any) {
      console.error("Get profile error:", error);
      return {
        success: false,
        message: getApiErrorMessage(error, "Failed to get profile"),
      };
    }
  },

  /**
   * Update partner profile
   */
  async updateProfile(data: any): Promise<ApiResponse<DeliveryPartner>> {
    try {
      const response = await apiClient.put<ApiResponse<DeliveryPartner>>(
        "/delivery-partners/profile",
        data,
      );
      return response;
    } catch (error: any) {
      console.error("Update profile error:", error);
      return {
        success: false,
        message: getApiErrorMessage(error, "Failed to update profile"),
      };
    }
  },

  /**
   * Update partner location
   */
  async updateLocation(
    latitude: number,
    longitude: number,
    metadata?: {
      accuracy?: number | null;
      mocked?: boolean | null;
      heading?: number | null;
    },
  ): Promise<ApiResponse<void>> {
    try {
      const response = await apiClient.post<ApiResponse<void>>(
        "/delivery-partners/location",
        { latitude, longitude, ...metadata },
      );
      return response;
    } catch (error: any) {
      console.error("Update location error:", error);
      return {
        success: false,
        message: getApiErrorMessage(error, "Failed to update location"),
      };
    }
  },

  /**
   * Toggle online/offline status
   */
  async toggleOnlineStatus(
    isOnline: boolean,
  ): Promise<ApiResponse<{ isActive: boolean }>> {
    try {
      const response = await apiClient.post<ApiResponse<{ isActive: boolean }>>(
        "/delivery-partners/toggle-status",
        { isActive: isOnline },
      );
      return response;
    } catch (error: any) {
      console.error("Toggle status error:", error);
      return {
        success: false,
        message: getApiErrorMessage(error, "Failed to toggle status"),
      };
    }
  },

  // ==================== ORDERS ====================

  /**
   * Get available orders for the delivery partner
   */
  async getAvailableOrders(): Promise<ApiResponse<any[]>> {
    try {
      const response = await apiClient.get<ApiResponse<any[]>>(
        "/delivery-partners/orders/available",
      );
      return response;
    } catch (error: any) {
      console.error("Get available orders error:", error);
      return {
        success: false,
        message: getApiErrorMessage(error, "Failed to get available orders"),
        data: [],
      };
    }
  },

  /**
   * Get assigned orders
   */
  async getAssignedOrders(): Promise<ApiResponse<any[]>> {
    try {
      const response = await apiClient.get<ApiResponse<any[]>>(
        "/delivery-partners/orders/assigned",
      );
      return response;
    } catch (error: any) {
      console.error("Get assigned orders error:", error);
      return {
        success: false,
        message: getApiErrorMessage(error, "Failed to get assigned orders"),
        data: [],
      };
    }
  },

  async getDeliveryRoutePlan(
    location?: { latitude: number; longitude: number },
  ): Promise<ApiResponse<any>> {
    try {
      const query = location
        ? `?latitude=${location.latitude}&longitude=${location.longitude}`
        : "";
      const response = await apiClient.get<ApiResponse<any>>(
        `/delivery-partners/orders/route-plan${query}`,
      );
      return response;
    } catch (error: any) {
      console.error("Get delivery route plan error:", error);
      return {
        success: false,
        message: getApiErrorMessage(error, "Failed to get delivery route plan"),
        data: null,
      };
    }
  },

  /**
   * Get order details by ID
   */
  async getOrderById(orderId: string): Promise<ApiResponse<any>> {
    try {
      const response = await apiClient.get<ApiResponse<any>>(
        `/delivery-partners/orders/${orderId}`,
      );
      return response;
    } catch (error: any) {
      console.error("Get order error:", error);
      return {
        success: false,
        message: getApiErrorMessage(error, "Failed to get order details"),
      };
    }
  },

  /**
   * Accept an order
   */
  async acceptOrder(orderId: string): Promise<ApiResponse<any>> {
    try {
      const response = await apiClient.post<ApiResponse<any>>(
        `/delivery-partners/orders/${orderId}/accept`,
      );
      return response;
    } catch (error: any) {
      console.error("Accept order error:", error);
      return {
        success: false,
        message: getApiErrorMessage(error, "Failed to accept order"),
      };
    }
  },

  /**
   * Reject/skip an order
   */
  async rejectOrder(orderId: string): Promise<ApiResponse<void>> {
    try {
      const response = await apiClient.post<ApiResponse<void>>(
        `/delivery-partners/orders/${orderId}/reject`,
      );
      return response;
    } catch (error: any) {
      console.error("Reject order error:", error);
      return {
        success: false,
        message: getApiErrorMessage(error, "Failed to reject order"),
      };
    }
  },

  /**
   * Get current active order
   */
  async getActiveOrder(): Promise<ApiResponse<any>> {
    try {
      const response = await apiClient.get<ApiResponse<any>>(
        "/delivery-partners/orders/active",
      );
      return response;
    } catch (error: any) {
      console.error("Get active order error:", error);
      return {
        success: false,
        message: getApiErrorMessage(error, "Failed to get active order"),
        data: null,
      };
    }
  },

  /**
   * Update order status
   */
  async updateOrderStatus(
    orderId: string,
    status: string,
    metadata?: {
      currentLocation?: { latitude: number; longitude: number };
      proofPhotoUrl?: string;
    },
  ): Promise<ApiResponse<void>> {
    try {
      const response = await apiClient.patch<ApiResponse<void>>(
        `/delivery-partners/orders/${orderId}/status`,
        { status, ...metadata },
      );
      return response;
    } catch (error: any) {
      console.error("Update order status error:", error);
      return {
        success: false,
        message: getApiErrorMessage(error, "Failed to update order status"),
      };
    }
  },

  async reportDeliveryDelay(
    orderId: string,
    reason: string,
  ): Promise<ApiResponse<void>> {
    try {
      const updatedEta = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      const response = await apiClient.post<ApiResponse<void>>(
        `/delivery-partners/orders/${orderId}/report-delay`,
        {
          reason,
          delayReason: reason,
          delayType: "RIDER_DELAY",
          updatedEta,
          significant: false,
        },
      );
      return response;
    } catch (error: any) {
      console.error("Report delivery delay error:", error);
      return {
        success: false,
        message: getApiErrorMessage(error, "Failed to report delivery delay"),
      };
    }
  },

  async requestOrderReassignment(
    orderId: string,
    reason: string,
  ): Promise<ApiResponse<void>> {
    try {
      const response = await apiClient.post<ApiResponse<void>>(
        `/delivery-partners/orders/${orderId}/request-reassignment`,
        {
          reason,
          delayReason: reason,
          delayType: "REASSIGNMENT_DELAY",
          significant: true,
        },
      );
      return response;
    } catch (error: any) {
      console.error("Request reassignment error:", error);
      return {
        success: false,
        message: getApiErrorMessage(error, "Failed to request reassignment"),
      };
    }
  },

  async confirmReturnedToRestaurant(orderId: string): Promise<ApiResponse<void>> {
    try {
      const response = await apiClient.post<ApiResponse<void>>(
        `/delivery-partners/orders/${orderId}/confirm-returned`,
      );
      return response;
    } catch (error: any) {
      console.error("Confirm returned error:", error);
      return {
        success: false,
        message: getApiErrorMessage(error, "Failed to confirm order return"),
      };
    }
  },

  /**
   * Get order history
   */
  async getOrderHistory(
    page: number = 1,
    limit: number = 20,
  ): Promise<ApiResponse<any[]>> {
    try {
      const response = await apiClient.get<ApiResponse<any[]>>(
        `/delivery-partners/orders/history?page=${page}&limit=${limit}`,
      );
      return response;
    } catch (error: any) {
      console.error("Get order history error:", error);
      return {
        success: false,
        message: getApiErrorMessage(error, "Failed to get order history"),
        data: [],
      };
    }
  },

  // ==================== EARNINGS ====================

  /**
   * Get earnings summary
   */
  async getEarnings(
    period: "today" | "week" | "month" = "today",
  ): Promise<ApiResponse<any>> {
    try {
      const response = await apiClient.get<ApiResponse<any>>(
        `/delivery-partners/earnings?period=${period}`,
      );
      return response;
    } catch (error: any) {
      console.error("Get earnings error:", error);
      return {
        success: false,
        message: getApiErrorMessage(error, "Failed to get earnings"),
        data: {
          today: 0,
          week: 0,
          month: 0,
        },
      };
    }
  },

  async requestPayoutWithdrawal(amount: number): Promise<ApiResponse<any>> {
    try {
      const response = await apiClient.post<ApiResponse<any>>(
        "/delivery-partners/payout/request",
        { amount },
      );
      return response;
    } catch (error: any) {
      console.error("Request payout withdrawal error:", error);
      return {
        success: false,
        message: getApiErrorMessage(error, "Failed to request withdrawal"),
      };
    }
  },

  async getPayoutLedger(
    period: DeliveryPayoutPeriod = "week",
  ): Promise<ApiResponse<DeliveryPayoutLedger>> {
    try {
      const response = await apiClient.get<ApiResponse<DeliveryPayoutLedger>>(
        `/delivery-partners/payouts/ledger?period=${period}`,
      );
      return response;
    } catch (error: any) {
      console.error("Get payout ledger error:", error);
      return {
        success: false,
        message: getApiErrorMessage(error, "Failed to get payout ledger"),
        data: {
          period: {
            label: period,
            start: new Date().toISOString(),
            end: new Date().toISOString(),
          },
          summary: {
            totalEarned: 0,
            periodEarned: 0,
            grossPayableAmount: 0,
            payableAmount: 0,
            paidAmount: 0,
            scheduledAmount: 0,
            deliveredOrders: 0,
            periodOrders: 0,
          },
          cash: {
            cashInHand: 0,
            totalCollected: 0,
            totalRemitted: 0,
            deliveredCashOrders: 0,
            remittances: [],
          },
          settlements: [],
          orders: [],
        },
      };
    }
  },

  /**
   * Get dashboard data
   */
  async getDashboardData(): Promise<ApiResponse<any>> {
    try {
      const response = await apiClient.get<ApiResponse<any>>(
        "/delivery-partners/dashboard",
      );
      return response;
    } catch (error: any) {
      console.error("Get dashboard data error:", error);
      return {
        success: false,
        message: getApiErrorMessage(error, "Failed to get dashboard data"),
        data: {
          earnings: { today: 0, week: 0, month: 0 },
          stats: { deliveriesToday: 0, shiftsCompleted: 0, activeOrders: 0 },
          onlineStatus: false,
        },
      };
    }
  },

  /**
   * Get user notifications
   */
  async getNotifications(
    page: number = 1,
    limit: number = 20,
  ): Promise<ApiResponse<any>> {
    try {
      const response = await apiClient.get<ApiResponse<any>>(
        `/notifications/user?page=${page}&limit=${limit}`,
      );
      return response;
    } catch (error: any) {
      console.error("Get notifications error:", error);
      return {
        success: false,
        message: getApiErrorMessage(error, "Failed to get notifications"),
        data: [],
      };
    }
  },

  // ==================== GOOGLE AUTHENTICATION ====================

  /**
   * Authenticate with Google
   * Sends Google user data to backend
   */
  async googleLogin(googleData: {
    googleId: string;
    email: string;
    name: string;
    picture?: string;
  }): Promise<LoginResponse> {
    try {
      const response = await apiClient.post<GoogleLoginApiResponse>(
        "/delivery-partners/auth/google",
        googleData,
      );

      // Store token if available
      if (response.data?.token) {
        await storeDeliveryPartnerToken(response.data.token);
      }

      return {
        success: response.success,
        message: response.message,
        data: {
          phone: response.data?.partner?.phone || "",
          deliveryPartnerId:
            response.data?.partner?.id || response.data?.partner?._id || "",
          token: response.data?.token || "",
          onboardingStatus:
            response.data?.partner?.onboardingStatus || "phone_verified",
          onboardingProgress:
            response.data?.onboardingProgress ||
            response.data?.partner?.onboardingProgress ||
            0,
          profileComplete:
            response.data?.partner?.onboardingStatus === "completed",
        },
      };
    } catch (error: any) {
      console.error("Google login error:", error);
      return {
        success: false,
        message: getApiErrorMessage(error, "Failed to authenticate with Google"),
      };
    }
  },

  // ==================== ACCOUNT MANAGEMENT ====================

  /**
   * Delete the current delivery partner account permanently
   */
  async deleteAccount(): Promise<ApiResponse<void>> {
    try {
      const response = await apiClient.delete<ApiResponse<void>>(
        "/delivery-partners/account",
      );
      // Clear token on successful deletion
      if (response.success) {
        await removeDeliveryPartnerToken();
      }
      return response;
    } catch (error: any) {
      console.error("Delete account error:", error);
      return {
        success: false,
        message: getApiErrorMessage(error, "Failed to delete account"),
      };
    }
  },

  // ==================== UTILITY ====================

  /**
   * Store authentication token
   */
  async storeToken(token: string): Promise<void> {
    await storeDeliveryPartnerToken(token);
  },

  /**
   * Get stored token
   */
  async getToken(): Promise<string | null> {
    return await getDeliveryPartnerToken();
  },

  /**
   * Remove stored token
   */
  async removeToken(): Promise<void> {
    await removeDeliveryPartnerToken();
  },

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    const token = await getDeliveryPartnerToken();
    return !!token;
  },

  // ==================== DELIVERY PARTNER WHATSAPP OTP ====================

  /**
   * Send OTP to delivery partner via WhatsApp
   * Uses WhatsApp Business API for OTP delivery
   */
  async sendDeliveryPartnerOtp(
    phoneNumber: string,
  ): Promise<ApiResponse<{ phone: string; expiresIn: number; otp?: string }>> {
    try {
      // Format phone number to E.164 format (+91XXXXXXXXXX)
      // Remove non-digits first, then ensure +91 prefix
      let phone = phoneNumber.replace(/\D/g, "");

      // If user entered 10 digits, add 91. If 12 (with 91), keep it.
      if (phone.length === 10) {
        phone = `91${phone}`;
      } else if (phone.length === 12 && phone.startsWith("91")) {
        // already has 91
      } else if (phone.startsWith("0")) {
        phone = `91${phone.substring(1)}`;
      }

      // Ensure + prefix
      const formattedPhone = `+${phone}`;

      const response = await apiClient.post<
        ApiResponse<{ phone: string; expiresIn: number; otp?: string }>
      >(
        "/delivery-partners/auth/send-otp",
        { phone: formattedPhone },
      );

      return response;
    } catch (error: any) {
      console.error("Send delivery partner OTP error:", error);
      throw error;
    }
  },

  /**
   * Verify delivery partner OTP
   * Returns JWT token and partner data on success
   */
  async verifyDeliveryPartnerOtp(
    phoneNumber: string,
    otp: string,
  ): Promise<LoginResponse> {
    try {
      // Format phone number to E.164 format (+91XXXXXXXXXX)
      let phone = phoneNumber.replace(/\D/g, "");

      if (phone.length === 10) {
        phone = `91${phone}`;
      } else if (phone.length === 12 && phone.startsWith("91")) {
        // already has 91
      } else if (phone.startsWith("0")) {
        phone = `91${phone.substring(1)}`;
      }

      const formattedPhone = `+${phone}`;

      const response = await apiClient.post<LoginResponse>(
        "/delivery-partners/auth/verify-otp",
        { phone: formattedPhone, otp },
      );

      // Store token if available
      if (response.data?.token) {
        await storeDeliveryPartnerToken(response.data.token);
      }

      return response;
    } catch (error: any) {
      console.error("Verify delivery partner OTP error:", error);
      throw error;
    }
  },

  // ==================== RAW HTTP HELPERS (for service modules) ====================

  async get<T = unknown>(url: string, config?: any): Promise<T> {
    return apiClient.get<T>(url, config);
  },

  async post<T = unknown>(url: string, data?: any, config?: any): Promise<T> {
    return apiClient.post<T>(url, data, config);
  },
};

export default ApiService;
