/**
 * AlertDialog — styled wrapper around @rn-primitives/alert-dialog
 * (the React Native Reusables primitive), themed to this app's palette
 * (orange #FF6A00 accent, white rounded cards) instead of the default
 * shadcn/cva styling this library ships with — this codebase doesn't use
 * class-variance-authority/cn anywhere else, so plain NativeWind classNames
 * are used here too for consistency.
 */
import * as AlertDialogPrimitive from "@rn-primitives/alert-dialog";
import * as React from "react";
import { Platform, StyleSheet, Text, View } from "react-native";

const AlertDialog = AlertDialogPrimitive.Root;
const AlertDialogTrigger = AlertDialogPrimitive.Trigger;

function AlertDialogPortal(props: AlertDialogPrimitive.PortalProps) {
  return <AlertDialogPrimitive.Portal {...props} />;
}

function AlertDialogOverlay({
  className,
  ...props
}: AlertDialogPrimitive.OverlayProps & { className?: string }) {
  return (
    <AlertDialogPrimitive.Overlay
      style={StyleSheet.absoluteFill}
      className={`flex items-center justify-center bg-black/60 p-4 ${className ?? ""}`}
      {...props}
    />
  );
}

function AlertDialogContent({
  className,
  children,
  ...props
}: AlertDialogPrimitive.ContentProps & { className?: string }) {
  return (
    <AlertDialogPortal>
      <AlertDialogOverlay>
        <AlertDialogPrimitive.Content
          className={`w-full max-w-sm rounded-3xl bg-white p-6 ${className ?? ""}`}
          style={
            Platform.OS === "android"
              ? { elevation: 24 }
              : {
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 10 },
                  shadowOpacity: 0.25,
                  shadowRadius: 20,
                }
          }
          {...props}>
          {children}
        </AlertDialogPrimitive.Content>
      </AlertDialogOverlay>
    </AlertDialogPortal>
  );
}

function AlertDialogHeader({
  className,
  ...props
}: React.ComponentProps<typeof View> & { className?: string }) {
  return <View className={`items-center gap-2 ${className ?? ""}`} {...props} />;
}

function AlertDialogFooter({
  className,
  ...props
}: React.ComponentProps<typeof View> & { className?: string }) {
  return <View className={`mt-5 gap-2.5 ${className ?? ""}`} {...props} />;
}

function AlertDialogTitle({
  className,
  ...props
}: AlertDialogPrimitive.TitleProps & { className?: string }) {
  return (
    <AlertDialogPrimitive.Title asChild>
      <Text
        className={`text-center text-xl font-extrabold text-[#1A1A1A] ${className ?? ""}`}
        {...props}
      />
    </AlertDialogPrimitive.Title>
  );
}

function AlertDialogDescription({
  className,
  ...props
}: AlertDialogPrimitive.DescriptionProps & { className?: string }) {
  return (
    <AlertDialogPrimitive.Description asChild>
      <Text
        className={`text-center text-sm leading-5 text-gray-500 ${className ?? ""}`}
        {...props}
      />
    </AlertDialogPrimitive.Description>
  );
}

const AlertDialogAction = AlertDialogPrimitive.Action;
const AlertDialogCancel = AlertDialogPrimitive.Cancel;

export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle,
  AlertDialogTrigger,
};
