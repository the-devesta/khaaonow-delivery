/**
 * Firebase Configuration - Unified for Expo Go and Native Builds
 *
 * This module provides a unified Firebase auth interface that works in both:
 * - Expo Go: Uses Firebase JS SDK (web) with test phone numbers
 * - Development/Production Builds: Uses @react-native-firebase (native) for real SMS
 *
 * IMPORTANT: For Expo Go testing, use Firebase test phone numbers configured in Firebase Console
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { FirebaseApp, getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, initializeAuth } from "firebase/auth";
// @ts-ignore
import { getReactNativePersistence } from "firebase/auth";
import { getStorage } from "firebase/storage";

// Firebase configuration
export const firebaseConfig = {
  apiKey: "AIzaSyAkfD1D3ErwApNq2aPouuPpfElyH-CI6Fg",
  authDomain: "khaaonow-91e55.firebaseapp.com",
  projectId: "khaaonow-91e55",
  storageBucket: "khaaonow-91e55.firebasestorage.app",
  messagingSenderId: "665067279336",
  appId: "1:665067279336:android:e9f6d045f5d2e5706b8a5d",
};

// Check if running in Expo Go
export const isExpoGo = Constants.appOwnership === "expo";

// Initialize Firebase app (singleton)
let app: FirebaseApp;
let auth: any;

if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);

  // Initialize Auth with AsyncStorage persistence for React Native
  try {
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage as any),
    });
    console.log("✅ Firebase Auth initialized with AsyncStorage persistence");
  } catch (error) {
    // If already initialized, get the existing instance
    auth = getAuth(app);
    console.log("ℹ️ Using existing Firebase Auth instance");
  }
} else {
  app = getApp();
  auth = getAuth(app);
}

// Export auth instance
export { auth };

// Initialize and export Storage
export const storage = getStorage(app);

// Export types for use in hooks
export type { ConfirmationResult } from "firebase/auth";

// Helper function for native Firebase import (only used in native builds)
let nativeAuth: any = null;

export const getNativeAuth = async () => {
  if (isExpoGo) {
    throw new Error("Native Firebase not available in Expo Go");
  }

  if (!nativeAuth) {
    try {
      const firebaseAuth = await import("@react-native-firebase/auth");
      nativeAuth = firebaseAuth.default;
    } catch (e) {
      console.warn("Native Firebase auth not available:", e);
      throw e;
    }
  }

  return nativeAuth;
};

console.log(
  "🔥 Firebase initialized:",
  isExpoGo ? "Expo Go (JS SDK)" : "Native Build",
);
