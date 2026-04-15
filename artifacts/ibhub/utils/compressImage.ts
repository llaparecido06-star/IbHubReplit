import * as ImageManipulator from "expo-image-manipulator";
import { Platform } from "react-native";

export interface CompressOptions {
  maxWidth?: number;
  quality?: number;
}

export async function compressImage(uri: string, options: CompressOptions = {}): Promise<string> {
  if (Platform.OS === "web") return uri;
  const { maxWidth = 1200, quality = 0.72 } = options;
  try {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: maxWidth } }],
      { compress: quality, format: ImageManipulator.SaveFormat.JPEG },
    );
    return result.uri;
  } catch {
    return uri;
  }
}

export async function compressAvatar(uri: string): Promise<string> {
  return compressImage(uri, { maxWidth: 800, quality: 0.78 });
}

export async function compressPostImage(uri: string): Promise<string> {
  return compressImage(uri, { maxWidth: 1200, quality: 0.72 });
}

export async function compressLogoImage(uri: string): Promise<string> {
  return compressImage(uri, { maxWidth: 800, quality: 0.78 });
}
