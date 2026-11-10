"use client";

import { safeReturnPath } from "@/lib/safe-path";
import { useRouter, useSearchParams } from "next/navigation";
import { HydrationGate } from "@/components/ui/Loading";
import { Button } from "@/components/ui/Button";
import { AppPermissionsList, useAppPermissions } from "@/components/settings/AppPermissions";
import { markPermissionsSeen } from "@/lib/native/permissions-step";
import { useT } from "@/i18n";

/** The Android app's first-run step after the intro: what each access turns on, one tap each. */
export default function PermissionsPage() {
  return (
    <HydrationGate>
      <PermissionsStep />
    </HydrationGate>
  );
}

function PermissionsStep() {
  const router = useRouter();
  const next = safeReturnPath(useSearchParams().get("next")) ?? "/";
  const perms = useAppPermissions();
  const t = useT();

  function done() {
    markPermissionsSeen();
    router.replace(next);
  }

  return (
    <main className="fixed inset-0 z-30 flex h-dvh flex-col overflow-hidden overscroll-none bg-bg px-5 pb-[calc(16px+env(safe-area-inset-bottom))] pt-[calc(32px+env(safe-area-inset-top))]">
      <h1 className="text-2xl font-bold tracking-tight">{t("Allow access")}</h1>
      <p className="mt-1 text-sm text-text-muted">{t("Each one turns on a feature. Change them any time in Settings.")}</p>
      <div className="mt-6 min-h-0 flex-1 overflow-y-auto">
        <AppPermissionsList perms={perms} />
      </div>
      <div className="mt-auto flex flex-col gap-2 pt-6">
        <Button
          variant="primary"
          onClick={async () => {
            await perms.allowAll();
            done();
          }}
          className="min-h-12 w-full text-base"
        >
          {t("Allow all")}
        </Button>
        <Button variant="ghost" onClick={done} className="w-full">
          {t("Not now")}
        </Button>
      </div>
    </main>
  );
}
