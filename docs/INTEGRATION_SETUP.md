# KhaaoNow Delivery Partner App - Setup & Integration Guide

## 🎯 Overview

This guide provides complete setup instructions for integrating the KhaaoNow Delivery Partner mobile app with the backend API.

## ✅ What Has Been Integrated

### 1. **API Service Layer** (`services/api.ts`)

- Complete axios-based HTTP client
- Automatic JWT token management
- Request/response interceptors
- All delivery partner endpoints integrated:
  - Authentication (Firebase phone verification)
  - Profile management
  - Document upload
  - Bank details
  - Order management
  - Location tracking
  - Earnings and dashboard

### 2. **Firebase Authentication** (`services/authService.ts`)

- Phone authentication with OTP
- Firebase configuration (`config/firebase.ts`)
- Seamless backend integration

### 3. **State Management** (Zustand stores)

- **`store/auth.ts`** - Authentication & partner profile
- **`store/partner.ts`** - Partner status, earnings, dashboard
- **`store/orders.ts`** - Order management & tracking

### 4. **Type Definitions** (`types/index.ts`)

- Complete TypeScript interfaces
- Type safety across the app

### 5. **Utilities**

- **`utils/errorHandler.ts`** - Comprehensive error handling
- **`utils/locationHelper.ts`** - Location services
- **`constants/api.ts`** - API configuration & constants

## 🚀 Setup Instructions

### Step 1: Install Dependencies

```bash
cd khaaonow-delivery
npm install
```

New dependencies added:

- `firebase` - Firebase SDK for authentication
- `expo-location` - Location services
- All other required packages are already configured

### Step 2: Configure Firebase

1. **Create a Firebase Project**

   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Create a new project or use existing one
   - Enable Phone Authentication in Authentication > Sign-in method

2. **Get Firebase Configuration**

   - Go to Project Settings > General
   - Add a web app
   - Copy the configuration

3. **Create `.env` file**

   ```bash
   cp .env.example .env
   ```

4. **Update `.env` with your credentials**

   ```env
   # Firebase Configuration
   EXPO_PUBLIC_FIREBASE_API_KEY=AIzaSy...
   EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   EXPO_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
   EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
   EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
   EXPO_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123

   # API Configuration
   EXPO_PUBLIC_API_URL=https://khaaonow-be.azurewebsites.net/api
   ```

### Step 3: Configure Backend

Ensure the backend (khaaonow-be) has:

1. **Firebase Admin SDK configured** (already done)

   - Check `src/config/firebase.ts`
   - Verify environment variables

2. **Delivery Partner routes enabled** (already done)

   - Routes in `src/routes/deliveryPartnerRoutes.ts`
   - Controllers in `src/controllers/deliveryPartnerAuthController.ts` and `deliveryPartnerController.ts`

3. **CORS configured for mobile app**
   - Should allow requests from the mobile app

### Step 4: Run the App

```bash
# Start Expo development server
npm start

# Run on Android
npm run android

# Run on iOS
npm run ios

# Run on web
npm run web
```

## 📱 Using the Integrated APIs

### Authentication Flow

```typescript
import { AuthService } from "./services/authService";
import { useAuthStore } from "./store/auth";

// In your login component
const { setAuthenticated } = useAuthStore();

// Step 1: Send OTP
const handleSendOTP = async (phoneNumber: string) => {
  const result = await AuthService.sendOTP(phoneNumber);
  if (result.success) {
    // Show OTP input screen
  }
};

// Step 2: Verify OTP & Authenticate
const handleVerifyOTP = async (phoneNumber: string, otp: string) => {
  const result = await AuthService.completePhoneAuth(phoneNumber, otp);

  if (result.success && result.data) {
    // Update auth store
    setAuthenticated(
      true,
      result.data.deliveryPartnerId,
      result.data.phone,
      result.data.token
    );

    // Navigate to appropriate screen based on onboarding status
    if (result.data.onboardingStatus === "completed") {
      // Go to dashboard
    } else {
      // Continue registration
    }
  }
};
```

### Profile Management

```typescript
import { ApiService } from "./services/api";
import { useAuthStore } from "./store/auth";

const { partner, updateProfile } = useAuthStore();

// Complete profile
const completeProfile = async (data: { name: string; email: string }) => {
  const response = await ApiService.completeProfile(data);

  if (response.success && response.data) {
    updateProfile(response.data.partner);
  }
};

// Upload documents
const uploadDocuments = async (documents: DocumentsData) => {
  const response = await ApiService.uploadDocuments(documents);

  if (response.success && response.data) {
    updateProfile(response.data.partner);
  }
};

// Add bank details
const addBankDetails = async (bankData: BankDetailsData) => {
  const response = await ApiService.addBankDetails(bankData);

  if (response.success && response.data) {
    updateProfile(response.data.partner);
  }
};
```

### Order Management

