import { Alert, Linking } from "react-native";

export function toCallablePhoneUrl(phone?: string | null) {
  if (!phone) return null;

  const trimmed = phone.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("+")) {
    const normalized = `+${trimmed.slice(1).replace(/\D/g, "")}`;
    return normalized.length > 1 ? `tel:${normalized}` : null;
  }

  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;

  const normalized =
    digits.length === 10 ? `+91${digits}` : digits.startsWith("91") ? `+${digits}` : digits;

  return `tel:${normalized}`;
}

export async function openPhoneDialer(phone?: string | null) {
  const url = toCallablePhoneUrl(phone);
  if (!url) {
    Alert.alert("Call unavailable", "No phone number is available for this contact.");
    return false;
  }

  // Deliberately skip Linking.canOpenURL() here. On Android 11+, querying a
  // tel: URL requires the app to declare package-visibility <queries> for
  // it — without that (or with some OEM dialers), canOpenURL() returns a
  // false negative even though a real dialer exists, which is exactly the
  // "sometimes doesn't work" symptom this fixes. Attempt the open directly
  // and only report failure if it genuinely throws.
  try {
    await Linking.openURL(url);
    return true;
  } catch (error) {
    console.warn("[openPhoneDialer] Linking.openURL failed:", error);
    Alert.alert(
      "Call unavailable",
      "Could not open the dialer. Long-press the number to copy it and dial manually.",
    );
    return false;
  }
}
