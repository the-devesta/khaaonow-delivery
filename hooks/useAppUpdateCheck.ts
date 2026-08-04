import { useCallback, useState } from "react";
import {
  AppUpdateCheckResult,
  checkForAppUpdate,
  getCurrentAppVersion,
} from "@/services/appUpdateService";

export function useAppUpdateCheck() {
  const [result, setResult] = useState<AppUpdateCheckResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const check = useCallback(async () => {
    setChecking(true);
    setError(null);
    try {
      const data = await checkForAppUpdate();
      setResult(data);
      return data;
    } catch (err: any) {
      // Fail open — never block app usage because the update-check itself
      // failed (network hiccup, backend hiccup, etc.).
      setError(err?.message || "Failed to check for update");
      return null;
    } finally {
      setChecking(false);
    }
  }, []);

  return {
    result,
    checking,
    error,
    check,
    currentVersion: getCurrentAppVersion(),
  };
}
