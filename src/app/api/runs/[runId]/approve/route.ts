import { NextResponse } from "next/server";
import { getRunAccess, getSessionUser } from "@/lib/auth/workspace";
import { createAdminClient } from "@/lib/supabase/admin";
import { appendRunEvent, userActorPayload } from "@/lib/runs/events";
import type { StagedAction } from "@/lib/supabase/types";
import {
  dispatchApprovedRunToSlack,
  ensureSlackDispatchAction,
  SLACK_ACTION_INTENT,
} from "@/lib/integrations/slack";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/runs/[runId]/approve
 * Marks the response pack approved and dispatches a Slack summary behind
 * the human approval boundary. Non-Slack staged actions remain queued.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { runId } = await params;

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const access = await getRunAccess(runId, ["admin", "reviewer"]);
  if (!access) {
    return NextResponse.json({ error: "Run not found or approval not permitted" }, { status: 404 });
  }

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

  const { data: run, error: runErr } = await admin
    .from("runs")
    .select("id, workspace_id, state, confidence, urgency, case:cases(case_ref, title)")
    .eq("id", runId)
    .maybeSingle();

  if (runErr) {
    return NextResponse.json({ error: runErr.message }, { status: 500 });
  }
  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  const caseRow = Array.isArray(run.case) ? run.case[0] : run.case;
  const stagedActions = ensureSlackDispatchAction(
    ((pack.staged_actions as StagedAction[] | null) ?? []),
    pack.escalation_queue,
  );
  const approvedAt = new Date().toISOString();

  const { data: workspace } = await admin
    .from("workspaces")
    .select("slug")
    .eq("id", run.workspace_id)
    .maybeSingle();

  const { data: approvedPack, error: approvalErr } = await admin
    .from("response_packs")
    .update({
      approved: true,
      approved_at: approvedAt,
      approved_by: user.id,
      staged_actions: stagedActions,
    })
    .eq("id", pack.id)
    .select()
    .single();
  if (approvalErr) {
    return NextResponse.json({ error: approvalErr.message }, { status: 500 });
  }

  const origin = new URL(request.url).origin;
  const dispatch = await dispatchApprovedRunToSlack({
    runId,
    runState: run.state,
    confidence: pack.confidence,
    urgency: run.urgency,
    caseRef: caseRow?.case_ref ?? "untitled",
    caseTitle: caseRow?.title ?? "Untitled case",
    recommendation: pack.recommendation,
    escalationQueue: pack.escalation_queue,
    runUrl: `${origin}/app/w/${workspace?.slug ?? "demo"}/runs/${runId}`,
  });

  const nextActions = stagedActions.map((action) =>
    action.intent === SLACK_ACTION_INTENT
      ? {
          ...action,
          status: dispatch.status,
          detail: dispatch.detail,
          target: dispatch.target,
          last_attempt_at: dispatch.last_attempt_at,
        }
      : action,
  );

  const { data: updated, error: updErr } = await admin
    .from("response_packs")
    .update({ staged_actions: nextActions })
    .eq("id", pack.id)
    .select()
    .single();
  if (updErr) {
    return NextResponse.json({
      response_pack: {
        ...approvedPack,
        staged_actions: nextActions,
      },
      dispatch,
      dispatch_persisted: false,
    });
  }

  await appendRunEvent(admin, {
    workspace_id: run.workspace_id,
    case_id: access.run.case_id,
    run_id: runId,
    event_type: "response_pack.approved",
    actor_type: "user",
    actor_user_id: user.id,
    payload: userActorPayload(user, "Response pack approved for outbound action."),
    created_at: approvedAt,
  });

  return NextResponse.json({ response_pack: updated, dispatch, dispatch_persisted: true });
}
