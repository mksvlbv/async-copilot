"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowsClockwise,
  ArrowRight,
  Buildings,
  CaretDown,
  CheckCircle,
  CircleNotch,
  Cpu,
  EnvelopeSimple,
  Paperclip,
} from "@phosphor-icons/react/dist/ssr";
import clsx from "clsx";
import type { Sample, UrgencyLevel } from "@/lib/supabase/types";

type Channel = "Email" | "Live Chat" | "In-App Widget" | "Customer Portal";

const SAMPLE_LOAD_ERROR = "Sample scenarios are temporarily unavailable. Refresh and try again.";
const CASE_CREATE_ERROR = "We couldn't create a case from that input. Try again in a few seconds.";
const RUN_CREATE_ERROR = "The case was saved, but the triage run could not start. Try again.";
const RUN_START_ERROR = "We couldn't start the triage run right now. Please try again.";

type Props = {
  workspaceSlug: string;
};

export function NewCasePage({ workspaceSlug }: Props) {
  return (
    <Suspense fallback={null}>
      <NewCasePageInner workspaceSlug={workspaceSlug} />
    </Suspense>
  );
}

function NewCasePageInner({ workspaceSlug }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedSampleSlug = searchParams?.get("sample") ?? null;

  const [customer, setCustomer] = useState("");
  const [channel, setChannel] = useState<Channel>("Email");
  const [urgency, setUrgency] = useState<UrgencyLevel | "auto">("auto");
  const [body, setBody] = useState("");
  const [title, setTitle] = useState("");

  const [samples, setSamples] = useState<Sample[] | null>(null);
  const [loadedSampleId, setLoadedSampleId] = useState<string | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await fetch("/api/samples", { cache: "no-store" });
        if (!response.ok) {
          throw new Error(SAMPLE_LOAD_ERROR);
        }

        const data = (await response.json()) as { samples: Sample[] };
        if (!cancelled) {
          setSamples(data.samples);
        }
      } catch (err) {
        if (!cancelled) {
          setLoadErr(err instanceof Error ? err.message : SAMPLE_LOAD_ERROR);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const loadSample = useCallback((sample: Sample) => {
    setLoadedSampleId(sample.id);
    setTitle(sample.name);
    setBody(sample.body);
    setUrgency(sample.urgency);
    setCustomer("");
  }, []);

  useEffect(() => {
    if (!requestedSampleSlug || !samples) {
      return;
    }

    const match = samples.find((sample) => sample.slug === requestedSampleSlug);
    if (match && loadedSampleId !== match.id) {
      loadSample(match);
    }
  }, [requestedSampleSlug, samples, loadedSampleId, loadSample]);

  function reset() {
    setCustomer("");
    setChannel("Email");
    setUrgency("auto");
    setBody("");
    setTitle("");
    setLoadedSampleId(null);
    setSubmitError(null);
  }

  const charCount = body.length;
  const lengthOk = charCount >= 30;

  async function startTriage(event: React.FormEvent) {
    event.preventDefault();
    if (submitting) {
      return;
    }

    setSubmitError(null);

    const derivedTitle = title.trim() || body.split("\n")[0].slice(0, 80);
    if (derivedTitle.length < 3) {
      setSubmitError("Please paste a longer case body (or set a title).");
      return;
    }
    if (body.trim().length < 10) {
      setSubmitError("Paste the customer message or thread below.");
      return;
    }

    setSubmitting(true);
    try {
      const caseResponse = await fetch("/api/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace_slug: workspaceSlug,
          title: derivedTitle,
          body: body.trim(),
          customer_name: customer || null,
          customer_account: customer || null,
          sample_id: loadedSampleId,
        }),
      });

      if (!caseResponse.ok) {
        throw new Error(CASE_CREATE_ERROR);
      }

      const { case: createdCase } = (await caseResponse.json()) as { case: { id: string } };

      const runResponse = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ case_id: createdCase.id }),
      });

      if (!runResponse.ok) {
        throw new Error(RUN_CREATE_ERROR);
      }

      const { run } = (await runResponse.json()) as { run: { id: string } };
      router.push(`/app/w/${workspaceSlug}/runs/${run.id}` as never);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : RUN_START_ERROR);
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-[1280px] mx-auto px-8 py-8 flex flex-col lg:flex-row gap-8 items-start">
      <form onSubmit={startTriage} className="w-full flex-1 flex flex-col lg:max-w-[800px]">
        <div className="mb-6 flex justify-between items-end">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-1.5 py-0.5 bg-white border border-gray-200 text-gray-500 text-[10px] font-mono rounded uppercase tracking-wider shadow-sm">
                {loadedSampleId ? "Sample Loaded" : "Manual Intake"}
              </span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
              Start New Triage Run
            </h1>
            <p className="text-sm text-gray-500 mt-1.5">
              Paste raw case context below. The system will parse intent, query internal state, and generate a response pack.
            </p>
          </div>
          <button
            type="button"
            onClick={reset}
            className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded shadow-sm hover:bg-gray-50 transition-colors flex items-center gap-1.5"
          >
            <ArrowsClockwise size={12} className="text-gray-400" /> Reset
          </button>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
          <div className="p-5 border-b border-gray-100 bg-gray-50/50">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <Field label="Customer / Account" optional>
                <div className="relative">
                  <Buildings size={16} className="absolute top-1/2 -translate-y-1/2 left-3 text-gray-400" />
                  <input
                    type="text"
                    value={customer}
                    onChange={(event) => setCustomer(event.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-gray-200 rounded-md shadow-sm outline-none focus:ring-1 focus:ring-black focus:border-black transition-all placeholder-gray-400 text-gray-900"
                    placeholder="e.g. Acme Corp"
                  />
                </div>
              </Field>

              <Field label="Origin Channel">
                <div className="relative">
                  <EnvelopeSimple size={16} className="absolute top-1/2 -translate-y-1/2 left-3 text-gray-400 pointer-events-none" />
                  <select
                    value={channel}
                    onChange={(event) => setChannel(event.target.value as Channel)}
                    className="w-full pl-9 pr-8 py-2 text-sm bg-white border border-gray-200 rounded-md shadow-sm outline-none focus:ring-1 focus:ring-black focus:border-black transition-all appearance-none cursor-pointer text-gray-900"
                  >
                    <option>Email</option>
                    <option>Live Chat</option>
                    <option>In-App Widget</option>
                    <option>Customer Portal</option>
                  </select>
                  <CaretDown size={12} className="absolute top-1/2 -translate-y-1/2 right-3 text-gray-400 pointer-events-none" />
                </div>
              </Field>

              <Field label="Reported Urgency">
                <div className="relative">
                  <span
                    className={clsx(
                      "absolute top-1/2 -translate-y-1/2 left-3 w-2 h-2 rounded-full",
                      urgency === "high" && "bg-red-500",
                      urgency === "medium" && "bg-amber-500",
                      urgency === "low" && "bg-gray-400",
                      urgency === "auto" && "bg-gray-300",
                    )}
                  />
                  <select
                    value={urgency}
                    onChange={(event) => setUrgency(event.target.value as UrgencyLevel | "auto")}
                    className="w-full pl-8 pr-8 py-2 text-sm bg-white border border-gray-200 rounded-md shadow-sm outline-none focus:ring-1 focus:ring-black focus:border-black transition-all appearance-none cursor-pointer text-gray-900"
                  >
                    <option value="auto">Auto-detect</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                  <CaretDown size={12} className="absolute top-1/2 -translate-y-1/2 right-3 text-gray-400 pointer-events-none" />
                </div>
              </Field>
            </div>
          </div>

          <div className="p-5 flex flex-col flex-1 relative">
            <div className="flex justify-between items-center mb-3">
              <label className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-semibold text-gray-900 uppercase tracking-widest">
                  Raw Case Context
                </span>
                <span className="px-1.5 py-0.5 bg-gray-100 text-gray-500 text-[10px] rounded font-mono border border-gray-200">
                  REQUIRED
                </span>
              </label>
              <div
                className="text-xs text-gray-400 flex items-center gap-1.5 font-medium"
                aria-label="Attachments are intentionally out of scope for this MVP"
              >
                <Paperclip size={12} /> Add Attachments
              </div>
            </div>

            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              className="w-full min-h-[320px] p-4 text-sm text-gray-800 bg-gray-50/50 border border-gray-200 rounded-lg outline-none focus:bg-white focus:ring-1 focus:ring-black focus:border-black resize-y font-sans leading-relaxed shadow-inner placeholder-gray-400"
              placeholder={`Paste the full customer email thread, chat transcript, or internal notes here...\n\ne.g.\nHi Support,\nWe're getting a 504 error when trying to process payments on the new checkout flow. Started about 10 mins ago. Trace ID: req_8xZ...\nPlease advise urgently.`}
              required
            />

            <div className="flex items-center justify-between mt-3 px-1">
              <div className="flex gap-3 text-gray-400 items-center">
                <div className="flex items-center gap-1.5 text-[11px] font-mono">
                  <CheckCircle size={12} weight="fill" className={lengthOk ? "text-green-500" : "text-gray-300"} />
                  <span className={lengthOk ? "text-gray-500" : "text-gray-400"}>
                    {lengthOk ? "Length OK" : "Too short"}
                  </span>
                </div>
              </div>
              <div className="text-[11px] text-gray-400 font-mono tracking-wide">
                {charCount.toLocaleString()} CHARS
              </div>
            </div>
          </div>

          <div className="p-5 border-t border-gray-100 bg-white flex items-center justify-between">
            <div className="flex items-center gap-2 text-[11px] text-gray-500 font-mono bg-gray-50 px-2.5 py-1.5 rounded border border-gray-200">
              <Cpu size={12} />
              Output: Staged Triage + Draft Reply
            </div>

            <div className="flex items-center gap-3">
              {submitError ? (
                <span className="text-xs text-red-600 font-medium">{submitError}</span>
              ) : null}
              <button
                type="submit"
                disabled={submitting || !lengthOk}
                className={clsx(
                  "px-6 py-2.5 text-sm font-medium rounded-md shadow-sm transition-all flex items-center justify-center gap-2 group focus:ring-2 focus:ring-offset-2 focus:ring-gray-900",
                  submitting || !lengthOk
                    ? "bg-gray-300 text-white cursor-not-allowed"
                    : "bg-gray-950 text-white hover:bg-gray-900",
                )}
              >
                {submitting ? (
                  <>
                    <CircleNotch size={14} className="animate-spin" /> Starting...
                  </>
                ) : (
                  <>
                    Start Triage
                    <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </form>

      <aside className="w-full lg:w-[320px] shrink-0 flex flex-col gap-5 pt-1">
        <div>
          <h2 className="text-[11px] font-mono font-semibold text-gray-500 uppercase tracking-widest mb-1">
            Pre-configured Scenarios
          </h2>
          <p className="text-xs text-gray-400">Load a sample case to test the system.</p>
        </div>

        <div className="space-y-3">
          {loadErr ? <div className="text-xs text-red-600">{loadErr}</div> : null}
          {!samples && !loadErr ? (
            <>
              <SampleSkeleton />
              <SampleSkeleton />
              <SampleSkeleton />
            </>
          ) : null}
          {samples?.map((sample) => (
            <SampleCard
              key={sample.id}
              sample={sample}
              loaded={loadedSampleId === sample.id}
              onLoad={() => loadSample(sample)}
            />
          ))}
        </div>
      </aside>
    </div>
  );
}

function Field({
  label,
  optional,
  children,
}: {
  label: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-mono font-medium text-gray-500 uppercase tracking-widest">
          {label}
        </span>
        {optional ? <span className="text-[10px] text-gray-400">Optional</span> : null}
      </label>
      {children}
    </div>
  );
}

function SampleCard({
  sample,
  loaded,
  onLoad,
}: {
  sample: Sample;
  loaded: boolean;
  onLoad: () => void;
}) {
  const urgencyBadge =
    sample.urgency === "high"
      ? { cls: "bg-red-50 text-red-700 border-red-100", label: "HIGH" }
      : sample.urgency === "medium"
        ? { cls: "bg-amber-50 text-amber-700 border-amber-100", label: "MED" }
        : { cls: "bg-gray-100 text-gray-600 border-gray-200", label: "LOW" };

  return (
    <button
      type="button"
      onClick={onLoad}
      className={clsx(
        "w-full text-left rounded-lg p-4 flex flex-col gap-2 transition-all cursor-pointer group relative",
        loaded
          ? "bg-white border border-gray-900 shadow-md ring-1 ring-gray-900 ring-offset-1 ring-offset-gray-50"
          : "bg-white border border-gray-200 shadow-sm hover:border-gray-400 hover:shadow",
      )}
    >
      {loaded ? (
        <div className="absolute -left-[5px] top-4 w-2.5 h-2.5 bg-gray-950 rounded-full shadow-sm" aria-hidden />
      ) : null}
      <div className={clsx("flex justify-between items-start mb-1", loaded && "pl-2")}>
        <div className="flex gap-1.5">
          <span
            className={clsx(
              "inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-mono font-medium border",
              urgencyBadge.cls,
            )}
          >
            {urgencyBadge.label}
          </span>
          {sample.is_golden ? (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-mono font-medium bg-gray-950 text-white border border-black">
              GOLDEN
            </span>
          ) : null}
        </div>
        {loaded ? (
          <span className="text-[10px] font-mono text-gray-400">LOADED</span>
        ) : (
          <ArrowRight size={12} className="text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
        )}
      </div>
      <h3 className={clsx("text-[13px] font-semibold", loaded ? "text-gray-900 pl-2" : "text-gray-700 group-hover:text-gray-900 transition-colors")}>
        {sample.name}
      </h3>
      <p className={clsx("text-[11px] text-gray-500 leading-relaxed line-clamp-2 mt-1", loaded && "pl-2")}>
        {sample.summary}
      </p>
    </button>
  );
}

function SampleSkeleton() {
  return (
    <div className="w-full rounded-lg p-4 bg-white border border-gray-100 flex flex-col gap-2 animate-pulse">
      <div className="flex justify-between">
        <div className="flex gap-1.5">
          <div className="w-10 h-3 rounded bg-gray-100" />
          <div className="w-10 h-3 rounded bg-gray-100" />
        </div>
      </div>
      <div className="h-4 w-3/4 rounded bg-gray-100" />
      <div className="h-3 w-full rounded bg-gray-100" />
      <div className="h-3 w-1/2 rounded bg-gray-100" />
    </div>
  );
}
