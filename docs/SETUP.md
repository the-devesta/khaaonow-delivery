# KhaoNow Delivery Partner App - Setup Instructions

## Project Structure

```
khaaonow-delivery/
├── app/
│   ├── index.tsx                    # Entry point (redirects to login or home)
│   ├── auth/
│   │   ├── login.tsx               # Phone number login
│   │   └── otp.tsx                 # OTP verification
│   ├── registration/
│   │   ├── basic-details.tsx       # Step 1: Name & Email
│   │   ├── kyc-documents.tsx       # Step 2: Aadhaar & PAN
│   │   ├── vehicle-details.tsx     # Step 3: Vehicle info
│   │   ├── profile-photo.tsx       # Step 4: Profile picture
│   │   ├── review-submit.tsx       # Step 5: Review all data
│   │   └── account-pending.tsx     # Pending approval screen
│   └── (tabs)/
│       ├── _layout.tsx             # Tab navigation layout
│       └── index.tsx               # Home/Dashboard screen
├── components/ui/
│   ├── primary-button.tsx          # Reusable button component
│   ├── input-field.tsx             # Text input with validation
│   ├── card-container.tsx          # White rounded card wrapper
│   ├── progress-header.tsx         # Registration progress bar
│   ├── document-uploader.tsx       # Image picker for documents
│   ├── section-title.tsx           # Section heading text
│   └── toggle-online-switch.tsx    # Online/Offline switch
├── constants/
│   └── colors.ts                   # Theme colors and styling
├── services/
│   └── api.ts                      # Mock API service
└── utils/
    └── validations.ts              # Formik/Yup schemas
```

## Theme Colors

- **Primary Orange**: `#FF6A00`
- **Primary Dark**: `#E45700`
- **Text Dark**: `#1A1A1A`
- **Text Light**: `#7A7A7A`
- **Background**: `#FFFFFF`
- **Card Background**: `#F8F8F8`

## Installation & Setup

### 1. Install Dependencies

```powershell
npm install
```

### 2. Start Development Server

```powershell
npx expo start
```

### 3. Run on Device/Emulator

**iOS:**

```powershell
npx expo start --ios
```

**Android:**

```powershell
npx expo start --android
```

**Web (for testing):**

```powershell
npx expo start --web
```

## Testing the App

### Login Flow

1. Start at login screen (auto-loads on first run)
2. Enter any 10-digit phone number
3. Enter any 6-digit OTP
4. If phone exists in mock DB → Home screen
5. If new user → Registration flow

### Mock Phone Numbers

- `9876543210` - Existing user (goes to Home)
- Any other number - New user (goes to Registration)

### Registration Flow

1. **Basic Details**: Enter name & email
2. **KYC Documents**: Upload Aadhaar & PAN (+ photos)
3. **Vehicle Details**: Select vehicle type, enter number & DL
4. **Profile Photo**: Upload profile picture
5. **Review & Submit**: Verify all info
6. **Account Pending**: Wait for approval (demo only)

## Key Features Implemented

### Authentication

- Phone-based login with OTP
- Auto-redirect based on user status
- Mock backend integration

### Registration (5-Step Flow)

- Progressive form with validation
- Document upload with camera/gallery
- Live progress indicator
- Review page before submission

### Home/Dashboard

- Online/Offline toggle switch
- Real-time earnings display (Today/Week/Month)
- Delivery stats cards
- Active order tracking card
- Quick action buttons

### Reusable Components

- Themed button variants (primary/secondary/outline)
- Custom input fields with icons & errors
- Shadow-styled card containers
- Document uploader with preview
- Progress bar for multi-step forms

## Customization

### Change Theme Colors

Edit `constants/colors.ts`:

```typescript
export const Colors = {
  primary: "#FF6A00", // Change primary orange
  primaryDark: "#E45700", // Change hover state
  // ... etc
};
```

### Modify Validation Rules

Edit `utils/validations.ts`:

```typescript
export const phoneValidation = Yup.string()
  .matches(/^[0-9]{10}$/, "Phone must be 10 digits")
  .required("Required");
```

### Connect to Real Backend

Replace mock API calls in `services/api.ts` with actual endpoints:

```typescript
export const ApiService = {
  async sendOtp(phoneNumber: string) {
    const response = await fetch("https://api.yourdomain.com/auth/send-otp", {
      method: "POST",
      body: JSON.stringify({ phoneNumber }),
    });
    return response.json();
  },
  // ... etc
};
```

## File Navigation

| Route                           | Screen                    |
| ------------------------------- | ------------------------- |
| `/`                             | Redirect to login or home |
| `/auth/login`                   | Login with phone          |
| `/auth/otp`                     | OTP verification          |
| `/registration/basic-details`   | Registration Step 1       |
| `/registration/kyc-documents`   | Registration Step 2       |
| `/registration/vehicle-details` | Registration Step 3       |
| `/registration/profile-photo`   | Registration Step 4       |
| `/registration/review-submit`   | Registration Step 5       |
| `/registration/account-pending` | Approval pending          |
| `/(tabs)`                       | Home dashboard            |

## Form Validation Rules

- **Phone**: 10 digits only
- **OTP**: 6 digits only
- **Name**: Min 3 characters
- **Email**: Valid email format
- **Aadhaar**: 12 digits
- **PAN**: Format `ABCDE1234F`
- **Vehicle Number**: Format `KA01AB1234`
- **Driving License**: Min 8 characters

## Notes

- All styling uses NativeWind (Tailwind CSS)
- Forms use Formik + Yup for validation
- Image uploads use Expo Image Picker
- Navigation uses Expo Router (file-based)
- Mock API simulates 300-1500ms delays
- All screens follow the orange/white theme

## Next Steps (Production)

1. Replace mock API with real backend
2. Add authentication state management (Context/Zustand)
3. Implement AsyncStorage for persistent login
4. Add error handling & loading states
5. Setup push notifications for orders
6. Add map integration for deliveries
7. Implement biometric authentication
8. Add analytics tracking

## Troubleshooting

**Metro bundler issues:**

```powershell
npx expo start -c
```

**Clear cache:**

```powershell
rm -rf node_modules; npm install
```

**iOS simulator not opening:**

```powershell
npx expo run:ios
```

**Android build errors:**

```powershell
cd android; ./gradlew clean; cd ..; npx expo run:android
```

---

**Built with:** React Native (Expo) + NativeWind + Formik + Expo Router
