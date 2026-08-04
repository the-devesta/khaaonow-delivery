import PaymentOptionsModal from "@/components/delivery/PaymentOptionsModal";
import DeliveryMap, {
  RouteInfo,
  haversineM,
} from "@/components/map/DeliveryMap";
import { useLocationTracking } from "@/hooks/useLocationTracking";
import ActionFooter from "@/components/orders/ActionFooter";
import { ApiService } from "@/services/api";
import { subscribeToOrderPayment } from "@/services/realtime.service";
import { socketService } from "@/services/socket";
import { uploadImageToFirebase } from "@/services/storage";
import { Location, useOrderStore } from "@/store/orders";
import { openPhoneDialer } from "@/utils/phone";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { Ionicons } from "@expo/vector-icons";
import * as Device from "expo-device";
import * as ExpoLocation from "expo-location";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  JSXElementConstructor,
  Key,
  ReactElement,
  ReactNode,
  ReactPortal,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Linking,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

const STEPS = [
  { labelKey: "orderDetail.accepted", icon: "checkmark-done-outline" },
  { labelKey: "orderDetail.atRestaurant", icon: "restaurant-outline" },
  { labelKey: "orderDetail.pickedUp", icon: "bicycle-outline" },
  { labelKey: "orderDetail.arriving", icon: "location-outline" },
];

const CONTACT_SHEET_SNAP_POINTS = ["34%"];

const debugPaymentSheet = (message: string, details?: Record<string, unknown>) => {
  if (__DEV__) {
    console.log(`[PaymentSheetDebug] ${message}`, details ?? "");
  }
};

const renderContactBackdrop = (props: any) => (
  <BottomSheetBackdrop
    {...props}
    appearsOnIndex={0}
    disappearsOnIndex={-1}
    opacity={0.45}
    pressBehavior="close"
  />
);

