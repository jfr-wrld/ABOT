"use client";

import { useId, useState } from "react";
import { ChevronDown, Mail } from "lucide-react";
import { AbotMark } from "@/components/brand/AbotMark";
import { CONTACT_EMAIL, contactHref } from "@/lib/social";
import { useAppVersion } from "./AppVersion";

/** Questions people ask, answered in a line or two each. */
export const FAQ: { q: string; a: string }[] = [
  {
    q: "Does ABOT work without internet?",
    a: "Yes. Workouts, routines and records are saved on your phone. Only exercise photos, the full catalog download and backup need a connection.",
  },
  {
    q: "Do I need an account?",
    a: "No. Sign in with Google only if you want a backup in the cloud or the same data on two phones.",
  },
  {
    q: "How are personal records counted?",
    a: "Once per lift per workout, for the heaviest weight, the best estimated 1RM and the most volume in a set. The first time you log a lift is your baseline, not a record.",
  },
  {
    q: "Why did the rest alarm not ring?",
    a: "Notifications must be on for ABOT: Settings, Notifications, then Test alert. If it rings late, allow on-time alarms there, and keep battery saver from stopping ABOT.",
  },
  {
    q: "How does ABOT pick my gym?",
    a: "Pin each gym in Settings, Workout, Gyms while you are there. A workout started within about 300 m of a pinned gym picks it, if location is allowed.",
  },
  {
    q: "How do I share a workout to Instagram Stories?",
    a: "Open a finished workout, tap Share story, pick a layout and an optional photo, then Share to Instagram and choose Stories. Your username comes from Profile.",
  },
  {
    q: "How do I move my data to a new phone?",
    a: "Sign in with Google on both phones, or export a backup file in Settings, Data, and import it on the new phone.",
  },
  {
    q: "How do I delete my data?",
    a: "Uninstalling ABOT removes everything from the phone. To delete your cloud backup as well, email us from the account you signed in with.",
  },
];

export function FaqSection() {
  const [open, setOpen] = useState<number | null>(0);
  const base = useId();
  return (
    <ul className="flex flex-col gap-2">
      {FAQ.map((item, i) => {
        const expanded = open === i;
        return (
          <li key={item.q} className="rounded-ctl border border-line bg-surface">
            <button
              type="button"
              aria-expanded={expanded}
              aria-controls={`${base}-${i}`}
              onClick={() => setOpen(expanded ? null : i)}
              className="flex min-h-12 w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm font-semibold"
            >
              {item.q}
              <ChevronDown aria-hidden="true" size={18} className={`shrink-0 text-text-muted transition-transform ${expanded ? "rotate-180" : ""}`} />
            </button>
            {expanded && (
              <p id={`${base}-${i}`} className="px-3 pb-3 text-sm text-text-muted">
                {item.a}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function AboutSection() {
  const version = useAppVersion();
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col items-center gap-2 pt-2 text-center">
        <span className="text-accent">
          <AbotMark size={56} />
        </span>
        <p className="text-xl font-black tracking-tight">ABOT</p>
        <p className="text-sm text-text-muted">A strength training log that works offline.</p>
        {version && <p className="num text-xs text-text-muted">Version {version}</p>}
      </div>

      <section aria-labelledby="about-privacy" className="panel p-3">
        <h2 id="about-privacy" className="text-sm font-semibold">
          Your data
        </h2>
        <p className="mt-1 text-sm text-text-muted">
          Your training stays on this phone. Signing in copies it to your own backup space so you can restore it. Nothing is
          sold, and no one else sees it.
        </p>
      </section>

      <section aria-labelledby="about-credits" className="panel p-3">
        <h2 id="about-credits" className="text-sm font-semibold">
          Credits
        </h2>
        <ul className="mt-1 flex flex-col gap-1 text-sm text-text-muted">
          <li>Exercise data and photos: free-exercise-db (public domain).</li>
          <li>Muscle map shapes: react-muscle-highlighter (MIT License).</li>
          <li>Type: Inter and JetBrains Mono (SIL Open Font License).</li>
        </ul>
      </section>

      <a href={contactHref(version)} className="panel flex min-h-12 items-center gap-3 p-3 text-sm hover:border-line-hover">
        <Mail aria-hidden="true" size={18} className="shrink-0 text-text-muted" />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">Contact us</span>
          <span className="block truncate text-text-muted">{CONTACT_EMAIL}</span>
        </span>
      </a>
    </div>
  );
}
