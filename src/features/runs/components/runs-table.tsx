"use client";

/**
 * Client-side table for /app/runs with live search + state chip filter.
 * Data is passed in as initialRuns from the server component; filtering
 * happens in memory (dataset is small for MVP demo).
 */
import { useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import {
  MagnifyingGlass,
  CircleNotch,
  CheckCircle,
  WarningCircle,
  Clock,
  ArrowRight,
} from "@phosphor-icons/react/dist/ssr";
import type { RunState, UrgencyLevel } from "@/lib/supabase/types";

type RunRow = {
  id: string;
  state: RunState;
  confidence: number | null;
  urgency: UrgencyLevel | null;
  created_at: string;
  advance_cursor: number;
  total_stages: number;
  case: {
    case_ref: string;
    title: string;
    customer_name: string | null;
    source: "intake" | "sample" | "gmail";
  } | null;
};

type Filter = "all" | RunState;

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "running", label: "Running" },
  { key: "completed", label: "Completed" },
  { key: "escalated", label: "Escalated" },
  { key: "pending", label: "Pending" },
];

export function RunsTable({
  initialRuns,
  workspaceSlug,
}: {
  initialRuns: RunRow[];
  workspaceSlug: string;
}) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return initialRuns.filter((r) => {
      if (filter !== "all" && r.state !== filter) return false;
      if (!query) return true;
      const hay = [
        r.case?.title ?? "",
        r.case?.case_ref ?? "",
        r.case?.customer_name ?? "",
        r.state,
        r.urgency ?? "",
        r.id.slice(0, 8),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(query);
    });
  }, [initialRuns, q, filter]);

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: initialRuns.length, running: 0, completed: 0, escalated: 0, pending: 0, failed: 0 };
    for (const r of initialRuns) c[r.state as Filter] = (c[r.state as Filter] ?? 0) + 1;
    return c;
  }, [initialRuns]);

  return (
    <div className="space-y-4">
      {/* Filter toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-md sm:flex-1">
          <MagnifyingGlass size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search runs by ID, case, or customerвЂ¦"
            className="w-full pl-9 pr-3 py-1.5 text-sm bg-white border border-gray-200 rounded-md shadow-sm outline-none focus:ring-1 focus:ring-black focus:border-black transition-all placeholder-gray-400 text-gray-900"
          />
        </div>
        <div className="-mx-1 flex w-full items-center gap-1.5 overflow-x-auto px-1 pb-1 sm:mx-0 sm:w-auto sm:overflow-visible sm:px-0 sm:pb-0">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={clsx(
                "shrink-0 px-2.5 py-1 text-xs rounded-md border transition-colors font-medium flex items-center gap-1.5",
                filter === f.key
                  ? "bg-gray-950 border-black text-white"
                  : "bg-white border-gray-200 text-gray-700 hover:border-gray-400",
              )}
            >
              <span>{f.label}</span>
              <span
                className={clsx(
                  "text-[10px] font-mono",
                  filter === f.key ? "text-gray-300" : "text-gray-600",
                )}
              >
                {counts[f.key] ?? 0}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {filtered.map((r) => (
          <RunMobileCard key={r.id} run={r} workspaceSlug={workspaceSlug} />
        ))}
        {filtered.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white px-4 py-10 text-center text-sm text-gray-500 shadow-sm">
            {initialRuns.length === 0 ? (
              <>
                No runs yet.{" "}
                <Link href={`/app/w/${workspaceSlug}` as never} className="font-medium text-black underline">
                  Start one
                </Link>
                .
              </>
            ) : (
              <>No runs match this filter.</>
            )}
          </div>
        ) : null}
      </div>

      {/* Table */}
      <div className="hidden bg-white border border-gray-200 rounded-lg shadow-sm overflow-x-auto md:block">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-gray-50 border-b border-gray-200 text-[10px] font-mono uppercase tracking-widest text-gray-500">
            <tr>
              <th className="text-left px-4 py-3 w-1/2">Case</th>
              <th className="text-left px-4 py-3">Customer</th>
              <th className="text-left px-4 py-3">State</th>
              <th className="text-left px-4 py-3">Progress</th>
              <th className="text-left px-4 py-3">Conf.</th>
              <th className="text-left px-4 py-3">Created</th>
              <th className="text-right px-4 py-3 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const c = r.case;
              return (
                <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors group">
                  <td className="px-4 py-3">
                    <Link href={`/app/w/${workspaceSlug}/runs/${r.id}` as never} className="block">
                      <div className="text-gray-900 font-medium truncate">{c?.title ?? "вЂ”"}</div>
                      <div className="mt-1 flex items-center gap-2 text-[11px] text-gray-500 font-mono">
                        <span>{c?.case_ref ?? r.id.slice(0, 8)}</span>
                        {c?.source ? <SourceBadge source={c.source} /> : null}
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-700 text-sm">{c?.customer_name ?? "вЂ”"}</td>
                  <td className="px-4 py-3">
                    <StateBadge state={r.state} />
                  </td>
                  <td className="px-4 py-3 text-xs font-mono text-gray-500">
                    {r.advance_cursor} / {r.total_stages}
                  </td>
                  <td className="px-4 py-3 text-gray-700 font-mono text-xs">
                    {r.confidence != null ? `${r.confidence}%` : "вЂ”"}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap font-mono" suppressHydrationWarning>
                    {formatCreatedAt(r.created_at)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/app/w/${workspaceSlug}/runs/${r.id}` as never}
                      className="inline-flex opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label="Open run"
                    >
                      <ArrowRight size={14} className="text-gray-400" />
                    </Link>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-sm text-gray-400">
                  {initialRuns.length === 0 ? (
                    <>
                      No runs yet.{" "}
                      <Link href={`/app/w/${workspaceSlug}` as never} className="text-black font-medium underline">
                        Start one
                      </Link>
                      .
                    </>
                  ) : (
                    <>No runs match this filter.</>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="text-[11px] text-gray-600 font-mono">
        Showing {filtered.length} of {initialRuns.length} runs
      </div>
    </div>
  );
}

function RunMobileCard({ run, workspaceSlug }: { run: RunRow; workspaceSlug: string }) {
  const c = run.case;

  return (
    <Link
      href={`/app/w/${workspaceSlug}/runs/${run.id}` as never}
      className="block rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-colors hover:border-gray-300 hover:bg-gray-50/40"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium text-gray-900 line-clamp-2">
            {c?.title ?? "вЂ”"}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-gray-500 font-mono">
            <span>{c?.case_ref ?? run.id.slice(0, 8)}</span>
            {c?.source ? <SourceBadge source={c.source} /> : null}
          </div>
        </div>
        <ArrowRight size={14} className="mt-0.5 shrink-0 text-gray-300" />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <StateBadge state={run.state} />
        <span className="rounded border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] font-mono text-gray-500">
          {run.advance_cursor} / {run.total_stages}
        </span>
        <span className="rounded border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] font-mono text-gray-500">
          {run.confidence != null ? `${run.confidence}% conf.` : "conf. pending"}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-gray-600">Customer</div>
          <div className="mt-0.5 text-gray-700">{c?.customer_name ?? "вЂ”"}</div>
        </div>
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-gray-600">Created</div>
          <div className="mt-0.5 font-mono text-gray-500" suppressHydrationWarning>
            {formatCreatedAt(run.created_at)}
          </div>
        </div>
      </div>
    </Link>
  );
}

function SourceBadge({ source }: { source: "intake" | "sample" | "gmail" }) {
  const tone =
    source === "gmail"
      ? "border-blue-200 bg-blue-50 text-blue-700"
      : source === "sample"
        ? "border-gray-200 bg-gray-100 text-gray-600"
        : "border-emerald-200 bg-emerald-50 text-emerald-700";

  return (
    <span
      className={clsx(
        "inline-flex items-center rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-widest",
        tone,
      )}
    >
      {source}
    </span>
  );
}

/**
 * Stable UTC-based timestamp format вЂ” avoids hydration mismatches caused by
 * server/client locale or timezone differences. Produces e.g. "Apr 18 06:04".
 */
function formatCreatedAt(iso: string): string {
  const d = new Date(iso);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${months[d.getUTCMonth()]} ${d.getUTCDate()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

function StateBadge({ state }: { state: RunState }) {
  const map: Record<RunState, { cls: string; icon: React.ReactNode; label: string }> = {
    pending: { cls: "bg-gray-100 text-gray-700 border-gray-200", icon: <Clock size={10} />, label: "PENDING" },
    running: { cls: "bg-blue-50 text-blue-700 border-blue-200", icon: <CircleNotch size={10} className="animate-spin" />, label: "RUNNING" },
    completed: { cls: "bg-green-50 text-green-700 border-green-200", icon: <CheckCircle size={10} weight="fill" />, label: "COMPLETED" },
    escalated: { cls: "bg-red-50 text-red-700 border-red-200", icon: <WarningCircle size={10} weight="fill" />, label: "ESCALATED" },
    failed: { cls: "bg-amber-50 text-amber-700 border-amber-200", icon: <WarningCircle size={10} />, label: "FAILED" },
  };
  const m = map[state];
  return (
    <span className={clsx("inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium uppercase tracking-wider border", m.cls)}>
      {m.icon}
      {m.label}
    </span>
  );
}