```typescript
import { useOrderStore } from "./store/orders";

const {
  activeOrder,
  availableOrders,
  fetchAvailableOrders,
  acceptOrder,
  updateOrderStatus,
} = useOrderStore();

// Fetch available orders
useEffect(() => {
  fetchAvailableOrders();

  const interval = setInterval(fetchAvailableOrders, 30000); // Every 30 seconds
  return () => clearInterval(interval);
}, []);

// Accept an order
const handleAcceptOrder = async (orderId: string) => {
  await acceptOrder(orderId);
};

// Update order status
const handlePickup = async () => {
  await updateOrderStatus("picked_up");
};

const handleDeliver = async () => {
  await updateOrderStatus("delivered");
};
```

### Partner Status & Location

```typescript
import { usePartnerStore } from "./store/partner";
import { locationHelper } from "./utils/locationHelper";

const { isOnline, toggleOnline, fetchDashboardData, updateLocation } =
  usePartnerStore();

// Toggle online/offline
const handleToggleOnline = async () => {
  await toggleOnline();
};

// Update location continuously
useEffect(() => {
  let locationSubscription: any;

  const startLocationTracking = async () => {
    locationSubscription = await locationHelper.watchLocation(
      (location) => {
        updateLocation(location.latitude, location.longitude);
      },
      15000 // Update every 15 seconds
    );
  };

  if (isOnline) {
    startLocationTracking();
  }

  return () => {
    if (locationSubscription) {
      locationSubscription.remove();
    }
  };
}, [isOnline]);

// Fetch dashboard data
useEffect(() => {
  fetchDashboardData();

  const interval = setInterval(fetchDashboardData, 60000); // Every minute
  return () => clearInterval(interval);
}, []);
```

### Earnings

```typescript
import { usePartnerStore } from "./store/partner";

const { earnings, fetchEarnings } = usePartnerStore();

// Fetch today's earnings
useEffect(() => {
  fetchEarnings("today");
}, []);

// Fetch weekly earnings
const handleWeeklyView = () => {
  fetchEarnings("week");
};

// Fetch monthly earnings
const handleMonthlyView = () => {
  fetchEarnings("month");
};
```

## 🔧 Key Files & Their Purpose

### Services

| File                      | Purpose                            |
| ------------------------- | ---------------------------------- |
| `services/api.ts`         | Main API client with all endpoints |
| `services/authService.ts` | Firebase authentication service    |
| `config/firebase.ts`      | Firebase initialization            |

### State Management

| File               | Purpose                                   |
| ------------------ | ----------------------------------------- |
| `store/auth.ts`    | Authentication & partner profile state    |
| `store/partner.ts` | Partner status, earnings, dashboard state |
| `store/orders.ts`  | Order management state                    |

### Utilities

| File                      | Purpose                          |
| ------------------------- | -------------------------------- |
| `utils/errorHandler.ts`   | API error parsing & handling     |
| `utils/locationHelper.ts` | Location services & calculations |
| `constants/api.ts`        | API constants & configuration    |

### Types

| File             | Purpose                              |
| ---------------- | ------------------------------------ |
| `types/index.ts` | TypeScript interfaces for all models |

## 🔐 Security Notes

1. **Never commit `.env` file** - It contains sensitive credentials
2. **Token Storage** - JWT tokens are securely stored in AsyncStorage
3. **Auto Logout** - Expired tokens trigger automatic logout
4. **HTTPS Only** - All API calls use HTTPS

## 🐛 Troubleshooting

### Issue: "Network Error"

**Solution:**

- Check internet connection
- Verify API_URL in `.env`
- Ensure backend is running

### Issue: "Invalid Firebase Configuration"

**Solution:**

- Verify all Firebase env variables are set correctly
- Check Firebase Console for correct values
- Ensure phone authentication is enabled

### Issue: "Token Expired"

**Solution:**

- User needs to re-login
- App automatically triggers logout on 401 errors

### Issue: "Location Permission Denied"

**Solution:**

- Request permissions in app settings
- Use `locationHelper.requestLocationPermission()`

## 📊 Testing Checklist

- [ ] Phone authentication works
- [ ] OTP is received and verified
- [ ] Profile completion saves correctly
- [ ] Document upload works
- [ ] Bank details are saved
- [ ] Orders are fetched from backend
- [ ] Order acceptance works
- [ ] Order status updates work
- [ ] Location updates are sent
- [ ] Online/offline toggle works
- [ ] Earnings are displayed correctly
- [ ] Dashboard data loads

## 🚦 Next Steps

1. **Test Authentication**

   - Try registering a new delivery partner
   - Complete the onboarding flow

2. **Test Order Flow**

   - Create test orders in backend
   - Accept and complete orders

3. **Test Location**

   - Enable location services
   - Verify location updates are sent to backend

4. **Add Real-time Features**

   - Implement WebSocket for order notifications
   - Add Firebase Cloud Messaging for push notifications

5. **UI Enhancements**
   - Add loading states
   - Add error messages
   - Improve user feedback

## 📞 Support

For issues or questions:

- Check the [API Integration Documentation](./API_INTEGRATION.md)
- Review backend API routes in `khaaonow-be/src/routes/deliveryPartnerRoutes.ts`
- Check Firebase Console for authentication issues

## 📝 Summary

The khaaonow-delivery app is now fully integrated with the khaaonow-be backend. All API endpoints are implemented, authentication is configured, and state management is in place. Follow the setup instructions above to get started with development and testing.
