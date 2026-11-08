"use client";

import { useHydration } from "@/store/hydration";
import { requestPersistentStorage } from "@/lib/storagePersistence";
import { Button } from "@/components/ui/Button";
import { isNativeApp } from "@/lib/native/files";

const TEXT = {
  persisted: "Protected: the browser will not clear ABOT data on its own.",
  not_persisted:
    "Not protected: the browser may clear ABOT data when the phone is low on space. Installing ABOT to the home screen usually fixes this. Keep a backup file too.",
  unsupported: "This browser cannot protect stored data. Keep a backup file.",
} as const;

/** In the Android app the data lives with the app: no browser can clear it. */
const APP_TEXT = "Stored inside the app. It goes only if you clear ABOT's data or uninstall it. Keep a backup file too.";

export function StorageSection() {
  const { durable, persistStatus, setPersistStatus } = useHydration();
  const app = isNativeApp();
  return (
    <section aria-labelledby="storage-heading" className="flex flex-col gap-2">
      <h2 id="storage-heading" className="text-sm font-semibold">
        Storage on this device
      </h2>
      <p role="status" className="text-sm text-text-muted">
        {app
          ? APP_TEXT
          : !durable
            ? "Data is only kept until this tab is closed (the browser blocked storage)."
            : persistStatus === null
              ? "Checking storage protection"
              : TEXT[persistStatus]}
      </p>
      {!app && durable && persistStatus === "not_persisted" && (
        <Button onClick={async () => setPersistStatus(await requestPersistentStorage())}>Ask the browser again</Button>
      )}
    </section>
  );
}
