# KhaaoNow Delivery Partner App - API Integration

This document outlines the API integration between the KhaaoNow Delivery Partner mobile app and the KhaaoNow backend.

## 🔗 Backend Integration

The delivery partner app is now fully integrated with the KhaaoNow backend API (`https://khaaonow-be.azurewebsites.net/api`).

## 📁 Project Structure

### Services Layer

- **`services/api.ts`** - Main API service with axios client and all endpoint methods
- **`services/authService.ts`** - Firebase authentication service
- **`config/firebase.ts`** - Firebase configuration and initialization

### State Management (Zustand)

- **`store/auth.ts`** - Authentication state management
- **`store/partner.ts`** - Delivery partner profile and status management
- **`store/orders.ts`** - Order management and tracking

### Types

- **`types/index.ts`** - TypeScript interfaces for all data models

## 🔐 Authentication Flow

### Firebase Phone Authentication

1. User enters phone number
2. Firebase sends OTP
3. User enters OTP code
4. Firebase verifies OTP
5. Get Firebase ID token
6. Send token to backend via `/delivery-partners/auth/verify-phone-token`
7. Backend validates token and returns JWT
8. Store JWT for subsequent API calls

### Implementation

```typescript
import { AuthService } from "./services/authService";
import { ApiService } from "./services/api";

// Send OTP
await AuthService.sendOTP(phoneNumber);

// Verify OTP and authenticate
const result = await AuthService.completePhoneAuth(phoneNumber, otpCode);
```

## 📡 API Endpoints

### Authentication

- `POST /delivery-partners/auth/verify-phone-token` - Verify Firebase phone token
- `POST /delivery-partners/auth/google` - Google OAuth authentication

### Profile Management

- `POST /delivery-partners/profile/complete` - Complete delivery partner profile
- `POST /delivery-partners/documents/upload` - Upload KYC documents
- `POST /delivery-partners/bank-details` - Add bank account details
- `GET /delivery-partners/profile` - Get current partner profile

### Orders

- `GET /orders?status=pending` - Get available orders
- `GET /delivery-partners/orders/assigned` - Get assigned orders
- `POST /delivery-partners/orders/:id/accept` - Accept an order
- `PATCH /orders/:id/status` - Update order status
- `GET /delivery-partners/orders/history` - Get order history

### Location & Status

- `POST /delivery-partners/location` - Update current location
- `POST /delivery-partners/toggle-status` - Toggle online/offline status

### Earnings

- `GET /delivery-partners/earnings?period=today|week|month` - Get earnings
- `GET /delivery-partners/dashboard` - Get dashboard data

## 🎯 Registration/Onboarding Flow

The delivery partner registration follows these steps:

### 1. Phone Verification

```typescript
const response = await AuthService.sendOTP(phoneNumber);
const authResult = await AuthService.completePhoneAuth(phoneNumber, otp);
```

### 2. Complete Profile

```typescript
await ApiService.completeProfile({
  name: "John Doe",
  email: "john@example.com",
});
```

### 3. Upload Documents

```typescript
await ApiService.uploadDocuments({
  aadhaarNumber: "1234-5678-9012",
  panNumber: "ABCDE1234F",
  aadhaarPhoto: "base64_or_url",
  panPhoto: "base64_or_url",
  vehicleType: "bike",
  vehicleNumber: "DL01AB1234",
  rcPhoto: "base64_or_url",
  drivingLicenseNumber: "DL123456789",
  drivingLicensePhoto: "base64_or_url",
  profilePhoto: "base64_or_url",
});
```

### 4. Add Bank Details

```typescript
await ApiService.addBankDetails({
  bankAccountName: "John Doe",
  bankAccountNumber: "1234567890",
  bankIFSC: "SBIN0001234",
  bankAccountPhoto: "base64_or_url",
});
```

## 🏪 Store Usage Examples

### Auth Store

```typescript
import { useAuthStore } from "./store/auth";

// In component
const { isAuthenticated, partner, setAuthenticated, logout } = useAuthStore();

// After successful authentication
setAuthenticated(true, partnerId, phoneNumber, token);

// Get partner profile
await fetchProfile();

// Logout
await logout();
```

### Partner Store

