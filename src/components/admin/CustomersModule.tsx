"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw } from "@/components/icons";
import { customers, type AdminMode } from "@/lib/admin-api";
import { missingFunctionMessage, proStatus, shortDate, sourceLabel, type Customer, type OrderTotals } from "@/lib/customers";
import { Metric, Note, Panel, cls } from "./ui";

/** Who paid and what PRO each account holds. View only: granting PRO stays in Licenses. */

const MIGRATION = "20261116_admin_customers_visits.sql";
const idr = (n: number) => `Rp ${n.toLocaleString("id-ID")}`;
const toneClass = (tone: "volt" | "amber" | undefined) => (tone === "volt" ? "text-accent" : tone === "amber" ? "text-caution" : "text-text-muted");

function founderText(c: Customer): string | null {
  if (c.founderUnitCode) return c.founderUnitCode.replace("FOUNDER // ", "Founder ");
  if (c.founderSeat !== null) return `Founder seat ${c.founderSeat}`;
  return c.isFounder ? "Founder" : null;
}

function lastPayment(c: Customer): string {
  if (!c.lastStatus || !c.lastAt) return "No order";
  const what = [c.lastPlan, c.lastAmountIdr !== null ? idr(c.lastAmountIdr) : null, c.lastPaymentType].filter(Boolean).join(" · ");
  return `${c.lastStatus === "paid" ? "Paid" : c.lastStatus[0]!.toUpperCase() + c.lastStatus.slice(1)} ${shortDate(c.lastAt)} · ${what}`;
}

export function CustomersModule({ mode }: { mode: AdminMode }) {
  const live = mode.kind === "server" && mode.admin;
  const [data, setData] = useState<{ list: Customer[]; totals: OrderTotals } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(live);
  const [query, setQuery] = useState("");
  const [now] = useState(() => Date.now());

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      setData(await customers());
    } catch (e) {
      setError(missingFunctionMessage(e, MIGRATION));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (!live) return;
    void customers()
      .then(setData, (e) => setError(missingFunctionMessage(e, MIGRATION)))
      .finally(() => setBusy(false));
  }, [live]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.list ?? []).filter((c) => !q || c.email.toLowerCase().includes(q));
  }, [data, query]);

  if (!live) {
    return (
      <Panel id="c-local" title="Customers" scope="global" wide>
        <Note>Customers need Supabase in the build and an admin sign-in.</Note>
      </Panel>
    );
  }

  const t = data?.totals;
  return (
    <>
      <Panel
        id="c-totals"
        title="Orders"
        scope="global"
        wide
        actions={
          <button type="button" onClick={() => void load()} disabled={busy} className={cls.ghost} aria-label="Refresh">
            <RefreshCw aria-hidden="true" size={14} className={busy ? "animate-spin" : undefined} />
          </button>
        }
      >
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <div className="col-span-2 sm:col-span-1">
            <Metric label="Revenue" value={t ? idr(t.revenueIdr) : "-"} tone="volt" />
          </div>
          <Metric label="Paid" value={t?.paid ?? "-"} />
          <Metric label="Pending" value={t?.pending ?? "-"} />
          <Metric label="Failed or expired" value={t?.failed ?? "-"} />
          <Metric label="Refunded" value={t?.refunded ?? "-"} />
        </dl>
        <Note>Sandbox payments count here until you clear them when Midtrans goes live (docs/payments-setup.md, Going live). The test buttons in Monetization are never counted.</Note>
        {error && <Note tone="error">{error}</Note>}
      </Panel>

      <Panel id="c-list" title={data ? `Customers (${data.list.length})` : "Customers"} scope="global" wide>
        <label htmlFor="c-search" className="sr-only">
          Search by email
        </label>
        <input id="c-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by email" className={cls.input} />

        {!data ? null : shown.length === 0 ? (
          <p className="text-sm text-text-muted">{data.list.length === 0 ? "Nobody has paid or holds PRO yet." : "No email matches."}</p>
        ) : (
          <>
            {/* Phones: one block per customer. */}
            <ul className="flex flex-col sm:hidden">
              {shown.map((c) => {
                const pro = proStatus(c, now);
                const founder = founderText(c);
                return (
                  <li key={c.userId} className="flex flex-col gap-1 border-t border-line py-3 first:border-t-0">
                    <p className="break-all text-sm font-semibold text-text">{c.email}</p>
                    <p className={`text-sm ${toneClass(pro.tone)}`}>
                      {pro.label}
                      {founder && <span className="text-text-muted"> · {founder}</span>}
                      {c.overCap && <span className="text-failure"> · Over cap</span>}
                    </p>
                    <p className="text-xs text-text-muted">{lastPayment(c)}</p>
                    <p className="text-xs text-text-muted">
                      {sourceLabel(c.source)} · {c.paidOrders} paid{c.paidOrders > 0 ? `, ${idr(c.paidTotalIdr)}` : ""}
                    </p>
                  </li>
                );
              })}
            </ul>
            {/* Wider screens: a table. */}
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">Customers, latest payment first</caption>
                <thead>
                  <tr className="text-xs text-text-muted">
                    <th scope="col" className="py-2 pr-3 font-normal">Email</th>
                    <th scope="col" className="py-2 pr-3 font-normal">PRO</th>
                    <th scope="col" className="py-2 pr-3 font-normal">Last order</th>
                    <th scope="col" className="py-2 pr-3 font-normal">From</th>
                    <th scope="col" className="py-2 text-right font-normal">Paid</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((c) => {
                    const pro = proStatus(c, now);
                    const founder = founderText(c);
                    return (
                      <tr key={c.userId} className="border-t border-line align-top">
                        <td className="max-w-[16rem] break-all py-2 pr-3 text-text">{c.email}</td>
                        <td className="py-2 pr-3">
                          <span className={toneClass(pro.tone)}>{pro.label}</span>
                          {founder && <span className="block text-xs text-text-muted">{founder}</span>}
                          {c.overCap && <span className="block text-xs text-failure">Over cap: review or refund</span>}
                        </td>
                        <td className="py-2 pr-3 text-text">{lastPayment(c)}</td>
                        <td className="py-2 pr-3 text-text">{sourceLabel(c.source)}</td>
                        <td className="py-2 text-right tabular-nums text-text">
                          {c.paidOrders}
                          {c.paidOrders > 0 && <span className="block text-xs text-text-muted">{idr(c.paidTotalIdr)}</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
        <Note>{"From is the last thing that changed the account's PRO. Paid counts every settled order."}</Note>
      </Panel>
    </>
  );
}
