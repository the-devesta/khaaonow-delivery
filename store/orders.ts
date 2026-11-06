import AsyncStorage from "@react-native-async-storage/async-storage";
import { Alert } from "react-native";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { ApiService } from "../services/api";
import { updateDriverLocationInFirebase } from "../services/driverTrackingService";
import { subscribeToDeliveryRealtime } from "../services/realtime.service";
import { socketService } from "../services/socket";
import { useAuthStore } from "./auth";

export interface Location {
  latitude: number;
  longitude: number;
}

/**
 * Parses any backend location shape into { latitude, longitude }.
 * Handles:
 *   - GeoJSON:  { type: "Point", coordinates: [lng, lat] }
 *   - Flat:     { latitude, longitude }  or  { lat, lng }
 *   - Nested:   { coordinates: [lng, lat] }  (without type)
 *   - Array:    [lng, lat]
 */
function parseLocation(loc: any): Location | undefined {
  if (!loc) return undefined;

  // Array form [lng, lat]
  if (Array.isArray(loc)) {
    if (loc.length >= 2 && typeof loc[0] === "number") {
      return { latitude: loc[1], longitude: loc[0] };
    }
    return undefined;
  }

  if (typeof loc !== "object") return undefined;

  // GeoJSON or { coordinates: [lng, lat] }
  if (Array.isArray(loc.coordinates) && loc.coordinates.length >= 2) {
    return { latitude: loc.coordinates[1], longitude: loc.coordinates[0] };
  }

  // Flat { latitude, longitude }
  if (typeof loc.latitude === "number" && typeof loc.longitude === "number") {
    return { latitude: loc.latitude, longitude: loc.longitude };
  }

  // Flat { lat, lng }
  if (typeof loc.lat === "number" && typeof loc.lng === "number") {
    return { latitude: loc.lat, longitude: loc.lng };
  }

  return undefined;
}

/**
 * Calculate distance between two points in km using Haversine formula
 */
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
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
  | "out_for_delivery"
  | "delivery_partner_accepted"
  | "delivery_partner_reached"
  | "delivery_partner_picked_up"
  | "delivery_partner_reached_user_dest"
  | "returning_to_restaurant"
  | "returned";

export type MissedReason = "timeout" | "taken" | "cancelled";

const TERMINAL_STATUSES: OrderStatus[] = ["cancelled", "delivered", "returned"];

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
  totalAmount?: number;
  items: { name: string; quantity: number }[];
  paymentType: "cash" | "online";
  paymentStatus?: "pending" | "completed" | "paid" | "failed";
  status: OrderStatus;
  createdAt: Date;
  /** Audience-specific offer phase time from the authenticated availability API. */
  offerAvailableAt?: number;
  pickupLocation?: Location;
  dropLocation?: Location;
  preparationTime?: number;
  acceptanceTimeoutSeconds?: number;
  cancellationReason?: string | null;
  autoCancelled?: boolean;
  // Set by an admin when this order is sent back with status
  // "returning_to_restaurant" - shown as the instruction on the order screen.
  returnReason?: string | null;
}

export interface RoutePlanStop {
  sequence: number;
  type: "pickup" | "drop";
  orderId: string;
  orderNumber?: string;
  restaurantName: string;
  customerName: string;
  address?: string;
  location: Location;
  distanceKm: number;
}

export interface RoutePlan {
  activeOrderCount: number;
  maxActiveBatch: number;
  totalDistanceKm: number;
  stops: RoutePlanStop[];
}

/** An order the partner saw but didn't accept in time */
export interface MissedOrder {
  order: Order;
  missedAt: Date;
  /** 15 minutes after missedAt — when this card should disappear */
  expiresAt: Date;
  /** Why it was missed: timer ran out, taken by someone else, or cancelled by restaurant */
  reason: MissedReason;
  /** Still available in backend — partner can accept it via API poll */
  stillAvailable: boolean;
}

interface OrderState {
  orderOwnerId: string | null;
  activeOrder: Order | null;
  activeOrders: Order[];
  incomingOrder: Order | null;
  pendingOrder: Order | null;
  /** Epoch ms when the current pendingOrder was first received. Used to restore the countdown timer after app restart. */
  pendingOrderReceivedAt: number | null;
  orderHistory: Order[];
  driverLocation: Location;
  availableOrders: Order[];
  missedOrders: MissedOrder[];
  loading: boolean;
  routePlan: RoutePlan | null;

  // Actions
  initializeSocket: () => void;
  initializeRealtime: () => () => void;
  removeAvailableOrder: (orderId: string) => void;
  setIncomingOrder: (order: Order | null) => void;
  acceptOrder: (orderId: string) => Promise<void>;
  rejectOrder: (orderId: string) => void;
  updateOrderStatus: (
    status: OrderStatus,
    metadata?: {
      currentLocation?: Location;
      proofPhotoUrl?: string;
      orderId?: string;
    },
  ) => Promise<boolean>;
  completeOrder: (orderId?: string) => void;
  releaseActiveOrder: (orderId?: string) => void;
  confirmReturnedToRestaurant: (orderId: string) => Promise<boolean>;
  setDriverLocation: (location: Location) => void;
  simulateDriverMovement: () => void;
  fetchAvailableOrders: () => Promise<void>;
  fetchAssignedOrders: () => Promise<void>;
  fetchRoutePlan: () => Promise<void>;
  fetchOrderHistory: (page?: number) => Promise<void>;
  updateLocation: (
    latitude: number,
    longitude: number,
    metadata?: { heading?: number | null; accuracy?: number | null },
  ) => Promise<{ success: boolean }>;
  dismissMissedOrder: (orderId: string) => void;
  acceptMissedOrder: (orderId: string) => Promise<void>;
  pruneMissedOrders: () => void;
  /** Called after AsyncStorage hydration to fix serialized Dates and expire stale timers. */
  restorePersistedState: () => void;
}

