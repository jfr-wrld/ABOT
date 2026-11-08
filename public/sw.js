/*
 * ABOT service worker: notifications only (no caching, no fetch handling, so it changes nothing
 * about how pages load). Handles the reminder buttons:
 *   ACTION_START (or a tap on the body): open ABOT on /workout?start=<routine> and start it.
 *   ACTION_SNOOZE: store "remind again in 30 minutes" in IndexedDB; the app's reminder loop
 *   shows it then. Nothing here can wake on its own later, so the snooze lives in storage.
 */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

const SNOOZE_MS = 30 * 60 * 1000;

function saveSnooze(routineId) {
  return new Promise((resolve) => {
    const open = indexedDB.open("abot");
    open.onerror = () => resolve();
    open.onsuccess = () => {
      const db = open.result;
      if (!db.objectStoreNames.contains("kv")) {
        db.close();
        resolve();
        return;
      }
      const tx = db.transaction("kv", "readwrite");
      tx.objectStore("kv").put({ key: "reminderSnooze", value: { until: Date.now() + SNOOZE_MS, routineId: routineId ?? null } });
      tx.oncomplete = tx.onerror = () => {
        db.close();
        resolve();
      };
    };
  });
}

async function openWorkout(url) {
  const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  for (const client of windows) {
    if ("focus" in client) {
      await client.focus();
      if ("navigate" in client) return client.navigate(url);
      return client.postMessage({ type: "abot-open", url });
    }
  }
  return self.clients.openWindow(url);
}

self.addEventListener("notificationclick", (event) => {
  const data = event.notification.data || {};
  event.notification.close();
  if (event.action === "ACTION_SNOOZE") {
    event.waitUntil(saveSnooze(data.routineId));
    return;
  }
  event.waitUntil(openWorkout(data.url || "/workout"));
});
