/**
 * UpdateAppDialog
 * Centered popup shown when a newer app version is available — either
 * automatically at login, or from the Profile screen's "Check for Updates"
 * action. Not dismissible when the release is marked force-update.
 */
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AppUpdateCheckResult } from "@/services/appUpdateService";
import { Ionicons } from "@expo/vector-icons";
import { Linking, Text, TouchableOpacity, View } from "react-native";

interface Props {
  visible: boolean;
  updateInfo: Extract<AppUpdateCheckResult, { status: "update_available" }>;
  onDismiss: () => void;
}

export default function UpdateAppDialog({ visible, updateInfo, onDismiss }: Props) {
  const openUpdateUrl = () => {
    Linking.openURL(updateInfo.url).catch(() => {
      // If the link fails to open there's nothing more useful to do here
      // than leave the dialog up so the rider can try again.
    });
  };

  return (
    <AlertDialog
      open={visible}
      onOpenChange={(open: boolean) => {
        // Force-update releases can't be swiped/backed away from — only the
        // "Update Now" button (which doesn't call onDismiss) moves forward.
        if (!open && !updateInfo.forceUpdate) onDismiss();
      }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: "#FFF5EB",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 4,
            }}>
            <Ionicons name="rocket-outline" size={30} color="#FF6A00" />
          </View>
          <AlertDialogTitle>Update Available</AlertDialogTitle>
          <AlertDialogDescription>
            {`A newer version (v${updateInfo.latestVersion}) of KhaaoNow Delivery is available.`}
            {updateInfo.notes ? `\n\n${updateInfo.notes}` : ""}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <TouchableOpacity
            onPress={openUpdateUrl}
            activeOpacity={0.85}
            style={{
              backgroundColor: "#FF6A00",
              borderRadius: 24,
              height: 50,
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
              gap: 8,
            }}>
            <Ionicons name="download-outline" size={18} color="#FFFFFF" />
            <Text style={{ color: "#FFFFFF", fontWeight: "800", fontSize: 15 }}>
              Update Now
            </Text>
          </TouchableOpacity>

          {!updateInfo.forceUpdate && (
            <TouchableOpacity
              onPress={onDismiss}
              activeOpacity={0.7}
              style={{
                height: 46,
                alignItems: "center",
                justifyContent: "center",
              }}>
              <Text style={{ color: "#9CA3AF", fontWeight: "700", fontSize: 14 }}>
                Later
              </Text>
            </TouchableOpacity>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