function formatAddressText(
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

// ── Navigation helpers ────────────────────────────────────────────────────

function getManeuverIcon(
  maneuver?: string,
): React.ComponentProps<typeof Ionicons>["name"] {
  switch (maneuver) {
    case "turn-left":
      return "arrow-back";
    case "turn-right":
      return "arrow-forward";
    case "turn-sharp-left":
      return "return-down-back";
    case "turn-sharp-right":
      return "return-down-forward";
    case "uturn-left":
    case "uturn-right":
      return "refresh";
    case "roundabout-left":
    case "roundabout-right":
      return "sync-circle";
    case "merge":
      return "git-branch";
    default:
      return "arrow-up";
  }
}

/** Parse any backend location shape into { latitude, longitude } */
function parseLocation(loc: any): Location | undefined {
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
function transformApiOrder(raw: any) {
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

  const earnings =
    raw.estimatedDeliveryFee ||
    raw.deliveryFee ||
    Math.max(30, (raw.totalAmount || 0) * 0.1);

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

export default function OrderDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const {
    activeOrder,
    activeOrders,
    updateOrderStatus,
    completeOrder,
    releaseActiveOrder,
    setDriverLocation,
    confirmReturnedToRestaurant,
  } =
    useOrderStore();
  const locationTracking = useLocationTracking();

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [proofUploading, setProofUploading] = useState(false);
  const [reportingIssue, setReportingIssue] = useState(false);
  const [confirmingReturn, setConfirmingReturn] = useState(false);
  const [apiOrder, setApiOrder] = useState<ReturnType<
    typeof transformApiOrder
  > | null>(null);
  const [driverLocation, setDriverLoc] = useState<Location | null>(null);
  const [isMapCollapsed, setIsMapCollapsed] = useState(false);
  const [itemsExpanded, setItemsExpanded] = useState(false);
  const contactSheetRef = useRef<BottomSheetModal>(null);
  const mapHeightAnim = useRef(new Animated.Value(1)).current; // 1 = full, 0 = collapsed

  // Navigation mode state
  const [isNavigating, setIsNavigating] = useState(false);
  const [routeInfo, setRouteInfo] = useState<RouteInfo>({
    steps: [],
    etaMin: 0,
    distKm: 0,
  });
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const handleRouteLoaded = useCallback((info: RouteInfo) => {
    setRouteInfo((current) => {
      const sameEta = current.etaMin === info.etaMin;
      const sameDist = current.distKm === info.distKm;
      const sameSteps = current.steps.length === info.steps.length;
      return sameEta && sameDist && sameSteps ? current : info;
    });
    setCurrentStepIdx((current) => (current === 0 ? current : 0));
  }, []);

  const matchedActiveOrder =
    activeOrders.find((order) => order.id === id) ||
    (activeOrder?.id === id ? activeOrder : null);
  const isActiveOrder = Boolean(matchedActiveOrder);

  // Fetch full order details from API (gives us properly populated restaurant/customer)
  const fetchOrder = async () => {
    if (!id) return;
    try {
      const res = await ApiService.getOrderById(id);
      if (res.success && res.data) {
        setApiOrder(transformApiOrder(res.data));
      }
    } catch (err) {
      console.error("Failed to fetch order details:", err);
    }
  };

  useEffect(() => {
    fetchOrder();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Join the socket room for this order so we receive payment-confirmed events
  // when the Razorpay webhook fires (QR / Payment Link paid).
  useEffect(() => {
    if (!id) return;
    socketService.joinOrderRoom(id);

    const handlePaymentConfirmedSocket = (data: {
      orderId: string;
      paymentStatus: string;
    }) => {
      if (data.orderId !== id) return;
      console.log("[Socket] payment-confirmed received:", data);
      // Refresh order so displayOrder.paymentStatus becomes "paid"
      fetchOrder();
      setPaymentConfirmed(true);
    };

    socketService.on("payment-confirmed", handlePaymentConfirmedSocket);

    return () => {
      socketService.off("payment-confirmed", handlePaymentConfirmedSocket);
      socketService.leaveOrderRoom(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!id) return;

    return subscribeToOrderPayment(id, () => {
      console.log("[Firebase] payment-confirmed received:", id);
      fetchOrder();
      setPaymentConfirmed(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Consume the shared GPS tracking hook instead of starting a second watcher
  // on the active-order screen.
  useEffect(() => {
    if (!isActiveOrder || !locationTracking.currentLocation) return;

    setDriverLoc(locationTracking.currentLocation);
    setDriverLocation(locationTracking.currentLocation);
  }, [
    isActiveOrder,
    locationTracking.currentLocation,
    setDriverLocation,
  ]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchOrder();
    setRefreshing(false);
  };

  const openPaymentModal = useCallback(() => {
    debugPaymentSheet("openPaymentModal called", {
      orderId: id,
      previousVisible: paymentModalVisible,
    });
    setLoading(false);
    setPaymentModalVisible(true);
  }, [id, paymentModalVisible]);

  // Advance turn-by-turn step when driver gets close to step end-point
  useEffect(() => {
    if (!isNavigating || !driverLocation || routeInfo.steps.length === 0)
      return;
    const step = routeInfo.steps[currentStepIdx];
    if (!step) return;
    const dist = haversineM(driverLocation, step.endLocation);
    if (dist < 40 && currentStepIdx < routeInfo.steps.length - 1) {
      setCurrentStepIdx((idx) => idx + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverLocation, isNavigating]);

  const toggleMapCollapse = () => {
    const toValue = isMapCollapsed ? 1 : 0;
    setIsMapCollapsed(!isMapCollapsed);

    Animated.spring(mapHeightAnim, {
      toValue,
      useNativeDriver: false,
      tension: 50,
      friction: 8,
    }).start();
  };

  const openExternalNavigation = (destination?: Location) => {
    if (!destination) {
      Alert.alert("Location unavailable", "Destination coordinates are missing.");
      return;
    }

    const label =
      navPhase === "pickup"
        ? displayOrder?.restaurantName
        : displayOrder?.customerName;
    const encodedLabel = encodeURIComponent(label || "KhaaoNow destination");
    const webGoogleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${destination.latitude},${destination.longitude}&travelmode=driving`;
    const nativeGoogleMapsUrl = `comgooglemaps://?daddr=${destination.latitude},${destination.longitude}&directionsmode=driving&q=${encodedLabel}`;

    if (Platform.OS === "ios") {
      Linking.canOpenURL("comgooglemaps://")
        .then((canOpenGoogleMaps) =>
          Linking.openURL(canOpenGoogleMaps ? nativeGoogleMapsUrl : webGoogleMapsUrl),
        )
        .catch(() =>
          Alert.alert(
            "Navigation unavailable",
            "Could not open Google Maps on this device.",
          ),
        );
      return;
    }

    Linking.openURL(webGoogleMapsUrl).catch(() =>
      Alert.alert(
        "Navigation unavailable",
        "Could not open Google Maps on this device.",
      ),
    );
  };

  const triggerSOS = () => {
    Alert.alert(
      "Emergency SOS",
      "Call emergency services now? Use this only for urgent rider safety issues.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Call 112",
          style: "destructive",
          onPress: () => openPhoneDialer("112"),
        },
      ],
    );
  };

  const reportDelay = () => {
    if (!displayOrder?.id) return;
    Alert.alert("Report Delay", "Notify customer and support that this delivery is delayed?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Report",
        onPress: async () => {
          setReportingIssue(true);
          try {
            const res = await ApiService.reportDeliveryDelay(
              String(displayOrder.id),
              "Traffic or operational delay",
            );
            Alert.alert(
              res.success ? "Delay Reported" : "Failed",
              res.message || "Delay update sent.",
            );
          } finally {
            setReportingIssue(false);
          }
        },
      },
    ]);
  };

  const requestReassignment = () => {
    if (!displayOrder?.id) return;
    Alert.alert(
      "Request Reassignment",
      "Use this only if you cannot complete the delivery. The order will be released for another rider.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Release Order",
          style: "destructive",
          onPress: async () => {
            setReportingIssue(true);
            try {
              const res = await ApiService.requestOrderReassignment(
                String(displayOrder.id),
                "Rider unable to continue delivery",
              );
              if (res.success) {
                releaseActiveOrder(String(displayOrder.id));
                Alert.alert(
                  "Reassignment Requested",
                  "Order released for another rider.",
                  [{ text: "OK", onPress: () => router.replace("/(tabs)") }],
                );
              } else {
                Alert.alert("Failed", res.message || "Could not release order.");
              }
            } finally {
              setReportingIssue(false);
            }
          },
        },
      ],
    );
  };

  const confirmReturned = () => {
    if (!displayOrder?.id) return;
    Alert.alert(
      "Confirm Return",
      "Confirm you've handed this order back to the restaurant?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: async () => {
            setConfirmingReturn(true);
            try {
              const ok = await confirmReturnedToRestaurant(String(displayOrder.id));
              if (ok) {
                router.replace("/(tabs)");
              } else {
                Alert.alert("Failed", "Could not confirm the return. Try again.");
              }
            } finally {
              setConfirmingReturn(false);
            }
          },
        },
      ],
    );
  };

  // Merge: prefer API order details for display, but use local store status for flow
  const displayOrder = apiOrder
    ? {
        ...apiOrder,
        // Always use local store status for the flow logic (it's more up-to-date)
        status: isActiveOrder
          ? (matchedActiveOrder?.status ?? apiOrder.status)
          : apiOrder.status,
      }
    : matchedActiveOrder
      ? matchedActiveOrder
      : null;

  // Navigate back if order truly not found anymore
  useEffect(() => {
    if (!apiOrder && !matchedActiveOrder && id) {
      // Give fetchOrder a chance first — only go back if both are null after a beat
      const timer = setTimeout(() => {
        if (!apiOrder && !matchedActiveOrder) {
          router.back();
        }
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [apiOrder, matchedActiveOrder, id, router]);

  if (!displayOrder) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center">
        <ActivityIndicator size="large" color="#F59E0B" />
        <Text className="text-gray-600 mt-4 font-medium">
          Loading order details...
        </Text>
      </SafeAreaView>
    );
  }

  const getCurrentStep = () => {
    switch (displayOrder.status) {
      case "delivery_partner_accepted":
      case "accepted":
        return 1;
      case "delivery_partner_reached":
        return 2;
      case "delivery_partner_picked_up":
      case "picked_up":
        return 3;
      case "delivery_partner_reached_user_dest":
      case "on_the_way":
        return 4;
      case "delivered":
        return 5;
      default:
        return 1;
    }
  };

  const getActionLabel = () => {
    switch (displayOrder.status) {
      case "delivery_partner_accepted":
      case "accepted":
        return t("orderDetail.reachedRestaurant");
      case "delivery_partner_reached":
        return t("orderDetail.orderPickedUp");
      case "delivery_partner_picked_up":
      case "picked_up":
        return t("orderDetail.reachedDropoff");
      case "delivery_partner_reached_user_dest":
      case "on_the_way":
        if (
          displayOrder?.paymentType === "online" ||
          paymentConfirmed ||
          displayOrder?.paymentStatus === "completed" ||
          displayOrder?.paymentStatus === "paid"
        ) {
          return t("orderDetail.completeOrder");
        }
        return t("payment.collectPayment");
      default:
        return t("orderDetail.continue");
    }
  };

  const isPaymentAlreadySettled =
    displayOrder?.paymentType === "online" ||
    paymentConfirmed ||
    displayOrder?.paymentStatus === "completed" ||
    displayOrder?.paymentStatus === "paid";

  const isCollectPaymentAction =
    (displayOrder.status === "delivery_partner_reached_user_dest" ||
      displayOrder.status === "on_the_way") &&
    !isPaymentAlreadySettled;

  const handlePrimaryActionPress = () => {
    debugPaymentSheet("primary action pressed", {
      orderId: displayOrder.id,
      orderNumber: (displayOrder as any).orderNumber,
      status: displayOrder.status,
      paymentType: displayOrder.paymentType,
      rawPaymentMethod: (displayOrder as any).rawPaymentMethod,
      paymentStatus: (displayOrder as any).paymentStatus,
      paymentConfirmed,
      isPaymentAlreadySettled,
      isCollectPaymentAction,
      actionLabel: getActionLabel(),
      loading,
      paymentModalVisible,
      isNavigating,
    });
    if (isCollectPaymentAction) {
      openPaymentModal();
      return;
    }

    void handleAction();
  };

  const handleAction = async () => {
    if (!isActiveOrder) return;

    setLoading(true);

    try {
      switch (displayOrder.status) {
        case "delivery_partner_accepted":
        case "accepted":
          await updateOrderStatus("delivery_partner_reached", {
            orderId: String(displayOrder.id),
          });
          break;
        case "delivery_partner_reached":
          await updateOrderStatus("delivery_partner_picked_up", {
            orderId: String(displayOrder.id),
          });
          break;
        case "delivery_partner_picked_up":
        case "picked_up":
          await updateOrderStatus("delivery_partner_reached_user_dest", {
            orderId: String(displayOrder.id),
          });
          break;
        case "delivery_partner_reached_user_dest":
        case "on_the_way":
          // Always verify customer handoff OTP before proof/photo completion.
          debugPaymentSheet("handleAction reached collect-payment status", {
            orderId: displayOrder.id,
            orderNumber: (displayOrder as any).orderNumber,
            status: displayOrder.status,
            paymentType: displayOrder.paymentType,
            rawPaymentMethod: (displayOrder as any).rawPaymentMethod,
            paymentStatus: (displayOrder as any).paymentStatus,
          });
          openPaymentModal();
          return;
      }
      // Refresh order display after status change
      await fetchOrder();
    } catch (error) {
      console.error("Update order status error:", error);
      Alert.alert("Error", "Failed to update order status. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentConfirmed = async () => {
    setPaymentModalVisible(false);
    setPaymentConfirmed(true);
    await completeDeliveryWithProof();
  };

  const ensureCurrentLocation = async (): Promise<Location | null> => {
    if (driverLocation) return driverLocation;

    const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Location Required", "Enable location to verify pickup/drop geofence.");
      return null;
    }

    const pos = await ExpoLocation.getCurrentPositionAsync({
      accuracy: ExpoLocation.Accuracy.High,
    });
    const loc = {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
    };
    setDriverLoc(loc);
    setDriverLocation(loc);
    return loc;
  };

  const captureProofPhoto = async (): Promise<string | null> => {
    const usePhotoLibraryOnly = !Device.isDevice;

    if (usePhotoLibraryOnly) {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Photos Required",
          "Select a delivery proof image from the photo library to complete this order.",
        );
        return null;
      }

      Alert.alert(
        "Simulator Mode",
        "The iOS simulator does not provide a real camera. Please choose a proof image from Photos.",
      );

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 0.65,
      });

      if (result.canceled || !result.assets?.[0]?.uri) return null;
      return uploadImageToFirebase(result.assets[0].uri, "delivery_proofs");
    }

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Camera Required",
        "Take a delivery proof photo to complete this order.",
      );
      return null;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      allowsEditing: false,
      quality: 0.65,
    });

    if (result.canceled || !result.assets?.[0]?.uri) return null;
    return uploadImageToFirebase(result.assets[0].uri, "delivery_proofs");
  };

  const completeDeliveryWithProof = async () => {
    setLoading(true);
    setProofUploading(true);
    try {
      const loc = await ensureCurrentLocation();
      if (!loc) return;

      const proofPhotoUrl = await captureProofPhoto();
      if (!proofPhotoUrl) return;

      const success = await updateOrderStatus("delivered", {
        orderId: String(displayOrder?.id || id),
        currentLocation: loc,
        proofPhotoUrl,
      });

      if (success) {
        completeOrder(String(displayOrder?.id || id));
        Alert.alert("🎉 Success", "Order delivered with proof captured.", [
          {
            text: "OK",
            onPress: () => setTimeout(() => router.replace("/(tabs)"), 100),
          },
        ]);
      } else {
        setPaymentConfirmed(false);
      }
    } catch (error: any) {
      console.error("Complete delivery proof error:", error);
      Alert.alert(
        "Delivery Proof Failed",
        error?.message || "Failed to complete delivery. Please try again.",
      );
      setPaymentConfirmed(false);
    } finally {
      setProofUploading(false);
      setLoading(false);
    }
  };

  const currentStep = getCurrentStep();

  // Which destination phase are we navigating toward?
  const navPhase: "pickup" | "dropoff" =
    currentStep >= 3 ||
    (displayOrder?.status &&
      [
        "delivery_partner_picked_up",
        "picked_up",
        "delivery_partner_reached_user_dest",
        "on_the_way",
      ].includes(displayOrder.status))
      ? "dropoff"
      : "pickup";
  const phaseTitle =
    displayOrder.status === "delivered"
      ? t("orderDetail.deliveryCompleted")
      : navPhase === "pickup"
        ? t("orderDetail.pickupFromRestaurant")
        : t("orderDetail.deliverToCustomer");
  const phaseName =
    navPhase === "pickup" ? displayOrder.restaurantName : displayOrder.customerName;
  const phaseAddress =
    navPhase === "pickup"
      ? formatAddressText(displayOrder.restaurantAddress, t("orderDetail.addressUnavailable"))
      : formatAddressText(displayOrder.customerAddress, t("orderDetail.addressUnavailable"));
  const routeEtaText =
    routeInfo.etaMin > 0 && routeInfo.distKm > 0
      ? `${routeInfo.etaMin} min • ${routeInfo.distKm} km`
      : t("orderDetail.calculatingRoute");
  const statusText =
    currentStep <= 1
      ? t("orderDetail.accepted")
      : currentStep === 2
        ? t("orderDetail.atRestaurant")
        : currentStep === 3
          ? t("orderDetail.pickedUp")
          : currentStep === 4
            ? t("orderDetail.arriving")
            : t("orderDetail.delivered");
  const contactName =
    navPhase === "pickup" ? displayOrder.restaurantName : displayOrder.customerName;
  const contactRole = navPhase === "pickup" ? "Restaurant" : "Customer";
  const contactPhone =
    navPhase === "pickup"
      ? (displayOrder as any).restaurantPhone || displayOrder.customerPhone
      : displayOrder.customerPhone || (displayOrder as any).restaurantPhone;

  const openContactSheet = () => {
    if (!contactPhone) {
      Alert.alert("Phone unavailable", `${contactRole} phone number is not available.`);
      return;
    }
    contactSheetRef.current?.present();
  };

  const callContact = () => {
    if (!contactPhone) return;
    openPhoneDialer(contactPhone);
  };

  const orderOverlays = (
    <>
      {/* Payment sheet — must be mounted in normal and fullscreen navigation modes. */}
      <PaymentOptionsModal
        visible={paymentModalVisible}
        orderId={String(displayOrder.id)}
        orderNumber={String((displayOrder as any).orderNumber || displayOrder.id)}
        totalAmount={(displayOrder as any).totalAmount || 0}
        paymentMethod={
          (displayOrder as any).rawPaymentMethod || displayOrder.paymentType
        }
        paymentStatus={(displayOrder as any).paymentStatus || "pending"}
        onPaymentConfirmed={handlePaymentConfirmed}
        onClose={() => {
          debugPaymentSheet("payment modal onClose", {
            orderId: displayOrder.id,
            orderNumber: (displayOrder as any).orderNumber,
          });
          setPaymentModalVisible(false);
        }}
      />

      <BottomSheetModal
        ref={contactSheetRef}
        snapPoints={CONTACT_SHEET_SNAP_POINTS}
        enablePanDownToClose
        backdropComponent={renderContactBackdrop}
        backgroundStyle={{ backgroundColor: "#FFFFFF", borderRadius: 28 }}
        handleIndicatorStyle={{ backgroundColor: "#D1D5DB", width: 42 }}>
        <BottomSheetView style={orderStyles.contactSheetContent}>
          <View style={orderStyles.contactSheetIcon}>
            <Ionicons name="call" size={26} color="#FF6A00" />
          </View>
          <Text style={orderStyles.contactSheetTitle}>
            Call {contactRole}
          </Text>
          <Text style={orderStyles.contactSheetName} numberOfLines={1}>
            {contactName}
          </Text>
          <TouchableOpacity
            onPress={callContact}
            activeOpacity={0.85}
            style={orderStyles.contactSheetCallButton}>
            <Ionicons name="call" size={18} color="#FFFFFF" />
            <Text style={orderStyles.contactSheetCallButtonText}>Call now</Text>
          </TouchableOpacity>
          <Text selectable style={orderStyles.contactSheetPhone}>
            {contactPhone || "Phone number unavailable"}
          </Text>
          <Text style={orderStyles.contactSheetHint}>
            If the call button does not open, long-press/copy this number and dial manually.
          </Text>
        </BottomSheetView>
      </BottomSheetModal>
    </>
  );

  // Use real GPS for driver marker; fall back to null (shows no driver pin)
  const safeDriverLoc = driverLocation;

  // ── Full-screen Navigation Mode ──────────────────────────────────────────
  if (isNavigating && displayOrder && isActiveOrder) {
    const step = routeInfo.steps[currentStepIdx];
    const phaseName =
      navPhase === "pickup"
        ? displayOrder.restaurantName
        : displayOrder.customerName;
    return (
      <View style={{ flex: 1 }}>
        {/* Map fills entire screen */}
        <DeliveryMap
          driverLocation={safeDriverLoc}
          pickupLocation={displayOrder.pickupLocation}
          dropLocation={displayOrder.dropLocation}
          showRoute
          navigationMode
          activePhase={navPhase}
          onRouteLoaded={handleRouteLoaded}
        />

        {/* ── Top: instruction card ── */}
        <SafeAreaView style={navStyles.topOverlay} edges={["top"]}>
          <View style={navStyles.instructionCard}>
            <View style={navStyles.maneuverCircle}>
              <Ionicons
                name={getManeuverIcon(step?.maneuver)}
                size={26}
                color="#fff"
              />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={navStyles.instructionText} numberOfLines={2}>
                {step?.instruction ??
                  (navPhase === "pickup"
                    ? "Head to restaurant"
                    : "Head to customer")}
              </Text>
              {step && (
                <Text style={navStyles.stepDist}>
                  {step.distanceText} ahead
                </Text>
              )}
            </View>
          </View>
        </SafeAreaView>

        {/* ── Bottom: ETA + action ── */}
        <View
          style={[
            navStyles.bottomSheet,
            { paddingBottom: Math.max(insets.bottom + 12, 22) },
          ]}>
          {/* ETA row */}
          <View style={navStyles.etaRow}>
            <View style={navStyles.etaBlock}>
              <Text style={navStyles.etaValue}>
                {routeInfo.etaMin > 0 ? routeInfo.etaMin : "--"}
              </Text>
              <Text style={navStyles.etaLabel}>min</Text>
            </View>
            <View style={navStyles.etaDivider} />
            <View style={navStyles.etaBlock}>
              <Text style={navStyles.etaValue}>
                {routeInfo.distKm > 0 ? routeInfo.distKm : "--"}
              </Text>
              <Text style={navStyles.etaLabel}>km</Text>
            </View>
            <View style={{ flex: 1 }} />
            <View style={navStyles.phaseTag}>
              <Ionicons
                name={navPhase === "pickup" ? "restaurant" : "person"}
                size={13}
                color="#FF6A00"
                style={{ marginRight: 4 }}
              />
              <Text style={navStyles.phaseText} numberOfLines={1}>
                {phaseName}
              </Text>
            </View>
          </View>

          {/* Buttons */}
          <View style={navStyles.btnRow}>
            <TouchableOpacity
              style={navStyles.exitBtn}
              onPress={() => setIsNavigating(false)}
              activeOpacity={0.7}>
              <Ionicons name="close" size={22} color="#1F2937" />
            </TouchableOpacity>
            <TouchableOpacity
              style={navStyles.actionBtn}
              onPress={handlePrimaryActionPress}
              disabled={loading}
              activeOpacity={0.85}>
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={navStyles.actionBtnText}>{getActionLabel()}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
        {orderOverlays}
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={["top"]}>
      <View className="flex-1">
        {/* Header */}
        <View className="bg-gray-50 px-4 pt-2 pb-3 flex-row items-center justify-between">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 bg-white rounded-full items-center justify-center "
            activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={20} color="#1A1A1A" />
          </TouchableOpacity>
          <Text className="text-base font-bold text-gray-900" numberOfLines={1}>
            {t("orderDetail.orderNumber", { number: String(displayOrder.id).slice(-6) })}
          </Text>
          <TouchableOpacity
            onPress={handleRefresh}
            className="w-10 h-10 bg-white rounded-full items-center justify-center "
            activeOpacity={0.7}>
            <Ionicons name="refresh-outline" size={20} color="#1A1A1A" />
          </TouchableOpacity>
        </View>

        {/* Map + live route */}
        <Animated.View
          style={{
            height: mapHeightAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [188, 388],
            }),
          }}>
          {/* Map Section */}
          <Animated.View
            style={{
              height: mapHeightAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [170, 360],
              }),
              overflow: "hidden",
            }}>
            <DeliveryMap
              driverLocation={safeDriverLoc}
              pickupLocation={displayOrder.pickupLocation}
              dropLocation={displayOrder.dropLocation}
              showRoute={displayOrder.status !== "cancelled"}
              navigationMode={isActiveOrder}
              activePhase={navPhase}
              onRouteLoaded={handleRouteLoaded}
            />

            <View style={orderStyles.mapRouteBar}>
              <View style={orderStyles.mapRouteIcon}>
                <Ionicons
                  name={navPhase === "pickup" ? "restaurant" : "person"}
                  size={17}
                  color="#FF6A00"
                />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={orderStyles.mapRouteLabel} numberOfLines={1}>
                  {navPhase === "pickup"
                    ? t("orderDetail.goToPickup")
                    : t("orderDetail.goToCustomer")}
                </Text>
                <Text style={orderStyles.mapRouteMeta} numberOfLines={1}>
                  {routeEtaText}
                </Text>
              </View>
              {isActiveOrder &&
                displayOrder.status !== "delivered" &&
                displayOrder.status !== "cancelled" && (
                  <TouchableOpacity
                    onPress={() => {
                      setCurrentStepIdx(0);
                      setIsNavigating(true);
                    }}
                    style={orderStyles.mapRouteButton}
                    activeOpacity={0.85}>
                    <Ionicons name="navigate" size={16} color="#fff" />
                    <Text style={orderStyles.mapRouteButtonText}>{t("common.start")}</Text>
                  </TouchableOpacity>
                )}
            </View>

            {/* Map Toggle Button */}
            <TouchableOpacity
              onPress={toggleMapCollapse}
              className="absolute top-3 left-3 w-10 h-10 bg-white rounded-full items-center justify-center shadow-xl border-2 border-white"
              activeOpacity={0.7}>
              <Ionicons
                name={isMapCollapsed ? "chevron-down" : "chevron-up"}
                size={20}
                color="#1A1A1A"
              />
            </TouchableOpacity>
          </Animated.View>

          <View style={orderStyles.progressStrip}>
            {STEPS.map((step, index) => {
              const stepNumber = index + 1;
              const isDone = stepNumber < currentStep;
              const isActive = stepNumber === currentStep;
              return (
                <View key={step.labelKey} style={orderStyles.progressSegmentWrap}>
                  <View
                    style={[
                      orderStyles.progressDot,
                      (isDone || isActive) && orderStyles.progressDotFilled,
                    ]}
                  />
                  {index < STEPS.length - 1 && (
                    <View
                      style={[
                        orderStyles.progressLine,
                        isDone && orderStyles.progressLineFilled,
                      ]}
                    />
                  )}
                </View>
              );
            })}
          </View>
        </Animated.View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 140 }}
          className="bg-gray-50"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#F59E0B"
              colors={["#F59E0B"]}
            />
          }>
          <View className="px-4 pt-4">
            <View style={orderStyles.taskCard}>
              <View style={orderStyles.taskHeader}>
                <View style={orderStyles.taskIcon}>
                  <Ionicons
                    name={navPhase === "pickup" ? "restaurant" : "navigate"}
                    size={20}
                    color="#FFFFFF"
                  />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={orderStyles.taskEyebrow}>{statusText}</Text>
                  <Text style={orderStyles.taskTitle} numberOfLines={1}>
                    {phaseTitle}
                  </Text>
                </View>
                <View style={orderStyles.taskMetric}>
                  <Text style={orderStyles.taskMetricText} numberOfLines={1}>
                    {routeEtaText}
                  </Text>
                </View>
              </View>
              <Text style={orderStyles.taskName} numberOfLines={1}>
                {phaseName}
              </Text>
              <Text style={orderStyles.taskAddress} numberOfLines={2}>
                {phaseAddress}
              </Text>
              <View style={orderStyles.quickActions}>
                <TouchableOpacity
                  onPress={() =>
                    openExternalNavigation(
                      navPhase === "pickup"
                        ? displayOrder.pickupLocation
                        : displayOrder.dropLocation,
                    )
                  }
                  style={orderStyles.primaryQuickAction}
                  activeOpacity={0.78}>
                  <Ionicons name="navigate" size={17} color="#FFFFFF" />
                  <Text style={orderStyles.primaryQuickActionText}>
                    {t("orderDetail.openMaps")}
                  </Text>
                </TouchableOpacity>
                {contactPhone ? (
                  <View style={orderStyles.callQuickActionWrap}>
                    <TouchableOpacity
                      onPress={openContactSheet}
                      style={orderStyles.secondaryQuickAction}
                      activeOpacity={0.78}>
                      <Ionicons name="call" size={17} color="#111827" />
                    </TouchableOpacity>
                    <Text
                      selectable
                      numberOfLines={1}
                      style={orderStyles.callQuickActionPhone}>
                      {contactPhone}
                    </Text>
                  </View>
                ) : null}
                <TouchableOpacity
                  onPress={triggerSOS}
                  style={orderStyles.sosQuickAction}
                  activeOpacity={0.78}>
                  <Ionicons name="alert-circle" size={18} color="#DC2626" />
                </TouchableOpacity>
              </View>
            </View>

            {displayOrder.status === "returning_to_restaurant" && (
              <View className="bg-red-50 border border-red-100 rounded-2xl p-4 mb-3">
                <View className="flex-row items-start">
                  <Ionicons name="return-up-back" size={18} color="#DC2626" />
                  <View className="ml-2 flex-1">
                    <Text className="text-red-700 font-bold text-xs mb-1">
                      Return this order to the restaurant
                    </Text>
                    <Text className="text-red-600 font-semibold text-xs">
                      {displayOrder.returnReason ||
                        "Admin decided this order needs to go back to the restaurant."}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={confirmReturned}
                  disabled={confirmingReturn}
                  className="bg-red-600 rounded-xl py-2.5 items-center mt-3">
                  <Text className="text-white font-bold text-xs">
                    {confirmingReturn ? "Confirming..." : "Mark as Returned to Restaurant"}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {isActiveOrder && displayOrder.status !== "returning_to_restaurant" && (
              <View className="flex-row items-center justify-between px-1 mb-3">
                <View className="flex-row items-center flex-1 mr-2">
                  <Ionicons name="battery-charging-outline" size={14} color="#9CA3AF" />
                  <Text
                    className="text-[11px] text-gray-400 font-medium ml-1.5 flex-1"
                    numberOfLines={2}>
                    Keep the app open — disable battery saver if tracking stops
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={reportDelay}
                  disabled={reportingIssue}
                  hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}>
                  <Text className="text-xs font-bold text-amber-600">Delay</Text>
                </TouchableOpacity>
                <Text className="text-gray-300 mx-2">|</Text>
                <TouchableOpacity
                  onPress={requestReassignment}
                  disabled={reportingIssue}
                  hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}>
                  <Text className="text-xs font-bold text-red-600">Reassign</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={orderStyles.stopsCard}>
              <View style={orderStyles.stopRow}>
                <View style={[orderStyles.stopDot, orderStyles.pickupDot]}>
                  <Ionicons name="restaurant" size={16} color="#FF6A00" />
                </View>
                <View style={orderStyles.stopLine} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={orderStyles.stopLabel}>Pickup</Text>
                  <Text style={orderStyles.stopName} numberOfLines={1}>
                    {displayOrder.restaurantName}
                  </Text>
                  <Text style={orderStyles.stopAddress} numberOfLines={2}>
                    {formatAddressText(displayOrder.restaurantAddress)}
                  </Text>
                </View>
              </View>
              <View style={orderStyles.stopDivider} />
              <View style={orderStyles.stopRow}>
                <View style={[orderStyles.stopDot, orderStyles.dropDot]}>
                  <Ionicons name="person" size={16} color="#065F46" />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={orderStyles.stopLabel}>Drop</Text>
                  <Text style={orderStyles.stopName} numberOfLines={1}>
                    {displayOrder.customerName}
                  </Text>
                  <Text style={orderStyles.stopAddress} numberOfLines={2}>
                    {formatAddressText(displayOrder.customerAddress)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Order Items */}
            <View className="bg-white rounded-2xl p-4  border border-gray-100 mb-3">
              <TouchableOpacity
                onPress={() => setItemsExpanded((v) => !v)}
                activeOpacity={0.7}
                className={`flex-row items-center ${itemsExpanded ? "mb-3" : ""}`}>
                <View className="w-10 h-10 bg-blue-50 rounded-xl items-center justify-center ">
                  <Ionicons name="fast-food" size={20} color="#3B82F6" />
                </View>
                <Text
                  className="text-sm font-bold text-gray-900 ml-3 flex-1"
                  numberOfLines={1}>
                  Order Items
                </Text>
                <Text className="text-xs font-semibold text-gray-400 mr-2">
                  {(displayOrder.items || []).length}
                </Text>
                <Ionicons
                  name={itemsExpanded ? "chevron-up" : "chevron-down"}
                  size={18}
                  color="#9CA3AF"
                />
              </TouchableOpacity>
              {itemsExpanded &&
                (displayOrder.items || []).map(
                (
                  item: {
                    name:
                      | string
                      | number
                      | bigint
                      | boolean
                      | ReactElement<
                          unknown,
                          string | JSXElementConstructor<any>
                        >
                      | Iterable<ReactNode>
                      | ReactPortal
                      | Promise<
                          | string
                          | number
                          | bigint
                          | boolean
                          | ReactPortal
                          | ReactElement<
                              unknown,
                              string | JSXElementConstructor<any>
                            >
                          | Iterable<ReactNode>
                          | null
                          | undefined
                        >
                      | null
                      | undefined;
                    quantity:
                      | string
                      | number
                      | bigint
                      | boolean
                      | ReactElement<
                          unknown,
                          string | JSXElementConstructor<any>
                        >
                      | Iterable<ReactNode>
                      | ReactPortal
                      | Promise<
                          | string
                          | number
                          | bigint
                          | boolean
                          | ReactPortal
                          | ReactElement<
                              unknown,
                              string | JSXElementConstructor<any>
                            >
                          | Iterable<ReactNode>
                          | null
                          | undefined
                        >
                      | null
                      | undefined;
                  },
                  index: Key | null | undefined,
                ) => (
                  <View
                    key={index}
                    className="flex-row justify-between py-2 border-b border-gray-100">
                    <View className="flex-row items-center flex-1">
                      <View className="w-7 h-7 bg-amber-50 rounded-lg items-center justify-center mr-2.5">
                        <Text className="font-bold text-[10px] text-amber-600">
                          {item.quantity}x
                        </Text>
                      </View>
                      <Text
                        className="text-xs text-gray-800 font-medium flex-1"
                        numberOfLines={1}>
                        {item.name}
                      </Text>
                    </View>
                  </View>
                ),
              )}
              {itemsExpanded && (displayOrder.items || []).length === 0 && (
                <Text className="text-xs text-gray-400 py-2">
                  {t("orderDetail.noItemsFound")}
                </Text>
              )}
            </View>

            {/* Payment & Earnings */}
            <View className="bg-white rounded-2xl p-4  border border-gray-100 mb-3">
              <View className="flex-row justify-between items-center mb-3">
                <View className="flex-row items-center flex-1">
                  <View className="w-10 h-10 bg-amber-50 rounded-xl items-center justify-center ">
                    <Ionicons name="wallet" size={20} color="#F59E0B" />
                  </View>
                  <Text
                    className="text-sm font-bold text-gray-900 ml-3"
                    numberOfLines={1}>
                    {t("orderDetail.paymentDetails")}
                  </Text>
                </View>
              </View>
              <View className="flex-row justify-between py-2 border-b border-gray-100">
                <Text className="text-xs text-gray-600" numberOfLines={1}>
                  {t("orderDetail.paymentType")}
                </Text>
                <View className="px-2.5 py-1 rounded-full bg-gray-100">
                  <Text
                    className="text-xs font-semibold text-gray-800 uppercase"
                    numberOfLines={1}>
                    {displayOrder.paymentType}
                  </Text>
                </View>
              </View>
              <View className="flex-row justify-between py-2 border-b border-gray-100">
                <Text className="text-xs text-gray-600" numberOfLines={1}>
                  {t("orderDetail.distance")}
                </Text>
                <Text
                  className="text-xs font-semibold text-gray-800"
                  numberOfLines={1}>
                  {displayOrder.distance} km
                </Text>
              </View>
              <View className="flex-row justify-between pt-3 mt-2 bg-green-50 -mx-4 -mb-4 px-4 py-3 rounded-b-2xl">
                <Text
                  className="text-sm font-bold text-gray-900"
                  numberOfLines={1}>
                  {t("orderDetail.yourEarnings")}
                </Text>
                <Text
                  className="text-lg font-bold text-green-600"
                  numberOfLines={1}>
                  ₹{displayOrder.earnings || 0}
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>

        {/* Action Footer - Only show for active orders */}
        {isActiveOrder &&
          displayOrder.status !== "delivered" &&
          displayOrder.status !== "cancelled" &&
          displayOrder.status !== "returning_to_restaurant" && (
            <ActionFooter
              label={proofUploading ? t("orderDetail.uploadingProof") : getActionLabel()}
              onPress={handlePrimaryActionPress}
              loading={loading || proofUploading}
            />
          )}

        {orderOverlays}
      </View>
    </SafeAreaView>
  );
}

