"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { useSyncStore } from "@/store/useSyncStore";
import { DELETE_ACCOUNT_MESSAGE, deleteAccount, wipeDevice } from "@/lib/delete-data";
import { useT } from "@/i18n";

type Scope = "device" | "account";

/**
 * Settings > Data & backup, last: delete what ABOT holds, on this phone only or with the account.
 * The account option shows only while signed in, since the server needs to know whose it is.
 */
export function DeleteDataSection() {
  const t = useT();
  const phase = useSyncStore((s) => s.phase);
  const userId = useSyncStore((s) => s.userId);
  const signedIn = phase === "idle" || phase === "syncing" || phase === "offline" || (phase === "error" && userId !== null);
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<Scope>("device");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    if (busy) return;
    setOpen(false);
    setError(null);
  };

  async function run() {
    setBusy(true);
    setError(null);
    if (scope === "account") {
      const r = await deleteAccount();
      if (!r.ok) {
        setError(t(DELETE_ACCOUNT_MESSAGE[r.reason]));
        setBusy(false);
        return;
      }
    }
    await wipeDevice();
  }

  const options: { value: Scope; title: string; body: string }[] = [
    {
      value: "device",
      title: t("This phone only"),
      body: signedIn
        ? t("Your account and its cloud copy stay. Sign in again to bring your training back.")
        : t("Workouts, routines, photos and settings on this phone."),
    },
    ...(signedIn
      ? [
          {
            value: "account" as const,
            title: t("This phone and my account"),
            body: t("Also deletes the cloud copy, the sign-in and any PRO bought on the account. It cannot be restored."),
          },
        ]
      : []),
  ];
  const pick = options.some((o) => o.value === scope) ? scope : "device";

  return (
    <section aria-labelledby="delete-heading" className="flex flex-col gap-2">
      <h2 id="delete-heading" className="text-sm font-semibold">
        {t("Delete my data")}
      </h2>
      <p className="text-sm text-text-muted">
        {t("Start over on this phone, or close your ABOT account. Export a backup first if you might want it back.")}
      </p>
      <Button variant="danger" onClick={() => setOpen(true)} aria-haspopup="dialog">
        <Trash2 aria-hidden="true" size={16} />
        {t("Delete my data")}
      </Button>

      <Sheet
        open={open}
        onClose={close}
        title={t("Delete my data")}
        footer={
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={close} disabled={busy}>
              {t("Cancel")}
            </Button>
            <Button variant="danger" onClick={() => void run()} disabled={busy}>
              {busy ? t("Deleting…") : pick === "account" ? t("Delete everything") : t("Delete from phone")}
            </Button>
          </div>
        }
      >
        <fieldset className="flex flex-col gap-2">
          <legend className="sr-only">{t("What to delete")}</legend>
          {options.map((o) => (
            <label
              key={o.value}
              className={`flex cursor-pointer gap-3 rounded-ctl border p-3 ${pick === o.value ? "border-failure/60 bg-failure/5" : "border-line-strong bg-surface-2"}`}
            >
              <input
                type="radio"
                name="delete-scope"
                value={o.value}
                checked={pick === o.value}
                onChange={() => setScope(o.value)}
                disabled={busy}
                className="mt-1 size-4 accent-[var(--color-failure)]"
              />
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold">{o.title}</span>
                <span className="text-xs text-text-muted">{o.body}</span>
              </span>
            </label>
          ))}
        </fieldset>
        {error && (
          <p role="alert" className="mt-3 text-sm text-failure">
            {error}
          </p>
        )}
      </Sheet>
    </section>
  );
}
