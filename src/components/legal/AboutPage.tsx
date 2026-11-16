"use client";

import Link from "next/link";
import { useState } from "react";
import { AbotMark } from "@/components/brand/AbotMark";
import { APK_URL } from "@/lib/get-app";
import { useT } from "@/i18n";
import { CONTACT_EMAIL, type LegalLang } from "./legal-content";
import { LangSwitch } from "./LangSwitch";

const COPY = {
  en: {
    lead: "ABOT is a strength training log for your phone. You log each set as you lift, rest on a timer, and look back at what you lifted.",
    does: "What it does",
    points: [
      "Log a set in one tap: type weight and reps, tap the check. What you lifted last time sits beside each set.",
      "Tick a set and the rest timer starts counting down, on every screen.",
      "Charts and personal records for each exercise.",
      "Workouts are saved on your phone and work offline. No account is needed.",
    ],
    google: "Signing in with Google",
    googleBody:
      "Signing in is optional. If you sign in with Google, ABOT uses your email address, name and picture to back up your routines and workouts and restore them on another phone. The Privacy Policy lists everything that is kept and how to delete it.",
    open: "Open ABOT",
    apk: "Download the Android app",
    privacy: "Privacy Policy",
    terms: "Terms of Use",
  },
  id: {
    lead: "ABOT adalah catatan latihan beban di HP kamu. Catat tiap set saat angkat, istirahat dengan timer, dan lihat lagi apa yang sudah kamu angkat.",
    does: "Yang bisa dilakukan",
    points: [
      "Catat set dengan satu ketukan: isi beban dan repetisi, ketuk centang. Angka latihan sebelumnya tampil di samping tiap set.",
      "Centang set dan timer istirahat langsung berjalan, di layar mana pun.",
      "Grafik dan rekor pribadi untuk tiap gerakan.",
      "Latihan tersimpan di HP dan bisa dipakai offline. Tidak perlu akun.",
    ],
    google: "Masuk dengan Google",
    googleBody:
      "Masuk itu opsional. Kalau kamu masuk dengan Google, ABOT memakai alamat email, nama, dan foto kamu untuk mencadangkan rutinitas dan latihan, lalu memulihkannya di HP lain. Kebijakan Privasi menjelaskan semua yang disimpan dan cara menghapusnya.",
    open: "Buka ABOT",
    apk: "Unduh aplikasi Android",
    privacy: "Kebijakan Privasi",
    terms: "Ketentuan Penggunaan",
  },
} as const;

/**
 * The public page about ABOT: Google's OAuth branding check reads it as the app's home page, so it
 * names the app, says what it does and why it asks for Google sign-in, and links the legal pages,
 * all in the prerendered HTML with nothing to sign in to or load first.
 */
export function AboutPage() {
  const t = useT();
  const [picked, setPicked] = useState<LegalLang | null>(null);
  const lang: LegalLang = picked ?? (t.lang === "id" ? "id" : "en");
  const c = COPY[lang];

  return (
    <main className="flex flex-1 flex-col px-4 pt-4 pb-10" lang={lang}>
      <div className="flex justify-end">
        <LangSwitch lang={lang} onPick={setPicked} />
      </div>

      <article className="mt-6 flex max-w-[62ch] flex-col gap-8">
        <header className="flex flex-col gap-3">
          <h1 className="flex items-center gap-3 text-3xl font-extrabold tracking-tight">
            <AbotMark size={40} />
            ABOT
          </h1>
          <p className="text-base leading-relaxed text-text-muted">{c.lead}</p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <Link
              href="/"
              className="inline-flex min-h-12 items-center justify-center rounded-ctl bg-accent px-5 text-base font-bold text-on-accent hover:brightness-110 active:brightness-95"
            >
              {c.open}
            </Link>
            <a
              href={APK_URL}
              className="inline-flex min-h-12 items-center justify-center rounded-ctl border border-line px-5 text-base font-semibold text-text hover:bg-ink/[0.05] active:bg-ink/10"
            >
              {c.apk}
            </a>
          </div>
        </header>

        <section className="flex flex-col gap-2">
          <h2 className="text-base font-bold">{c.does}</h2>
          <ul className="flex list-disc flex-col gap-1.5 pl-5 text-[15px] leading-relaxed marker:text-text-muted">
            {c.points.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-base font-bold">{c.google}</h2>
          <p className="text-[15px] leading-relaxed">{c.googleBody}</p>
        </section>

        <footer className="flex flex-wrap gap-x-4 gap-y-2 border-t border-line pt-4 text-sm">
          <Link href="/privacy" className="font-semibold text-accent underline-offset-4 hover:underline">
            {c.privacy}
          </Link>
          <Link href="/terms" className="font-semibold text-accent underline-offset-4 hover:underline">
            {c.terms}
          </Link>
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-text-muted underline-offset-4 hover:underline">
            {CONTACT_EMAIL}
          </a>
        </footer>
      </article>
    </main>
  );
}
