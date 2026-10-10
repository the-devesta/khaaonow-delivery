/**
 * Order payload helpers shared by the order screen: tolerate every location
 * and address shape the backend returns and flatten an order for display.
 */
import type { Location } from "@/store/orders";

export function formatAddressText(
  address: string | Record<string, any> | undefined | null,
  fallback = "Address unavailable",
) {
  if (!address) return fallback;
  if (typeof address === "string") return address || fallback;
  const a = address as any;
  if (a.fullAddress) return a.fullAddress;
  const parts = [a.street, a.city, a.state, a.postalCode].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : fallback;
}

/** Parse any backend location shape into { latitude, longitude } */
export function parseLocation(loc: any): Location | undefined {
  if (!loc) return undefined;
  if (Array.isArray(loc)) {
    if (loc.length >= 2 && typeof loc[0] === "number") {
      return { latitude: loc[1], longitude: loc[0] };
    }
    return undefined;
  }
  if (typeof loc !== "object") return undefined;
  // GeoJSON { type: "Point", coordinates: [lng, lat] }
  if (Array.isArray(loc.coordinates) && loc.coordinates.length >= 2) {
    return { latitude: loc.coordinates[1], longitude: loc.coordinates[0] };
  }
  if (typeof loc.latitude === "number" && typeof loc.longitude === "number") {
    return { latitude: loc.latitude, longitude: loc.longitude };
  }
  if (typeof loc.lat === "number" && typeof loc.lng === "number") {
    return { latitude: loc.lat, longitude: loc.lng };
  }
  return undefined;
}

/** Transform raw API order response to typed order object */
export function transformApiOrder(raw: any) {
  // restaurant can come as populated object (from API) or as restaurantId
  const restaurant = raw.restaurant || raw.restaurantId || {};
  const customer = raw.customer || raw.userId || {};
  const deliveryAddr = raw.deliveryAddress || {};
  const restaurantAddr = raw.restaurantAddress || {};

  const restaurantName =
    restaurant?.restaurantName ||
    restaurant?.name ||
    restaurantAddr?.name ||
    "Unknown Restaurant";
  const restaurantPhone =
    restaurant?.phone ||
    restaurant?.phoneNumber ||
    restaurant?.mobile ||
    restaurant?.ownerPhone ||
    restaurantAddr?.phone ||
    "";

  const restaurantAddress =
    restaurant?.address?.street ||
    restaurant?.address?.fullAddress ||
    restaurantAddr?.fullAddress ||
    restaurantAddr?.street ||
    "";

  const customerName = customer?.name || "Customer";
  const customerPhone = customer?.phone || "";
  const customerAddress =
    deliveryAddr?.fullAddress || deliveryAddr?.street || "";

  const pickupLocation =
    parseLocation(restaurant?.location) ??
    parseLocation(restaurant?.address?.location) ??
    parseLocation(restaurant?.address?.coordinates) ??
    (restaurantAddr?.latitude != null
      ? {
          latitude: restaurantAddr.latitude,
          longitude: restaurantAddr.longitude,
        }
      : undefined);

  const dropLocation =
    parseLocation(deliveryAddr?.location) ??
    parseLocation(deliveryAddr?.coordinates) ??
    (deliveryAddr?.latitude != null
      ? { latitude: deliveryAddr.latitude, longitude: deliveryAddr.longitude }
      : undefined);

  // The backend sends the rider's earning as estimatedDeliveryFee. Never
  // guess: deliveryFee is what the customer paid, not what the rider earns.
  const earnings = Number(raw.estimatedDeliveryFee ?? raw.earnings ?? 0) || 0;

  const totalAmount = raw.totalAmount || raw.total || 0;

  // Determine payment category for the delivery UI logic
  const rawPaymentMethod: string = raw.paymentMethod || "cash";
  const paymentType =
    rawPaymentMethod === "card" ||
    rawPaymentMethod === "razorpay" ||
    rawPaymentMethod === "online"
      ? ("online" as const)
      : ("cash" as const);

  return {
    id: raw.id || raw._id,
    orderNumber: raw.orderNumber || raw._id || raw.id || "",
    status: raw.status,
    restaurantName,
    restaurantPhone,
    restaurantAddress,
    customerName,
    customerPhone,
    customerAddress,
    pickupLocation,
    dropLocation,
    earnings,
    totalAmount,
    returnReason:
      raw.status === "returning_to_restaurant"
        ? raw.pendingDecision?.reason
        : undefined,
    distance: raw.deliveryInfo?.distanceKm || 0,
    paymentType,
    rawPaymentMethod,
    paymentStatus: raw.paymentStatus || "pending",
    items:
      raw.items?.map((item: any) => ({
        name: item.food?.name || item.name || "Item",
        quantity: item.quantity,
      })) || [],
    createdAt: new Date(raw.createdAt),
    estimatedTime: (() => {
      const raw2 = raw.deliveryInfo?.durationMinutes;
      if (!raw2) return "30 min";
      const mins = raw2 > 120 ? Math.ceil(raw2 / 60) : Math.ceil(raw2);
      return `${mins} min`;
    })(),
  };
}
export type OrderView = ReturnType<typeof transformApiOrder>;

/** i18n key for the rider's next step on an active order. */
export const NEXT_STEP_KEY: Record<string, string> = {
  delivery_partner_accepted: "home.nextGoRestaurant",
  accepted: "home.nextGoRestaurant",
  delivery_partner_reached: "home.nextPickUp",
  delivery_partner_picked_up: "home.nextGoCustomer",
  picked_up: "home.nextGoCustomer",
  delivery_partner_reached_user_dest: "home.nextHandOver",
  on_the_way: "home.nextHandOver",
  returning_to_restaurant: "home.nextReturn",
};
