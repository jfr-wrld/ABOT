"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { useSyncStore } from "@/store/useSyncStore";
import { useT } from "@/i18n";

/**
 * Asked once when someone signs in with a different account than the one this phone synced
 * with. On a shared phone the workouts here belong to someone else, so nothing uploads until the
 * lifter says so. Closing the sheet counts as "No", the safe answer.
 */
export function AccountSwitchDialog() {
  const t = useT();
  const email = useSyncStore((s) => s.switchTo);
  const confirm = useSyncStore((s) => s.confirmSwitch);
  const cancel = useSyncStore((s) => s.cancelSwitch);
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    await fn();
    setBusy(false);
  }

  return (
    <Sheet
      open={email !== null}
      onClose={() => !busy && void run(cancel)}
      title={t("Put this phone's data in a different account?")}
      footer={
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button onClick={() => void run(cancel)} disabled={busy}>
            {t("No, sign out")}
          </Button>
          <Button variant="primary" onClick={() => void run(confirm)} disabled={busy}>
            {t("Yes, add it")}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-2 pb-2 text-sm">
        <p>
          {email
            ? t("This phone last synced with another account. Signing in as {email} would copy every workout, gym and body weight here into {email}.", { email })
            : t("This phone last synced with another account. Signing in now would copy every workout, gym and body weight here into this one.")}
        </p>
        <p className="text-text-muted">{t("To start this account empty instead, sign out, delete this phone's data in Settings, then sign in again.")}</p>
      </div>
    </Sheet>
  );
}
