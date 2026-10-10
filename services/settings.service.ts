import { apiClient } from "./api";

export interface PublicAppStatus {
  maintenance: {
    enabled: boolean;
    message: string;
  };
  deliveryApp: {
    /** This app's own maintenance switch (older backends only send the top-level one). */
    maintenance?: {
      enabled: boolean;
      message: string;
    };
    minVersion: string;
    latestVersion: string;
    forceUpdateMessage: string;
    updateUrls: {
      ios: string;
      android: string;
    };
    platforms?: {
      ios?: {
        minVersion: string;
        latestVersion: string;
        updateUrl: string;
      };
      android?: {
        minVersion: string;
        latestVersion: string;
        updateUrl: string;
      };
    };
  };
}

const DEFAULT_PUBLIC_APP_STATUS: PublicAppStatus = {
  maintenance: {
    enabled: false,
    message:
      "KhaaoNow is temporarily unavailable while we upgrade the service.",
  },
  deliveryApp: {
    minVersion: "0.0.0",
    latestVersion: "0.0.0",
    forceUpdateMessage: "Please update the KhaaoNow Delivery app to continue.",
    updateUrls: {
      ios: "",
      android: "",
    },
    platforms: {
      ios: {
        minVersion: "0.0.0",
        latestVersion: "0.0.0",
        updateUrl: "",
      },
      android: {
        minVersion: "0.0.0",
        latestVersion: "0.0.0",
        updateUrl: "",
      },
    },
  },
};

class SettingsService {
  async getPublicAppStatus(): Promise<PublicAppStatus> {
    try {
      const response = await apiClient.get<{
        success: boolean;
        data: PublicAppStatus;
      }>("/settings/public/app-status");

      return response.data;
    } catch (error) {
      return DEFAULT_PUBLIC_APP_STATUS;
    }
  }
}

export default new SettingsService();
