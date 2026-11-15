"use client";

import { useCallback, useEffect, useState } from "react";
import { ExternalLink, RefreshCw } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { growth, type AdminMode } from "@/lib/admin-api";
import { fetchDownloads, type DownloadSummary, type GrowthSummary } from "@/lib/growth";
import { Metric, Note, Panel, cls, errText } from "./ui";

/**
 * Growth: web visitors (Vercel's dashboard; ABOT only sends the page views), APK downloads
 * (GitHub Releases) and accounts (admin_growth). Numbers are read when the module opens and on
 * Refresh, never in the background.
 */

const num = (n: number | null | undefined) => (n === null || n === undefined ? "-" : n.toLocaleString("en-US"));
const shortDay = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

export function GrowthModule({ mode }: { mode: AdminMode }) {
  return (
    <>
      <AccountsPanel mode={mode} />
      <DownloadsPanel />
      <VisitorsPanel />
    </>
  );
}

function growthError(e: unknown): string {
  const text = errText(e);
  return /admin_growth/.test(text) ? "admin_growth() is missing: apply supabase/migrations/20261115_admin_growth.sql." : text;
}

function RefreshButton({ busy, onClick }: { busy: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} disabled={busy} className={cls.ghost} aria-label="Refresh">
      <RefreshCw aria-hidden="true" size={14} className={busy ? "animate-spin" : undefined} />
    </button>
  );
}

function AccountsPanel({ mode }: { mode: AdminMode }) {
  const [data, setData] = useState<GrowthSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const live = mode.kind === "server" && mode.admin;
  const [busy, setBusy] = useState(live);

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      setData(await growth(30));
    } catch (e) {
      setError(growthError(e));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (!live) return;
    void growth(30)
      .then(setData, (e) => setError(growthError(e)))
      .finally(() => setBusy(false));
  }, [live]);

  return (
    <Panel id="g-accounts" title="New accounts" scope="global" wide actions={live ? <RefreshButton busy={busy} onClick={() => void load()} /> : undefined}>
      {!live ? (
        <Note>Account numbers need Supabase in the build and an admin sign-in.</Note>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Metric label="Today" value={num(data?.signupsToday)} tone="volt" />
            <Metric label="Last 7 days" value={num(data?.signups7)} />
            <Metric label="Last 30 days" value={num(data?.signupsTotal)} />
            <Metric label="Synced today" value={num(data?.activeToday)} tone="cyan" />
          </dl>
          {data && data.days.length > 0 && (
            <figure className="flex flex-col gap-2">
              <div className="h-56 w-full" role="img" aria-label={`Sign-ups per day over the last ${data.days.length} days, ${data.signupsTotal} in all, and accounts that synced each day, at most ${data.activePeak}.`}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.days} margin={{ top: 8, right: 4, left: -20, bottom: 0 }} barCategoryGap="20%">
                    <CartesianGrid vertical={false} stroke="#27272a" />
                    <XAxis dataKey="day" tickFormatter={shortDay} tick={{ fill: "#a1a1aa", fontSize: 10 }} tickLine={false} axisLine={{ stroke: "#27272a" }} minTickGap={16} />
                    <YAxis allowDecimals={false} tick={{ fill: "#a1a1aa", fontSize: 10 }} tickLine={false} axisLine={false} width={44} />
                    <Tooltip
                      cursor={{ fill: "rgba(255,255,255,0.04)" }}
                      contentStyle={{ background: "#09090b", border: "1px solid #27272a", borderRadius: 8, fontSize: 12 }}
                      labelStyle={{ color: "#fff" }}
                      labelFormatter={(v) => shortDay(String(v))}
                    />
                    <Bar dataKey="signups" name="Sign-ups" fill="#ccff00" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="active" name="Synced" fill="#00f0ff" fillOpacity={0.55} radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <figcaption className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-400">
                <span className="flex items-center gap-1.5">
                  <span aria-hidden="true" className="size-2.5 rounded-[2px] bg-[#ccff00]" /> Sign-ups
                </span>
                <span className="flex items-center gap-1.5">
                  <span aria-hidden="true" className="size-2.5 rounded-[2px] bg-[#00f0ff]/55" /> Accounts that synced
                </span>
                <span>Days in Jakarta time.</span>
              </figcaption>
            </figure>
          )}
          <Note>Only people who sign in with Google have an account. Anyone using ABOT without signing in shows up in downloads and web visitors, not here.</Note>
          {error && <Note tone="error">{error}</Note>}
        </>
      )}
    </Panel>
  );
}

function DownloadsPanel() {
  const [data, setData] = useState<DownloadSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      setData(await fetchDownloads());
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void fetchDownloads()
      .then(setData, (e) => setError(errText(e)))
      .finally(() => setBusy(false));
  }, []);

  return (
    <Panel id="g-downloads" title="APK downloads" scope="global" actions={<RefreshButton busy={busy} onClick={() => void load()} />}>
      <dl className="grid grid-cols-2 gap-2">
        <Metric label="From the web link" value={num(data?.fromLink)} tone="volt" />
        <Metric label="In-app updates" value={num(data?.updates)} />
      </dl>
      {data && data.releases.length > 0 && (
        <table className="w-full font-mono text-xs tabular-nums">
          <caption className="sr-only">Downloads per build, newest first</caption>
          <thead>
            <tr className="text-left text-zinc-400">
              <th scope="col" className="py-1 font-normal">Build</th>
              <th scope="col" className="py-1 font-normal">Released</th>
              <th scope="col" className="py-1 text-right font-normal">Link</th>
              <th scope="col" className="py-1 text-right font-normal">Updates</th>
            </tr>
          </thead>
          <tbody>
            {data.releases.slice(0, 8).map((r) => (
              <tr key={r.tag} className="border-t border-[#27272a] text-zinc-200">
                <td className="py-1.5">{r.build}</td>
                <td className="py-1.5 text-zinc-400">{r.publishedAt ? new Date(r.publishedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "-"}</td>
                <td className="py-1.5 text-right">{num(r.fromLink)}</td>
                <td className="py-1.5 text-right">{num(r.updates)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <Note>GitHub counts downloads, not people: a phone that downloads twice counts twice. Updates come from people who already have the app.</Note>
      {error && <Note tone="error">{error}</Note>}
    </Panel>
  );
}

function VisitorsPanel() {
  return (
    <Panel id="g-visitors" title="Web visitors" scope="global">
      <p className="text-sm text-zinc-300">
        Visitors, top pages, countries, devices and where people came from (Threads shows up as a referrer) are in Vercel: open the project, then Analytics.
      </p>
      <a href="https://vercel.com/dashboard" target="_blank" rel="noopener noreferrer" className={`${cls.ghost} self-start`}>
        Open Vercel <ExternalLink aria-hidden="true" size={14} />
      </a>
      <Note>Counting starts once Web Analytics is turned on for the project in Vercel and this version is deployed. The Android app sends nothing.</Note>
    </Panel>
  );
}
