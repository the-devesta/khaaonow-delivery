# Create APK - Quick Reference

## 📱 Build Production APK (Production Backend)

Build an APK that connects to the production backend at `https://khaaonow-be.azurewebsites.net/api`:

```bash
eas build --platform android --profile production
```

Download the APK from the Expo dashboard after build completes.

---

## 🔧 Build Development APK (Local Backend)

Build an APK that connects to your local backend (useful for testing):

```bash
eas build --platform android --profile production-local
```

**Note:** Make sure your local backend is running with `func start` in the backend directory.

---

## 🚀 Quick Local Test (No Build Needed)

Test on a real device without building an APK:

### Option 1: Using Environment Variable

1. Create/edit `.env.local` file:

   ```
   EXPO_PUBLIC_API_URL=http://10.176.171.122:7071/api
   ```

2. Start Expo:

   ```bash
   npx expo start
   ```

3. Scan QR code with Expo Go app

### Option 2: Default DEV Mode

The app automatically uses `http://10.176.171.122:7071/api` in development mode.

Just run:

```bash
npx expo start
```

---

## 🌐 Change Backend URL

### For Local Development:

Edit `services/api.ts` line 23:

```typescript
const localUrl = "http://YOUR_IP:7071/api";
```

Or create `.env.local`:

```
EXPO_PUBLIC_API_URL=http://YOUR_IP:7071/api
```

### For Production Build:

Edit `eas.json` production profile:

```json
"env": {
  "EXPO_PUBLIC_API_URL": "https://your-backend-url.com/api"
}
```

---

## ✅ Test Backend Connectivity

1. Make sure backend is running:

   ```bash
   cd c:\Users\Shivam\khaaonow-be
   func start
   ```

2. Check your IP address:

   ```bash
   ipconfig
   ```

   Look for "IPv4 Address" under "Wireless LAN adapter Wi-Fi"

3. Test API endpoint in browser:
   ```
   http://YOUR_IP:7071/api/delivery-partners/auth/verify-phone-token
   ```

---

## 🏗️ Build Profiles

| Profile            | Backend URL                                 | Use Case                   |
| ------------------ | ------------------------------------------- | -------------------------- |
| `production`       | `https://khaaonow-be.azurewebsites.net/api` | Final release APK          |
| `production-local` | `http://10.176.171.122:7071/api`            | Testing with local backend |
| `preview`          | Current env or production                   | Quick internal test        |

---

## 🐛 Troubleshooting

### Can't connect to local backend from real device:

1. **Check IP address** - Your IP might have changed. Run `ipconfig` and update:

   - `services/api.ts` line 23
   - `eas.json` production-local profile
   - `.env.local` file

2. **Check firewall** - Windows Firewall might block connections. Allow Node.js:

   ```
   Control Panel → Windows Defender Firewall → Allow an app
   ```

3. **Same network** - Device and computer must be on same Wi-Fi

### App still uses old URL:

1. Stop Expo dev server
2. Clear cache: `npx expo start -c`
3. Reload app completely

### Build fails:

1. Make sure you're logged in: `eas login`
2. Check `eas.json` is valid JSON
3. Try without `--local` flag (cloud build)
