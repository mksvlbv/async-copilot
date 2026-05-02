"use client";

/**
 * Live Triage Run — signature screen.
 * 3-column lockup: Case Context | Visible Triage | Response Pack.
 *
 * Background execution (preferred):
 *   - Run creation queues server-owned execution immediately.
 *   - The client observes progress by polling run detail state.
 *
 * Polling (fallback):
 *   - If background execution is idle, POST /advance can still execute one step.
 *   - Refreshing the page re-reads server state (no client-only run memory).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import {
  MagicWand,
  Envelope,
  Receipt,
  Package,
  Spinner,
  Pause,
  ArrowsClockwise,
  ShareNetwork,
  Copy,
  CheckCircle,
  Clock,
  CaretRight,
  Info,
  Lightning,
  Export,
  CopySimple,
} from "@phosphor-icons/react/dist/ssr";
import type { RunWithDetails, StageProvenance, WorkspaceRole } from "@/lib/supabase/types";
import { SLACK_ACTION_INTENT } from "@/lib/integrations/slack";
import {
  formatStageDurationLabel,
  formatPromptReference,
  formatRuntimeReference,
  getResponsePackLineage,
  getStageProvenance,
} from "@/features/runs/lib/provenance";

const POLL_MS = 800;
const LIVE_UPDATE_ERROR = "Live updates paused. Refresh the page to resume this run.";

type Props = {
  initialRun: RunWithDetails;
  workspaceSlug: string;
  currentRole: WorkspaceRole;
};

/** Per-stage streaming tokens buffer. */
type StreamingTokens = Record<string, string>;

export function LiveRunView({ initialRun, workspaceSlug, currentRole }: Props) {
  const [run, setRun] = useState<RunWithDetails>(initialRun);
  const [polling, setPolling] = useState(false);
  const [pollError, setPollError] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [streamingTokens, setStreamingTokens] = useState<StreamingTokens>({});
  const [activeStreamStage, setActiveStreamStage] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [aiMode, setAiMode] = useState<"streaming" | "polling" | null>(null);
  const aborted = useRef(false);

  const isTerminal =
    run.state === "completed" ||
    run.state === "escalated" ||
    run.state === "failed";

  // Refresh run detail from server
  const refreshRun = useCallback(async () => {
    try {
      const r = await fetch(`/api/runs/${run.id}`, { cache: "no-store" });
      if (!r.ok) return;
      const data = (await r.json()) as { run: RunWithDetails };
      if (!aborted.current) setRun(data.run);
    } catch { /* ignore */ }
  }, [run.id]);

  // SSE streaming mode
  useEffect(() => {
    if (isTerminal || paused || aiMode === "polling") return;
    if (aiMode === "streaming") return; // already connected

    aborted.current = false;

    async function tryStream() {
      if (aborted.current) return;

      try {
        const res = await fetch(`/api/runs/${run.id}/stream`);

        // Not available → fall back to polling
        if (res.status === 204 || res.status === 409) {
          setAiMode("polling");
          return;
        }
        if (!res.ok || !res.body) {
          setAiMode("polling");
          return;
        }

        setAiMode("streaming");
        setIsStreaming(true);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          if (aborted.current) break;
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          let eventType = "";
          for (const line of lines) {
            if (line.startsWith("event: ")) {
              eventType = line.slice(7).trim();
            } else if (line.startsWith("data: ")) {
              const raw = line.slice(6);
              try {
                const data = JSON.parse(raw);
                handleSSEEvent(eventType, data);
              } catch { /* skip malformed */ }
            }
          }
        }
      } catch {
        if (!aborted.current) setAiMode("polling");
      } finally {
        setIsStreaming(false);
        setActiveStreamStage(null);
        // Final refresh to get the completed state
        if (!aborted.current) refreshRun();
      }
    }

    function handleSSEEvent(event: string, data: Record<string, unknown>) {
      switch (event) {
        case "stage-start":
          setActiveStreamStage(data.stageKey as string);
          setStreamingTokens((prev) => ({ ...prev, [data.stageKey as string]: "" }));
          break;
        case "stage-token":
          setStreamingTokens((prev) => ({
            ...prev,
            [data.stageKey as string]: (prev[data.stageKey as string] ?? "") + (data.token as string),
          }));
          break;
        case "stage-done":
          setActiveStreamStage(null);
          // Refresh run to pick up DB updates
          refreshRun();
          break;
        case "run-done":
          refreshRun();
          break;
        case "error":
          setPollError(LIVE_UPDATE_ERROR);
          break;
      }
    }

    tryStream();

    return () => {
      aborted.current = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run.id, isTerminal, paused]);

  // Polling fallback loop (only when aiMode === "polling")
  useEffect(() => {
    if (aiMode !== "polling") return;
    aborted.current = false;

    async function step() {
      if (aborted.current) return;
      if (paused) return;
      if (
        run.state === "completed" ||
        run.state === "escalated" ||
        run.state === "failed"
      ) {
        setPolling(false);
        return;
      }

      setPolling(true);
      try {
        const observeOnly =
          run.execution_status === "running" ||
          run.execution_status === "retrying";

        if (!observeOnly) {
          await fetch(`/api/runs/${run.id}/advance`, { method: "POST" });
        }
        const r = await fetch(`/api/runs/${run.id}`, { cache: "no-store" });
        if (!r.ok) throw new Error(LIVE_UPDATE_ERROR);
        const data = (await r.json()) as { run: RunWithDetails };
        if (aborted.current) return;
        setRun(data.run);
        setPollError(null);
      } catch (e) {
        if (!aborted.current) {
          setPollError(e instanceof Error ? e.message : LIVE_UPDATE_ERROR);
        }
      }
    }

    const handle = setTimeout(step, POLL_MS);
    return () => {
      clearTimeout(handle);
      aborted.current = true;
    };
  }, [aiMode, run.id, run.state, run.advance_cursor, run.execution_status, paused]);

  return (
    <div className="flex-1 flex min-h-0 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
      <CaseContextPanel run={run} workspaceSlug={workspaceSlug} />
      <TimelinePanel
        run={run}
        polling={polling || isStreaming}
        pollError={pollError}
        streamingTokens={streamingTokens}
        activeStreamStage={activeStreamStage}
        aiMode={aiMode}
      />
      <ResponsePackPanel
        run={run}
        workspaceSlug={workspaceSlug}
        currentRole={currentRole}
        refreshRun={refreshRun}
        isTerminal={isTerminal}
        paused={paused}
        setPaused={setPaused}
      />
    </div>
  );
}