```typescript
import { usePartnerStore } from "./store/partner";

// In component
const { isOnline, earnings, stats, toggleOnline, fetchDashboardData } =
  usePartnerStore();

// Toggle online status
await toggleOnline();

// Fetch dashboard data
await fetchDashboardData();

// Update location
await updateLocation(latitude, longitude);
```

### Orders Store

```typescript
import { useOrderStore } from "./store/orders";

// In component
const {
  activeOrder,
  availableOrders,
  acceptOrder,
  updateOrderStatus,
  fetchAvailableOrders,
} = useOrderStore();

// Get available orders
await fetchAvailableOrders();

// Accept an order
await acceptOrder(orderId);

// Update order status
await updateOrderStatus("picked_up");
```

## ⚙️ Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
# Firebase Configuration
EXPO_PUBLIC_FIREBASE_API_KEY=your-firebase-api-key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
EXPO_PUBLIC_FIREBASE_APP_ID=your-app-id

# API Configuration
EXPO_PUBLIC_API_URL=https://khaaonow-be.azurewebsites.net/api
```

## 🔄 API Response Format

All API responses follow this format:

```typescript
interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}
```

### Success Response

```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": { ... }
}
```

### Error Response

```json
{
  "success": false,
  "message": "Error message",
  "error": "Detailed error information"
}
```

## 🛡️ Error Handling

The API service includes comprehensive error handling:

```typescript
try {
  const response = await ApiService.completeProfile(data);

  if (response.success) {
    // Handle success
  } else {
    // Handle error
    console.error(response.message);
  }
} catch (error) {
  // Handle network or other errors
  console.error("API call failed:", error);
}
```

## 🔒 Token Management

The API service automatically handles JWT tokens:

1. Token is stored in AsyncStorage after authentication
2. Automatically included in all API requests via axios interceptor
3. Token is refreshed on 401 errors
4. Token is removed on logout

## 📱 Usage in Components

### Example: Login Screen

```typescript
import { AuthService } from "../services/authService";
import { useAuthStore } from "../store/auth";

const LoginScreen = () => {
  const { setAuthenticated } = useAuthStore();

  const handleLogin = async (phone: string, otp: string) => {
    try {
      const result = await AuthService.completePhoneAuth(phone, otp);

      if (result.success && result.data) {
        setAuthenticated(
          true,
          result.data.deliveryPartnerId,
          result.data.phone,
          result.data.token
        );

        // Navigate to home screen
      }
    } catch (error) {
      console.error("Login failed:", error);
    }
  };
};
```

### Example: Dashboard Screen

```typescript
import { useEffect } from "react";
import { usePartnerStore } from "../store/partner";
import { useOrderStore } from "../store/orders";

const DashboardScreen = () => {
  const { isOnline, earnings, stats, fetchDashboardData } = usePartnerStore();
  const { activeOrder, fetchAssignedOrders } = useOrderStore();

  useEffect(() => {
    fetchDashboardData();
    fetchAssignedOrders();
  }, []);

  // Render dashboard UI
};
```

## 🚀 Next Steps

1. **Configure Firebase** - Add your Firebase project credentials to `.env`
2. **Test Authentication** - Verify phone authentication flow
3. **Test Order Flow** - Accept and complete test orders
4. **Implement Real-time Updates** - Add WebSocket/Firebase Cloud Messaging for order notifications
5. **Add Location Tracking** - Implement continuous location updates during delivery
6. **Error Handling UI** - Add user-friendly error messages and retry mechanisms

## 📝 Notes

- All endpoints require authentication except `/auth/verify-phone-token` and `/auth/google`
- JWT token expires after 7 days (configurable in backend)
- Phone numbers should be in E.164 format (+91xxxxxxxxxx)
- File uploads should be base64 encoded or URLs to cloud storage
- Location updates should be sent every 10-30 seconds when online

## 🐛 Troubleshooting

### Token Expired Error

- The JWT token has expired
- User needs to re-authenticate
- Auto-logout is triggered by the API service

### Firebase Error

- Check Firebase configuration in `.env`
- Verify Firebase project settings
- Ensure phone authentication is enabled in Firebase Console

### Network Error

- Check API base URL
- Verify internet connection
- Check backend server status

## 📞 API Reference

For detailed API documentation, refer to the backend repository or Postman collection.
