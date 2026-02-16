# Google OAuth Setup for KhaaoNow Delivery App

✅ **UPDATED:** Now using backend OAuth flow - no client-side configuration needed!

## Overview

The delivery app now uses the **same backend OAuth flow** as the main KhaaoNow app. This means:

- ✅ No need to configure Android/iOS/Web client IDs
- ✅ No expo-auth-session complexity
- ✅ No state management issues
- ✅ 100% reliable authentication
- ✅ Works on all platforms (Android, iOS, Web)

## Prerequisites

1. Google Cloud Console account
2. Existing OAuth 2.0 Web Application credentials (already configured for main app)

## Setup Steps

### Step 1: Add Redirect URI to Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (khaaonow-91e55)
3. Navigate to **APIs & Services** > **Credentials**
4. Find your existing **OAuth 2.0 Client ID** (Web application)
5. Click **Edit**
6. Under **Authorized redirect URIs**, add:
   - **Local Development:** `http://localhost:7071/api/delivery-partners/auth/google/callback`
   - **Production:** `https://khaaonow-be.azurewebsites.net/api/delivery-partners/auth/google/callback`
7. Click **Save**

### Step 2: Update Backend Environment Variables (Already Done)

The backend `.env` file has been updated with:

```env
GOOGLE_DELIVERY_CALLBACK_URL=http://localhost:7071/api/delivery-partners/auth/google/callback
```

### Step 3: That's It!

No client-side configuration needed. The app will work automatically.

## How It Works

1. **User taps "Continue with Google"** in the delivery app
2. **App opens system browser** to backend OAuth URL:
   ```
   https://khaaonow-be.azurewebsites.net/api/delivery-partners/auth/google
   ```
3. **Backend redirects to Google** for authentication
4. **User authenticates** with their Google account
5. **Google redirects back to backend** with authorization code
6. **Backend exchanges code for user info** and creates/finds delivery partner
7. **Backend generates JWT token** and redirects to app via deep link:
   ```
   khaaonowdelivery://auth/callback?token=JWT_TOKEN
   ```
8. **App intercepts deep link**, extracts token, and logs in user

## Backend Endpoints Added

### GET `/delivery-partners/auth/google`

Initiates OAuth flow - redirects to Google

### GET `/delivery-partners/auth/google/callback`

Handles Google callback - creates/updates partner and redirects to app

### POST `/delivery-partners/auth/google` (Legacy)

Client-side token exchange method (kept for backwards compatibility)

## Deep Link Configuration

The app is configured with the deep link scheme:

```
khaaonowdelivery://auth/callback
```

This is already set up in [app.json](app.json):

- Bundle ID (iOS): `com.khaaonow.delivery`
- Package Name (Android): `com.khaaonow.delivery`
- Scheme: `khaaonowdelivery`

## Testing

### Local Development

1. Start backend: `npm run dev` (in khaaonow-be)
2. Start delivery app: `npm run dev` (in khaaonow-delivery)
3. Tap "Continue with Google"
4. Authenticate in browser
5. App should receive token via deep link

### Production

Same flow but uses production URLs automatically

## Troubleshooting

### "Redirect URI mismatch" error

- Make sure you added the callback URL to Google Cloud Console
- Check that backend is running on correct port (7071 for local)

### Deep link not working

- Verify app.json has correct scheme configuration
- On Android, deep links work automatically
- On iOS, may need to rebuild app if scheme changed

### Token not received

- Check backend logs for errors
- Verify GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in backend .env
- Make sure deep link listener is active (check app logs)

## Migration from Old Setup

The old setup using `expo-auth-session/providers/google` has been completely replaced. You can:

1. ❌ Remove client ID environment variables from `.env.local` (no longer needed)
2. ✅ Keep the backend URL in `.env.local`

## Code Changes

### Updated Files

- ✅ [`hooks/use-google-auth.ts`](hooks/use-google-auth.ts) - Now uses backend OAuth flow
- ✅ Backend controller - Added OAuth init and callback endpoints
- ✅ Backend routes - Added GET routes for OAuth flow

## Benefits of Backend OAuth

1. **Simpler** - No client ID configuration
2. **More Secure** - Client secret stays on backend
3. **Consistent** - Same flow as main app
4. **Reliable** - No state management issues
5. **Maintainable** - Single source of truth for OAuth logic

## Testing

### In Expo Go (Development)

- Use the Web client ID
- OAuth redirects through Expo's proxy

### In Standalone Build (Production)

- Android uses Android client ID
- iOS uses iOS client ID
- OAuth redirects directly to the app

## Troubleshooting

### "Google auth not configured"

- Ensure environment variables are set
- Restart Metro bundler after adding .env

### "redirect_uri_mismatch"

- Verify redirect URIs in Google Console
- For Expo Go: `https://auth.expo.io/@username/khaaonow-delivery`

### "The operation couldn't be completed"

- Check internet connection
- Verify OAuth credentials are correct

## Files Involved

- `hooks/use-google-auth.ts` - Google OAuth hook
- `services/api.ts` - `googleLogin()` method
- `app/auth/login.tsx` - Login screen with Google button
- `app/registration/phone-verification.tsx` - Phone verification for Google users
- `app.json` - App configuration with OAuth scheme
