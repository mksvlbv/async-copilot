import { NextResponse } from "next/server";
import { getRunAccess, getSessionUser } from "@/lib/auth/workspace";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/runs/[runId]
 * Returns a run with case, stages (ordered), and response pack (if any).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { runId } = await params;

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const access = await getRunAccess(runId);
  if (!access) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  const admin = createAdminClient();

  const { data: run, error: runErr } = await admin
    .from("runs")
    .select(
      `*,
       case:cases ( *, gmail_message:gmail_messages ( * ) ),
       stages:run_stages ( * ),
       response_pack:response_packs ( * ),
       events:run_events ( * )`,
    )
    .eq("id", runId)
    .eq("workspace_id", access.run.workspace_id)
    .order("stage_order", { foreignTable: "run_stages", ascending: true })
    .order("id", { foreignTable: "run_events", ascending: true })
    .maybeSingle();

  if (runErr) {
    return NextResponse.json({ error: runErr.message }, { status: 500 });
  }
  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  // response_pack comes back as an array because of the embedded select;
  // collapse to null | object for ergonomic client consumption.
  const pack = Array.isArray(run.response_pack)
    ? (run.response_pack[0] ?? null)
    : (run.response_pack ?? null);
  const caseRow = Array.isArray(run.case) ? (run.case[0] ?? null) : (run.case ?? null);
  const gmailMessage = Array.isArray(caseRow?.gmail_message)
    ? (caseRow.gmail_message[0] ?? null)
    : (caseRow?.gmail_message ?? null);

  return NextResponse.json({
    run: {
      ...run,
      case: caseRow ? { ...caseRow, gmail_message: gmailMessage } : null,
      response_pack: pack,
      events: run.events ?? [],
    },
  });
}
