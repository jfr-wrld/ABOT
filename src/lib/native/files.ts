import { Capacitor, registerPlugin } from "@capacitor/core";

/**
 * Saving and sharing files on both builds. The browser uses a download link and the Web Share
 * API; the Android WebView has neither, so there the bytes go to native code: FileSaver
 * (android/app/src/main/java/app/abot/gym/FileSaverPlugin.java) and @capacitor/share.
 */

interface FileSaverPlugin {
  save(opts: { data: string; fileName: string; mimeType: string }): Promise<{ folder: string }>;
}

const FileSaver = registerPlugin<FileSaverPlugin>("FileSaver");

export const isNativeApp = () => Capacitor.isNativePlatform();

export type SaveResult = { kind: "downloaded" } | { kind: "saved"; folder: string };

/** Saves the file: a browser download, or Pictures/ABOT (images) and Download/ABOT in the app. */
export async function saveFile(blob: Blob, fileName: string): Promise<SaveResult> {
  if (isNativeApp()) {
    const { folder } = await FileSaver.save({ data: await toBase64(blob), fileName, mimeType: blob.type });
    return { kind: "saved", folder };
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.append(a);
  a.click();
  a.remove();
  // Revoking in the same tick can cancel the download in Safari.
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
  return { kind: "downloaded" };
}

/** True when this device can hand a file to other apps (Instagram, WhatsApp, ...). */
export function canShareFiles(sample: File): boolean {
  if (isNativeApp()) return true;
  if (typeof navigator === "undefined" || typeof navigator.canShare !== "function") return false;
  try {
    return navigator.canShare({ files: [sample] });
  } catch {
    return false;
  }
}

export type ShareResult = "shared" | "cancelled" | "unsupported";

/** Opens the system share sheet with the file. */
export async function shareFile(file: File, text: { title: string; text: string }): Promise<ShareResult> {
  if (isNativeApp()) {
    const [{ Filesystem, Directory }, { Share }] = await Promise.all([import("@capacitor/filesystem"), import("@capacitor/share")]);
    const { uri } = await Filesystem.writeFile({ path: file.name, data: await toBase64(file), directory: Directory.Cache });
    try {
      await Share.share({ ...text, files: [uri], dialogTitle: text.title });
      return "shared";
    } catch (err) {
      if (err instanceof Error && /cancel/i.test(err.message)) return "cancelled";
      throw err;
    }
  }
  if (!canShareFiles(file)) return "unsupported";
  try {
    await navigator.share({ ...text, files: [file] });
    return "shared";
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return "cancelled";
    throw err;
  }
}

function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^,]*,/, ""));
    reader.onerror = () => reject(reader.error ?? new Error("The file could not be read."));
    reader.readAsDataURL(blob);
  });
}
