import { Alert } from "react-native";
import { create } from "zustand";
import { ApiService } from "../services/api";
import { socketService } from "../services/socket";

export interface Location {
  latitude: number;
  longitude: number;
}

export type OrderStatus =
  | "pending"
  | "accepted"
  | "picked_up"
  | "on_the_way"
  | "delivered"
  | "cancelled"
  | "confirmed"
  | "preparing"
  | "ready"
  | "out_for_delivery";

export interface Order {
  id: string;
  restaurantName: string;
  restaurantAddress: string;
  customerName: string;
  customerAddress: string;
  customerPhone: string;
  distance: number;
  estimatedTime: string;
  earnings: number;
  items: { name: string; quantity: number }[];
  paymentType: "cash" | "online";
  status: OrderStatus;
  createdAt: Date;
  pickupLocation?: Location;
  dropLocation?: Location;
}

interface OrderState {
  activeOrder: Order | null;
  incomingOrder: Order | null;
  pendingOrder: Order | null;
  orderHistory: Order[];
  driverLocation: Location;
  availableOrders: Order[];
  loading: boolean;

  // Actions
  initializeSocket: () => void;
  setIncomingOrder: (order: Order | null) => void;
  acceptOrder: (orderId: string) => Promise<void>;
  rejectOrder: (orderId: string) => void;
  updateOrderStatus: (status: OrderStatus) => Promise<void>;
  completeOrder: () => void;
  setDriverLocation: (location: Location) => void;
  simulateDriverMovement: () => void;
  fetchAvailableOrders: () => Promise<void>;
  fetchAssignedOrders: () => Promise<void>;
  fetchOrderHistory: (page?: number) => Promise<void>;
  updateLocation: (latitude: number, longitude: number) => Promise<void>;
}

