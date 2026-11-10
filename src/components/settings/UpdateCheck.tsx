"use client";

import { useEffect, useState } from "react";
import { Download, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { isNativeApp } from "@/lib/native/files";
import { checkForUpdate, type UpdateCheck as Result } from "@/lib/app-update";
import { feedback } from "@/lib/feedback";
import { useT } from "@/i18n";

/**
 * Settings > About, in the Android app: asks GitHub for the newest APK release and, when it is
 * newer than this build, downloads it in the browser so Android shows its install screen. The web
 * version is always current, so nothing shows there.
 */
export function UpdateCheck() {
  const t = useT();
  const [installed, setInstalled] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    if (!isNativeApp()) return;
    void import("@capacitor/app")
      .then(({ App }) => App.getInfo())
      .then((info) => setInstalled(Number(info.build) || 0))
      .catch(() => {});
  }, []);

  if (installed === null) return null;

  async function check() {
    feedback.tick();
    setBusy(true);
    setResult(await checkForUpdate(installed!));
    setBusy(false);
  }

  async function install(url: string) {
    feedback.tick();
    const { Browser } = await import("@capacitor/browser");
    await Browser.open({ url });
  }

  const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(t.locale, { day: "numeric", month: "long", year: "numeric" }) : "");

  return (
    <section aria-labelledby="about-update" className="panel flex flex-col gap-2 p-3">
      <h2 id="about-update" className="text-sm font-semibold">
        {t("App update")}
      </h2>
      {result?.kind === "available" ? (
        <>
          <p className="text-sm">
            {t("ABOT {version} is ready", { version: result.release.version })}
            {result.release.publishedAt && <span className="text-text-muted"> · {date(result.release.publishedAt)}</span>}
          </p>
          {result.release.notes && <p className="text-xs text-text-muted">{result.release.notes}</p>}
          <Button variant="primary" onClick={() => void install(result.release.apkUrl)}>
            <Download aria-hidden="true" size={16} />
            {t("Download and install")}
          </Button>
          <p className="text-xs text-text-muted">
            {t("The APK downloads in the browser; open it from the notification and tap Update. Your data stays on the phone.")}
          </p>
        </>
      ) : (
        <>
          <p role="status" className="text-sm text-text-muted">
            {result?.kind === "current"
              ? t("You have the newest version.")
              : result?.kind === "none"
                ? t("No release has been published yet.")
                : result?.kind === "error"
                  ? t("Could not reach GitHub. Check the connection and try again.")
                  : t("Check GitHub for a newer ABOT build.")}
          </p>
          <Button onClick={() => void check()} disabled={busy} aria-busy={busy}>
            <RefreshCw aria-hidden="true" size={16} className={busy ? "animate-spin" : ""} />
            {busy ? t("Checking...") : t("Check for updates")}
          </Button>
        </>
      )}
    </section>
  );
}
