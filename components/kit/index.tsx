/**
 * Rider app UI kit. Every screen is built from these so spacing, colours,
 * touch sizes and states stay identical across the app. Prefer adding a
 * variant here over one-off styling in a screen.
 */
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { color, TOUCH } from "@/theme/tokens";

/** Light tap felt on every press, so riders know the app registered it. */
const tap = () => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
};

type IconName = React.ComponentProps<typeof Ionicons>["name"];

/* ------------------------------------------------------------------ Screen */

export function Screen({
  title,
  subtitle,
  back = false,
  right,
  children,
  footer,
  scroll = true,
  refreshControl,
  contentStyle,
}: {
  title?: string;
  subtitle?: string;
  back?: boolean | (() => void);
  right?: React.ReactNode;
  children: React.ReactNode;
  /** Sticky bottom area, usually a <BottomBar>. */
  footer?: React.ReactNode;
  scroll?: boolean;
  refreshControl?: React.ReactElement<any>;
  contentStyle?: ViewStyle;
}) {
  const insets = useSafeAreaInsets();
  const body = (
    <View style={[{ padding: 16, gap: 12 }, contentStyle]}>{children}</View>
  );
  return (
    <View style={{ flex: 1, backgroundColor: color.canvas }}>
      {(title || back) && (
        <View
          style={{ paddingTop: insets.top + 6 }}
          className="bg-surface border-b border-line px-2 pb-2.5"
        >
          <View className="flex-row items-center min-h-[44px]">
            {back ? (
              <IconButton
                icon="chevron-back"
                label="Back"
                onPress={
                  typeof back === "function" ? back : () => router.back()
                }
              />
            ) : (
              <View className="w-2" />
            )}
            <View className="flex-1 px-1">
              {title ? (
                <Text numberOfLines={1} className="text-lg font-bold text-ink">
                  {title}
                </Text>
              ) : null}
              {subtitle ? (
                <Text numberOfLines={1} className="text-xs text-muted">
                  {subtitle}
                </Text>
              ) : null}
            </View>
            {right}
          </View>
        </View>
      )}
      {scroll ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingBottom: footer ? 16 : insets.bottom + 24,
          }}
          keyboardShouldPersistTaps="handled"
          refreshControl={refreshControl}
          showsVerticalScrollIndicator={false}
        >
          {body}
        </ScrollView>
      ) : (
        <View style={{ flex: 1 }}>{body}</View>
      )}
      {footer}
    </View>
  );
}

/** Sticky footer that respects the home indicator. */
/* --------------------------------------------------------------- TabScreen */

/**
 * Screen for the four tabs: a big title that stays pinned above the content
 * (with its own background, so nothing scrolls under the status bar) and
 * gains a divider once the list scrolls. Leaves room for the tab bar.
 */
export function TabScreen({
  kicker,
  title,
  right,
  children,
  refreshControl,
}: {
  kicker?: string;
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  refreshControl?: React.ReactElement<any>;
}) {
  const insets = useSafeAreaInsets();
  const [scrolled, setScrolled] = React.useState(false);
  return (
    <View style={{ flex: 1, backgroundColor: color.canvas }}>
      <View
        style={{
          paddingTop: insets.top + 8,
          backgroundColor: color.canvas,
          borderBottomWidth: 1,
          borderBottomColor: scrolled ? color.line : "transparent",
        }}
        className="px-4 pb-3 flex-row items-center"
      >
        <View className="flex-1">
          {kicker ? <Text className="text-sm text-muted">{kicker}</Text> : null}
          <Text numberOfLines={1} className="text-2xl font-extrabold text-ink">
            {title}
          </Text>
        </View>
        {right}
      </View>
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        refreshControl={refreshControl}
        scrollEventThrottle={32}
        onScroll={(e) => {
          const next = e.nativeEvent.contentOffset.y > 4;
          if (next !== scrolled) setScrolled(next);
        }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: insets.bottom + 110, gap: 12 }}
      >
        {children}
      </ScrollView>
    </View>
  );
}

export function BottomBar({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{ paddingBottom: Math.max(insets.bottom, 12) }}
      className="bg-surface border-t border-line px-4 pt-3 gap-2"
    >
      {children}
    </View>
  );
}

/* ------------------------------------------------------------------ Button */

type ButtonVariant =
  "primary" | "dark" | "outline" | "danger" | "success" | "ghost";

const BUTTON_STYLES: Record<
  ButtonVariant,
  { box: string; text: string; spinner: string }
