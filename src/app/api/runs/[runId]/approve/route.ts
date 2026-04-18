import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/runs/[runId]/approve
 * Marks the response pack approved. Staged actions remain queued
 * (R21: no autonomous action — human still triggers each action).
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { runId } = await params;
  const admin = createAdminClient();

  const { data: pack, error: findErr } = await admin
    .from("response_packs")
    .select("*")
    .eq("run_id", runId)
    .maybeSingle();

  if (findErr) {
    return NextResponse.json({ error: findErr.message }, { status: 500 });
  }
  if (!pack) {
    return NextResponse.json(
      { error: "Response pack not ready — run must complete first" },
      { status: 409 },
    );
  }

  if (pack.approved) {
    return NextResponse.json({ response_pack: pack, already_approved: true });
  }

  const { data: updated, error: updErr } = await admin
    .from("response_packs")
    .update({ approved: true, approved_at: new Date().toISOString() })
    .eq("id", pack.id)
    .select()
    .single();
  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  return NextResponse.json({ response_pack: updated });
}
