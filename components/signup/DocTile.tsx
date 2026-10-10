/**
 * One document slot: shows a thumbnail once uploaded, otherwise a big
 * "Add photo" target. Tapping offers Camera / Gallery, compresses and
 * uploads immediately (private storage for KYC folders), then reports the
 * stored reference.
 */
import { uploadImageToFirebase } from "@/services/storage";
import { color } from "@/theme/tokens";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, ActionSheetIOS, Alert, Image, Platform, Pressable, Text, View } from "react-native";

export default function DocTile({
  label,
  value,
  folder,
  onUploaded,
  selfie = false,
}: {
  label: string;
  /** Stored reference or a local preview URI */
  value?: string;
  folder: string;
  onUploaded: (reference: string, previewUri: string) => void;
  selfie?: boolean;
}) {
  const { t } = useTranslation();
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | undefined>(
    value && value.startsWith("http") ? value : undefined,
  );
  const done = Boolean(value);

  const pick = async (source: "camera" | "library") => {
    try {
      const perm =
        source === "camera"
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== "granted") {
        Alert.alert(t("signup.permissionTitle"), t("signup.permissionBody"));
        return;
      }
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ["images"],
        quality: 0.7,
        cameraType: selfie ? ImagePicker.CameraType.front : ImagePicker.CameraType.back,
      };
      const result =
        source === "camera"
          ? await ImagePicker.launchCameraAsync(options)
          : await ImagePicker.launchImageLibraryAsync(options);
      const uri = result.canceled ? undefined : result.assets?.[0]?.uri;
      if (!uri) return;
      setUploading(true);
      const reference = await uploadImageToFirebase(uri, folder);
      if (!reference) throw new Error("upload");
      setPreview(uri);
      onUploaded(reference, uri);
    } catch {
      Alert.alert(t("signup.uploadFailed"), t("common.tryAgain"));
    } finally {
      setUploading(false);
    }
  };

  const choose = () => {
    const options = [t("signup.takePhoto"), t("signup.chooseGallery"), t("common.cancel")];
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions({ options, cancelButtonIndex: 2 }, (i) => {
        if (i === 0) void pick("camera");
        if (i === 1) void pick("library");
      });
      return;
    }
    Alert.alert(label, undefined, [
      { text: options[0], onPress: () => void pick("camera") },
      { text: options[1], onPress: () => void pick("library") },
      { text: options[2], style: "cancel" },
    ]);
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={choose}
      disabled={uploading}
      style={{ aspectRatio: 1.25 }}
      className={`flex-1 rounded-2xl overflow-hidden border-2 ${
        done ? "border-success bg-surface" : "border-dashed border-line bg-surface"
      }`}>
      {preview ? (
        <Image source={{ uri: preview }} style={{ flex: 1 }} resizeMode="cover" />
      ) : (
        <View className="flex-1 items-center justify-center gap-1.5 p-2">
          {uploading ? (
            <ActivityIndicator color={color.ink} />
          ) : (
            <Ionicons name={done ? "checkmark-circle" : selfie ? "person-circle-outline" : "camera-outline"} size={30} color={done ? color.success : color.muted} />
          )}
          <Text className="text-xs text-muted text-center">
            {uploading ? t("signup.uploading") : done ? t("signup.uploaded") : t("signup.addPhoto")}
          </Text>
        </View>
      )}
      <View className={`px-2.5 py-2 flex-row items-center gap-1.5 ${done ? "bg-success-soft" : "bg-canvas"}`}>
        {done ? <Ionicons name="checkmark-circle" size={14} color={color.success} /> : null}
        <Text className="flex-1 text-xs font-bold text-ink" numberOfLines={1}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}
