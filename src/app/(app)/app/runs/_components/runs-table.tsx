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

export function RunsTable({ initialRuns }: { initialRuns: RunRow[] }) {
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
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <MagnifyingGlass size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search runs by ID, case, or customer…"
            className="w-full pl-9 pr-3 py-1.5 text-sm bg-white border border-gray-200 rounded-md shadow-sm outline-none focus:ring-1 focus:ring-black focus:border-black transition-all placeholder-gray-400 text-gray-900"
          />
        </div>
        <div className="flex items-center gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={clsx(
                "px-2.5 py-1 text-xs rounded-md border transition-colors font-medium flex items-center gap-1.5",
                filter === f.key
                  ? "bg-black border-black text-white"
                  : "bg-white border-gray-200 text-gray-700 hover:border-gray-400",
              )}
            >
              <span>{f.label}</span>
              <span
                className={clsx(
                  "text-[10px] font-mono",
                  filter === f.key ? "text-gray-300" : "text-gray-400",
                )}
              >
                {counts[f.key] ?? 0}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        <table className="w-full text-sm">
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
                    <Link href={`/app/runs/${r.id}` as never} className="block">
                      <div className="text-gray-900 font-medium truncate">{c?.title ?? "—"}</div>
                      <div className="text-[11px] text-gray-500 font-mono">{c?.case_ref ?? r.id.slice(0, 8)}</div>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-700 text-sm">{c?.customer_name ?? "—"}</td>
                  <td className="px-4 py-3">
                    <StateBadge state={r.state} />
                  </td>
                  <td className="px-4 py-3 text-xs font-mono text-gray-500">
                    {r.advance_cursor} / {r.total_stages}
                  </td>
                  <td className="px-4 py-3 text-gray-700 font-mono text-xs">
                    {r.confidence != null ? `${r.confidence}%` : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap font-mono" suppressHydrationWarning>
                    {formatCreatedAt(r.created_at)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/app/runs/${r.id}` as never}
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
                      <Link href={"/app" as never} className="text-black font-medium underline">
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

      <div className="text-[11px] text-gray-400 font-mono">
        Showing {filtered.length} of {initialRuns.length} runs
      </div>
    </div>
  );
}

/**
 * Stable UTC-based timestamp format — avoids hydration mismatches caused by
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
