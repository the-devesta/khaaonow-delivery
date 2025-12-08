# Khaaonow Delivery Partner App 🚴

The official delivery partner application for Khaaonow - empowering delivery partners to manage orders, track deliveries, and maximize earnings.

## Features ✨

- **📦 Order Management**: View and accept available delivery orders in real-time
- **💰 Earnings Dashboard**: Track daily, weekly, and monthly earnings with detailed breakdowns
- **📊 Performance Metrics**: Monitor your delivery stats, ratings, and completion streaks
- **🎯 Smart Matching**: Get matched with nearby orders based on your location
- **📍 Real-time Tracking**: GPS-enabled order tracking and navigation
- **👤 Profile Management**: Manage your profile, documents, and verification status
- **🌙 Dark Mode**: Full dark mode support for comfortable viewing

## Tech Stack

- **Framework**: React Native with Expo
- **Language**: TypeScript
- **Navigation**: Expo Router (file-based routing)
- **Styling**: NativeWind (Tailwind CSS for React Native)
- **UI Components**: Custom themed components with SF Symbols icons

## Getting Started 🚀

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Expo Go app (for testing on physical device)
- Android Studio or Xcode (for emulator testing)

### Installation

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the development server

   ```bash
   npx expo start
   ```

3. Run on your preferred platform:
   - Press `a` for Android emulator
   - Press `i` for iOS simulator
   - Scan QR code with Expo Go app for physical device

## App Structure 📁

```
app/
├── (tabs)/              # Tab navigation screens
│   ├── index.tsx       # Orders screen (Home)
│   └── explore.tsx     # Earnings screen
├── _layout.tsx         # Root layout with navigation setup
├── modal.tsx           # Profile/Settings modal
└── splash.tsx          # App splash screen
```

## Key Screens 📱

### Orders Screen

- View all available orders
- Online/Offline status toggle
- Quick stats (deliveries & earnings today)
- Order details with distance, items, and payment info
- Accept order functionality

### Earnings Screen

- Weekly earnings summary
- Daily earnings breakdown
- Performance metrics (rating, avg time, streak)
- Withdraw earnings option
- Detailed delivery history

### Profile Modal

- Personal information
- Document verification status
- Performance statistics
- App settings
- Help & support access

## Development 💻

### Scripts

- `npm start` - Start Expo development server
- `npm run android` - Run on Android
- `npm run ios` - Run on iOS
- `npm run web` - Run on web browser
- `npm run lint` - Run ESLint

### Customization

The app uses a themed approach with support for light and dark modes. You can customize:

- Colors in `constants/theme.ts`
- Tailwind styles in `tailwind.config.js`
- Component themes in `components/themed-*` files

## Contributing 🤝

This is the delivery partner app for Khaaonow food delivery platform. For contributions or issues, please contact the development team.

## License

© 2025 Khaaonow. All rights reserved.