// ── Navigation overlay styles ────────────────────────────────────────────────

const navStyles = StyleSheet.create({
  topOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  instructionCard: {
    margin: 14,
    backgroundColor: "#1F2937",
    borderRadius: 18,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 10,
  },
  maneuverCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#FF6A00",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  instructionText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 21,
  },
  stepDist: {
    color: "#9CA3AF",
    fontSize: 12,
    marginTop: 3,
  },
  bottomSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 30,
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 22,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 14,
  },
  etaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  etaBlock: {
    alignItems: "center",
    minWidth: 48,
  },
  etaValue: {
    fontSize: 24,
    fontWeight: "800",
    color: "#1F2937",
    lineHeight: 30,
  },
  etaLabel: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 2,
  },
  etaDivider: {
    width: 1,
    height: 36,
    backgroundColor: "#E5E7EB",
    marginHorizontal: 12,
  },
  phaseTag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF5EB",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: 140,
  },
  phaseText: {
    color: "#FF6A00",
    fontSize: 12,
    fontWeight: "700",
    flexShrink: 1,
  },
  btnRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  exitBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtn: {
    flex: 1,
    minHeight: 48,
    backgroundColor: "#FF6A00",
    borderRadius: 24,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#FF6A00",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  actionBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
});

const orderStyles = StyleSheet.create({
  progressStrip: {
    height: 28,
    backgroundColor: "#F9FAFB",
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
  },
  progressSegmentWrap: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  progressDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: "#E5E7EB",
    flexShrink: 0,
  },
  progressDotFilled: {
    backgroundColor: "#10B981",
  },
  progressLine: {
    flex: 1,
    height: 2,
    backgroundColor: "#E5E7EB",
    marginHorizontal: 4,
  },
  progressLineFilled: {
    backgroundColor: "#10B981",
  },
  mapRouteBar: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 12,
    minHeight: 64,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(17,24,39,0.08)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 8,
  },
  mapRouteIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#FFF5EB",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  mapRouteLabel: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "800",
  },
  mapRouteMeta: {
    color: "#6B7280",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 3,
  },
  mapRouteButton: {
    height: 38,
    borderRadius: 19,
    paddingHorizontal: 12,
    backgroundColor: "#FF6A00",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    flexShrink: 0,
  },
  mapRouteButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  taskCard: {
    backgroundColor: "#111827",
    borderRadius: 24,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 8,
  },
  taskHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  taskIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#FF6A00",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  taskEyebrow: {
    color: "#9CA3AF",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  taskTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "900",
    marginTop: 2,
  },
  taskMetric: {
    maxWidth: 116,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexShrink: 0,
  },
  taskMetricText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
  },
  taskName: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
  },
  taskAddress: {
    color: "#D1D5DB",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 5,
  },
  quickActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 15,
  },
  primaryQuickAction: {
    flex: 1,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#FF6A00",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  primaryQuickActionText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
  },
  secondaryQuickAction: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  callQuickActionWrap: {
    alignItems: "center",
    gap: 5,
    maxWidth: 82,
  },
  callQuickActionPhone: {
    color: "#D1D5DB",
    fontSize: 9,
    fontWeight: "800",
    maxWidth: 82,
    textAlign: "center",
  },
  sosQuickAction: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    alignItems: "center",
    justifyContent: "center",
  },
  contactSheetContent: {
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 28,
    alignItems: "center",
  },
  contactSheetIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#FFF7ED",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  contactSheetTitle: {
    color: "#111827",
    fontSize: 24,
    fontWeight: "900",
    textAlign: "center",
  },
  contactSheetName: {
    color: "#6B7280",
    fontSize: 14,
    fontWeight: "800",
    marginTop: 5,
    maxWidth: "100%",
    textAlign: "center",
  },
  contactSheetCallButton: {
    width: "100%",
    minHeight: 52,
    borderRadius: 26,
    backgroundColor: "#FF6A00",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 18,
  },
  contactSheetCallButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
  },
  contactSheetPhone: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "900",
    marginTop: 14,
    textAlign: "center",
  },
  contactSheetHint: {
    color: "#9CA3AF",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 8,
    textAlign: "center",
  },
  stopsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#EEF2F7",
    padding: 16,
    marginBottom: 12,
  },
  stopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  stopDot: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  pickupDot: {
    backgroundColor: "#FFF5EB",
  },
  dropDot: {
    backgroundColor: "#D1FAE5",
  },
  stopLine: {
    position: "absolute",
    left: 19,
    top: 42,
    width: 2,
    height: 42,
    backgroundColor: "#E5E7EB",
  },
  stopDivider: {
    height: 1,
    backgroundColor: "#F3F4F6",
    marginVertical: 14,
    marginLeft: 52,
  },
  stopLabel: {
    color: "#9CA3AF",
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  stopName: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "900",
    marginTop: 2,
  },
  stopAddress: {
    color: "#6B7280",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
});