export const useOrderStore = create<OrderState>((set, get) => ({
  activeOrder: null,
  incomingOrder: null,
  pendingOrder: null,
  orderHistory: [],
  driverLocation: { latitude: 28.5355, longitude: 77.391 },
  availableOrders: [],
  loading: false,

  initializeSocket: () => {
    socketService.connect();

    socketService.on("new-delivery-available", (order: any) => {
      console.log("🔔 New delivery available:", order._id);
      const transformedOrder: Order = {
        id: order._id,
        restaurantName:
          order.restaurant?.name || order.restaurantId?.name || "Unknown",
        restaurantAddress:
          order.restaurant?.address ||
          order.restaurantAddress?.fullAddress ||
          "",
        customerName: order.user?.name || order.userId?.name || "Customer",
        customerAddress: order.deliveryAddress?.fullAddress || "",
        customerPhone: order.user?.phone || order.userId?.phone || "",
        distance: order.deliveryInfo?.distanceKm || 0,
        estimatedTime: order.deliveryInfo?.durationMinutes
          ? `${Math.ceil(order.deliveryInfo.durationMinutes)} min`
          : "30 min",
        earnings: order.estimatedDeliveryFee || order.deliveryFee || 0,
        items:
          order.items?.map((item: any) => ({
            name: item.food?.name || item.name,
            quantity: item.quantity,
          })) || [],
        paymentType: order.paymentMethod === "card" ? "online" : "cash",
        status: order.status,
        createdAt: new Date(order.createdAt),
        pickupLocation: order.restaurant?.location || order.restaurantAddress,
        dropLocation: order.deliveryAddress?.location || {
          latitude: order.deliveryAddress?.latitude,
          longitude: order.deliveryAddress?.longitude,
        },
      };
      set({ incomingOrder: transformedOrder, pendingOrder: transformedOrder });
    });

    socketService.on("order-taken", (data: { orderId: string }) => {
      console.log("⚠️ Order taken by another driver:", data.orderId);
      const { pendingOrder } = get();
      if (pendingOrder && pendingOrder.id === data.orderId) {
        set({ incomingOrder: null, pendingOrder: null });
      }
    });

    socketService.on("order-updated", (updatedOrder: any) => {
      console.log("📦 Order updated:", updatedOrder._id, updatedOrder.status);
      const { activeOrder, pendingOrder } = get();

      if (activeOrder && activeOrder.id === updatedOrder._id) {
        set({ activeOrder: { ...activeOrder, status: updatedOrder.status } });
      }

      // If pending order is cancelled or taken (though taken is handled by order-taken)
      if (pendingOrder && pendingOrder.id === updatedOrder._id) {
        if (
          updatedOrder.status === "cancelled" ||
          updatedOrder.status === "delivered"
        ) {
          set({ incomingOrder: null, pendingOrder: null });
        } else {
          set({
            pendingOrder: { ...pendingOrder, status: updatedOrder.status },
          });
        }
      }
    });
  },

  setIncomingOrder: (order) =>
    set({ incomingOrder: order, pendingOrder: order }),

  acceptOrder: async (orderId: string) => {
    try {
      set({ loading: true });

      const response = await ApiService.acceptOrder(orderId);

      if (response.success) {
        const { pendingOrder } = get();
        // If we have a pending order locally, use it to set active order immediately
        // But also update it with response data if available
        const acceptedOrderData = response.data;

        // Construct active order from pending or response
        const baseOrder =
          pendingOrder ||
          (acceptedOrderData
            ? {
                id: acceptedOrderData.id || acceptedOrderData._id,
                // ... map from response if needed, but pendingOrder is usually sufficient for immediate transition
                // simplifying to use pendingOrder if available due to complex mapping
              }
            : null);

        if (baseOrder) {
          // Determine start location for tracking (restaurant)
          const pickup = (baseOrder as Order).pickupLocation || {
            latitude: 28.5355,
            longitude: 77.391,
          };

          const newActiveOrder = {
            ...baseOrder,
            status: "accepted" as OrderStatus,
          } as Order;

          set({
            activeOrder: newActiveOrder,
            incomingOrder: null,
            pendingOrder: null,
            driverLocation: pickup,
          });

          // Join socket room
          socketService.joinOrderRoom(orderId);
        } else {
          // Fallback if no pending order (e.g. slight race condition or re-hydration)
          // We should fetch assigned orders to be safe
          await get().fetchAssignedOrders();
        }
      } else {
        console.error("Failed to accept order:", response.message);
        Alert.alert("Error", response.message || "Failed to accept order");
      }
    } catch (error) {
      console.error("Accept order error:", error);
      Alert.alert("Error", "An unexpected error occurred");
    } finally {
      set({ loading: false });
    }
  },

  rejectOrder: (orderId: string) => {
    const { pendingOrder } = get();
    if (pendingOrder && pendingOrder.id === orderId) {
      set({ incomingOrder: null, pendingOrder: null });
    }
  },

  updateOrderStatus: async (status: OrderStatus) => {
    try {
      const { activeOrder } = get();
      if (!activeOrder) return;

      set({ loading: true });

      const response = await ApiService.updateOrderStatus(
        activeOrder.id,
        status,
      );

      if (response.success) {
        set({ activeOrder: { ...activeOrder, status } });
      } else {
        console.error("Failed to update order status:", response.message);
      }
    } catch (error) {
      console.error("Update order status error:", error);
    } finally {
      set({ loading: false });
    }
  },

  completeOrder: () => {
    const { activeOrder, orderHistory } = get();
    if (activeOrder) {
      set({
        activeOrder: null,
        orderHistory: [
          { ...activeOrder, status: "delivered" },
          ...orderHistory,
        ],
      });
    }
  },

  setDriverLocation: (location) => set({ driverLocation: location }),

  simulateDriverMovement: () => {
    const { driverLocation, activeOrder } = get();
    if (!activeOrder) return;

    const target =
      activeOrder.status === "picked_up" || activeOrder.status === "accepted"
        ? activeOrder.pickupLocation
        : activeOrder.dropLocation;

    if (!target) return;

    const latDiff = (target.latitude - driverLocation.latitude) * 0.1;
    const lngDiff = (target.longitude - driverLocation.longitude) * 0.1;

    set({
      driverLocation: {
        latitude: driverLocation.latitude + latDiff,
        longitude: driverLocation.longitude + lngDiff,
      },
    });
  },

  fetchAvailableOrders: async () => {
    try {
      set({ loading: true });

      const response = await ApiService.getAvailableOrders();

      if (response.success && response.data) {
        const orders: Order[] = response.data.map((order: any) => ({
          id: order._id || order.id,
          restaurantName:
            order.restaurant?.name ||
            order.restaurantId?.name ||
            "Unknown Restaurant",
          restaurantAddress:
            order.restaurant?.address ||
            order.restaurantAddress?.fullAddress ||
            "",
          customerName: order.user?.name || order.userId?.name || "Customer",
          customerAddress: order.deliveryAddress?.fullAddress || "",
          customerPhone: order.user?.phone || order.userId?.phone || "",
          distance: order.deliveryInfo?.distanceKm || 0,
          estimatedTime: order.deliveryInfo?.durationMinutes
            ? `${Math.ceil(order.deliveryInfo.durationMinutes)} min`
            : "30 min",
          earnings: order.estimatedDeliveryFee || order.deliveryFee || 0,
          items:
            order.items?.map((item: any) => ({
              name: item.food?.name || item.name,
              quantity: item.quantity,
            })) || [],
          paymentType: order.paymentMethod === "card" ? "online" : "cash",
          status: order.status,
          createdAt: new Date(order.createdAt),
          pickupLocation: order.restaurant?.location || order.restaurantAddress,
          dropLocation: order.deliveryAddress?.location || {
            latitude: order.deliveryAddress?.latitude,
            longitude: order.deliveryAddress?.longitude,
          },
        }));

        set({ availableOrders: orders });
      }
    } catch (error) {
      console.error("Fetch available orders error:", error);
    } finally {
      set({ loading: false });
    }
  },

  fetchAssignedOrders: async () => {
    try {
      set({ loading: true });

      const response = await ApiService.getAssignedOrders();

      if (response.success && response.data) {
        if (response.data.length > 0) {
          const order = response.data[0];
          const transformedOrder: Order = {
            id: order._id || order.id,
            restaurantName:
              order.restaurant?.name ||
              order.restaurantId?.name ||
              "Unknown Restaurant",
            restaurantAddress:
              order.restaurant?.address ||
              order.restaurantAddress?.fullAddress ||
              "",
            customerName: order.user?.name || order.userId?.name || "Customer",
            customerAddress: order.deliveryAddress?.fullAddress || "",
            customerPhone: order.user?.phone || order.userId?.phone || "",
            distance: order.deliveryInfo?.distanceKm || 0,
            estimatedTime: order.deliveryInfo?.durationMinutes
              ? `${Math.ceil(order.deliveryInfo.durationMinutes)} min`
              : "30 min",
            earnings: order.estimatedDeliveryFee || order.deliveryFee || 0,
            items:
              order.items?.map((item: any) => ({
                name: item.food?.name || item.name,
                quantity: item.quantity,
              })) || [],
            paymentType: order.paymentMethod === "card" ? "online" : "cash",
            status: order.status,
            createdAt: new Date(order.createdAt),
            pickupLocation:
              order.restaurant?.location || order.restaurantAddress,
            dropLocation: order.deliveryAddress?.location || {
              latitude: order.deliveryAddress?.latitude,
              longitude: order.deliveryAddress?.longitude,
            },
          };

          set({ activeOrder: transformedOrder });

          // Re-join order room on app load for active order
          socketService.joinOrderRoom(transformedOrder.id);
        }
      }
    } catch (error) {
      console.error("Fetch assigned orders error:", error);
    } finally {
      set({ loading: false });
    }
  },

  fetchOrderHistory: async (page = 1) => {
    try {
      set({ loading: true });

      const response = await ApiService.getOrderHistory(page);

      if (response.success && response.data) {
        const orders: Order[] = response.data.map((order: any) => ({
          id: order._id || order.id,
          restaurantName: order.restaurant?.name || "Unknown Restaurant",
          restaurantAddress: order.restaurant?.address || "",
          customerName: order.user?.name || "Customer",
          customerAddress: order.deliveryAddress?.fullAddress || "",
          customerPhone: order.user?.phone || "",
          distance: order.distance || 0,
          estimatedTime: order.estimatedDeliveryTime || "30 min",
          earnings: order.deliveryFee || 0,
          items:
            order.items?.map((item: any) => ({
              name: item.food?.name || item.name,
              quantity: item.quantity,
            })) || [],
          paymentType: order.paymentMethod === "card" ? "online" : "cash",
          status: order.status,
          createdAt: new Date(order.createdAt),
          pickupLocation: order.restaurant?.location,
          dropLocation: order.deliveryAddress?.location,
        }));

        set({ orderHistory: orders });
      }
    } catch (error) {
      console.error("Fetch order history error:", error);
    } finally {
      set({ loading: false });
    }
  },

  updateLocation: async (latitude: number, longitude: number) => {
    try {
      const { activeOrder } = get();

      // Update DB
      await ApiService.updateLocation(latitude, longitude);
      set({ driverLocation: { latitude, longitude } });

      // Broadcast via Socket if active order
      if (activeOrder) {
        socketService.updateLocation(activeOrder.id, { latitude, longitude });
      }
    } catch (error) {
      console.error("Update location error:", error);
    }
  },
}));
