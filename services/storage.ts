import Constants from "expo-constants";
import * as FileSystem from "expo-file-system/legacy";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { getDeliveryPartnerToken } from "./api";

// Raw camera photos on modern phones are commonly 3000px+ wide and several
// MB even at reduced JPEG quality (quality only affects compression, not
// dimensions) — slow to upload, and large enough to trip nginx's default
// 1MB client_max_body_size on the server (413 Request Entity Too Large).
// Resizing to a sane max width before upload fixes both.
const MAX_UPLOAD_DIMENSION = 1280;
const UPLOAD_JPEG_QUALITY = 0.7;

const compressForUpload = async (uri: string): Promise<string> => {
  try {
    const result = await ImageManipulator.manipulate(uri)
      .resize({ width: MAX_UPLOAD_DIMENSION })
      .renderAsync();
    const saved = await result.saveAsync({
      compress: UPLOAD_JPEG_QUALITY,
      format: SaveFormat.JPEG,
    });
    return saved.uri;
  } catch (error) {
    // Compression is a best-effort optimization — never let a failure here
    // block the actual upload.
    console.warn("[Storage] Image compression failed, uploading original:", error);
    return uri;
  }
};

// Resolve the backend base URL (same logic as api.ts)
const getBaseUrl = (): string => {
  const envApiUrl =
    Constants.expoConfig?.extra?.apiUrl || process.env.EXPO_PUBLIC_API_URL;
  if (envApiUrl) return envApiUrl;
  return "https://5axnuhvpz7h2mjnrp2ledb7nmy0hmwkh.lambda-url.ap-south-1.on.aws/api";
};

/**
 * Upload image to Firebase Storage via the backend API.
 *
 * The backend uses the Firebase Admin SDK which bypasses Storage security rules,
 * so no Firebase client-side authentication is required.
 *
 * @param uri   Local file URI (e.g. file:///... from image picker)
 * @param folder Folder name in Firebase Storage (e.g. 'kyc_docs', 'profile_photos')
 * @returns     Public download URL of the uploaded image
 */
export const uploadImageToFirebase = async (
  uri: string,
  folder: string = "kyc_docs",
): Promise<string> => {
  if (!uri) return "";

  // Already a remote URL — return as-is
  if (uri.startsWith("http")) return uri;

  try {
    // Get auth token from storage
    const token = await getDeliveryPartnerToken();
    if (!token) throw new Error("Not authenticated — no token in storage");

    // Resized/compressed output is always JPEG regardless of the source
    // format, so the mimeType is fixed once compression succeeds. Only
    // falls back to sniffing the original extension if compression itself
    // failed and the original file is being uploaded as-is.
    const compressedUri = await compressForUpload(uri);
    const wasCompressed = compressedUri !== uri;

    const ext = uri.split(".").pop()?.toLowerCase() ?? "jpg";
    const mimeMap: Record<string, string> = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      gif: "image/gif",
      webp: "image/webp",
      heic: "image/heic",
    };
    const mimeType = wasCompressed ? "image/jpeg" : (mimeMap[ext] ?? "image/jpeg");

    const baseUrl = getBaseUrl();
    const uploadUrl = `${baseUrl}/delivery-partners/upload-image`;

    console.log(`📤 [Storage] Uploading to backend: ${uploadUrl}`);

    const response = await FileSystem.uploadAsync(uploadUrl, compressedUri, {
      httpMethod: "POST",
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName: "image",
      mimeType,
      parameters: { folder },
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const responseText = response.body;
    let json: any = {};
    if (responseText) {
      try {
        json = JSON.parse(responseText);
      } catch {
        json = { message: responseText };
      }
    }

    if (response.status < 200 || response.status >= 300 || !json.success) {
      throw new Error(
        json.message ||
          json.error ||
          `Upload failed with status ${response.status}`,
      );
    }

    const downloadUrl = json.url || json.downloadUrl || json.data?.url;
    if (!downloadUrl) {
      throw new Error("Upload completed but no download URL was returned");
    }

    console.log(`✅ [Storage] Upload successful: ${downloadUrl}`);
    return downloadUrl as string;
  } catch (error: any) {
    console.error("❌ [Storage] Upload error:", error);
    throw new Error(error.message || "Failed to upload image");
  }
};