/** Online = paid through the app (Razorpay/card/UPI) or already marked paid. */
const paymentTypeOf = (order: any): "cash" | "online" => {
  const method = String(order?.paymentMethod || "").toLowerCase();
  const status = String(order?.paymentStatus || "").toLowerCase();
  if (["card", "razorpay", "online", "upi"].includes(method)) return "online";
  if (status === "paid" || status === "completed") return "online";
  return "cash";
};

// ── Helper: transform a raw backend order into our Order shape ───────────────
function transformSocketOrder(order: any): Order {
  const earnings =
    order.estimatedDeliveryFee ??
    order.earnings ??
    order.deliveryEarnings ??
    0;

  const _pickupLoc =
    parseLocation(order.restaurant?.location) ??
    parseLocation(order.restaurantId?.location) ??
    parseLocation(order.restaurantId?.address?.location) ??
    parseLocation(order.restaurantId?.address?.coordinates) ??
    // Order document stores flat restaurantAddress: { latitude, longitude }
    (order.restaurantAddress?.latitude != null &&
    order.restaurantAddress?.longitude != null
      ? {
          latitude: Number(order.restaurantAddress.latitude),
          longitude: Number(order.restaurantAddress.longitude),
        }
      : undefined);

  const _dropLoc =
    parseLocation(order.deliveryAddress?.location) ??
    parseLocation(order.deliveryAddress?.coordinates) ??
    (order.deliveryAddress?.latitude != null
      ? {
          latitude: order.deliveryAddress.latitude,
          longitude: order.deliveryAddress.longitude,
        }
      : undefined);

  const result: Order = {
    id: order._id || order.id,
    restaurantName:
      order.restaurant?.restaurantName ||
      order.restaurant?.name ||
      order.restaurantId?.restaurantName ||
      order.restaurantId?.name ||
      "Unknown",
    restaurantAddress:
      order.restaurant?.address?.street ||
      order.restaurant?.address ||
      order.restaurantAddress?.fullAddress ||
      order.restaurantId?.address?.street ||
      "",
    customerName:
      order.user?.name ||
      order.userId?.name ||
      order.customer?.name ||
      "Customer",
    customerAddress:
      order.deliveryAddress?.fullAddress || order.deliveryAddress?.street || "",
    customerPhone:
      order.user?.phone || order.userId?.phone || order.customer?.phone || "",
    distance: order.deliveryInfo?.distanceKm ?? order.distance ?? 0,
    estimatedTime: (() => {
      const raw = order.deliveryInfo?.durationMinutes;
      if (!raw) return "—";
      const mins = raw > 120 ? Math.ceil(raw / 60) : Math.ceil(raw);
      return `${mins} min`;
    })(),
    earnings,
    totalAmount: order.totalAmount,
    items:
      order.items?.map((item: any) => ({
        name: item.food?.name || item.name,
        quantity: item.quantity,
      })) || [],
    paymentType: paymentTypeOf(order),
    paymentStatus: order.paymentStatus,
    status: order.status,
    preparationTime: order.preparationTime,
    acceptanceTimeoutSeconds: order.acceptanceTimeoutSeconds,
    createdAt: new Date(order.createdAt),
    offerAvailableAt: order.offerAvailableAt != null
      ? (typeof order.offerAvailableAt === "number" ? order.offerAvailableAt : Date.parse(order.offerAvailableAt))
      : undefined,
    pickupLocation: _pickupLoc,
    dropLocation: _dropLoc,
    returnReason:
      order.status === "returning_to_restaurant"
        ? order.pendingDecision?.reason
        : undefined,
  };

  // Calculate distance if missing or zero from backend
  if ((!result.distance || result.distance === 0) && _pickupLoc && _dropLoc) {
    result.distance = parseFloat(
      calculateDistance(
        _pickupLoc.latitude,
        _pickupLoc.longitude,
        _dropLoc.latitude,
        _dropLoc.longitude,
      ).toFixed(1),
    );
  }

  return result;
}

function mergeIncomingOrder(existing: Order, incomingRaw: any): Order {
  const incoming = transformSocketOrder(incomingRaw);
  return {
    ...existing,
    ...incoming,
    status: (incoming.status || incomingRaw?.status || existing.status) as OrderStatus,
  };
}

const MISSED_ORDER_TTL_MS = 15 * 60 * 1000; // 15 minutes accept window (controls Accept button)
// How recently the order must have been broadcast for it to pop the ring modal
// (vs. sitting quietly in the "missed but still available" list). The old 90s
// window meant that after a cold start + push delay + the rider opening a
// closed app, a perfectly valid order silently landed in the missed list with
// no ring — the "sometimes it rings, sometimes it doesn't" flakiness. 5 min
// covers those delays while still not ringing for genuinely stale broadcasts.
const RING_FRESHNESS_MS = 5 * 60 * 1000;
/** How long missed-order cards stay visible in "Pending Requests" before auto-pruning. */
const MISSED_ORDER_DISPLAY_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours
let offerGeneration = 0;
let offerRevision = 0;
let availabilityRefresh: Promise<void> | null = null;
let availabilityRefreshAgain = false;
function sameOrderSession(session: ReturnType<typeof useAuthStore.getState>, generation: number) {
  const current = useAuthStore.getState();
  return generation === offerGeneration && current.isAuthenticated &&
    current.partner?.id === session.partner?.id && current.token === session.token;
}
function offerTime(order: Order): number {
  const phaseTime = order.offerAvailableAt;
  return phaseTime != null && Number.isFinite(phaseTime)
    ? phaseTime : order.createdAt.getTime();
}
let socketFallbackHandlersRegistered = false;

