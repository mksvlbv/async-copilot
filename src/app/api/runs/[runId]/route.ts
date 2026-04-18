import { NextResponse } from "next/server";
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
  const admin = createAdminClient();

  const { data: run, error: runErr } = await admin
    .from("runs")
    .select(
      `*,
       case:cases ( * ),
       stages:run_stages ( * ),
       response_pack:response_packs ( * )`,
    )
    .eq("id", runId)
    .order("stage_order", { foreignTable: "run_stages", ascending: true })
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

  return NextResponse.json({
    run: { ...run, response_pack: pack },
  });
}
