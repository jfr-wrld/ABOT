"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useT } from "@/i18n";

/**
 * A screen that throws while rendering lands here instead of Next's bare error page. The Android
 * app has no address bar, so this offers the way out: try again, Home, or Settings > Data, where a
 * bad import can be replaced with a good backup.
 */
export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useT();
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex flex-1 flex-col justify-center gap-4 px-4 py-10">
      <div>
        <p className="label-caps">{t("Something went wrong")}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">{t("This screen could not be shown")}</h1>
        <p className="mt-2 max-w-[42ch] text-sm text-text-muted">
          {t("Your data is still on this phone. If this started after an import, restore a backup you trust in Settings > Data.")}
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <Button variant="primary" onClick={reset} className="min-h-12 w-full text-base">
          <RotateCcw aria-hidden="true" size={18} />
          {t("Try again")}
        </Button>
        <Link href="/settings?section=data" className="flex min-h-12 items-center justify-center rounded-xl border border-ink/[0.12] text-base font-semibold hover:border-ink/25">
          {t("Open Settings > Data")}
        </Link>
        <Link href="/" className="flex min-h-11 items-center justify-center rounded-xl text-sm font-semibold text-text-muted hover:text-text">
          {t("Go to Home")}
        </Link>
      </div>
    </main>
  );
}
