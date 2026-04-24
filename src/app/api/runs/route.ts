import { NextResponse } from "next/server";
import {
  getCaseAccess,
  getDefaultWorkspaceMembership,
  getSessionUser,
  getWorkspaceAccessForMutation,
} from "@/lib/auth/workspace";
import { createRunForCase } from "@/lib/runs/create-run";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiRateLimiter, getClientIP } from "@/lib/rate-limit";

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
  const workspaceSlug = searchParams.get("workspace");

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const access = workspaceSlug
    ? await getWorkspaceAccessForMutation(workspaceSlug)
    : await getDefaultWorkspaceMembership();

  if (!access) {
    return NextResponse.json({ error: "Workspace access required" }, { status: 403 });
  }

  const admin = createAdminClient();
  let q = admin
    .from("runs")
    .select(
      `id, state, confidence, urgency, advance_cursor, total_stages,
       started_at, completed_at, created_at,
       case:cases ( id, case_ref, title, customer_name, customer_account, source )`,
    )
    .eq("workspace_id", access.workspace.id)
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
  const ip = getClientIP(request);
  const rl = apiRateLimiter.check(ip);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } },
    );
  }

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

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const caseAccess = await getCaseAccess(case_id);
  if (!caseAccess) {
    return NextResponse.json(
      { error: "Case not found" },
      { status: 404 },
    );
  }

  const admin = createAdminClient();
  const caseRow = caseAccess.caseRow;

  try {
    const run = await createRunForCase({
      admin,
      caseRow,
      user,
    });

    return NextResponse.json({ run }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "failed to create run" },
      { status: 500 },
    );
  }
}
