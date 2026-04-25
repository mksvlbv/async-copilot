import { NextResponse } from "next/server";
import { getRunAccess, getSessionUser } from "@/lib/auth/workspace";
import { createAdminClient } from "@/lib/supabase/admin";
import { appendRunEvent, userActorPayload } from "@/lib/runs/events";
import type { ResponsePack, RunActionAttempt, StagedAction } from "@/lib/supabase/types";
import {
  dispatchApprovedRunToSlack,
  ensureSlackDispatchAction,
  SLACK_ACTION_INTENT,
  type SlackDispatchResult,
} from "@/lib/integrations/slack";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/runs/[runId]/approve
 * Marks the response pack approved and dispatches a Slack summary behind
 * the human approval boundary. Failed Slack delivery stays retryable.
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
  const pack = await loadResponsePack(admin, runId);
  if (!pack) {
    return NextResponse.json(
      { error: "Response pack not ready — run must complete first" },
      { status: 409 },
    );
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
  const baseActions = ensureSlackDispatchAction(
    ((pack.staged_actions as StagedAction[] | null) ?? []),
    pack.escalation_queue,
  );
  const latestAttempt = await loadLatestSlackAttempt(admin, runId);

  if (pack.approved) {
    const earlyResult = await maybeReturnExistingApproval({
      admin,
      pack,
      baseActions,
      latestAttempt,
    });
    if (earlyResult) {
      return NextResponse.json(earlyResult);
    }
  }

  const approvedAt = pack.approved_at ?? new Date().toISOString();
  let currentPack = pack;
  const currentActions = baseActions;

  if (!pack.approved) {
    const { data: approvedPack, error: approvalErr } = await admin
      .from("response_packs")
      .update({
        approved: true,
        approved_at: approvedAt,
        approved_by: user.id,
        staged_actions: currentActions,
      })
      .eq("id", pack.id)
      .eq("approved", false)
      .select()
      .maybeSingle();

    if (approvalErr) {
      return NextResponse.json({ error: approvalErr.message }, { status: 500 });
    }

    if (!approvedPack) {
      const latestPack = await loadResponsePack(admin, runId);
      if (!latestPack) {
        return NextResponse.json({ error: "Response pack not found" }, { status: 404 });
      }

      const latestApprovedAttempt = await loadLatestSlackAttempt(admin, runId);
      const earlyResult = await maybeReturnExistingApproval({
        admin,
        pack: latestPack,
        baseActions: ensureSlackDispatchAction(
          ((latestPack.staged_actions as StagedAction[] | null) ?? []),
          latestPack.escalation_queue,
        ),
        latestAttempt: latestApprovedAttempt,
      });

      if (earlyResult) {
        return NextResponse.json(earlyResult);
      }

      return NextResponse.json({
        response_pack: latestPack,
        already_approved: true,
        dispatch_in_progress: true,
      });
    }

    currentPack = approvedPack;

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
  }

  const { data: workspace } = await admin
    .from("workspaces")
    .select("slug")
    .eq("id", run.workspace_id)
    .maybeSingle();

  const slackAction =
    currentActions.find((action) => action.intent === SLACK_ACTION_INTENT) ??
    ensureSlackDispatchAction([], currentPack.escalation_queue)[0];
  const attemptNo = (latestAttempt?.attempt_no ?? 0) + 1;
  const idempotencyKey = `${runId}:${SLACK_ACTION_INTENT}:${attemptNo}`;
  const reservedAt = new Date().toISOString();

  const reserveResult = await admin.from("run_action_attempts").insert({
    workspace_id: run.workspace_id,
    run_id: runId,
    response_pack_id: currentPack.id,
    action_intent: SLACK_ACTION_INTENT,
    action_label: slackAction.label,
    attempt_no: attemptNo,
    status: "pending",
    target: slackAction.target ?? "Slack webhook",
    detail: "Slack dispatch in progress.",
    idempotency_key: idempotencyKey,
    actor_user_id: user.id,
    attempted_at: reservedAt,
  });

  if (reserveResult.error) {
    const concurrentAttempt = await loadLatestSlackAttempt(admin, runId);
    const earlyResult = await maybeReturnExistingApproval({
      admin,
      pack: currentPack,
      baseActions: currentActions,
      latestAttempt: concurrentAttempt,
    });

    if (earlyResult) {
      return NextResponse.json(earlyResult);
    }

    return NextResponse.json({
      response_pack: currentPack,
      already_approved: true,
      dispatch_in_progress: true,
    });
  }

  const origin = new URL(request.url).origin;
  const dispatch = await dispatchApprovedRunToSlack({
    runId,
    runState: run.state,
    confidence: currentPack.confidence,
    urgency: run.urgency,
    caseRef: caseRow?.case_ref ?? "untitled",
    caseTitle: caseRow?.title ?? "Untitled case",
    recommendation: currentPack.recommendation,
    escalationQueue: currentPack.escalation_queue,
    runUrl: `${origin}/app/w/${workspace?.slug ?? "demo"}/runs/${runId}`,
    idempotencyKey,
  });

  await admin
    .from("run_action_attempts")
    .update({
      status: dispatch.status,
      target: dispatch.target,
      detail: dispatch.detail,
      attempted_at: dispatch.last_attempt_at,
    })
    .eq("idempotency_key", idempotencyKey)
    .eq("status", "pending");

  const nextActions = applyDispatchToActions(currentActions, dispatch, attemptNo);
  const updatedPack = await persistActionSnapshot(admin, currentPack.id, nextActions, {
    ...currentPack,
    staged_actions: nextActions,
  });

  return NextResponse.json({
    response_pack: updatedPack,
    dispatch,
    dispatch_persisted: true,
    retried: pack.approved,
  });
}

