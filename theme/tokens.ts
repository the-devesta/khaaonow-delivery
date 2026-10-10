/**
 * KhaaoNow Delivery design tokens — the single source for colours, radius
 * and spacing. Mirrored into tailwind.config.js so `className` and inline
 * styles use the same values. Brand is the app-icon yellow; primary actions
 * are yellow with dark ink text (high contrast outdoors in sunlight).
 */
export const color = {
  brand: "#FFD233",
  brandDark: "#E6B800",
  brandSoft: "#FFF6CC",
  ink: "#111827",
  inkSoft: "#374151",
  muted: "#6B7280",
  faint: "#9CA3AF",
  line: "#E5E7EB",
  canvas: "#F6F6F3",
  surface: "#FFFFFF",
  success: "#16A34A",
  successSoft: "#DCFCE7",
  danger: "#DC2626",
  dangerSoft: "#FEE2E2",
  warning: "#D97706",
  warningSoft: "#FEF3C7",
  info: "#2563EB",
  infoSoft: "#DBEAFE",
  overlay: "rgba(17,24,39,0.45)",
} as const;

export const radius = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 } as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

/** Minimum touch target for riders using the app on the move / with gloves. */
export const TOUCH = 52;
