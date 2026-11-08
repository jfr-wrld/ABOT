export type PersistStatus = "persisted" | "not_persisted" | "unsupported";

/**
 * Asks the browser to exempt ABOT's IndexedDB from automatic cleanup when storage runs low.
 * Chrome decides silently (installed PWAs and engaged sites are usually granted); Firefox may
 * prompt; Safari grants it to Home Screen apps.
 */
export async function requestPersistentStorage(
  nav: Pick<Navigator, "storage"> | undefined = typeof navigator === "undefined" ? undefined : navigator,
): Promise<PersistStatus> {
  const storage = nav?.storage;
  if (!storage || typeof storage.persist !== "function" || typeof storage.persisted !== "function") return "unsupported";
  try {
    if (await storage.persisted()) return "persisted";
    return (await storage.persist()) ? "persisted" : "not_persisted";
  } catch {
    return "not_persisted";
  }
}
