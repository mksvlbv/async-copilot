import type { User } from "@supabase/supabase-js";
import { appendRunEvents, type RunEventInsert, userActorPayload } from "@/lib/runs/events";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Case, Run, Sample } from "@/lib/supabase/types";
import { stagesForSample } from "@/lib/triage/run-model";

type AdminClient = ReturnType<typeof createAdminClient>;

type CreateRunOptions = {
  admin: AdminClient;
  caseRow: Case;
  user: Pick<User, "id" | "email"> | null;
  preRunEvents?: Omit<RunEventInsert, "workspace_id" | "case_id" | "run_id">[];
};

export async function createRunForCase({
  admin,
  caseRow,
  user,
  preRunEvents = [],
}: CreateRunOptions) {
  const sample = await loadSampleForCase(admin, caseRow.sample_id);
  const stageDefs = stagesForSample(sample);

  const { data: run, error: runErr } = await admin
    .from("runs")
    .insert({
      workspace_id: caseRow.workspace_id,
      case_id: caseRow.id,
      created_by: user?.id ?? null,
      state: "pending",
      urgency: sample?.urgency ?? null,
      advance_cursor: 0,
      total_stages: stageDefs.length,
    })
    .select()
    .single();

  if (runErr || !run) {
    throw new Error(runErr?.message ?? "failed to create run");
  }

  await appendRunEvents(admin, [
    ...preRunEvents.map((event) => ({
      ...event,
      workspace_id: caseRow.workspace_id,
      case_id: caseRow.id,
      run_id: run.id,
      payload: event.payload ?? {},
    })),
    {
      workspace_id: caseRow.workspace_id,
      case_id: caseRow.id,
      run_id: run.id,
      event_type: "run.created",
      actor_type: user ? "user" : "system",
      actor_user_id: user?.id ?? null,
      payload: user
        ? userActorPayload(user as User, summaryForCaseSource(caseRow.source))
        : { summary: summaryForCaseSource(caseRow.source) },
    },
  ]);

  const stageRows = stageDefs.map((stage, index) => ({
    run_id: run.id,
    stage_order: index + 1,
    stage_key: stage.key,
    stage_label: stage.label,
    state: "pending" as const,
    duration_ms: stage.duration_ms,
  }));

  const { error: stageErr } = await admin.from("run_stages").insert(stageRows);
  if (stageErr) {
    throw new Error(`stage insert failed: ${stageErr.message}`);
  }

  return run as Run;
}

async function loadSampleForCase(admin: AdminClient, sampleId: string | null) {
  if (!sampleId) {
    return null as Sample | null;
  }

  const { data } = await admin.from("samples").select("*").eq("id", sampleId).single();
  return (data as Sample | null) ?? null;
}

function summaryForCaseSource(source: Case["source"]) {
  switch (source) {
    case "gmail":
      return "Run created from Gmail intake.";
    case "sample":
      return "Run created from a sample case.";
    default:
      return "Run created from workspace intake.";
  }
}
