import { storage } from "@/config/firebase";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";

/**
 * Upload image to Firebase Storage
 * @param uri Local file URI
 * @param folder Folder name in storage (e.g., 'delivery_partners')
 * @returns Download URL
 */
export const uploadImageToFirebase = async (
  uri: string,
  folder: string = "delivery_partners",
): Promise<string> => {
  if (!uri) return "";

  // If already a remote URL, return it
  if (uri.startsWith("http")) return uri;

  try {
    // Determine file extension
    const extension = uri.split(".").pop();
    const filename = `${folder}/${Date.now()}-${Math.random().toString(36).substring(7)}.${extension}`;
    const storageRef = ref(storage, filename);

    // Convert URI to Blob
    const response = await fetch(uri);
    const blob = await response.blob();

    // Upload
    const snapshot = await uploadBytes(storageRef, blob);

    // Get Download URL
    const downloadUrl = await getDownloadURL(snapshot.ref);
    return downloadUrl;
  } catch (error: any) {
    console.error("Firebase upload error:", error);
    throw new Error(error.message || "Failed to upload image");
  }
};
