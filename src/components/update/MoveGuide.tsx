"use client";

import Link from "next/link";
import { Download, HardDriveDownload, ShieldCheck } from "lucide-react";
import type { LatestRelease } from "@/lib/app-update";
import { useT } from "@/i18n";

/**
 * Shown by builds signed with the old, public key once ABOT ships signed with its private
 * release key. Android refuses an update signed by another key, so the move is a reinstall:
 * back up, uninstall, install the new one, restore. Kept short and in that order.
 */
export function MoveSteps({ release, onBackup }: { release: LatestRelease; onBackup?: () => void }) {
  const t = useT();
  const download = async () => {
    const { Browser } = await import("@capacitor/browser");
    await Browser.open({ url: release.apkUrl });
  };
  return (
    <div className="flex flex-col gap-3">
      <p className="flex items-start gap-2 text-sm">
        <ShieldCheck aria-hidden="true" size={18} className="mt-0.5 shrink-0 text-accent" />
        {t("ABOT is now signed with its own private key, so no one else can publish an update that looks like it. This one time, the new version cannot install over this one.")}
      </p>
      <ol className="flex flex-col gap-2 text-sm">
        <li className="flex gap-2">
          <span className="num font-bold text-accent">1</span>
          <span className="min-w-0 flex-1">
            {t("Back up your data to a file. With cloud sync on, signing in again brings your workouts back too.")}
            <Link href="/settings?section=data" onClick={onBackup} className="mt-1 flex min-h-11 items-center gap-1.5 font-semibold text-accent">
              <HardDriveDownload aria-hidden="true" size={16} />
              {t("Back up now")}
            </Link>
          </span>
        </li>
        <li className="flex gap-2">
          <span className="num font-bold text-accent">2</span>
          <span>{t("Uninstall ABOT from the phone's settings.")}</span>
        </li>
        <li className="flex gap-2">
          <span className="num font-bold text-accent">3</span>
          <span className="min-w-0 flex-1">
            {t("Install the new version, then restore the backup in Settings > Data.")}
            <button type="button" onClick={() => void download()} className="mt-1 flex min-h-11 items-center gap-1.5 font-semibold text-accent">
              <Download aria-hidden="true" size={16} />
              {t("Download ABOT {version}", { version: release.version })}
            </button>
          </span>
        </li>
      </ol>
    </div>
  );
}
