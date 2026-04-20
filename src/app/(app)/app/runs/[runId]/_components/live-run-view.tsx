"use client";

/**
 * Live Triage Run — signature screen.
 * 3-column lockup: Case Context | Visible Triage | Response Pack.
 *
 * Streaming (preferred):
 *   - SSE via GET /api/runs/[id]/stream — real Llama 3.3 tokens in real-time.
 *   - Each stage streams token-by-token like ChatGPT.
 *
 * Polling (fallback):
 *   - If SSE returns 501 (no GROQ_API_KEY) → falls back to POST /advance polling.
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
import type { RunWithDetails } from "@/lib/supabase/types";
import { SLACK_ACTION_INTENT } from "@/lib/integrations/slack";

const POLL_MS = 800;
const LIVE_UPDATE_ERROR = "Live updates paused. Refresh the page to resume this run.";

type Props = { initialRun: RunWithDetails };

/** Per-stage streaming tokens buffer. */
type StreamingTokens = Record<string, string>;

export function LiveRunView({ initialRun }: Props) {
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
        if (res.status === 501 || res.status === 409) {
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
        await fetch(`/api/runs/${run.id}/advance`, { method: "POST" });
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
  }, [aiMode, run.id, run.state, run.advance_cursor, paused]);

  return (
    <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
      {/* Mobile-only notice: left/right panels hidden < lg */}
      <div className="lg:hidden px-5 py-2 bg-amber-50 border-b border-amber-100 text-[11px] font-mono text-amber-800 tracking-wide shrink-0">
        Case Context &amp; Response Pack are best viewed on desktop.
      </div>
      <CaseContextPanel run={run} />
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

function CaseContextPanel({ run }: { run: RunWithDetails }) {
  const c = run.case;
  const urgencyStage = run.stages.find((s) => s.stage_key === "classify");
  const queryStage = run.stages.find((s) => s.stage_key === "query");

  return (
    <aside className="hidden lg:flex w-[340px] shrink-0 border-r border-gray-200 bg-white flex-col z-10">
      <div className="h-12 border-b border-gray-100 flex items-center justify-between px-5 bg-gray-50/50 shrink-0">
        <span className="text-[10px] font-mono font-semibold text-gray-500 uppercase tracking-widest">
          Case Context
        </span>
        <span className="px-1.5 py-0.5 bg-gray-100 text-gray-500 text-[10px] rounded font-mono border border-gray-200">
          STATIC
        </span>
      </div>
      <div className="flex-1 overflow-y-auto mockup-scroll p-5 space-y-6">
        {/* Customer identity */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Customer Identity</h3>
          <dl className="text-xs text-gray-700 space-y-2 border border-gray-200 rounded-md p-3 bg-gray-50/30">
            <Row label="Name" value={c.customer_name ?? "—"} />
            <Row label="Account" value={c.customer_account ?? "—"} />
            <Row label="Plan" value={c.customer_plan ?? "—"} mono />
          </dl>
        </div>

        {/* Extracted Facts (populated from classify + query stage outputs) */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-1.5">
            <MagicWand size={14} weight="fill" className="text-gray-400" /> Extracted Facts
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
              source="Source Email"
              body={truncate(c.body, 280)}
            />
            <EvidenceCard
              icon={<Receipt size={12} />}
              source="Case"
              body={`Ref: ${c.case_ref}\nSource: ${c.source}`}
              mono
            />
          </div>
        </div>

        {/* Similar Cases (RAG) */}
        <SimilarCasesSection caseId={c.id} />
      </div>
    </aside>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <dt className="text-gray-500 font-mono text-[10px] uppercase tracking-widest">{label}</dt>
      <dd className={clsx("text-gray-900 font-medium", mono && "font-mono text-[11px] bg-gray-100 px-1.5 py-0.5 rounded")}>
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
        ? "text-amber-600"
        : "text-gray-900";
  return (
    <div className={clsx("flex flex-col gap-1 border-l-2 pl-3", borderClass)}>
      <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">{label}</span>
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
      <p className={clsx("p-3 text-[11px] text-gray-700 leading-relaxed whitespace-pre-line", mono && "font-mono")}>
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

function SimilarCasesSection({ caseId }: { caseId: string }) {
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
          <ShareNetwork size={14} weight="fill" className="text-gray-400" /> Similar Cases
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
        <ShareNetwork size={14} weight="fill" className="text-gray-400" /> Similar Cases
        <span className="text-[9px] font-mono text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200 uppercase tracking-widest ml-auto">
          pgvector + trgm
        </span>
      </h3>
      <div className="space-y-2">
        {cases.map((sc) => (
          <Link
            key={sc.id}
            href={`/app/runs` as never}
            className="block border border-gray-200 rounded-md p-2.5 hover:border-blue-300 hover:bg-blue-50/30 transition-colors group"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-mono text-gray-500">{sc.case_ref}</span>
              <span className="text-[9px] font-mono text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
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
  const currentOrder = run.advance_cursor + 1;
  const isTerminal =
    run.state === "completed" ||
    run.state === "escalated" ||
    run.state === "failed";

  return (
    <section className="flex-1 flex flex-col bg-gray-50/50 min-w-0 overflow-hidden">
      {/* Top header */}
      <div className="px-8 py-6 border-b border-gray-200 bg-white/50 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-2 mb-2">
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
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
          {run.case.title}
        </h1>
        <p className="text-sm text-gray-500 mt-2 font-mono">
          Running execution pipeline for {run.case.case_ref}
        </p>
        {pollError && <div className="mt-3 text-[11px] text-red-600 font-medium">{pollError}</div>}
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto mockup-scroll px-8 py-8">
        <div className="relative max-w-2xl mx-auto">
          {/* Vertical line */}
          <div className="absolute left-[15px] top-2 bottom-2 w-px bg-gray-200" aria-hidden />

          <ol className="space-y-6">
            {stages.map((s) => {
              const num = String(s.stage_order).padStart(2, "0");
              const completed = s.state === "completed" || s.stage_order < currentOrder;
              const running =
                !isTerminal &&
                s.stage_order === currentOrder &&
                (run.state === "running" || run.state === "pending");
              const pending = !completed && !running;

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
                    streamingText={streamingTokens?.[s.stage_key]}
                    isActiveStream={activeStreamStage === s.stage_key}
                  />
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}

function StageBody({
  stage,
  running,
  pending,
  streamingText,
  isActiveStream,
}: {
  stage: RunWithDetails["stages"][number];
  running: boolean;
  pending: boolean;
  streamingText?: string;
  isActiveStream?: boolean;
}) {
  if (pending) {
    return (
      <div className="text-xs text-gray-400">Awaiting previous stage…</div>
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
  return (
    <div className="mt-1 bg-white border border-gray-200 rounded-md p-3 shadow-sm space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">Output</span>
        <span className="text-[10px] font-mono text-gray-400">
          {stage.duration_ms != null ? `${stage.duration_ms} ms` : ""}
        </span>
      </div>
      {hasOutput ? (
        <dl className="text-[11px] text-gray-700 space-y-1">
          {Object.entries(out)
            .slice(0, 4)
            .map(([k, v]) => (
              <div key={k} className="grid grid-cols-[auto_1fr] gap-2">
                <dt className="text-gray-500">{k.replace(/_/g, " ")}</dt>
                <dd className={clsx("font-medium truncate", typeof v === "string" && /^\d+$/.test(v) ? "font-mono" : "")}>
                  {renderValue(v)}
                </dd>
              </div>
            ))}
        </dl>
      ) : (
        <div className="text-[11px] text-gray-400">No detailed output.</div>
      )}
    </div>
  );
}

/* =============================================================
 *  RIGHT — Response Pack
 * ============================================================= */

function ResponsePackPanel({
  run,
  isTerminal,
  paused,
  setPaused,
}: {
  run: RunWithDetails;
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

  async function approve() {
    if (approving || approved) return;
    setApproving(true);
    try {
      const r = await fetch(`/api/runs/${run.id}/approve`, { method: "POST" });
      if (r.ok) {
        const data = (await r.json()) as { response_pack?: RunWithDetails["response_pack"] };
        if (data.response_pack) setPackState(data.response_pack);
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
    <aside className="hidden lg:flex w-[360px] shrink-0 border-l border-gray-200 bg-white flex-col z-10 shadow-[-8px_0_24px_rgba(0,0,0,0.02)]">
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

      <div className="flex-1 overflow-y-auto mockup-scroll p-5 space-y-4">
        {/* Confidence card */}
        <div
          className={clsx(
            "border rounded-lg shadow-sm overflow-hidden bg-white",
            escalation ? "border-red-200 border-l-4 border-l-red-500" : "border-gray-200 border-l-4 border-l-green-500",
          )}
        >
          <div className="p-4 border-b border-gray-100 flex justify-between items-start">
            <div>
              <div className="text-[10px] font-mono text-gray-500 uppercase mb-1">System Confidence</div>
              <div className="text-2xl font-bold text-gray-900 font-mono tracking-tight flex items-baseline gap-1">
                {run.confidence ?? "—"}
                <span className="text-sm text-gray-400">%</span>
              </div>
            </div>
            {escalation && (
              <div className="bg-red-50 text-red-700 text-[10px] font-mono px-2 py-0.5 rounded border border-red-100 font-medium">
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
                <Info size={12} className="text-gray-500" />
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
                {copyOk ? <CheckCircle size={12} weight="fill" className="text-green-600" /> : <Copy size={12} />}
              </button>
              <span className="px-1.5 py-0.5 rounded border border-gray-200 bg-white text-[10px] font-mono uppercase tracking-widest text-gray-400">
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
            <div className="text-[10px] font-mono uppercase text-gray-500 mb-2 tracking-widest">
              Sources Cited
            </div>
            <ul className="space-y-1.5 text-[11px] text-gray-700">
              {pack.citations.slice(0, 4).map((c) => (
                <li key={c.id} className="flex items-start gap-2">
                  <span className="font-mono text-gray-500 shrink-0">·</span>
                  <div className="flex-1">
                    <span className="font-semibold">{c.source}</span>
                    <span className="text-gray-500"> — {c.note}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Staged actions */}
        {pack && pack.staged_actions.length > 0 && (
          <div className="border border-gray-200 rounded-md bg-white overflow-hidden">
            <div className="bg-gray-50 border-b border-gray-100 px-3 py-2 flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase text-gray-600 font-semibold flex items-center gap-1.5">
                <Lightning size={12} className="text-gray-400" /> Staged Actions
              </span>
              <span className="text-[10px] font-mono text-gray-400">
                {approved ? stagedActionsStatusLabel(slackAction) : "awaiting approval"}
              </span>
            </div>
            <div className="p-3 space-y-2">
              {pack.staged_actions.map((a, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 p-2 border border-gray-200 rounded-md bg-gray-50/50 cursor-default"
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
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
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
                    <span className="text-[10px] text-gray-500 font-mono truncate">
                      {a.intent}
                      {a.target ? ` · ${a.target}` : ""}
                    </span>
                    {a.detail && (
                      <span className="text-[10px] text-gray-500 leading-relaxed mt-1">
                        {a.detail}
                      </span>
                    )}
                    {a.last_attempt_at && (
                      <span className="text-[10px] text-gray-400 font-mono mt-1">
                        Last attempt {formatAttempt(a.last_attempt_at)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="p-4 border-t border-gray-200 bg-white shrink-0 flex flex-col gap-2.5 shadow-[0_-12px_24px_-8px_rgba(0,0,0,0.05)]">
        {/* Primary CTA (dynamic label) */}
        <button
          type="button"
          onClick={approve}
          disabled={!pack || approving || approved}
          className={clsx(
            "w-full text-sm font-medium py-2.5 rounded-md shadow-sm flex items-center justify-center gap-2 transition-colors",
            !pack || approving
              ? "bg-gray-200 text-gray-400 cursor-not-allowed"
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
        <div className="flex gap-2">
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
                <CheckCircle size={14} weight="fill" className="text-green-600" /> Copied
              </>
            ) : (
              <>
                <CopySimple size={14} /> Copy All
              </>
            )}
          </button>
        </div>

        {/* Tertiary row: Pause + back */}
        <div className="flex items-center justify-between pt-1">
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
            <span className="text-[10px] font-mono text-gray-400 tracking-wide">
              Generated from staged triage run
            </span>
          )}
          <Link
            href={"/app/runs" as never}
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
      return "Slack dispatch failed";
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
  return date.toLocaleString();
}
