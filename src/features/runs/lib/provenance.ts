import type { RunStage, RunWithDetails, StageProvenance } from "@/lib/supabase/types";

export type PackLineageStage = {
  stage_order: number;
  stage_key: string;
  stage_label: string;
  provenance: StageProvenance | null;
};

export type ResponsePackLineage = {
  created_at: string;
  stages: PackLineageStage[];
  runtime_provenance_coverage: "none" | "partial" | "full";
  execution_summary: string;
  timing_summary: string | null;
  signals_summary: string | null;
};

export function getStageProvenance(
  events: RunWithDetails["events"],
  stageKey: string,
  stageOrder: number,
): StageProvenance | null {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const eventItem = events[index];
    if (eventItem.event_type !== "stage.completed" || eventItem.stage_key !== stageKey) {
      continue;
    }

    const eventStageOrder = eventItem.payload?.stage_order;
    if (typeof eventStageOrder === "number" && eventStageOrder !== stageOrder) {
      continue;
    }

    return parseStageProvenance(eventItem.payload);
  }

  return null;
}

export function getResponsePackLineage(
  run: Pick<RunWithDetails, "events" | "stages" | "response_pack">,
): ResponsePackLineage | null {
  const pack = run.response_pack;
  if (!pack) {
    return null;
  }

  const completedStages = [...run.stages]
    .filter((stage) => stage.state === "completed")
    .sort((a, b) => a.stage_order - b.stage_order);

  if (completedStages.length === 0) {
    return null;
  }

  const stages = completedStages.map((stage) => ({
    stage_order: stage.stage_order,
    stage_key: stage.stage_key,
    stage_label: stage.stage_label,
    provenance: getStageProvenance(run.events, stage.stage_key, stage.stage_order),
  }));
  const latestCreatedEvent = getLatestResponsePackCreatedEvent(run.events);
  const stagesWithProvenance = stages.filter((stage) => stage.provenance != null).length;
  const aiStages = stages.filter((stage) => stage.provenance?.execution_mode === "ai").length;
  const syntheticStages = stages.filter(
    (stage) => stage.provenance?.execution_mode === "synthetic",
  ).length;
  const parseWarnings = stages.filter((stage) => stage.provenance?.parse_error).length;
  const runtimeProvenanceCoverage =
    stagesWithProvenance === 0 ? "none" : stagesWithProvenance < stages.length ? "partial" : "full";

  return {
    created_at: latestCreatedEvent?.created_at ?? pack.created_at,
    stages,
    runtime_provenance_coverage: runtimeProvenanceCoverage,
    execution_summary: formatPackExecutionSummary({
      totalStages: stages.length,
      stagesWithProvenance,
      aiStages,
      syntheticStages,
    }),
    timing_summary: formatPackTimingSummary(completedStages),
    signals_summary: formatPackSignalsSummary({
      syntheticStages,
      parseWarnings,
    }),
  };
}

export function formatPromptReference(provenance: StageProvenance) {
  const promptKey = provenance.prompt_key ?? "Prompt unavailable";

  return provenance.prompt_version
    ? `${promptKey} · ${provenance.prompt_version}`
    : promptKey;
}

export function formatRuntimeReference(provenance: StageProvenance) {
  if (provenance.execution_mode === "synthetic") {
    if (provenance.fallback_reason === "llm_failure") {
      return "Synthetic fallback · LLM request failed after retries";
    }

    return "Synthetic fallback · AI unavailable in this environment";
  }

  if (provenance.provider && provenance.model) {
    return `${provenance.provider} · ${provenance.model}`;
  }

  if (provenance.model) {
    return provenance.model;
  }

  if (provenance.provider) {
    return provenance.provider;
  }

  return "AI execution";
}

export function formatStageDurationLabel(
  stage: Pick<RunStage, "started_at" | "completed_at" | "duration_ms">,
) {
  const actualElapsedMs = getElapsedMs(stage.started_at, stage.completed_at);
  if (actualElapsedMs != null) {
    return formatElapsedDuration(actualElapsedMs);
  }

  if (stage.duration_ms != null) {
    return `est. ${formatElapsedDuration(stage.duration_ms)}`;
  }

  return null;
}

function getLatestResponsePackCreatedEvent(events: RunWithDetails["events"]) {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const eventItem = events[index];
    if (eventItem.event_type === "response_pack.created") {
      return eventItem;
    }
  }

  return null;
}

