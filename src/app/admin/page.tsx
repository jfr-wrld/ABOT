"use client";

import dynamic from "next/dynamic";
import Link from "next/link";

/**
 * Mission Control is web-only (owner, 2026-11-16): the APK build replaces it with a note, and the
 * flag is fixed at build time, so the console's code (ten modules, charts) is not in the APK at all.
 */
const MissionControl =
  process.env.ABOT_NATIVE_APP === "1" ? null : dynamic(() => import("@/components/admin/MissionControl"), { ssr: false });

export default function AdminPage() {
  if (MissionControl) return <MissionControl />;
  return (
    <main className="flex flex-1 flex-col items-start gap-3 px-4 pt-6">
      <h1 className="text-xl font-bold tracking-tight">Mission Control</h1>
      <p className="text-sm text-text-muted">Mission Control is in the web app only. Open ABOT in a browser and go to /admin.</p>
      <Link href="/settings" className="section-link flex min-h-11 items-center">
        Back to Settings
      </Link>
    </main>
  );
}
