"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { HydrationGate } from "@/components/ui/Loading";
import { Button } from "@/components/ui/Button";
import { AppPermissionsList, useAppPermissions } from "@/components/settings/AppPermissions";
import { markPermissionsSeen } from "@/lib/native/permissions-step";

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
  const raw = useSearchParams().get("next");
  const next = raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
  const perms = useAppPermissions();

  function done() {
    markPermissionsSeen();
    router.replace(next);
  }

  return (
    <main className="flex min-h-[100dvh] flex-1 flex-col px-5 pb-[calc(16px+env(safe-area-inset-bottom))] pt-8">
      <h1 className="text-2xl font-bold tracking-tight">Allow access</h1>
      <p className="mt-1 text-sm text-text-muted">Each one turns on a feature. Change them any time in Settings.</p>
      <div className="mt-6">
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
          Allow all
        </Button>
        <Button variant="ghost" onClick={done} className="w-full">
          Not now
        </Button>
      </div>
    </main>
  );
}
