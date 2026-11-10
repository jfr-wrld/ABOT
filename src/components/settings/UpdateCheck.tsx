"use client";

import { useEffect, useState } from "react";
import { Download, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { isNativeApp } from "@/lib/native/files";
import { checkForUpdate, type UpdateCheck as Result } from "@/lib/app-update";
import { AppUpdate, followDownload } from "@/lib/native/app-updater";
import { feedback } from "@/lib/feedback";
import { useT } from "@/i18n";

/**
 * Settings > About, in the Android app: asks GitHub for the newest APK release and, when it is
 * newer than this build, downloads it with Android's DownloadManager (progress shown here) and
 * opens the install screen. If that fails or stalls, the browser download is offered instead. The
 * web version is always current, so nothing shows there.
 */
export function UpdateCheck() {
  const t = useT();
  const [installed, setInstalled] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  /** idle, then downloading (with the share done), then the installer; or a way out. */
  const [step, setStep] = useState<"idle" | "downloading" | "permission" | "failed" | "opened">("idle");
  const [fraction, setFraction] = useState<number | null>(null);

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

  async function openInstaller() {
    try {
      const { needsPermission } = await AppUpdate.install();
      setStep(needsPermission ? "permission" : "opened");
    } catch {
      setStep("failed");
    }
  }

  async function install(url: string, version: string) {
    feedback.tick();
    setStep("downloading");
    setFraction(null);
    try {
      const { id } = await AppUpdate.download({ url, title: `ABOT ${version}` });
      const end = await followDownload(id, setFraction);
      if (end === "done") await openInstaller();
      else setStep("failed");
    } catch {
      setStep("failed");
    }
  }

  async function inBrowser(url: string) {
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
          {step === "downloading" ? (
            <div role="status" aria-live="polite" className="flex flex-col gap-1.5">
              <div className="flex justify-between text-sm">
                <span>{t("Downloading...")}</span>
                <span className="num text-text-muted">{fraction === null ? "" : `${Math.round(fraction * 100)}%`}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-ink/10" aria-hidden="true">
                <div
                  className={`h-full rounded-full bg-accent transition-[width] duration-300 ${fraction === null ? "w-1/4 animate-pulse" : ""}`}
                  style={fraction === null ? undefined : { width: `${fraction * 100}%` }}
                />
              </div>
            </div>
          ) : step === "permission" || step === "opened" ? (
            <>
              <p role="status" className="text-sm text-text-muted">
                {step === "permission"
                  ? t("Turn on Allow from this source for ABOT, come back, then tap Install.")
                  : t("Tap Update on Android's screen. Your data stays on the phone.")}
              </p>
              <Button variant="primary" onClick={() => void openInstaller()}>
                <Download aria-hidden="true" size={16} />
                {t("Install")}
              </Button>
            </>
          ) : (
            <>
              {step === "failed" && (
                <p role="alert" className="text-sm text-failure">
                  {t("The download did not finish. Try again, or download it in the browser.")}
                </p>
              )}
              <Button variant="primary" onClick={() => void install(result.release.apkUrl, result.release.version)}>
                <Download aria-hidden="true" size={16} />
                {step === "failed" ? t("Try again") : t("Download and install")}
              </Button>
              {step === "failed" && (
                <Button onClick={() => void inBrowser(result.release.apkUrl)}>{t("Download in the browser")}</Button>
              )}
              <p className="text-xs text-text-muted">{t("ABOT downloads the update and opens Android's install screen. Your data stays on the phone.")}</p>
            </>
          )}
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