export const useOrderStore = create<OrderState>()(
  persist(
    (set, get) => ({
      orderOwnerId: null,
      activeOrder: null,
      activeOrders: [],
      incomingOrder: null,
      pendingOrder: null,
      pendingOrderReceivedAt: null,
      orderHistory: [],
      driverLocation: { latitude: 0, longitude: 0 },
      availableOrders: [],
      missedOrders: [],
      loading: false,
      routePlan: null,

      // ── Socket initialization ────────────────────────────────────────────────────
      initializeSocket: () => {
        socketService.connect();

        if (socketFallbackHandlersRegistered) {
          return;
        }

        socketFallbackHandlersRegistered = true;

        // Global/socket payloads are hints only; REST enforces priority eligibility.
        socketService.on("new-delivery-available", () => {
          void get().fetchAvailableOrders();
        });
        socketService.on("order-taken", (data: { orderId: string }) => {
          get().removeAvailableOrder(data.orderId);
          void get().fetchAvailableOrders();
        });

        socketService.on("order-updated", (updatedOrder: any) => {
          console.log(
            "📦 Order updated:",
            updatedOrder._id,
            updatedOrder.status,
          );
          const { activeOrder, activeOrders, pendingOrder, missedOrders } = get();
          const updatedId = updatedOrder._id || updatedOrder.id;

          // A cancelled order (by restaurant/admin/customer) must drop out of
          // activeOrders entirely, not just have its status field updated in
          // place - otherwise it keeps occupying a batch slot forever, both
          // in the "N active" route widget and in the backend's own
          // ACTIVE_DELIVERY_STATUSES-based accept-order count (which already
          // excludes "cancelled" - the bug was purely this stale client array).
          if (updatedOrder.status === "cancelled") {
            const { orderHistory } = get();
            const cancelledOrder =
              activeOrders.find((order) => order.id === updatedId) ||
              (activeOrder?.id === updatedId ? activeOrder : null);
            const remainingActive = activeOrders.filter(
              (order) => order.id !== updatedId,
            );
            set({
              activeOrder:
                activeOrder?.id === updatedId
                  ? remainingActive[0] || null
                  : activeOrder,
              activeOrders: remainingActive,
              orderHistory: cancelledOrder
                ? [
                    mergeIncomingOrder(cancelledOrder, updatedOrder),
                    ...orderHistory.filter((o) => o.id !== updatedId),
                  ]
                : orderHistory,
            });
            get().fetchRoutePlan();
          } else if (
            !activeOrders.some((order) => order.id === updatedId) &&
            activeOrder?.id !== updatedId &&
            String(updatedOrder.deliveryInfo?.driverId) ===
              String(useAuthStore.getState().partner?.id)
          ) {
            // Order isn't in our active list (e.g. it was cancelled and
            // pruned earlier) but an admin just sent it back to us -
            // "returning_to_restaurant" or a normal delivery status. Add it
            // back instead of silently dropping the update.
            const transformed = transformSocketOrder(updatedOrder);
            set({
              activeOrders: [...activeOrders, transformed],
              activeOrder: activeOrder || transformed,
            });
            get().fetchRoutePlan();
          } else {
            if (activeOrder && activeOrder.id === updatedId) {
              set({
                activeOrder: mergeIncomingOrder(activeOrder, updatedOrder),
              });
            }
            if (activeOrders.some((order) => order.id === updatedId)) {
              set({
                activeOrders: activeOrders.map((order) =>
                  order.id === updatedId
                    ? mergeIncomingOrder(order, updatedOrder)
                    : order,
                ),
              });
            }
          }

          // If the order is already in missedOrders, update it in-place so it
          // gets the correct status (e.g. "cancelled") and appears in history.
          const hasMissedEntry = missedOrders.some(
            (m) => m.order.id === updatedId,
          );
          if (hasMissedEntry) {
            set({
              missedOrders: missedOrders.map((m) =>
                m.order.id !== updatedId
                  ? m
                  : {
                      ...m,
                      order: mergeIncomingOrder(m.order, updatedOrder),
                      reason:
                        updatedOrder.status === "cancelled"
                          ? ("cancelled" as MissedReason)
                          : m.reason,
                      stillAvailable:
                        updatedOrder.status === "cancelled" ||
                        updatedOrder.status === "delivered"
                          ? false
                          : m.stillAvailable,
                    },
              ),
            });
            return;
          }

          // If the pending order got cancelled, move it to missed with reason "cancelled"
          if (pendingOrder && pendingOrder.id === updatedId) {
            if (
              updatedOrder.status === "cancelled" ||
              updatedOrder.status === "delivered"
            ) {
              const now = new Date();
              const missedEntry: MissedOrder = {
                order: pendingOrder,
                missedAt: now,
                expiresAt: new Date(now.getTime() + MISSED_ORDER_TTL_MS),
                reason: "cancelled",
                stillAvailable: false,
              };
              set({
                missedOrders: [
                  missedEntry,
                  ...missedOrders.filter(
                    (m) => m.order.id !== updatedOrder._id,
                  ),
                ],
                incomingOrder: null,
                pendingOrder: null,
                pendingOrderReceivedAt: null,
              });
            } else {
              set({
                pendingOrder: mergeIncomingOrder(pendingOrder, updatedOrder),
              });
            }
          }
        });

      },

      initializeRealtime: () => {
        const partnerId = useAuthStore.getState().partner?.id;
        const clearScope = (ownerId: string | null) => set({
          orderOwnerId: ownerId,
          activeOrder: null, activeOrders: [], orderHistory: [], routePlan: null,
          driverLocation: { latitude: 0, longitude: 0 }, loading: false,
          incomingOrder: null, pendingOrder: null, pendingOrderReceivedAt: null,
          availableOrders: [], missedOrders: [],
        });
        const signedIn = useAuthStore.getState().isAuthenticated && !!partnerId;
        if (!signedIn || get().orderOwnerId !== partnerId) clearScope(signedIn ? partnerId! : null);
        const reset = () => set({
          incomingOrder: null, pendingOrder: null, pendingOrderReceivedAt: null,
          availableOrders: [], missedOrders: [],
        });
        const generation = ++offerGeneration;
        availabilityRefresh = null;
        availabilityRefreshAgain = false;
        reset();
        if (!partnerId || !useAuthStore.getState().isAuthenticated) return () => {};
        const cleanup = subscribeToDeliveryRealtime(partnerId, {
          onOffersChanged: () => { void get().fetchAvailableOrders(); },
          onOrderTaken: (orderId) => {
            get().removeAvailableOrder(orderId);
            void get().fetchAvailableOrders();
          },
          watchAssignedOrders: (listener) => {
            const notify = () => listener(get().activeOrders.map((order) => order.id));
            notify();
            return useOrderStore.subscribe((state, previous) => {
              if (state.activeOrders !== previous.activeOrders) notify();
            });
          },
            onOrderUpdated: (updatedOrder: any) => {
              const updatedId = updatedOrder._id || updatedOrder.id;
              if (!updatedId) return;

              const { activeOrder, activeOrders, pendingOrder, missedOrders } =
                get();
              const nextStatus = updatedOrder.status as OrderStatus;

              if (nextStatus === "cancelled") {
                const { orderHistory } = get();
                const cancelledOrder =
                  activeOrders.find((order) => order.id === updatedId) ||
                  (activeOrder?.id === updatedId ? activeOrder : null);
                const remainingActive = activeOrders.filter(
                  (order) => order.id !== updatedId,
                );
                set({
                  activeOrder:
                    activeOrder?.id === updatedId
                      ? remainingActive[0] || null
                      : activeOrder,
                  activeOrders: remainingActive,
                  orderHistory: cancelledOrder
                    ? [
                        mergeIncomingOrder(cancelledOrder, updatedOrder),
                        ...orderHistory.filter((o) => o.id !== updatedId),
                      ]
                    : orderHistory,
                });
                get().fetchRoutePlan();
              } else if (
                !activeOrders.some((order) => order.id === updatedId) &&
                activeOrder?.id !== updatedId &&
                String(updatedOrder.deliveryInfo?.driverId) ===
                  String(useAuthStore.getState().partner?.id)
              ) {
                const transformed = transformSocketOrder(updatedOrder);
                set({
                  activeOrders: [...activeOrders, transformed],
                  activeOrder: activeOrder || transformed,
                });
                get().fetchRoutePlan();
              } else {
                if (activeOrder && activeOrder.id === updatedId) {
                  set({
                    activeOrder: mergeIncomingOrder(activeOrder, updatedOrder),
                  });
                }

                if (activeOrders.some((order) => order.id === updatedId)) {
                  set({
                    activeOrders: activeOrders.map((order) =>
                      order.id === updatedId
                        ? mergeIncomingOrder(order, updatedOrder)
                        : order,
                    ),
                  });
                }
              }

              if (pendingOrder && pendingOrder.id === updatedId) {
                if (["cancelled", "delivered"].includes(nextStatus)) {
                  const now = new Date();
                  const missedEntry: MissedOrder = {
                    order: pendingOrder,
                    missedAt: now,
                    expiresAt: new Date(now.getTime() + MISSED_ORDER_TTL_MS),
                    reason: "cancelled",
                    stillAvailable: false,
                  };
                  set({
                    missedOrders: [
                      missedEntry,
                      ...missedOrders.filter((m) => m.order.id !== updatedId),
                    ],
                    incomingOrder: null,
                    pendingOrder: null,
                    pendingOrderReceivedAt: null,
                  });
                } else {
                  set({
                    pendingOrder: mergeIncomingOrder(pendingOrder, updatedOrder),
                  });
                }
              }
            },
        });
        void get().fetchAvailableOrders();
        let stopped = false;
        const stop = () => {
          if (stopped) return;
          stopped = true;
          if (offerGeneration === generation) {
            offerGeneration++;
            availabilityRefresh = null;
            reset();
            const current = useAuthStore.getState();
            if (!current.isAuthenticated || current.partner?.id !== partnerId) clearScope(null);
          }
          cleanup();
        };
        const session = useAuthStore.getState();
        const stopWatching = useAuthStore.subscribe((state) => {
          if (!state.isAuthenticated || state.partner?.id !== partnerId || state.token !== session.token) stop();
        });
        return () => { stopWatching(); stop(); };
      },

      removeAvailableOrder: (orderId) => {
        offerRevision++;
        const { pendingOrder, incomingOrder, missedOrders, availableOrders } = get();
        set({
          availableOrders: availableOrders.filter((order) => order.id !== orderId),
          missedOrders: missedOrders.map((missed) => missed.order.id === orderId
            ? { ...missed, reason: "taken", stillAvailable: false } : missed),
          ...(incomingOrder?.id === orderId ? { incomingOrder: null } : {}),
          ...(pendingOrder?.id === orderId
            ? { pendingOrder: null, pendingOrderReceivedAt: null } : {}),
        });
      },

      setIncomingOrder: (order) => {
        if (order) { void get().fetchAvailableOrders(); return; }
        set({ incomingOrder: null, pendingOrder: null, pendingOrderReceivedAt: null });
      },

      // ── Accept order ─────────────────────────────────────────────────────────────
      acceptOrder: async (orderId: string) => {
        const session = useAuthStore.getState();
        const generation = offerGeneration;
        try {
          set({ loading: true });

          const response = await ApiService.acceptOrder(orderId);

          if (!sameOrderSession(session, generation)) return ;
          if (response.success) {
            const { pendingOrder, missedOrders } = get();
            const acceptedOrderData = response.data;

            const baseOrder =
              pendingOrder ||
              (acceptedOrderData
                ? {
                    id: acceptedOrderData.id || acceptedOrderData._id,
                  }
                : null);

            if (baseOrder) {
              // Prefer the full populated order from the API response to get restaurant/customer names
              const newActiveOrder: Order = acceptedOrderData
                ? {
                    ...transformSocketOrder(acceptedOrderData),
                    status: "delivery_partner_accepted" as OrderStatus,
                  }
                : {
                    ...(baseOrder as Order),
                    status: "delivery_partner_accepted" as OrderStatus,
                  };

              const pickup = newActiveOrder.pickupLocation || {
                latitude: 28.5355,
                longitude: 77.391,
              };

              const currentActiveOrders = get().activeOrders;
              const nextActiveOrders = [
                ...currentActiveOrders.filter((order) => order.id !== orderId),
                newActiveOrder,
              ];

              // Remove from missedOrders if it was there
              set({
                activeOrder: newActiveOrder,
                activeOrders: nextActiveOrders,
                incomingOrder: null,
                pendingOrder: null,
                pendingOrderReceivedAt: null,
                missedOrders: missedOrders.filter(
                  (m) => m.order.id !== orderId,
                ),
                driverLocation: pickup,
              });

              socketService.joinOrderRoom(orderId);
            } else {
              await get().fetchAssignedOrders();
            }
          } else {
            console.error("Failed to accept order:", response.message);
            const errorMsg = response.message || "Failed to accept order";
            if (
              errorMsg.includes("not found") ||
              errorMsg.includes("already assigned")
            ) {
              // Mark missed order as no longer available
              const { missedOrders } = get();
              set({
                incomingOrder: null,
                pendingOrder: null,
                pendingOrderReceivedAt: null,
                missedOrders: missedOrders.map((m) =>
                  m.order.id === orderId ? { ...m, stillAvailable: false } : m,
                ),
              });
            } else {
              // Any other refusal (offline, too many orders, out of area):
              // close the popup and keep the order in the missed list so the
              // rider can retry once fixed — never leave a dead popup up.
              get().rejectOrder(orderId);
            }
            Alert.alert("Order Unavailable", errorMsg);
          }
        } catch (error: any) {
          console.error("Accept order error:", error);
          const errorMsg =
            error?.response?.data?.message ||
            error?.message ||
            "An unexpected error occurred";
          if (
            error?.response?.status === 404 ||
            errorMsg.includes("not found") ||
            errorMsg.includes("already assigned")
          ) {
            const { missedOrders } = get();
            set({
              incomingOrder: null,
              pendingOrder: null,
              pendingOrderReceivedAt: null,
              missedOrders: missedOrders.map((m) =>
                m.order.id === orderId ? { ...m, stillAvailable: false } : m,
              ),
            });
            Alert.alert(
              "Order Unavailable",
              "This order has expired or been assigned to another delivery partner.",
            );
          } else {
            get().rejectOrder(orderId);
            Alert.alert("Error", errorMsg);
          }
        } finally {
          if (sameOrderSession(session, generation)) set({ loading: false });
        }
      },

      // ── Reject order (timeout or manual rejection) ───────────────────────────────
      rejectOrder: (orderId: string) => {
        const { pendingOrder, missedOrders } = get();
        if (pendingOrder && pendingOrder.id === orderId) {
          const now = new Date();
          const missedEntry: MissedOrder = {
            order: pendingOrder,
            missedAt: now,
            expiresAt: new Date(now.getTime() + MISSED_ORDER_TTL_MS),
            reason: "timeout",
            stillAvailable: true, // might still be available for 15 min
          };
          set({
            incomingOrder: null,
            pendingOrder: null,
            pendingOrderReceivedAt: null,
            missedOrders: [
              missedEntry,
              ...missedOrders.filter((m) => m.order.id !== orderId),
            ],
          });
        }
      },

      // ── Dismiss a missed order card manually ─────────────────────────────────────
      dismissMissedOrder: (orderId: string) => {
        const { missedOrders } = get();
        set({
          missedOrders: missedOrders.filter((m) => m.order.id !== orderId),
        });
      },

      // ── Accept a missed order (from the dashboard card) ──────────────────────────
      acceptMissedOrder: async (orderId: string) => {
        const { missedOrders } = get();
        const missed = missedOrders.find((m) => m.order.id === orderId);
        if (!missed) return;

        // Check if still within 15-minute window
        if (new Date() > missed.expiresAt) {
          Alert.alert(
            "Order Expired",
            "This order request has expired and can no longer be accepted.",
          );
          set({
            missedOrders: missedOrders.filter((m) => m.order.id !== orderId),
          });
          return;
        }

        // Accept directly — setting it as pending would ring the new-order
        // popup while the request runs.
        await get().acceptOrder(orderId);
      },

      // ── Prune expired missed orders ───────────────────────────────────────────────
      pruneMissedOrders: () => {
        const now = Date.now();
        const { missedOrders } = get();
        // Keep cards until MISSED_ORDER_DISPLAY_TTL_MS (4h) from when they were missed.
        // expiresAt only controls the Accept button, not when the card disappears.
        const filtered = missedOrders.filter(
          (m) => m.missedAt.getTime() + MISSED_ORDER_DISPLAY_TTL_MS > now,
        );
        if (filtered.length !== missedOrders.length) {
          set({ missedOrders: filtered });
        }
      },

      updateOrderStatus: async (
        status: OrderStatus,
        metadata?: {
          currentLocation?: Location;
          proofPhotoUrl?: string;
          orderId?: string;
        },
      ): Promise<boolean> => {
        const session = useAuthStore.getState();
        const generation = offerGeneration;
        try {
          const { activeOrder, activeOrders } = get();
          const targetOrder =
            activeOrders.find((order) => order.id === metadata?.orderId) ||
            activeOrder;
          if (!targetOrder) return false;

          set({ loading: true });

          const response = await ApiService.updateOrderStatus(
            targetOrder.id,
            status,
            {
              currentLocation: metadata?.currentLocation || get().driverLocation,
              proofPhotoUrl: metadata?.proofPhotoUrl,
            },
          );

          if (!sameOrderSession(session, generation)) return false;
          if (response.success) {
            const nextActiveOrders = activeOrders.map((order) =>
              order.id === targetOrder.id ? { ...order, status } : order,
            );
            set({
              activeOrder:
                activeOrder?.id === targetOrder.id
                  ? { ...targetOrder, status }
                  : activeOrder,
              activeOrders: nextActiveOrders,
            });
            return true;
          } else {
            console.error("Failed to update order status:", response.message);
            Alert.alert(
              "Update Failed",
              response.message ||
                "Failed to update order status. Please try again.",
            );
            return false;
          }
        } catch (error: any) {
          console.error("Update order status error:", error);
          const msg =
            error?.response?.data?.message ||
            "Failed to update order status. Please try again.";
          Alert.alert("Error", msg);
          return false;
        } finally {
          if (sameOrderSession(session, generation)) set({ loading: false });
        }
      },

      completeOrder: (orderId?: string) => {
        const { activeOrder, activeOrders, orderHistory } = get();
        const completedOrder =
          activeOrders.find((order) => order.id === orderId) || activeOrder;
        if (completedOrder) {
          const remainingActive = activeOrders.filter(
            (order) => order.id !== completedOrder.id,
          );
          set({
            activeOrder: remainingActive[0] || null,
            activeOrders: remainingActive,
            orderHistory: [
              { ...completedOrder, status: "delivered" },
              ...orderHistory,
            ],
          });
          get().fetchRoutePlan();
        }
      },

      confirmReturnedToRestaurant: async (orderId: string) => {
        const session = useAuthStore.getState();
        const generation = offerGeneration;
        try {
          const response = await ApiService.confirmReturnedToRestaurant(orderId);
          if (!sameOrderSession(session, generation)) return false;
          if (!response.success) return false;

          const { activeOrder, activeOrders, orderHistory } = get();
          const returnedOrder =
            activeOrders.find((order) => order.id === orderId) || activeOrder;
          if (returnedOrder) {
            const remainingActive = activeOrders.filter(
              (order) => order.id !== orderId,
            );
            set({
              activeOrder:
                activeOrder?.id === orderId
                  ? remainingActive[0] || null
                  : activeOrder,
              activeOrders: remainingActive,
              orderHistory: [
                { ...returnedOrder, status: "returned" },
                ...orderHistory,
              ],
            });
            get().fetchRoutePlan();
          }
          return true;
        } catch (error) {
          console.error("Confirm returned to restaurant error:", error);
          return false;
        }
      },

      releaseActiveOrder: (orderId?: string) => {
        const { activeOrder, activeOrders } = get();
        const releasedOrder =
          activeOrders.find((order) => order.id === orderId) || activeOrder;
        if (!releasedOrder) return;

        const remainingActive = activeOrders.filter(
          (order) => order.id !== releasedOrder.id,
        );
        set({
          activeOrder: remainingActive[0] || null,
          activeOrders: remainingActive,
        });
        get().fetchRoutePlan();
      },

      setDriverLocation: (location) => set({ driverLocation: location }),

      simulateDriverMovement: () => {
        const { driverLocation, activeOrder } = get();
        if (!activeOrder) return;

        const target =
          activeOrder.status === "delivery_partner_picked_up" ||
          activeOrder.status === "delivery_partner_reached_user_dest"
            ? activeOrder.dropLocation
            : activeOrder.pickupLocation;

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

      fetchAvailableOrders: () => {
        const session = useAuthStore.getState();
        if (!session.isAuthenticated || !session.partner?.id) return Promise.resolve();
        if (availabilityRefresh) {
          availabilityRefreshAgain = true;
          return availabilityRefresh;
        }
        const generation = offerGeneration;
        const partnerId = session.partner.id;
        const token = session.token;
        const refresh = async () => {
          do {
            availabilityRefreshAgain = false;
            const revision = offerRevision;
            const response = await ApiService.getAvailableOrders();
            const current = useAuthStore.getState();
            if (generation !== offerGeneration || !current.isAuthenticated ||
                current.partner?.id !== partnerId || current.token !== token) return;
            // An order-taken event while REST was in flight invalidates that snapshot.
            if (revision !== offerRevision) {
              availabilityRefreshAgain = true;
              continue;
            }
            if (!response.success || !Array.isArray(response.data)) return;
            const activeIds = new Set(get().activeOrders.map((order) => order.id));
            const orders: Order[] = response.data.map(transformSocketOrder)
              .filter((order: Order) => !activeIds.has(order.id));
            const availableIds = new Set(orders.map((order) => order.id));
            const { pendingOrder, incomingOrder, activeOrder, activeOrders,
              missedOrders, orderHistory } = get();
            const pending = pendingOrder && availableIds.has(pendingOrder.id)
              ? pendingOrder : null;
            const updatedMissed = missedOrders.map((missed) => ({
              ...missed,
              stillAvailable: missed.reason === "timeout" && availableIds.has(missed.order.id),
            }));
            const tracked = new Set([
              pendingOrder?.id, activeOrder?.id, ...activeOrders.map((order) => order.id),
              ...updatedMissed.map((missed) => missed.order.id),
              ...orderHistory.map((order) => order.id),
            ]);
            const unseen = orders.filter((order) => !tracked.has(order.id));
            const now = Date.now();
            const ring = !pending && !activeOrder
              ? unseen.find((order) => now - offerTime(order) >= 0 &&
                  now - offerTime(order) < RING_FRESHNESS_MS)
              : undefined;
            set({
              availableOrders: orders,
              pendingOrder: ring || pending,
              incomingOrder: ring || (incomingOrder && availableIds.has(incomingOrder.id) ? incomingOrder : null),
              pendingOrderReceivedAt: ring ? now : pending ? get().pendingOrderReceivedAt : null,
              missedOrders: [
                ...unseen.filter((order) => order.id !== ring?.id).map((order) => ({
                  order, missedAt: new Date(offerTime(order)),
                  expiresAt: new Date(offerTime(order) + MISSED_ORDER_TTL_MS),
                  reason: "timeout" as MissedReason, stillAvailable: true,
                })),
                ...updatedMissed,
              ],
            });
          } while (availabilityRefreshAgain);
        };
        const pending = refresh().catch(() => {
          console.warn("[Offers] Availability refresh failed");
        }).finally(() => {
          if (availabilityRefresh === pending) availabilityRefresh = null;
        });
        availabilityRefresh = pending;
        return pending;
      },

      fetchAssignedOrders: async () => {
        const session = useAuthStore.getState();
        const generation = offerGeneration;
        if (!session.isAuthenticated || !session.partner?.id) return;
        try {
          set({ loading: true });

          const response = await ApiService.getAssignedOrders();

          const current = useAuthStore.getState();
          if (generation !== offerGeneration || !current.isAuthenticated ||
              current.partner?.id !== session.partner.id || current.token !== session.token) return;

          if (response.success && response.data) {
            const assignedOrders = response.data
              .map((order: any) => transformSocketOrder(order))
              .filter(
                (order: Order) =>
                  !["delivered", "cancelled"].includes(order.status),
              );

            assignedOrders.forEach((order: Order) =>
              socketService.joinOrderRoom(order.id),
            );

            set({
              activeOrders: assignedOrders,
              activeOrder: assignedOrders[0] || null,
            });

            if (assignedOrders.length > 0) {
              await get().fetchRoutePlan();
            }
          }
        } catch (error) {
          console.error("Fetch assigned orders error:", error);
        } finally {
          set({ loading: false });
        }
      },

      fetchRoutePlan: async () => {
        const session = useAuthStore.getState();
        const generation = offerGeneration;
        if (!session.isAuthenticated || !session.partner?.id) return;
        try {
          const response = await ApiService.getDeliveryRoutePlan(
            get().driverLocation,
          );
          if (!sameOrderSession(session, generation)) return;
          if (response.success && response.data) {
            set({
              routePlan: {
                activeOrderCount: response.data.activeOrderCount || 0,
                maxActiveBatch: response.data.maxActiveBatch || 1,
                totalDistanceKm: response.data.totalDistanceKm || 0,
                stops: response.data.stops || [],
              },
            });
          }
        } catch (error) {
          console.error("Fetch route plan error:", error);
        }
      },

      fetchOrderHistory: async (page = 1) => {
        const session = useAuthStore.getState();
        const generation = offerGeneration;
        if (!session.isAuthenticated || !session.partner?.id) return;
        try {
          set({ loading: true });

          const response = await ApiService.getOrderHistory(page);
          if (!sameOrderSession(session, generation)) return;

          console.log(
            "📦 [History] Raw API response:",
            JSON.stringify({
              success: response.success,
              count: response.data?.length ?? 0,
              pagination: (response as any).pagination,
              firstItem: response.data?.[0] ?? null,
            }),
          );

          if (response.success && response.data) {
            console.log(
              "📋 [History] All statuses:",
              response.data.map((o: any) => ({
                id: String(o._id || o.id).slice(-6),
                status: o.status,
                reason: o.cancellationReason ?? null,
              })),
            );
            const orders: Order[] = response.data.map((order: any) => ({
              id: String(order._id || order.id),
              restaurantName:
                order.restaurantName ||
                order.restaurant?.name ||
                (order.restaurantId as any)?.name ||
                "Restaurant",
              restaurantAddress:
                order.restaurantAddress?.fullAddress ||
                order.restaurant?.address?.street ||
                "",
              customerName:
                order.customerName || order.userId?.name || "Customer",
              customerAddress:
                order.customerAddress ||
                order.deliveryAddress?.fullAddress ||
                "",
              customerPhone: order.customerPhone || order.userId?.phone || "",
              distance: order.deliveryInfo?.distanceKm || order.distance || 0,
              estimatedTime: "30 min",
              earnings:
                order.estimatedDeliveryFee ??
                order.earnings ??
                order.deliveryEarnings ??
                0,
              totalAmount: order.totalAmount,
              items:
                order.items?.map((item: any) => ({
                  name: item.food?.name || item.name || "Item",
                  quantity: item.quantity,
                })) || [],
              paymentType: paymentTypeOf(order),
              paymentStatus: order.paymentStatus,
              status: order.status || "delivered",
              cancellationReason: order.cancellationReason || null,
              autoCancelled: order.autoCancelled || false,
              preparationTime: order.preparationTime,
              createdAt: new Date(order.createdAt),
              pickupLocation: undefined,
              dropLocation: undefined,
            }));

            set({ orderHistory: orders });
            console.log(
              "✅ [History] Stored orderHistory count:",
              orders.length,
              "| statuses:",
              orders.map((o) => o.status),
            );
          } else {
            console.warn(
              "⚠️ [History] API returned no data:",
              JSON.stringify(response),
            );
          }
        } catch (error) {
          console.error("Fetch order history error:", error);
        } finally {
          set({ loading: false });
        }
      },

      updateLocation: async (
        latitude: number,
        longitude: number,
        metadata?: { heading?: number | null; accuracy?: number | null },
      ) => {
        const session = useAuthStore.getState();
        const generation = offerGeneration;
        try {
          const { activeOrder } = get();

          const result = await ApiService.updateLocation(
            latitude,
            longitude,
            metadata,
          );
          if (!sameOrderSession(session, generation)) return { success: false as const };
          if (result?.success === false) {
            return { success: false as const };
          }
          set({ driverLocation: { latitude, longitude } });

          if (activeOrder) {
            const partnerId = useAuthStore.getState().partner?.id;
            if (partnerId) {
              await updateDriverLocationInFirebase(
                partnerId,
                { latitude, longitude, heading: metadata?.heading },
                activeOrder.id,
              );
            }

            socketService.updateLocation(activeOrder.id, {
              latitude,
              longitude,
            });
          }

          return { success: true as const };
        } catch (error) {
          console.error("Update location error:", error);
          return { success: false as const };
        }
      },

      // ── Fix serialized Dates + expire stale timers after AsyncStorage hydration ─
      restorePersistedState: () => {
        const {
          missedOrders,
          pendingOrder,
          pendingOrderReceivedAt,
          activeOrder,
          activeOrders,
          orderHistory,
        } = get();
        const now = Date.now();

        // Revive Date objects (JSON.stringify turns them into strings)
        const fixedMissed: MissedOrder[] = (missedOrders || [])
          .map((m) => ({
            ...m,
            missedAt: new Date(m.missedAt),
            expiresAt: new Date(m.expiresAt),
            order: { ...m.order, createdAt: new Date(m.order.createdAt) },
          }))
          // prune only orders older than the 4-hour display window
          .filter(
            (m) => m.missedAt.getTime() + MISSED_ORDER_DISPLAY_TTL_MS > now,
          );

        let fixedPending: Order | null = pendingOrder
          ? { ...pendingOrder, createdAt: new Date(pendingOrder.createdAt) }
          : null;
        let fixedReceivedAt = pendingOrderReceivedAt;
        let updatedMissed = fixedMissed;

        // If the acceptance timer has expired while app was closed, move to missed
        if (fixedPending && fixedReceivedAt) {
          const elapsed = (now - fixedReceivedAt) / 1000;
          const timeout = fixedPending.acceptanceTimeoutSeconds ?? 30;
          if (elapsed >= timeout) {
            const expiredAt = fixedReceivedAt + timeout * 1000;
            const expiresAt = new Date(expiredAt + MISSED_ORDER_TTL_MS);
            if (expiresAt.getTime() > now) {
              const missed: MissedOrder = {
                order: fixedPending,
                missedAt: new Date(expiredAt),
                expiresAt,
                reason: "timeout",
                stillAvailable: false,
              };
              updatedMissed = [
                missed,
                ...fixedMissed.filter((m) => m.order.id !== fixedPending!.id),
              ];
            }
            fixedPending = null;
            fixedReceivedAt = null;
          }
        }

        set({
          missedOrders: updatedMissed.map((missed) => ({ ...missed, stillAvailable: false })),
          // Persisted offers are not proof of current server eligibility.
          pendingOrder: null,
          incomingOrder: null,
          pendingOrderReceivedAt: null,
          activeOrder: activeOrder
            ? { ...activeOrder, createdAt: new Date(activeOrder.createdAt) }
            : null,
          activeOrders: (activeOrders || []).map((o) => ({
            ...o,
            createdAt: new Date(o.createdAt),
          })),
          orderHistory: (orderHistory || []).map((o) => ({
            ...o,
            createdAt: new Date(o.createdAt),
          })),
        });
        console.log("✅ Persisted state restored:", {
          pendingOrder: fixedPending?.id ?? null,
          missedOrders: updatedMissed.length,
        });
      },
    }),
    {
      name: "delivery-order-store",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        orderOwnerId: state.orderOwnerId,
        activeOrder: state.activeOrder,
        activeOrders: state.activeOrders,
        pendingOrder: state.pendingOrder,
        pendingOrderReceivedAt: state.pendingOrderReceivedAt,
        missedOrders: state.missedOrders,
        orderHistory: state.orderHistory,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) state.restorePersistedState();
      },
    },
  ),
);
