import { NextResponse } from "next/server";
import { getRunAccess, getSessionUser } from "@/lib/auth/workspace";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAIEnabled } from "@/lib/ai/client";
import { loadRunById } from "@/lib/runs/execute-step";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/runs/[runId]/stream
 * Background execution now owns run progression. The client observes state
 * via polling when streaming is unavailable or intentionally disabled.
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

  if (!isAIEnabled()) {
    // Return an empty success response so the client can switch to polling
    // without surfacing noisy failed-resource errors in the browser console.
    return new Response(null, { status: 204 });
  }

  const admin = createAdminClient();
  const run = await loadRunById(admin, runId);
  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  if (run.state === "completed" || run.state === "escalated" || run.state === "failed") {
    return NextResponse.json({ error: "Run already terminal", state: run.state }, { status: 409 });
  }

  return new Response(null, { status: 204 });
}
