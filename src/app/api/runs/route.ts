import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stagesForSample } from "@/lib/triage/run-model";
import type { Sample } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/runs
 * List runs newest-first. Joins case title + response-pack summary.
 * Optional ?limit=N, ?state=running|completed|escalated
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 200);
  const state = searchParams.get("state");

  const admin = createAdminClient();
  let q = admin
    .from("runs")
    .select(
      `id, state, confidence, urgency, advance_cursor, total_stages,
       started_at, completed_at, created_at,
       case:cases ( id, case_ref, title, customer_name, customer_account )`,
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (state) {
    q = q.eq("state", state);
  }

  const { data, error } = await q;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ runs: data ?? [] });
}

/**
 * POST /api/runs
 * Body: { case_id }
 * Creates a fresh pending run for the given case and pre-provisions
 * all stages (pending state). Advance endpoint will run them one by one.
 */
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const case_id = typeof body.case_id === "string" ? body.case_id : null;
  if (!case_id) {
    return NextResponse.json(
      { error: "Field 'case_id' is required" },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  // Look up case + optional sample
  const { data: caseRow, error: caseErr } = await admin
    .from("cases")
    .select("*")
    .eq("id", case_id)
    .single();
  if (caseErr || !caseRow) {
    return NextResponse.json(
      { error: "Case not found", detail: caseErr?.message },
      { status: 404 },
    );
  }

  let sample: Sample | null = null;
  if (caseRow.sample_id) {
    const { data } = await admin
      .from("samples")
      .select("*")
      .eq("id", caseRow.sample_id)
      .single();
    sample = (data as Sample | null) ?? null;
  }

  const stageDefs = stagesForSample(sample);

  // Create run
  const { data: run, error: runErr } = await admin
    .from("runs")
    .insert({
      case_id,
      state: "pending",
      urgency: sample?.urgency ?? null,
      advance_cursor: 0,
      total_stages: stageDefs.length,
    })
    .select()
    .single();
  if (runErr || !run) {
    return NextResponse.json(
      { error: runErr?.message ?? "failed to create run" },
      { status: 500 },
    );
  }

  // Pre-provision stages as 'pending'
  const stageRows = stageDefs.map((s, i) => ({
    run_id: run.id,
    stage_order: i + 1,
    stage_key: s.key,
    stage_label: s.label,
    state: "pending" as const,
    duration_ms: s.duration_ms,
  }));
  const { error: stageErr } = await admin.from("run_stages").insert(stageRows);
  if (stageErr) {
    return NextResponse.json(
      { error: `stage insert failed: ${stageErr.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ run }, { status: 201 });
}
