import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { ApiService } from "../services/api";

interface Earnings {
  today: number;
  week: number;
  month: number;
}

interface Stats {
  deliveriesToday: number;
  shiftsCompleted: number;
  activeOrders: number;
}

interface ActiveOrder {
  id: string;
  restaurantName: string;
  customerName: string;
  deliveryAddress: string;
  orderValue: number;
  status: "accepted" | "picked_up" | "delivering";
  estimatedTime: string;
}

interface PartnerState {
  isOnline: boolean;
  todayEarnings: number;
  completedOrders: number;
  activeOrder: ActiveOrder | null;
  earnings: Earnings;
  stats: Stats;
  loading: boolean;
  
  // Actions
  toggleOnline: () => Promise<void>;
  setOnlineStatus: (status: boolean) => Promise<void>;
  syncOnlineStatus: (status: boolean) => void; // Local sync only, no API call
  setActiveOrder: (order: ActiveOrder | null) => void;
  completeOrder: () => void;
  updateEarnings: (amount: number) => void;
  fetchDashboardData: () => Promise<void>;
  fetchEarnings: (period?: 'today' | 'week' | 'month') => Promise<void>;
  updateLocation: (latitude: number, longitude: number) => Promise<void>;
  initializeStore: () => Promise<void>;
}

export const usePartnerStore = create<PartnerState>()(
  persist(
    (set, get) => ({
      isOnline: false,
      todayEarnings: 0,
      completedOrders: 0,
      activeOrder: null,
      earnings: {
        today: 0,
        week: 0,
        month: 0,
      },
      stats: {
        deliveriesToday: 0,
        shiftsCompleted: 0,
        activeOrders: 0,
      },
      loading: false,

      toggleOnline: async () => {
        const currentStatus = get().isOnline;
        const newStatus = !currentStatus;
        
        try {
          set({ loading: true });
          
          const response = await ApiService.toggleOnlineStatus(newStatus);
          
          if (!response.success) {
            // Let the caller tell the rider; a silent failure looked like
            // the button did nothing.
            throw new Error(response.message || 'Could not change your status');
          }
          set({ isOnline: newStatus });
        } finally {
          set({ loading: false });
        }
      },

      setOnlineStatus: async (status: boolean) => {
        try {
          set({ loading: true });
          
          const response = await ApiService.toggleOnlineStatus(status);
          
          if (response.success) {
            set({ isOnline: status });
          } else {
            console.error('Failed to set online status:', response.message);
          }
        } catch (error) {
          console.error('Set online status error:', error);
        } finally {
          set({ loading: false });
        }
      },

      // Local sync only, no API call - used to sync state from API response
      syncOnlineStatus: (status: boolean) => {
        set({ isOnline: status });
      },

      setActiveOrder: (order) => {
        set({ activeOrder: order });
      },

      completeOrder: () => {
        const { activeOrder, completedOrders, todayEarnings } = get();
        if (activeOrder) {
          set({
            activeOrder: null,
            completedOrders: completedOrders + 1,
            todayEarnings: todayEarnings + activeOrder.orderValue,
          });
        }
      },

      updateEarnings: (amount: number) => {
        set((state) => ({
          todayEarnings: state.todayEarnings + amount,
        }));
      },

      fetchDashboardData: async () => {
        try {
          set({ loading: true });
          
          const response = await ApiService.getDashboardData();
          
          if (response.success && response.data) {
            const { earnings, stats, onlineStatus, activeOrder } = response.data;
            
            set({
              earnings: earnings || get().earnings,
              stats: stats || get().stats,
              isOnline: onlineStatus || get().isOnline,
              todayEarnings: earnings?.today || get().todayEarnings,
              completedOrders: stats?.deliveriesToday || get().completedOrders,
              activeOrder: activeOrder || null,
            });
          }
        } catch (error) {
          console.error('Fetch dashboard data error:', error);
        } finally {
          set({ loading: false });
        }
      },

      fetchEarnings: async (period = 'today') => {
        try {
          const response = await ApiService.getEarnings(period);
          
          if (response.success && response.data) {
            set({ earnings: response.data });
            if (period === 'today' && response.data.today !== undefined) {
              set({ todayEarnings: response.data.today });
            }
          }
        } catch (error) {
          console.error('Fetch earnings error:', error);
        }
      },

      updateLocation: async (latitude: number, longitude: number) => {
        try {
          await ApiService.updateLocation(latitude, longitude);
        } catch (error) {
          console.error('Update location error:', error);
        }
      },

      initializeStore: async () => {
        try {
          const stored = await AsyncStorage.getItem("partner-storage");
          if (stored) {
            const data = JSON.parse(stored);
            set(data.state);
          }
          
          // Fetch latest data from server
          await get().fetchDashboardData();
        } catch (error) {
          console.error("Failed to initialize partner store:", error);
        }
      },
    }),
    {
      name: "partner-storage",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