function parseStageProvenance(payload: Record<string, unknown>): StageProvenance | null {
  const executionMode = payload.execution_mode;
  if (executionMode !== "ai" && executionMode !== "synthetic") {
    return null;
  }

  const fallbackReason = payload.fallback_reason;
  return {
    prompt_key: typeof payload.prompt_key === "string" ? payload.prompt_key : null,
    prompt_version: typeof payload.prompt_version === "string" ? payload.prompt_version : null,
    provider: typeof payload.provider === "string" ? payload.provider : null,
    model: typeof payload.model === "string" ? payload.model : null,
    execution_mode: executionMode,
    fallback_reason:
      fallbackReason === "ai_disabled" || fallbackReason === "llm_failure"
        ? fallbackReason
        : null,
    parse_error: payload.parse_error === true,
  };
}

function formatPackExecutionSummary({
  totalStages,
  stagesWithProvenance,
  aiStages,
  syntheticStages,
}: {
  totalStages: number;
  stagesWithProvenance: number;
  aiStages: number;
  syntheticStages: number;
}) {
  if (stagesWithProvenance === 0) {
    return "Stage lineage recorded; runtime provenance unavailable for this historical run";
  }

  if (stagesWithProvenance < totalStages) {
    return `Partial runtime provenance · ${stagesWithProvenance}/${totalStages} stages recorded`;
  }

  if (syntheticStages === 0) {
    return `AI only · ${aiStages}/${totalStages} stages`;
  }

  if (aiStages === 0) {
    return `Synthetic fallback · ${syntheticStages}/${totalStages} stages`;
  }

  return `Mixed execution · ${aiStages} AI · ${syntheticStages} synthetic`;
}

function formatPackSignalsSummary({
  syntheticStages,
  parseWarnings,
}: {
  syntheticStages: number;
  parseWarnings: number;
}) {
  const parts: string[] = [];

  if (syntheticStages > 0) {
    parts.push(`${syntheticStages} synthetic fallback stage${syntheticStages === 1 ? "" : "s"}`);
  }

  if (parseWarnings > 0) {
    parts.push(`${parseWarnings} parse warning${parseWarnings === 1 ? "" : "s"}`);
  }

  return parts.length > 0 ? parts.join(" · ") : null;
}

function formatPackTimingSummary(
  stages: Array<Pick<RunWithDetails["stages"][number], "stage_label" | "started_at" | "completed_at">>,
) {
  const timedStages = stages
    .map((stage) => ({
      stage_label: stage.stage_label,
      elapsed_ms: getElapsedMs(stage.started_at, stage.completed_at),
    }))
    .filter((stage): stage is { stage_label: string; elapsed_ms: number } => stage.elapsed_ms != null);

  if (timedStages.length === 0) {
    return null;
  }

  const totalElapsedMs = timedStages.reduce((total, stage) => total + stage.elapsed_ms, 0);
  const slowestStage = timedStages.reduce((slowest, stage) =>
    stage.elapsed_ms > slowest.elapsed_ms ? stage : slowest,
  );

  const coverageSummary =
    timedStages.length < stages.length ? ` across ${timedStages.length}/${stages.length} stages` : "";

  return `${formatElapsedDuration(totalElapsedMs)} active stage time${coverageSummary} · slowest ${slowestStage.stage_label} (${formatElapsedDuration(slowestStage.elapsed_ms)})`;
}

export function getElapsedMs(startedAt: string | null, completedAt: string | null) {
  if (!startedAt || !completedAt) {
    return null;
  }

  const started = Date.parse(startedAt);
  const completed = Date.parse(completedAt);
  if (Number.isNaN(started) || Number.isNaN(completed) || completed < started) {
    return null;
  }

  return completed - started;
}

export function formatElapsedDuration(valueMs: number) {
  if (valueMs < 1000) {
    return `${Math.round(valueMs)}ms`;
  }

  if (valueMs < 10_000) {
    return `${(valueMs / 1000).toFixed(1)}s`;
  }

  if (valueMs < 60_000) {
    return `${Math.round(valueMs / 1000)}s`;
  }

  const totalSeconds = Math.round(valueMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (valueMs < 3_600_000) {
    return `${minutes}m ${seconds}s`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}