/* =============================================================
 *  LEFT — Case Context
 * ============================================================= */

function CaseContextPanel({
  run,
  workspaceSlug,
}: {
  run: RunWithDetails;
  workspaceSlug: string;
}) {
  const c = run.case;
  const gmailMessage = c.gmail_message ?? null;
  const urgencyStage = run.stages.find((s) => s.stage_key === "classify");
  const queryStage = run.stages.find((s) => s.stage_key === "query");

  return (
    <aside className="flex w-full shrink-0 flex-col border-b border-gray-200 bg-white z-10 lg:w-[300px] lg:border-b-0 lg:border-r xl:w-[340px]">
      <div className="h-12 border-b border-gray-100 flex items-center justify-between px-5 bg-gray-50/50 shrink-0">
        <span className="text-[10px] font-mono font-semibold text-gray-700 uppercase tracking-widest">
          Case Context
        </span>
        <span className="px-1.5 py-0.5 bg-gray-100 text-gray-700 text-[10px] rounded font-mono border border-gray-200">
          STATIC
        </span>
      </div>
      <div className="mockup-scroll p-4 space-y-6 sm:p-5 lg:flex-1 lg:overflow-y-auto">
        {/* Customer identity */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Customer Identity</h3>
          <dl className="text-xs text-gray-700 space-y-2 border border-gray-200 rounded-md p-3 bg-gray-50/30">
            <Row label="Source" value={formatCaseSource(c.source)} mono />
            <Row label="Name" value={c.customer_name ?? "—"} />
            <Row label="Account" value={c.customer_account ?? "—"} />
            <Row label="Plan" value={c.customer_plan ?? "—"} mono />
          </dl>
        </div>

        {/* Extracted Facts (populated from classify + query stage outputs) */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-1.5">
            <MagicWand size={14} weight="fill" className="text-gray-500" /> Extracted Facts
          </h3>
          <div className="space-y-2.5">
            <Fact
              label="Core Issue"
              value={prettyIntent((urgencyStage?.output as Record<string, unknown>)?.intent)}
            />
            {(queryStage?.output as Record<string, unknown>)?.ledger_mismatch === true && (
              <Fact label="Ledger" value="Mismatch detected" accent="red" />
            )}
            <Fact
              label="Urgency"
              value={run.urgency ?? "analyzing…"}
              accent={run.urgency === "high" ? "red" : run.urgency === "medium" ? "amber" : undefined}
            />
            <Fact
              label="Confidence"
              value={run.confidence != null ? `${run.confidence}%` : "pending"}
              mono
            />
          </div>
        </div>

        {/* Evidence snippets */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Evidence Snippets</h3>
          <div className="space-y-3">
            <EvidenceCard
              icon={<Envelope size={12} />}
              source={c.source === "gmail" ? "Gmail Source" : "Source Email"}
              body={
                c.source === "gmail" && gmailMessage
                  ? [
                      `Subject: ${gmailMessage.subject ?? c.title}`,
                      `From: ${gmailMessage.from_email ?? "unknown"}`,
                      `Thread: ${shortenSourceId(gmailMessage.gmail_thread_id)}`,
                    ].join("\n")
                  : truncate(c.body, 280)
              }
            />
            <EvidenceCard
              icon={<Receipt size={12} />}
              source="Case"
              body={`Ref: ${c.case_ref}\nSource: ${formatCaseSource(c.source)}`}
              mono
            />
            {gmailMessage ? (
              <EvidenceCard
                icon={<Receipt size={12} />}
                source="Gmail Metadata"
                body={[
                  `Message: ${shortenSourceId(gmailMessage.gmail_message_id)}`,
                  `Snippet: ${gmailMessage.snippet ?? "—"}`,
                ].join("\n")}
                mono
              />
            ) : null}
          </div>
        </div>

        {/* Similar Cases (RAG) */}
        <SimilarCasesSection caseId={c.id} workspaceSlug={workspaceSlug} />
      </div>
    </aside>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-gray-700 font-mono text-[10px] uppercase tracking-widest">{label}</dt>
      <dd className={clsx("min-w-0 break-words text-right text-gray-900 font-medium", mono && "break-all font-mono text-[11px] bg-gray-100 px-1.5 py-0.5 rounded")}>
        {value}
      </dd>
    </div>
  );
}

function Fact({
  label,
  value,
  mono,
  accent,
}: {
  label: string;
  value: string;
  mono?: boolean;
  accent?: "red" | "amber";
}) {
  const borderClass =
    accent === "red"
      ? "border-red-300"
      : accent === "amber"
        ? "border-amber-300"
        : "border-gray-200";
  const textClass =
    accent === "red"
      ? "text-red-600"
      : accent === "amber"
        ? "text-amber-700"
        : "text-gray-900";
  return (
    <div className={clsx("flex flex-col gap-1 border-l-2 pl-3", borderClass)}>
      <span className="text-[10px] font-mono text-gray-700 uppercase tracking-widest">{label}</span>
      <span className={clsx("text-sm font-medium", textClass, mono && "font-mono text-xs")}>
        {value}
      </span>
    </div>
  );
}

function EvidenceCard({
  icon,
  source,
  body,
  mono,
}: {
  icon: React.ReactNode;
  source: string;
  body: string;
  mono?: boolean;
}) {
  return (
    <div className="border border-gray-200 rounded-md overflow-hidden hover:border-gray-300 transition-colors cursor-pointer group">
      <div className="bg-gray-50 border-b border-gray-100 px-2.5 py-1.5 flex justify-between items-center">
        <div className="flex items-center gap-1.5 text-[10px] font-mono text-gray-600 uppercase tracking-wider">
          {icon} {source}
        </div>
        <CaretRight size={10} className="text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      <p className={clsx("p-3 text-[11px] text-gray-700 leading-relaxed whitespace-pre-line break-words", mono && "font-mono")}>
        {body}
      </p>
    </div>
  );
}

/* =============================================================
 *  Similar Cases (RAG panel)
 * ============================================================= */

type SimilarCase = {
  id: string;
  case_ref: string;
  title: string;
  body: string;
  similarity: number;
};

function SimilarCasesSection({
  caseId,
  workspaceSlug,
}: {
  caseId: string;
  workspaceSlug: string;
}) {
  const [cases, setCases] = useState<SimilarCase[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const r = await fetch(`/api/cases/${caseId}/similar?limit=3`);
        if (!r.ok) throw new Error();
        const data = (await r.json()) as { similar: SimilarCase[] };
        if (!cancelled) setCases(data.similar);
      } catch {
        // Silently fail — similar cases is non-critical
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [caseId]);

  if (loading) {
    return (
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-1.5">
          <ShareNetwork size={14} weight="fill" className="text-gray-500" /> Similar Cases
        </h3>
        <div className="animate-pulse space-y-2">
          <div className="h-14 bg-gray-100 rounded-md" />
          <div className="h-14 bg-gray-100 rounded-md" />
        </div>
      </div>
    );
  }

  if (cases.length === 0) return null;

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-1.5">
        <ShareNetwork size={14} weight="fill" className="text-gray-500" /> Similar Cases
        <span className="text-[9px] font-mono text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200 uppercase tracking-widest ml-auto">
          pgvector + trgm
        </span>
      </h3>
      <div className="space-y-2">
        {cases.map((sc) => (
          <Link
            key={sc.id}
            href={`/app/w/${workspaceSlug}/runs` as never}
            className="block border border-gray-200 rounded-md p-2.5 hover:border-blue-300 hover:bg-blue-50/30 transition-colors group"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-mono text-gray-500">{sc.case_ref}</span>
              <span className="text-[9px] font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                {Math.round(sc.similarity * 100)}% match
              </span>
            </div>
            <p className="text-[11px] font-medium text-gray-800 leading-snug line-clamp-2">
              {sc.title}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}

/* =============================================================
 *  CENTER — Visible Triage timeline
 * ============================================================= */

function TimelinePanel({
  run,
  polling,
  pollError,
  streamingTokens,
  activeStreamStage,
  aiMode,
}: {
  run: RunWithDetails;
  polling: boolean;
  pollError: string | null;
  streamingTokens?: StreamingTokens;
  activeStreamStage?: string | null;
  aiMode?: "streaming" | "polling" | null;
}) {
  const stages = [...run.stages].sort((a, b) => a.stage_order - b.stage_order);
  const events = run.events ?? [];
  const currentOrder = run.advance_cursor + 1;
  const isTerminal =
    run.state === "completed" ||
    run.state === "escalated" ||
    run.state === "failed";

  return (
    <section 
      className="flex w-full flex-col bg-gray-50/50 min-w-0 lg:flex-1 lg:overflow-hidden"
      aria-live="polite"
      aria-atomic="true"
    >
      {/* Top header */}
      <div className="px-4 py-5 border-b border-gray-200 bg-white/50 backdrop-blur-sm shrink-0 sm:px-6 lg:px-6 lg:py-6 xl:px-8">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span className="relative flex h-2 w-2" aria-hidden>
            {isTerminal ? (
              <span
                className={clsx(
                  "relative inline-flex rounded-full h-2 w-2",
                  run.state === "completed" && "bg-green-500",
                  run.state === "escalated" && "bg-red-500",
                  run.state === "failed" && "bg-amber-500",
                )}
              />
            ) : (
              <>
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
              </>
            )}
          </span>
          <span className="text-[11px] font-mono font-medium text-gray-700 tracking-wide uppercase">
            {isTerminal ? run.state.replace("_", " ") : "Triage In Progress"}
          </span>
          {polling && (
            <Spinner size={12} className="animate-spin text-gray-400 ml-1" />
          )}
          {aiMode === "streaming" && (
            <span className="ml-2 px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-[9px] font-mono font-semibold rounded border border-emerald-200 uppercase tracking-widest">
              Llama 3.3 · Live
            </span>
          )}
          {aiMode === "polling" && (
            <span className="ml-2 px-1.5 py-0.5 bg-gray-100 text-gray-500 text-[9px] font-mono font-semibold rounded border border-gray-200 uppercase tracking-widest">
              Synthetic
            </span>
          )}
        </div>
        <h1 className="break-words text-xl font-semibold tracking-tight text-gray-900 sm:text-2xl">
          {run.case.title}
        </h1>
        <p className="break-words text-sm text-gray-500 mt-2 font-mono">
          Running execution pipeline for {run.case.case_ref}
        </p>
        {pollError && <div className="mt-3 text-[11px] text-red-600 font-medium">{pollError}</div>}
      </div>

      {/* Timeline */}
      <div className="mockup-scroll px-4 py-6 sm:px-6 lg:flex-1 lg:overflow-y-auto lg:px-6 lg:py-8 xl:px-8">
        <div className="relative max-w-2xl mx-auto">
          <div className="relative">
            {/* Vertical line for the staged execution only. */}
            <div
              className="pointer-events-none absolute left-[15px] top-2 bottom-8 w-px bg-gradient-to-b from-gray-200 via-gray-200 to-transparent"
              aria-hidden
            />

            <ol className="space-y-6">
              {stages.map((s) => {
                const num = String(s.stage_order).padStart(2, "0");
                const completed = s.state === "completed" || s.stage_order < currentOrder;
                const running =
                  !isTerminal &&
                  s.stage_order === currentOrder &&
                  (run.state === "running" || run.state === "pending");
                const pending = !completed && !running;
                const provenance = getStageProvenance(events, s.stage_key, s.stage_order);

                return (
                  <li key={s.id} className="relative pl-12">
                    {/* Marker */}
                    <div className="absolute left-0 top-1 z-10">
                      {completed ? (
                        <div className="w-8 h-8 bg-gray-950 rounded-full flex items-center justify-center text-white shadow-sm">
                          <CheckCircle size={16} weight="fill" />
                        </div>
                      ) : running ? (
                        <div className="w-8 h-8 rounded-full bg-white border-2 border-blue-500 flex items-center justify-center shadow-sm animate-pulse">
                          <span className="w-2 h-2 rounded-full bg-blue-500" />
                        </div>
                      ) : (
                        <div className="w-8 h-8 bg-gray-50 border-2 border-dashed border-gray-300 rounded-full flex items-center justify-center">
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                        </div>
                      )}
                    </div>

                    <h4
                      className={clsx(
                        "text-sm font-mono font-medium uppercase tracking-widest mb-1 pt-1",
                        completed
                          ? "text-gray-900"
                          : running
                            ? "text-gray-900"
                            : "text-gray-400",
                      )}
                    >
                      {num} {s.stage_label}
                    </h4>

                    <StageBody
                      stage={s}
                      running={running}
                      pending={pending}
                      provenance={provenance}
                      streamingText={streamingTokens?.[s.stage_key]}
                      isActiveStream={activeStreamStage === s.stage_key}
                    />
                  </li>
                );
              })}
            </ol>
          </div>

          {events.length > 0 ? (
            <div className="mt-8 border border-gray-200 rounded-lg bg-white shadow-sm overflow-hidden sm:mt-10 sm:ml-12">
              <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex flex-wrap items-center justify-between gap-2">
                <div className="text-[10px] font-mono font-semibold uppercase tracking-widest text-gray-500">
                  Event Timeline
                </div>
                <div className="text-[10px] font-mono text-gray-400">
                  {events.length} events
                </div>
              </div>
              <div className="divide-y divide-gray-100">
                {events.map((eventItem) => (
                  <div key={eventItem.id} className="px-4 py-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-gray-900">
                        {formatEventLabel(eventItem.event_type)}
                      </div>
                      <div className="mt-1 text-[11px] text-gray-500">
                        {formatEventActor(eventItem)}
                        {eventItem.stage_key ? ` · ${eventItem.stage_key}` : ""}
                      </div>
                      <div className="mt-1 text-[11px] text-gray-600 break-words">
                        {formatEventSummary(eventItem.payload)}
                      </div>
                    </div>
                    <div className="text-[10px] font-mono text-gray-400 sm:shrink-0">
                      {formatAttempt(eventItem.created_at)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function StageBody({
  stage,
  running,
  pending,
  provenance,
  streamingText,
  isActiveStream,
}: {
  stage: RunWithDetails["stages"][number];
  running: boolean;
  pending: boolean;
  provenance?: StageProvenance | null;
  streamingText?: string;
  isActiveStream?: boolean;
}) {
  if (pending) {
    return (
      <div className="text-xs text-gray-600">Awaiting previous stage…</div>
    );
  }
  if (running || isActiveStream) {
    return (
      <div className="mt-1 space-y-2">
        <div className="text-xs text-gray-500 flex items-center gap-2">
          <Spinner size={14} className="animate-spin text-gray-400" />
          {isActiveStream ? "Streaming from Llama 3.3…" : "Running…"}
        </div>
        {streamingText && (
          <div className="bg-gray-950 rounded-md p-3 shadow-sm overflow-x-auto">
            <pre className="text-[11px] text-emerald-400 font-mono leading-relaxed whitespace-pre-wrap break-words">
              {streamingText}
              <span className="animate-pulse text-emerald-300">▌</span>
            </pre>
          </div>
        )}
      </div>
    );
  }
  // completed
  const out = stage.output as Record<string, unknown>;
  const hasOutput = out && Object.keys(out).length > 0;
  const durationLabel = formatStageDurationLabel(stage);
  return (
    <div className="mt-1 bg-white border border-gray-200 rounded-md p-3 shadow-sm space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono text-gray-700 uppercase tracking-widest">Output</span>
        <span className="text-[10px] font-mono text-gray-600">{durationLabel ?? ""}</span>
      </div>
      {provenance ? (
        <div className="rounded-md border border-gray-200 bg-gray-50/70 px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[9px] font-mono uppercase tracking-widest text-gray-500">
              Provenance
            </span>
            <span
              className={clsx(
                "shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-widest",
                provenance.execution_mode === "ai"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-amber-200 bg-amber-50 text-amber-700",
              )}
            >
              {provenance.execution_mode === "ai" ? "AI" : "Synthetic fallback"}
            </span>
          </div>
          <dl className="mt-2 space-y-1 text-[10px] text-gray-600">
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-[56px_1fr] sm:gap-2">
              <dt className="font-mono uppercase tracking-widest text-gray-700">Prompt</dt>
              <dd className="font-mono break-all">{formatPromptReference(provenance)}</dd>
            </div>
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-[56px_1fr] sm:gap-2">
              <dt className="font-mono uppercase tracking-widest text-gray-700">Runtime</dt>
              <dd className="break-words">{formatRuntimeReference(provenance)}</dd>
            </div>
            {provenance.parse_error ? (
              <div className="grid grid-cols-1 gap-1 sm:grid-cols-[56px_1fr] sm:gap-2">
                <dt className="font-mono uppercase tracking-widest text-gray-700">Warning</dt>
                <dd>Model returned non-JSON output; raw stage output was kept for review.</dd>
              </div>
            ) : null}
          </dl>
        </div>
      ) : null}
      {hasOutput ? (
        <dl className="text-[11px] text-gray-700 space-y-1">
          {Object.entries(out)
            .slice(0, 4)
            .map(([k, v]) => (
              <div key={k} className="grid grid-cols-1 gap-1 sm:grid-cols-[auto_1fr] sm:gap-2">
                <dt className="text-gray-700">{k.replace(/_/g, " ")}</dt>
                <dd className={clsx("break-words font-medium sm:truncate", typeof v === "string" && /^\d+$/.test(v) ? "font-mono" : "")}>
                  {renderValue(v)}
                </dd>
              </div>
            ))}
        </dl>
      ) : (
        <div className="text-[11px] text-gray-600">No detailed output.</div>
      )}
    </div>
  );
}

/* =============================================================
 *  RIGHT — Response Pack
 * ============================================================= */

function ResponsePackPanel({
  run,
  workspaceSlug,
  currentRole,
  refreshRun,
  isTerminal,
  paused,
  setPaused,
}: {
  run: RunWithDetails;
  workspaceSlug: string;
  currentRole: WorkspaceRole;
  refreshRun: () => Promise<void>;
  isTerminal: boolean;
  paused: boolean;
  setPaused: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const [approving, setApproving] = useState(false);
  const [packState, setPackState] = useState(run.response_pack);
  const [copyOk, setCopyOk] = useState(false);
  const [copyAllOk, setCopyAllOk] = useState(false);

  useEffect(() => {
    setPackState(run.response_pack);
  }, [run.response_pack]);

  const pack = packState;
  const approved = pack?.approved ?? false;
  const building = !isTerminal || !pack;
  const escalation = pack ? pack.confidence < 70 : run.confidence != null && run.confidence < 70;
  const slackAction = pack?.staged_actions.find((action) => action.intent === SLACK_ACTION_INTENT) ?? null;
  const approvalHistory = run.approval_history ?? [];
  const actionAttempts = run.action_attempts ?? [];
  const packLineage = pack ? getResponsePackLineage(run) : null;
  const canApprove = currentRole === "admin" || currentRole === "reviewer";
  const actionRetryable = approved && slackAction?.status === "failed" && canApprove;
  const primaryDisabled = !pack || approving || !canApprove || (approved && !actionRetryable);

  async function approve() {
    if (approving || primaryDisabled) return;
    setApproving(true);
    try {
      const r = await fetch(`/api/runs/${run.id}/approve`, { method: "POST" });
      if (r.ok) {
        const data = (await r.json()) as { response_pack?: RunWithDetails["response_pack"] };
        if (data.response_pack) setPackState(data.response_pack);
        await refreshRun();
      }
    } finally {
      setApproving(false);
    }
  }

  function copyDraft() {
    if (!pack) return;
    navigator.clipboard.writeText(pack.draft_reply).then(() => {
      setCopyOk(true);
      setTimeout(() => setCopyOk(false), 1500);
    });
  }

  function copyAll() {
    if (!pack) return;
    const text = [
      `# Response Pack — ${run.case.case_ref}`,
      `Case: ${run.case.title}`,
      `State: ${run.state} · Confidence: ${pack.confidence}% · Urgency: ${run.urgency ?? "—"}`,
      "",
      pack.recommendation ? `Recommendation: ${pack.recommendation}` : "",
      "",
      "Internal summary:",
      pack.internal_summary,
      "",
      "Draft reply:",
      pack.draft_reply,
    ]
      .filter(Boolean)
      .join("\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopyAllOk(true);
      setTimeout(() => setCopyAllOk(false), 1500);
    });
  }

  return (
    <aside className="flex w-full shrink-0 flex-col border-t border-gray-200 bg-white z-10 shadow-[-8px_0_24px_rgba(0,0,0,0.02)] lg:w-[320px] lg:border-l lg:border-t-0 xl:w-[360px]">
      <div className="h-12 border-b border-gray-100 flex items-center justify-between px-5 bg-gray-50/50 shrink-0">
        <span className="text-[10px] font-mono font-semibold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
          <Package size={12} /> Response Pack
        </span>
        <span className="flex items-center gap-1.5 text-[10px] font-mono text-gray-500">
          {building ? (
            <>
              <Spinner size={12} className="animate-spin text-gray-400" /> BUILDING
            </>
          ) : approved ? (
            <>
              <CheckCircle size={12} weight="fill" className="text-green-600" /> APPROVED
            </>
          ) : (
            <>
              <Clock size={12} className="text-gray-400" /> READY
            </>
          )}
        </span>
      </div>

      <div className="mockup-scroll p-4 space-y-4 sm:p-5 lg:flex-1 lg:overflow-y-auto">
        {/* Confidence card */}
        <div
          className={clsx(
            "border rounded-lg shadow-sm overflow-hidden bg-white",
            escalation ? "border-red-200 border-l-4 border-l-red-500" : "border-gray-200 border-l-4 border-l-green-500",
          )}
        >
          <div className="p-4 border-b border-gray-100 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="text-[10px] font-mono text-gray-700 uppercase mb-1">System Confidence</div>
              <div className="text-2xl font-bold text-gray-900 font-mono tracking-tight flex items-baseline gap-1">
                {run.confidence ?? "—"}
                <span className="text-sm text-gray-600">%</span>
              </div>
            </div>
            {escalation && (
              <div className="w-fit bg-red-50 text-red-700 text-[10px] font-mono px-2 py-0.5 rounded border border-red-100 font-medium">
                ESCALATION REQUIRED
              </div>
            )}
          </div>
          {pack?.recommendation && (
            <div className="bg-gray-50 p-3 text-xs text-gray-600 leading-relaxed border-t border-gray-100 font-sans">
              <span className="font-semibold text-gray-800">Recommendation: </span>
              {pack.recommendation}
            </div>
          )}
        </div>

        {/* Internal summary */}
        {pack?.internal_summary && (
          <div className="border border-gray-200 rounded-md overflow-hidden shadow-sm">
            <div className="bg-gray-50 border-b border-gray-200 px-3 py-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Info size={12} className="text-gray-600" />
                <span className="text-[10px] font-mono uppercase text-gray-600">Internal Triage Note</span>
              </div>
              <CheckCircle size={12} weight="fill" className="text-green-500" />
            </div>
            <div className="p-3 text-xs text-gray-800 leading-relaxed whitespace-pre-line">
              {pack.internal_summary}
            </div>
          </div>
        )}

        {/* Draft reply */}
        <div className="border border-gray-200 rounded-md overflow-hidden shadow-sm flex flex-col">
          <div className="bg-gray-50 border-b border-gray-200 px-3 py-2 flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase text-gray-600">Draft Reply</span>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={copyDraft}
                disabled={!pack}
                className="p-1 hover:bg-gray-200 rounded text-gray-500 disabled:opacity-40"
                aria-label="Copy"
              >
                {copyOk ? <CheckCircle size={12} weight="fill" className="text-green-700" /> : <Copy size={12} />}
              </button>
              <span className="px-1.5 py-0.5 rounded border border-gray-200 bg-white text-[10px] font-mono uppercase tracking-widest text-gray-700">
                Read-only
              </span>
            </div>
          </div>
          <div className={clsx("p-3 text-xs text-gray-700 leading-relaxed whitespace-pre-line bg-white min-h-[140px]", building && "blur-[2px] select-none")}>
            {pack?.draft_reply ?? "Drafting based on guidelines…"}
          </div>
        </div>

        {/* Citations */}
        {pack && pack.citations.length > 0 && (
          <div className="border border-gray-200 rounded-md bg-gray-50/50 p-3">
            <div className="text-[10px] font-mono uppercase text-gray-700 mb-2 tracking-widest">
              Sources Cited
            </div>
            <ul className="space-y-1.5 text-[11px] text-gray-700">
              {pack.citations.slice(0, 4).map((c) => (
                <li key={c.id} className="flex items-start gap-2">
                    <span className="font-mono text-gray-700 shrink-0">·</span>
                  <div className="flex-1">
                    <span className="font-semibold">{c.source}</span>
                    <span className="text-gray-700"> — {c.note}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {packLineage ? (
          <div className="border border-gray-200 rounded-md bg-white overflow-hidden">
            <div className="bg-gray-50 border-b border-gray-100 px-3 py-2 flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase text-gray-600 font-semibold">
                Pack Provenance
              </span>
              <span className="text-[10px] font-mono text-gray-600">
                {packLineage.stages.length} stage{packLineage.stages.length === 1 ? "" : "s"}
              </span>
            </div>
            <dl className="p-3 space-y-3">
              <div className="grid grid-cols-1 gap-1 text-[10px] text-gray-600 sm:grid-cols-[56px_1fr] sm:gap-2">
                <dt className="font-mono uppercase tracking-widest text-gray-700">Created</dt>
                <dd className="font-mono text-gray-700">{formatAttempt(packLineage.created_at)}</dd>
              </div>
              <div className="grid grid-cols-1 gap-1 text-[10px] text-gray-600 sm:grid-cols-[56px_1fr] sm:gap-2">
                <dt className="font-mono uppercase tracking-widest text-gray-700">Execution</dt>
                <dd>{packLineage.execution_summary}</dd>
              </div>
              {packLineage.timing_summary ? (
                <div className="grid grid-cols-1 gap-1 text-[10px] text-gray-600 sm:grid-cols-[56px_1fr] sm:gap-2">
                  <dt className="font-mono uppercase tracking-widest text-gray-700">Timing</dt>
                  <dd>{packLineage.timing_summary}</dd>
                </div>
              ) : null}
              {packLineage.signals_summary ? (
                <div className="grid grid-cols-1 gap-1 text-[10px] text-gray-600 sm:grid-cols-[56px_1fr] sm:gap-2">
                  <dt className="font-mono uppercase tracking-widest text-gray-700">Signals</dt>
                  <dd>{packLineage.signals_summary}</dd>
                </div>
              ) : null}
              <div className="grid grid-cols-1 gap-1 text-[10px] text-gray-600 sm:grid-cols-[56px_1fr] sm:gap-2">
                <dt className="font-mono uppercase tracking-widest text-gray-700">Lineage</dt>
                <dd className="flex flex-wrap gap-1.5">
                  {packLineage.stages.map((stage) => (
                    <span
                      key={`${stage.stage_key}:${stage.stage_order}`}
                      className="inline-flex items-center gap-1.5 rounded border border-gray-200 bg-gray-50/70 px-2 py-1"
                    >
                      <span className="font-mono text-gray-600">
                        {String(stage.stage_order).padStart(2, "0")}
                      </span>
                      <span className="text-gray-700">{stage.stage_label}</span>
                      {stage.provenance ? (
                        <span
                          className={clsx(
                            "rounded border px-1 py-0.5 text-[9px] font-mono uppercase tracking-widest",
                            stage.provenance.execution_mode === "ai"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-amber-200 bg-amber-50 text-amber-800",
                          )}
                        >
                          {stage.provenance.execution_mode === "ai" ? "AI" : "Synthetic"}
                        </span>
                      ) : null}
                    </span>
                  ))}
                </dd>
              </div>
            </dl>
          </div>
        ) : null}

        {/* Staged actions */}
        {pack && pack.staged_actions.length > 0 && (
          <div className="border border-gray-200 rounded-md bg-white overflow-hidden">
            <div className="bg-gray-50 border-b border-gray-100 px-3 py-2 flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase text-gray-600 font-semibold flex items-center gap-1.5">
                <Lightning size={12} className="text-gray-500" /> Staged Actions
              </span>
              <span className="text-[10px] font-mono text-gray-600">
                {approved ? stagedActionsStatusLabel(slackAction) : "awaiting approval"}
              </span>
            </div>
            <div className="p-3 space-y-2">
              {pack.staged_actions.map((a, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 p-2 border border-gray-200 rounded-md bg-gray-50/50 cursor-default"
                >
                  <span
                    className={clsx(
                      "w-4 h-4 rounded border flex items-center justify-center shrink-0",
                      actionStatusTone(a.status).check,
                    )}
                    aria-hidden
                  >
                    {a.status !== "queued" && a.status !== "failed" && (
                      <CheckCircle size={10} weight="fill" className="text-white" />
                    )}
                    {a.status === "failed" && <span className="w-1.5 h-1.5 rounded-full bg-red-500" />}
                  </span>
                  <div className="flex min-w-0 flex-col">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-gray-900 truncate">
                        {a.label}
                      </span>
                      <span
                        className={clsx(
                          "shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-widest",
                          actionStatusTone(a.status).badge,
                        )}
                      >
                        {a.status.replace("_", " ")}
                      </span>
                    </div>
                    <span className="text-[10px] text-gray-700 font-mono truncate">
                      {a.intent}
                      {a.target ? ` · ${a.target}` : ""}
                    </span>
                    {a.detail && (
                      <span className="text-[10px] text-gray-700 leading-relaxed mt-1">
                        {a.detail}
                      </span>
                    )}
                    {a.last_attempt_at && (
                      <span className="text-[10px] text-gray-600 font-mono mt-1">
                        Last attempt {formatAttempt(a.last_attempt_at)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {approvalHistory.length > 0 && (
          <div className="border border-gray-200 rounded-md bg-white overflow-hidden">
            <div className="bg-gray-50 border-b border-gray-100 px-3 py-2 flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase text-gray-600 font-semibold">
                Approval History
              </span>
              <span className="text-[10px] font-mono text-gray-600">
                {approvalHistory.length} record{approvalHistory.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="p-3 space-y-2">
              {approvalHistory.slice(0, 4).map((approval) => (
                <div
                  key={approval.id}
                  className="rounded-md border border-gray-200 bg-gray-50/70 px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[10px] font-mono text-gray-700">
                      {formatApprovalActor(approval)}
                    </span>
                    <span className="shrink-0 rounded border border-green-200 bg-green-50 px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-widest text-green-700">
                      Approved
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] text-gray-600 leading-relaxed">
                    Response pack crossed the reviewer approval boundary.
                  </div>
                  <div className="mt-1 text-[10px] text-gray-600 font-mono">
                    {formatAttempt(approval.approved_at)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {actionAttempts.length > 0 && (
          <div className="border border-gray-200 rounded-md bg-white overflow-hidden">
            <div className="bg-gray-50 border-b border-gray-100 px-3 py-2 flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase text-gray-600 font-semibold">
                Action Log
              </span>
              <span className="text-[10px] font-mono text-gray-600">
                {actionAttempts.length} attempt{actionAttempts.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="p-3 space-y-2">
              {actionAttempts.slice(0, 4).map((attempt) => (
                <div
                  key={attempt.id}
                  className="rounded-md border border-gray-200 bg-gray-50/70 px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[10px] font-mono text-gray-700">
                      Attempt #{attempt.attempt_no}
                    </span>
                    <span
                      className={clsx(
                        "shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-widest",
                        actionStatusTone(attempt.status).badge,
                      )}
                    >
                      {attempt.status.replace("_", " ")}
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] text-gray-700 leading-relaxed">
                    {attempt.action_label}
                  </div>
                  {attempt.detail ? (
                    <div className="mt-1 text-[10px] text-gray-700 leading-relaxed">
                      {attempt.detail}
                    </div>
                  ) : null}
                  <div className="mt-1 text-[10px] text-gray-600 font-mono">
                    {formatAttempt(attempt.attempted_at)}
                    {attempt.target ? ` · ${attempt.target}` : ""}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {run.execution_status === "retrying" && run.execution_last_error ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800 leading-relaxed">
            Background execution retry scheduled. {run.execution_last_error}
          </div>
        ) : null}

        {!canApprove && pack ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800 leading-relaxed">
            Reviewer approval required. Operators can inspect the response pack and timeline, but only reviewers and admins can cross the outbound approval boundary.
          </div>
        ) : null}
      </div>

      {/* Footer actions */}
      <div className="p-4 border-t border-gray-200 bg-white shrink-0 flex flex-col gap-2.5 shadow-[0_-12px_24px_-8px_rgba(0,0,0,0.05)]">
        {/* Primary CTA (dynamic label) */}
        <button
          type="button"
          onClick={approve}
          disabled={primaryDisabled}
          className={clsx(
            "w-full text-sm font-medium py-2.5 rounded-md shadow-sm flex items-center justify-center gap-2 transition-colors",
            primaryDisabled
              ? "bg-gray-200 text-gray-400 cursor-not-allowed"
              : actionRetryable
                ? "bg-amber-600 hover:bg-amber-700 text-white"
                : approved
                ? "bg-green-600 text-white"
                : escalation
                  ? "bg-red-600 hover:bg-red-700 text-white"
                  : "bg-gray-950 hover:bg-gray-900 text-white",
          )}
        >
          {approving ? (
            <>
              <Spinner size={14} className="animate-spin" /> Working…
            </>
          ) : !canApprove ? (
            <>
              <Clock size={14} /> Reviewer approval required
            </>
          ) : actionRetryable ? (
            <>
              <ArrowsClockwise size={14} /> Retry Slack Dispatch
            </>
          ) : approved ? (
            <>
              <CheckCircle size={14} weight="fill" /> {approvedCtaLabel(slackAction)}
            </>
          ) : escalation ? (
            <>
              <ShareNetwork size={14} /> Approve &amp; Escalate to Tier 2
            </>
          ) : (
            <>
              <CheckCircle size={14} weight="fill" /> Approve Pack &amp; Queue Actions
            </>
          )}
        </button>

        {/* Secondary row: Export / Copy All */}
        <div className="flex flex-col gap-2 sm:flex-row">
          <a
            href={`/api/runs/${run.id}/export?format=markdown`}
            className={clsx(
              "flex-1 bg-white border border-gray-300 text-gray-700 text-xs font-medium py-2 rounded-md shadow-sm hover:bg-gray-50 transition-colors flex items-center justify-center gap-1.5",
              !pack && "pointer-events-none opacity-40",
            )}
            title="Download response pack as markdown"
          >
            <Export size={14} /> Export Pack
          </a>
          <button
            type="button"
            onClick={copyAll}
            disabled={!pack}
            className="flex-1 bg-white border border-gray-300 text-gray-700 text-xs font-medium py-2 rounded-md shadow-sm hover:bg-gray-50 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {copyAllOk ? (
              <>
                <CheckCircle size={14} weight="fill" className="text-green-700" /> Copied
              </>
            ) : (
              <>
                <CopySimple size={14} /> Copy All
              </>
            )}
          </button>
        </div>

        {/* Tertiary row: Pause + back */}
        <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:items-center sm:justify-between">
          {!isTerminal ? (
            <button
              type="button"
              onClick={() => setPaused((p) => !p)}
              className="text-[11px] font-mono text-gray-500 hover:text-gray-900 transition-colors flex items-center gap-1.5"
            >
              {paused ? (
                <>
                  <ArrowsClockwise size={12} /> Resume Run
                </>
              ) : (
                <>
                  <Pause size={12} /> Pause Run
                </>
              )}
            </button>
          ) : (
            <span className="text-[10px] font-mono text-gray-600 tracking-wide">
              Generated from staged triage run
            </span>
          )}
          <Link
            href={`/app/w/${workspaceSlug}/runs` as never}
            className="text-[11px] font-mono text-gray-500 hover:text-gray-900 transition-colors"
          >
            ← back to runs
          </Link>
        </div>
      </div>
    </aside>
  );
}

/* ================ helpers ================ */

function prettyIntent(raw: unknown): string {
  if (typeof raw !== "string") return "analyzing…";
  return raw
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1).trimEnd() + "…";
}

function renderValue(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "boolean") return v ? "yes" : "no";
  if (typeof v === "object") return JSON.stringify(v).slice(0, 60);
  return String(v);
}

function actionStatusTone(status: string) {
  switch (status) {
    case "executed":
      return {
        check: "bg-green-600 border-green-600",
        badge: "border-green-200 bg-green-50 text-green-700",
      };
    case "dry_run":
      return {
        check: "bg-amber-500 border-amber-500",
        badge: "border-amber-200 bg-amber-50 text-amber-700",
      };
    case "failed":
      return {
        check: "bg-red-50 border-red-200",
        badge: "border-red-200 bg-red-50 text-red-700",
      };
    case "cancelled":
      return {
        check: "bg-gray-200 border-gray-300",
        badge: "border-gray-200 bg-gray-100 text-gray-500",
      };
    default:
      return {
        check: "bg-white border-gray-300",
        badge: "border-gray-200 bg-white text-gray-500",
      };
  }
}

function stagedActionsStatusLabel(
  slackAction: RunWithDetails["response_pack"] extends infer T
    ? T extends { staged_actions: infer A }
      ? A extends Array<infer Item>
        ? Item | null
        : never
      : never
    : never,
) {
  if (!slackAction) return "queued for execution";
  switch (slackAction.status) {
    case "executed":
      return "Slack dispatched";
    case "dry_run":
      return "Slack dry-run";
    case "failed":
      return "Slack failed — retry available";
    default:
      return "queued for execution";
  }
}

function approvedCtaLabel(
  slackAction: RunWithDetails["response_pack"] extends infer T
    ? T extends { staged_actions: infer A }
      ? A extends Array<infer Item>
        ? Item | null
        : never
      : never
    : never,
) {
  if (!slackAction) return "Approved — actions queued";
  switch (slackAction.status) {
    case "executed":
      return "Approved — Slack sent";
    case "dry_run":
      return "Approved — Slack dry-run";
    case "failed":
      return "Approved — Slack failed";
    default:
      return "Approved — actions queued";
  }
}

function formatAttempt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const min = String(date.getUTCMinutes()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd} ${hh}:${min} UTC`;
}

function formatEventLabel(eventType: string) {
  return eventType
    .split(".")
    .map((segment) =>
      segment
        .split("_")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" "),
    )
    .join(" ");
}

function formatCaseSource(source: RunWithDetails["case"]["source"]) {
  switch (source) {
    case "gmail":
      return "Gmail";
    case "sample":
      return "Sample";
    default:
      return "Manual intake";
  }
}

function shortenSourceId(value: string) {
  if (value.length <= 18) {
    return value;
  }

  return `${value.slice(0, 9)}...${value.slice(-6)}`;
}

function formatEventActor(eventItem: RunWithDetails["events"][number]) {
  if (eventItem.actor_type === "user") {
    const actorLabel = eventItem.payload?.actor_label;
    return typeof actorLabel === "string" ? actorLabel : "Workspace user";
  }

  return "System";
}

function formatEventSummary(payload: Record<string, unknown>) {
  const summary = payload.summary;
  if (typeof summary === "string" && summary.length > 0) {
    return summary;
  }

  const stageLabel = payload.stage_label;
  if (typeof stageLabel === "string") {
    return stageLabel;
  }

  const recommendation = payload.recommendation;
  if (typeof recommendation === "string") {
    return recommendation;
  }

  const state = payload.state;
  if (typeof state === "string") {
    return `state=${state}`;
  }

  return Object.entries(payload)
    .slice(0, 2)
    .map(([key, value]) => `${key}=${renderValue(value)}`)
    .join(" · ");
}

function formatApprovalActor(approval: RunWithDetails["approval_history"][number]) {
  if (approval.actor_label && approval.actor_label.length > 0) {
    return approval.actor_label;
  }

  return approval.actor_user_id ? "Workspace reviewer" : "Historical approval";
}