> = {
  primary: { box: "bg-brand", text: "text-ink", spinner: color.ink },
  dark: { box: "bg-ink", text: "text-white", spinner: "#fff" },
  outline: {
    box: "bg-surface border border-line",
    text: "text-ink",
    spinner: color.ink,
  },
  danger: { box: "bg-danger", text: "text-white", spinner: "#fff" },
  success: { box: "bg-success", text: "text-white", spinner: "#fff" },
  ghost: { box: "bg-transparent", text: "text-ink", spinner: color.ink },
};

export function Button({
  title,
  onPress,
  variant = "primary",
  icon,
  loading = false,
  disabled = false,
  size = "lg",
  style,
}: {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  size?: "lg" | "md";
  style?: ViewStyle;
}) {
  const v = BUTTON_STYLES[variant];
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      onPress={
        onPress
          ? () => {
              tap();
              onPress();
            }
          : undefined
      }
      disabled={inactive}
      style={({ pressed }) => [
        { opacity: inactive ? 0.5 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      {/* Layout lives on an inner View: NativeWind drops function-style values
          (minHeight) when className is set on the Pressable itself. */}
      <View
        style={{ minHeight: size === "lg" ? TOUCH + 4 : 44, opacity: inactive ? 0.45 : 1 }}
        className={`flex-row items-center justify-center rounded-2xl px-5 gap-2 ${v.box}`}
      >
        {loading ? (
          <ActivityIndicator color={v.spinner} />
        ) : (
          <>
            {icon ? (
              <Ionicons
                name={icon}
                size={size === "lg" ? 20 : 18}
                color={
                  variant === "primary" ||
                  variant === "outline" ||
                  variant === "ghost"
                    ? color.ink
                    : "#fff"
                }
              />
            ) : null}
            <Text
              numberOfLines={1}
              className={`${size === "lg" ? "text-base" : "text-sm"} font-bold ${v.text}`}
            >
              {title}
            </Text>
          </>
        )}
      </View>
    </Pressable>
  );
}

export function IconButton({
  icon,
  label,
  onPress,
  tone = "plain",
}: {
  icon: IconName;
  label: string;
  onPress?: () => void;
  tone?: "plain" | "soft" | "brand";
}) {
  const bg =
    tone === "brand"
      ? color.brand
      : tone === "soft"
        ? color.canvas
        : "transparent";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: bg,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Ionicons name={icon} size={22} color={color.ink} />
    </Pressable>
  );
}

/* -------------------------------------------------------------------- Card */

export function Card({
  children,
  onPress,
  style,
  padded = true,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  padded?: boolean;
}) {
  const inner = (
    <View
      style={style}
      className={`bg-surface rounded-3xl border border-line ${padded ? "p-4" : ""}`}
    >
      {children}
    </View>
  );
  if (!onPress) return inner;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
    >
      {inner}
    </Pressable>
  );
}

export function SectionTitle({
  title,
  action,
}: {
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <View className="flex-row items-center justify-between mt-2 px-1">
      <Text className="text-sm font-bold text-muted uppercase tracking-wide">
        {title}
      </Text>
      {action}
    </View>
  );
}

/* ----------------------------------------------------------------- ListRow */

export function ListRow({
  icon,
  title,
  subtitle,
  value,
  onPress,
  danger = false,
  chevron = !!onPress,
}: {
  icon?: IconName;
  title: string;
  subtitle?: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
  chevron?: boolean;
}) {
  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
    >
      <View
        style={{ minHeight: TOUCH }}
        className="flex-row items-center gap-3 px-4 py-3"
      >
        {icon ? (
          <View
            className={`w-10 h-10 rounded-full items-center justify-center ${
              danger ? "bg-danger-soft" : "bg-canvas"
            }`}
          >
            <Ionicons
              name={icon}
              size={20}
              color={danger ? color.danger : color.ink}
            />
          </View>
        ) : null}
        <View className="flex-1">
          <Text
            className={`text-base font-semibold ${danger ? "text-danger" : "text-ink"}`}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text className="text-sm text-muted">{subtitle}</Text>
          ) : null}
        </View>
        {value ? (
          <Text className="text-base font-semibold text-ink">{value}</Text>
        ) : null}
        {chevron ? (
          <Ionicons name="chevron-forward" size={18} color={color.faint} />
        ) : null}
      </View>
    </Pressable>
  );
}

/** Divider-separated group of ListRows inside a card. */
export function ListGroup({ children }: { children: React.ReactNode }) {
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <View className="bg-surface rounded-3xl border border-line overflow-hidden">
      {items.map((child, i) => (
        <View key={i} className={i > 0 ? "border-t border-line" : ""}>
          {child}
        </View>
      ))}
    </View>
  );
}

