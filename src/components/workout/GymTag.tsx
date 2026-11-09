"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, MapPin } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { useLocationStore } from "@/store/useLocationStore";
import { useWorkoutStore } from "@/store/useWorkoutStore";
import type { WorkoutSession } from "@/types/workout";
import { NearbyGymFinder } from "@/components/settings/LocationsSection";
import { useT } from "@/i18n";

/**
 * The gym a finished workout was done at, under its date. Tapping it picks another gym or none;
 * the change also moves the workout's per-gym records, like picking the gym in the logger.
 */
export function GymTag({ session }: { session: WorkoutSession }) {
  const t = useT();
  const locations = useLocationStore((s) => s.locations);
  const addGym = useLocationStore((s) => s.add);
  const updateGym = useLocationStore((s) => s.update);
  const setSessionLocation = useWorkoutStore((s) => s.setSessionLocation);
  const [open, setOpen] = useState(false);
  const gym = locations.find((l) => l.id === session.locationId);

  const pick = (id: string | undefined) => {
    setSessionLocation(session.id, id);
    setOpen(false);
  };
  const option = (id: string | undefined, label: string) => {
    const on = session.locationId === id || (!id && !gym);
    return (
      <button
        key={id ?? "none"}
        type="button"
        role="radio"
        aria-checked={on}
        onClick={() => pick(id)}
        className="flex min-h-12 w-full items-center justify-between gap-3 rounded-ctl px-3 text-left text-base font-semibold hover:bg-ink/[0.05]"
      >
        <span className="min-w-0 truncate">{label}</span>
        {on && (
          <Check
            aria-hidden="true"
            size={18}
            className="shrink-0 text-accent"
          />
        )}
      </button>
    );
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={
          gym ? t("Gym: {name}. Change", { name: gym.name }) : t("Tag a gym")
        }
        className="-ml-1 mt-1 inline-flex min-h-11 max-w-full items-center gap-1.5 rounded-full px-1 text-sm hover:bg-ink/[0.06]"
      >
        <MapPin
          aria-hidden="true"
          size={16}
          className={gym ? "shrink-0 text-text" : "shrink-0 text-text-muted"}
        />
        <span
          className={`truncate ${gym ? "font-semibold" : "text-text-muted"}`}
        >
          {gym ? gym.name : t("Tag a gym")}
        </span>
      </button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={t("Where did you train?")}
      >
        <div className="flex flex-col gap-3 pb-2">
          {locations.length > 0 && (
            <div role="radiogroup" aria-label={t("Gym")} className="flex flex-col">
              {locations.map((l) => option(l.id, l.name))}
              {option(undefined, t("No gym"))}
            </div>
          )}
          <NearbyGymFinder
            taken={locations}
            onPick={(g) => {
              const existing = locations.find((l) => l.name.toLowerCase() === g.name.toLowerCase());
              const gym = existing ?? addGym(g.name);
              if (!existing) updateGym(gym.id, { lat: g.lat, lng: g.lng });
              pick(gym.id);
            }}
          />
          <Link href="/settings?section=workout" className="flex min-h-11 items-center justify-center text-sm font-semibold text-text-muted hover:text-text">
            {t("Manage gyms in Settings")}
          </Link>
        </div>
      </Sheet>
    </>
  );
}
