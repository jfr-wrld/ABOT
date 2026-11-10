"use client";

import { useEffect } from "react";
import { Download, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { isNativeApp } from "@/lib/native/files";
import { useAppUpdate } from "@/store/useAppUpdate";
import { feedback } from "@/lib/feedback";
import { useT } from "@/i18n";

/**
 * Settings > About, in the Android app: the same update the pop-up offers (UpdateCenter), with
 * the download's progress, Install once it is in, and a manual check. If the download fails,
 * the browser download is offered instead. The web version is always current, so nothing shows.
 */
export function UpdateCheck() {
  const t = useT();
  const s = useAppUpdate();

  // Settings opened before UpdateCenter learned the build (it reads it on launch too).
  useEffect(() => {
    if (!isNativeApp() || useAppUpdate.getState().installed !== null) return;
    void import("@capacitor/app")
      .then(({ App }) => App.getInfo())
      .then((info) => useAppUpdate.getState().init(Number(info.build) || 0))
      .catch(() => {});
  }, []);

  if (s.installed === null) return null;
  const r = s.result;

  async function inBrowser(url: string) {
    const { Browser } = await import("@capacitor/browser");
    await Browser.open({ url });
  }

  return (
    <section aria-labelledby="about-update" className="panel flex flex-col gap-2 p-3">
      <h2 id="about-update" className="text-sm font-semibold">
        {t("App update")}
      </h2>

      {s.phase === "downloading" ? (
        <div role="status" aria-live="polite" className="flex flex-col gap-1.5">
          <div className="flex justify-between text-sm">
            <span>{t("Downloading in the background...")}</span>
            <span className="num text-text-muted">{s.fraction === null ? "" : `${Math.round(s.fraction * 100)}%`}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-ink/10" aria-hidden="true">
            <div
              className={`h-full rounded-full bg-accent transition-[width] duration-300 ${s.fraction === null ? "w-1/4 animate-pulse" : ""}`}
              style={s.fraction === null ? undefined : { width: `${s.fraction * 100}%` }}
            />
          </div>
        </div>
      ) : s.phase === "ready" || s.phase === "permission" || s.phase === "opened" ? (
        <>
          <p role="status" className="text-sm text-text-muted">
            {s.phase === "permission"
              ? t("Turn on Allow from this source for ABOT, come back, then tap Install.")
              : s.phase === "opened"
                ? t("Tap Update on Android's screen. Your data stays on the phone.")
                : t("ABOT {version} is downloaded.", { version: s.build ? `1.0.${s.build}` : "" })}
          </p>
          <Button variant="primary" onClick={() => void s.install()}>
            <Download aria-hidden="true" size={16} />
            {t("Install")}
          </Button>
        </>
      ) : r?.kind === "available" ? (
        <>
          <p className="text-sm">{t("ABOT {version} is ready", { version: r.release.version })}</p>
          {s.phase === "failed" && (
            <p role="alert" className="text-sm text-failure">
              {t("The download did not finish. Try again, or download it in the browser.")}
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={s.openModal}>
              <Sparkles aria-hidden="true" size={16} />
              {t("What's new")}
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                feedback.tick();
                void s.start();
              }}
            >
              <Download aria-hidden="true" size={16} />
              {s.phase === "failed" ? t("Try again") : t("Update now")}
            </Button>
          </div>
          {s.phase === "failed" && <Button onClick={() => void inBrowser(r.release.apkUrl)}>{t("Download in the browser")}</Button>}
        </>
      ) : (
        <>
          <p role="status" className="text-sm text-text-muted">
            {r?.kind === "current"
              ? t("You have the newest version.")
              : r?.kind === "none"
                ? t("No release has been published yet.")
                : r?.kind === "error"
                  ? t("Could not reach GitHub. Check the connection and try again.")
                  : t("ABOT checks GitHub for a newer build when it opens.")}
          </p>
          <Button
            onClick={() => {
              feedback.tick();
              void s.check();
            }}
            disabled={s.checking}
            aria-busy={s.checking}
          >
            <RefreshCw aria-hidden="true" size={16} className={s.checking ? "animate-spin" : ""} />
            {s.checking ? t("Checking...") : t("Check for updates")}
          </Button>
        </>
      )}
    </section>
  );
}