/* -------------------------------------------------------------------- Pill */

type Tone = "neutral" | "brand" | "success" | "warning" | "danger" | "info";
const PILL: Record<Tone, string> = {
  neutral: "bg-canvas text-ink-soft",
  brand: "bg-brand-soft text-ink",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
};

export function Pill({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: Tone;
}) {
  const [bg, text] = PILL[tone].split(" ");
  return (
    <View className={`self-start rounded-full px-2.5 py-1 ${bg}`}>
      <Text className={`text-xs font-bold ${text}`}>{label}</Text>
    </View>
  );
}

/* --------------------------------------------------------------- Feedback */

export function EmptyState({
  icon = "file-tray-outline",
  title,
  body,
  action,
}: {
  icon?: IconName;
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <View className="items-center py-12 px-6 gap-2">
      <View className="w-16 h-16 rounded-full bg-surface border border-line items-center justify-center mb-2">
        <Ionicons name={icon} size={28} color={color.faint} />
      </View>
      <Text className="text-lg font-bold text-ink text-center">{title}</Text>
      {body ? (
        <Text className="text-sm text-muted text-center">{body}</Text>
      ) : null}
      {action ? <View className="mt-3 self-stretch">{action}</View> : null}
    </View>
  );
}

export function Banner({
  tone = "warning",
  icon = "alert-circle",
  title,
  body,
  action,
}: {
  tone?: "warning" | "danger" | "info" | "success";
  icon?: IconName;
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  const bg = {
    warning: "bg-warning-soft",
    danger: "bg-danger-soft",
    info: "bg-info-soft",
    success: "bg-success-soft",
  }[tone];
  const fg = {
    warning: color.warning,
    danger: color.danger,
    info: color.info,
    success: color.success,
  }[tone];
  return (
    <View className={`rounded-2xl p-3.5 flex-row gap-3 ${bg}`}>
      <Ionicons name={icon} size={22} color={fg} />
      <View className="flex-1 gap-0.5">
        <Text className="text-sm font-bold text-ink">{title}</Text>
        {body ? <Text className="text-sm text-ink-soft">{body}</Text> : null}
        {action ? <View className="mt-2 self-start">{action}</View> : null}
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------- Field */

export function Field({
  label,
  error,
  hint,
  ...input
}: TextInputProps & { label: string; error?: string; hint?: string }) {
  return (
    <View className="gap-1.5">
      <Text className="text-sm font-semibold text-ink">{label}</Text>
      <TextInput
        placeholderTextColor={color.faint}
        {...input}
        style={[
          {
            minHeight: TOUCH,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: error ? color.danger : color.line,
            backgroundColor: color.surface,
            paddingHorizontal: 14,
            fontSize: 16,
            color: color.ink,
          },
          input.style,
        ]}
      />
      {error ? (
        <Text className="text-xs text-danger">{error}</Text>
      ) : hint ? (
        <Text className="text-xs text-muted">{hint}</Text>
      ) : null}
    </View>
  );
}

/** Big tappable choice (e.g. vehicle type, payment method). */
export function Choice({
  icon,
  title,
  subtitle,
  selected,
  onPress,
}: {
  icon?: IconName;
  title: string;
  subtitle?: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={() => {
        tap();
        onPress();
      }}
      style={{ minHeight: TOUCH + 12 }}
      className={`flex-1 rounded-2xl border-2 p-3.5 gap-1 ${
        selected ? "border-ink bg-brand-soft" : "border-line bg-surface"
      }`}
    >
      {icon ? <Ionicons name={icon} size={24} color={color.ink} /> : null}
      <Text className="text-base font-bold text-ink">{title}</Text>
      {subtitle ? <Text className="text-xs text-muted">{subtitle}</Text> : null}
    </Pressable>
  );
}

/** Money formatting used across the app. */
export const rupees = (value: number | null | undefined, decimals = 0) =>
  `₹${Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;

/** Two-to-four option switch (e.g. Today / Week / Month). */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <View className="flex-row bg-surface border border-line rounded-2xl p-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => {
              tap();
              onChange(o.value);
            }}
            style={{ minHeight: 40 }}
            className={`flex-1 items-center justify-center rounded-xl ${active ? "bg-ink" : ""}`}
          >
            <Text
              className={`text-sm font-bold ${active ? "text-white" : "text-ink-soft"}`}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
