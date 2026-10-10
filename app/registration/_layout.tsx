import { ApiService } from "@/services/api";
import { OnboardingStatus, useAuthStore } from "@/store/auth";
import { Stack, usePathname, useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { signupEdit } from "@/utils/signupEdit";

const normalizeStatus = (status?: string | null) =>
  status ? status.toLowerCase() : null;

const getPartnerFromProfileResponse = (data: unknown) => {
  const payload = data as { partner?: unknown } | null;
  return (payload?.partner || data) as {
    isApproved?: boolean;
    onboardingStatus?: string;
    onboardingProgress?: number;
    name?: string;
    email?: string;
  } | null;
};

const getCompletedPartnerRoute = (
  partner: ReturnType<typeof getPartnerFromProfileResponse>,
) => {
  if (!partner) return null;
  // The rider chose to edit their details from the review screen.
  if (signupEdit.active()) return null;

  const status = normalizeStatus(partner.onboardingStatus);
  const approved = Boolean(partner.isApproved);
  const progress = Number(partner.onboardingProgress || 0);
  const profileLooksComplete = Boolean(partner.name);

  if (status === OnboardingStatus.REJECTED) {
    return "/registration/account-rejected";
  }

  if (
    status === OnboardingStatus.COMPLETED ||
    (approved && (progress >= 100 || profileLooksComplete))
  ) {
    return approved ? "/(tabs)" : "/registration/account-pending";
  }

  return null;
};

export default function RegistrationLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const initializedRef = useRef(false);
  const repairedPathRef = useRef<string | null>(null);
  const {
    isAuthenticated,
    loading,
    partner,
    onboardingStatus,
    onboardingProgress,
    isApproved,
    initializeAuth,
    getNavigationRoute,
  } = useAuthStore();

  useEffect(() => {
    if (initializedRef.current) {
      return;
    }

    initializedRef.current = true;
    initializeAuth()
      .then(async () => {
        const response = await ApiService.getProfile();
        const latestPartner = getPartnerFromProfileResponse(response.data);
        const route = response.success
          ? getCompletedPartnerRoute(latestPartner)
          : null;

        if (latestPartner) {
          await useAuthStore.getState().setPartner(latestPartner as never);
        }

        if (route && route !== pathname) {
          router.replace(route as never);
        }
      })
      .catch((error) => {
        console.error("❌ [RegistrationGuard] Auth repair failed:", error);
      });
  }, [initializeAuth, pathname, router]);

  useEffect(() => {
    if (repairedPathRef.current === pathname) {
      return;
    }

    repairedPathRef.current = pathname;
    ApiService.getProfile()
      .then(async (response) => {
        if (!response.success) {
          return;
        }

        const latestPartner = getPartnerFromProfileResponse(response.data);
        const route = getCompletedPartnerRoute(latestPartner);

        if (latestPartner) {
          await useAuthStore.getState().setPartner(latestPartner as never);
        }

        if (route && route !== pathname) {
          router.replace(route as never);
        }
      })
      .catch((error) => {
        console.error("❌ [RegistrationGuard] Profile repair failed:", error);
      });
  }, [pathname, router]);

  useEffect(() => {
    if (loading || !isAuthenticated) return;

    const status = normalizeStatus(partner?.onboardingStatus || onboardingStatus);
    const approved = Boolean(partner?.isApproved || isApproved);
    const progress = partner?.onboardingProgress || onboardingProgress || 0;
    const isCompleted =
      status === OnboardingStatus.COMPLETED || (approved && progress >= 100);

    if (!isCompleted && status !== OnboardingStatus.REJECTED) return;

    const route = useAuthStore.getState().getNavigationRoute();
    if (route && route !== pathname) {
      router.replace(route as never);
    }
  }, [
    getNavigationRoute,
    isApproved,
    isAuthenticated,
    loading,
    onboardingProgress,
    onboardingStatus,
    partner?.isApproved,
    partner?.onboardingProgress,
    partner?.onboardingStatus,
    pathname,
    router,
  ]);

  return <Stack screenOptions={{ headerShown: false }} />;
}
