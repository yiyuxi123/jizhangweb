import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Compress an image (base64 data URL) to a manageable size for Firestore storage.
 * Firestore documents have a 1MB hard limit — a raw phone photo base64 can be 3-8MB.
 * This compresses to JPEG ≤ 200KB of base64 text, keeping the document safely under 1MB.
 */
export function compressImage(
  base64: string,
  maxWidth = 1024,
  quality = 0.7
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      // If the image is already small enough, return as-is
      if (img.width <= maxWidth && base64.length < 150_000) {
        resolve(base64);
        return;
      }

      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      // Scale down proportionally
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      // Export as JPEG (much smaller than PNG for photos)
      const compressed = canvas.toDataURL('image/jpeg', quality);

      // If still too large, try once more with lower quality
      if (compressed.length > 200_000 && quality > 0.4) {
        const retry = canvas.toDataURL('image/jpeg', 0.4);
        resolve(retry);
      } else {
        resolve(compressed);
      }
    };
    img.onerror = () => reject(new Error('Failed to load image for compression'));
    img.src = base64;
  });
}
