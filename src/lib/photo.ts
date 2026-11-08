import { PROFILE_LIMITS } from "@/types/workout";

/**
 * Turns a picked photo into a small square JPEG data URL, entirely on the device: centre crop,
 * scale to `size`, re-encode. Re-encoding also drops EXIF (location, camera) from the original.
 * Throws a readable Error when the file is not an image the browser can decode.
 */
export async function squareJpeg(file: File, size = 256): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Pick a photo (JPEG, PNG or WebP).");
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("This photo could not be read. Try a JPEG or PNG.");
  }
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser cannot resize photos.");
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  bitmap.close();
  // Step quality down until it fits the stored limit (a 256px photo almost always fits at 0.82).
  for (const q of [0.82, 0.7, 0.55]) {
    const url = canvas.toDataURL("image/jpeg", q);
    if (url.length <= PROFILE_LIMITS.photoMax) return url;
  }
  throw new Error("This photo is too detailed to store. Try another one.");
}
