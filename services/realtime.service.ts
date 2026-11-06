import { auth, firebaseConfig } from "@/config/firebase";
import { getApp } from "firebase/app";
import { onAuthStateChanged, signInWithCustomToken, signOut } from "firebase/auth";
import { getDatabase, onChildAdded, onValue, ref } from "firebase/database";
import { ApiService } from "./api";
import { AppState } from "react-native";
import { useAuthStore } from "../store/auth";

const db = getDatabase(getApp(), firebaseConfig.databaseURL);
// Serialize identity changes so a late sign-in cannot outlive logout/account switch.
let identityQueue: Promise<unknown> = Promise.resolve();
function withIdentity(work: () => Promise<void>) {
  const next = identityQueue.then(work, work);
  identityQueue = next.catch(() => {});
  return next;
}

export function subscribeToDeliveryRealtime(partnerId: string, handlers: {
  onOffersChanged: () => void;
  onOrderTaken: (orderId: string) => void;
  onOrderUpdated: (order: any) => void;
  watchAssignedOrders: (listener: (ids: string[]) => void) => () => void;
}) {
  let cancelled = false;
  let starting = false;
  let ready = false;
  const unsubscribers: (() => void)[] = [];
  const assigned = new Map<string, () => void>();
  const onError = () => {
    console.warn("[Realtime] Subscription unavailable; using REST refresh");
    if (!cancelled) handlers.onOffersChanged();
  };

  const start = () => {
    if (cancelled || starting || ready) return;
    starting = true;
    void withIdentity(async () => {
    if (cancelled) return;
    if (auth.currentUser && auth.currentUser.uid !== partnerId) await signOut(auth);
    const response = await ApiService.getFirebaseToken();
    if (cancelled) return;
    if (!response.success || !response.data?.customToken || response.data.partnerId !== partnerId) {
      throw new Error("Firebase token unavailable");
    }
    const { user } = await signInWithCustomToken(auth, response.data.customToken);
    if (cancelled) return;
    const token = await user.getIdTokenResult();
    if (cancelled) return;
    if (user.uid !== partnerId || token.claims.role !== "deliveryPartner" || token.claims.partnerId !== partnerId) {
      await signOut(auth);
      throw new Error("Firebase partner identity mismatch");
    }
    // All snapshots (including replay/removal) are REST invalidations, not offers.
    unsubscribers.push(onValue(
      ref(db, `delivery/partners/${partnerId}/availableOrders`),
      () => { if (!cancelled) handlers.onOffersChanged(); },
      onError,
    ));
    unsubscribers.push(onChildAdded(ref(db, "delivery/orderTaken"), (snapshot) => {
      if (cancelled) return;
      const orderId = snapshot.val()?.orderId || snapshot.key;
      if (orderId) handlers.onOrderTaken(orderId);
    }, onError));
    // Never read the database-wide /orders tree; rules must enforce assignment.
    unsubscribers.push(handlers.watchAssignedOrders((ids) => {
      const nextIds = new Set(ids);
      assigned.forEach((stop, id) => {
        if (!nextIds.has(id)) { stop(); assigned.delete(id); }
      });
      nextIds.forEach((id) => {
        if (assigned.has(id)) return;
        assigned.set(id, onValue(ref(db, `orders/${id}`), (snapshot) => {
          if (cancelled) return;
          const order = snapshot.val()?.payload;
          if ((order?._id || order?.id) === id) handlers.onOrderUpdated(order);
        }, onError));
      });
    }));
    ready = true;
    }).catch(onError).finally(() => { starting = false; });
  };
  start();
  const foreground = AppState.addEventListener("change", (state) => {
    if (state === "active") start();
  });

  return () => {
    cancelled = true;
    foreground.remove();
    unsubscribers.forEach((stop) => stop());
    assigned.forEach((stop) => stop());
    assigned.clear();
    void withIdentity(async () => { await signOut(auth); }).catch(() => {});
  };
}

export function subscribeToOrderPayment(orderId: string, onPaymentConfirmed: () => void) {
  const partnerId = useAuthStore.getState().partner?.id;
  const isOwner = () => !!partnerId && useAuthStore.getState().isAuthenticated &&
    useAuthStore.getState().partner?.id === partnerId;
  let stopPayment: (() => void) | undefined;
  // QR screens can mount before custom-token auth completes on a cold deep link.
  const stopAuth = onAuthStateChanged(auth, (user) => {
    stopPayment?.();
    stopPayment = undefined;
    if (!user || user.uid !== partnerId || !isOwner()) return;
    stopPayment = onValue(ref(db, `events/orders/${orderId}/payment-confirmed`), (snapshot) => {
      if (isOwner() && snapshot.exists()) onPaymentConfirmed();
    }, () => { console.warn("[Realtime] Payment subscription unavailable; use payment status refresh"); });
  });
  const stopScope = useAuthStore.subscribe(() => {
    if (!isOwner()) { stopAuth(); stopPayment?.(); stopPayment = undefined; }
  });
  return () => { stopScope(); stopAuth(); stopPayment?.(); };
}
