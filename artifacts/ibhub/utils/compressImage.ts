import * as ImageManipulator from "expo-image-manipulator";
import { Platform } from "react-native";

export interface CompressOptions {
  maxWidth?: number;
  quality?: number;
}

async function compressImageWeb(uri: string, options: CompressOptions = {}): Promise<string> {
  const { maxWidth = 1200, quality = 0.72 } = options;
  return new Promise((resolve) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const scale = img.width > maxWidth ? maxWidth / img.width : 1;
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(uri); return; }
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => {
          if (!blob) { resolve(uri); return; }
          resolve(URL.createObjectURL(blob));
        },
        "image/jpeg",
        quality,
      );
    };
    img.onerror = () => resolve(uri);
    img.src = uri;
  });
}

export async function compressImage(uri: string, options: CompressOptions = {}): Promise<string> {
  if (Platform.OS === "web") return compressImageWeb(uri, options);
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
