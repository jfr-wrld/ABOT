"use client";

import { useEffect, useState } from "react";
import { Camera } from "lucide-react";
import { useSettingsStore } from "@/store/useSettingsStore";
import { HydrationGate } from "@/components/ui/Loading";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import { BodyweightSection } from "@/components/profile/BodyweightSection";
import { AccountSection } from "@/components/profile/AccountSection";
import { HeightField } from "@/components/profile/HeightField";
import { usePhotoPicker } from "@/components/profile/usePhotoPicker";
import { normalizeHandle } from "@/lib/profile";
import { useNow } from "@/lib/useNow";
import { PROFILE_LIMITS } from "@/types/workout";
import { useT } from "@/i18n";
import { CoverPickerSheet, CoverThumb } from "@/components/profile/ProfileCover";

export default function EditProfilePage() {
  return (
    <HydrationGate>
      <EditProfile />
    </HydrationGate>
  );
}

const INPUT =
  "h-11 w-full rounded-ctl border border-zinc-800 bg-well px-3 text-base text-text placeholder:text-text-muted hover:border-zinc-700 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30";

/**
 * Profile > Edit profile: everything about the lifter that they type in themselves. Photo, name,
 * username and height first, then bodyweight, then the account. #account scrolls to the account.
 */
function EditProfile() {
  const s = useSettingsStore();
  const now = useNow(60_000);
  const t = useT();
  const photo = usePhotoPicker((profilePhoto) => s.update({ profilePhoto }));
  const [coverOpen, setCoverOpen] = useState(false);

  useEffect(() => {
    // Arriving from the account chip: bring the account into view once it has rendered.
    if (window.location.hash !== "#account") return;
    let tries = 0;
    let frame = 0;
    const look = () => {
      const el = document.getElementById("account");
      if (el) el.scrollIntoView({ block: "center" });
      else if (tries++ < 60) frame = requestAnimationFrame(look);
    };
    frame = requestAnimationFrame(look);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <main className="flex flex-1 flex-col">
      <PageHeader title={t("Edit profile")} back={{ href: "/profile", label: t("Profile") }} />
      <div className="flex flex-col gap-4 px-4 pb-8 pt-4">
        <section aria-labelledby="body-heading" className="panel flex flex-col gap-3 p-3">
          <h2 id="body-heading" className="label-caps">
            {t("About you")}
          </h2>
          <div className="flex items-center gap-3">
            {photo.input}
            <button
              type="button"
              onClick={photo.open}
              disabled={photo.busy}
              aria-label={s.profilePhoto ? t("Change photo") : t("Add photo")}
              className="relative shrink-0 rounded-full transition-transform active:scale-95 disabled:opacity-50"
            >
              <ProfileAvatar name={s.profileName} photo={s.profilePhoto} size={64} />
              <span
                aria-hidden="true"
                className="absolute -right-0.5 -bottom-0.5 flex size-7 items-center justify-center rounded-full border border-line-strong bg-surface-2 text-text"
              >
                <Camera size={13} />
              </span>
            </button>
            <div className="flex min-w-0 flex-1 flex-wrap gap-1">
              <button
                type="button"
                onClick={photo.open}
                disabled={photo.busy}
                className="min-h-11 rounded-xl px-3 text-sm font-semibold text-text transition-colors hover:bg-ink/[0.05] disabled:opacity-50"
              >
                {s.profilePhoto ? t("Change photo") : t("Add photo")}
              </button>
              {s.profilePhoto && (
                <button
                  type="button"
                  onClick={() => s.update({ profilePhoto: null })}
                  className="min-h-11 rounded-xl px-3 text-sm font-semibold text-text-muted transition-colors hover:bg-ink/[0.05] hover:text-text"
                >
                  {t("Remove photo")}
                </button>
              )}
            </div>
          </div>
          {photo.error && (
            <p role="alert" className="text-xs text-failure">
              {t(photo.error)}
            </p>
          )}
          <button
            type="button"
            onClick={() => setCoverOpen(true)}
            aria-haspopup="dialog"
            className="flex min-h-12 items-center gap-3 rounded-xl text-left transition-colors hover:bg-ink/[0.03]"
          >
            <span className="relative block h-10 w-24 shrink-0 overflow-hidden rounded-lg border border-line bg-surface">
              <CoverThumb />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">{t("Profile cover")}</span>
              <span className="block text-xs text-text-muted">{t("Your own image or one of ten designs")}</span>
            </span>
          </button>
          <CoverPickerSheet open={coverOpen} onClose={() => setCoverOpen(false)} weeks={[]} />
          <div>
            <label htmlFor="profile-name" className="mb-1 block text-sm font-semibold">
              {t("Name")}
            </label>
            <input
              id="profile-name"
              value={s.profileName}
              maxLength={PROFILE_LIMITS.nameMax}
              autoComplete="name"
              onChange={(e) => s.update({ profileName: e.target.value })}
              placeholder={t("What should ABOT call you?")}
              className={INPUT}
            />
          </div>
          <div>
            <label htmlFor="profile-handle" className="mb-1 block text-sm font-semibold">
              {t("Username")} <span className="font-normal text-text-muted">{t("(on shared stories)")}</span>
            </label>
            <div className="flex h-11 items-center rounded-ctl border border-zinc-800 bg-well focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/30 hover:border-zinc-700">
              <span aria-hidden="true" className="num pl-3 text-base text-text-muted">
                @
              </span>
              <input
                id="profile-handle"
                value={s.profileHandle}
                maxLength={PROFILE_LIMITS.handleMax}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                onChange={(e) => s.update({ profileHandle: normalizeHandle(e.target.value) })}
                placeholder={t("yourname")}
                className="h-full min-w-0 flex-1 bg-transparent pl-0.5 pr-3 text-base text-text placeholder:text-text-muted focus:outline-none"
              />
            </div>
          </div>
          <HeightField imperial={s.weightUnit === "lbs"} heightCm={s.heightCm} onChange={(heightCm) => s.update({ heightCm })} />
        </section>
        <BodyweightSection now={now} />
        <AccountSection />
      </div>
    </main>
  );
}