async function loadResponsePack(admin: ReturnType<typeof createAdminClient>, runId: string) {
  const { data, error } = await admin
    .from("response_packs")
    .select("*")
    .eq("run_id", runId)
    .maybeSingle();

  if (error || !data) {
    return null as ResponsePack | null;
  }

  return data as ResponsePack;
}

async function maybeReturnExistingApproval({
  admin,
  pack,
  baseActions,
  latestAttempt,
}: {
  admin: ReturnType<typeof createAdminClient>;
  pack: ResponsePack;
  baseActions: StagedAction[];
  latestAttempt: RunActionAttempt | null;
}) {
  if (latestAttempt && isSuccessfulActionStatus(latestAttempt.status)) {
    const syncedActions = applyDispatchToActions(
      baseActions,
      actionAttemptToDispatch(latestAttempt),
      latestAttempt.attempt_no,
    );
    const syncedPack = await persistActionSnapshot(admin, pack.id as string, syncedActions, {
      ...pack,
      staged_actions: syncedActions,
    });

    return {
      response_pack: syncedPack,
      already_approved: true,
      dispatch: actionAttemptToDispatch(latestAttempt),
      dispatch_persisted: true,
    };
  }

  if (latestAttempt?.status === "pending") {
    return {
      response_pack: {
        ...pack,
        staged_actions: baseActions,
      },
      already_approved: true,
      dispatch_in_progress: true,
    };
  }

  const currentSlackAction = baseActions.find((action) => action.intent === SLACK_ACTION_INTENT) ?? null;
  if (currentSlackAction && isSuccessfulActionStatus(currentSlackAction.status)) {
    return {
      response_pack: {
        ...pack,
        staged_actions: baseActions,
      },
      already_approved: true,
    };
  }

  return null;
}

async function loadLatestSlackAttempt(
  admin: ReturnType<typeof createAdminClient>,
  runId: string,
) {
  const { data, error } = await admin
    .from("run_action_attempts")
    .select("*")
    .eq("run_id", runId)
    .eq("action_intent", SLACK_ACTION_INTENT)
    .order("attempt_no", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return null as RunActionAttempt | null;
  }

  return data as RunActionAttempt;
}

async function persistActionSnapshot(
  admin: ReturnType<typeof createAdminClient>,
  packId: string,
  stagedActions: StagedAction[],
  fallbackPack: ResponsePack,
) {
  const { data, error } = await admin
    .from("response_packs")
    .update({ staged_actions: stagedActions })
    .eq("id", packId)
    .select()
    .single();

  if (error || !data) {
    return {
      ...fallbackPack,
      staged_actions: stagedActions,
    };
  }

  return data;
}

function applyDispatchToActions(
  actions: StagedAction[],
  dispatch: SlackDispatchResult,
  attemptCount: number,
) {
  return actions.map((action) =>
    action.intent === SLACK_ACTION_INTENT
      ? {
          ...action,
          status: dispatch.status,
          detail: dispatch.detail,
          target: dispatch.target,
          last_attempt_at: dispatch.last_attempt_at,
          attempt_count: attemptCount,
        }
      : action,
  );
}

function actionAttemptToDispatch(attempt: RunActionAttempt): SlackDispatchResult {
  return {
    ok: attempt.status !== "failed",
    status: attempt.status === "pending" ? "failed" : attempt.status,
    detail: attempt.detail ?? "Slack dispatch attempt recorded.",
    target: attempt.target,
    last_attempt_at: attempt.attempted_at,
  };
}

function isSuccessfulActionStatus(status: RunActionAttempt["status"] | StagedAction["status"]) {
  return status === "executed" || status === "dry_run";
}
