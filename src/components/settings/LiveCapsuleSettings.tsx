"use client";

import { useCapsulePrefs, type CapsuleDetail, type CapsuleMode } from "@/lib/live-capsule";
import { Choice } from "./controls";
import { useT } from "@/i18n";

/** Android app, with the live timer on: when it shows and what its second line says. */
export function LiveCapsuleSettings() {
  const t = useT();
  const { mode, detail, set } = useCapsulePrefs();
  return (
    <div className="mt-3 flex flex-col gap-3">
      <Choice<CapsuleMode>
        name="capsule-mode"
        label={t("Show the timer")}
        info={t("Rest only hides it between rests; it comes back for each rest countdown.")}
        value={mode}
        options={[
          { value: "full", label: t("Rest and workout") },
          { value: "rest", label: t("Rest only") },
        ]}
        onChange={(m) => set({ mode: m })}
      />
      <Choice<CapsuleDetail>
        name="capsule-detail"
        label={t("Second line")}
        value={detail}
        options={[
          { value: "set", label: t("Next set") },
          { value: "volume", label: t("Total volume") },
        ]}
        onChange={(d) => set({ detail: d })}
      />
    </div>
  );
}
