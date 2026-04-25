import { NextResponse } from "next/server";
import type { ResponsePackLineage } from "@/features/runs/lib/provenance";
import { getResponsePackLineage } from "@/features/runs/lib/provenance";
import { getRunAccess, getSessionUser } from "@/lib/auth/workspace";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  Citation,
  ResponsePackApproval,
  RunActionAttempt,
  StagedAction,
} from "@/lib/supabase/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/runs/[runId]/export?format=markdown|text|json
 * Returns the completed response pack plus portable trust evidence.
 * Default format is markdown.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { runId } = await params;
  const { searchParams } = new URL(request.url);
  const format = (searchParams.get("format") ?? "markdown").toLowerCase();

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const access = await getRunAccess(runId);
  if (!access) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("runs")
    .select(
      `id, state, confidence, urgency, started_at, completed_at,
        case:cases ( id, case_ref, title, customer_name, customer_account, customer_plan ),
        stages:run_stages ( * ),
        events:run_events ( * ),
        action_attempts:run_action_attempts ( * ),
        approval_history:response_pack_approvals ( * ),
        response_pack:response_packs ( * )`,
    )
    .eq("id", runId)
    .eq("workspace_id", access.run.workspace_id)
    .order("stage_order", { foreignTable: "run_stages", ascending: true })
    .order("id", { foreignTable: "run_events", ascending: true })
    .order("attempted_at", { foreignTable: "run_action_attempts", ascending: false })
    .order("approved_at", { foreignTable: "response_pack_approvals", ascending: false })
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  const pack = Array.isArray(data.response_pack)
    ? data.response_pack[0]
    : data.response_pack;
  if (!pack) {
    // Return error in the content-type the caller asked for so browsers
    // downloading as text/markdown don't get a mislabeled JSON file.
    if (format === "text" || format === "markdown") {
      return new NextResponse(
        "Response pack not available — run has not completed yet.",
        {
          status: 409,
          headers: {
            "Content-Type":
              format === "text"
                ? "text/plain; charset=utf-8"
                : "text/markdown; charset=utf-8",
          },
        },
      );
    }
    return NextResponse.json(
      { error: "No response pack — run not completed" },
      { status: 409 },
    );
  }

  const caseRow = Array.isArray(data.case) ? data.case[0] : data.case;
  const stages = data.stages ?? [];
  const events = data.events ?? [];
  const actionAttempts = data.action_attempts ?? [];
  const approvalHistory = data.approval_history ?? [];
  const packLineage = getResponsePackLineage({
    events,
    stages,
    response_pack: pack,
  });
  const payload = {
    case: caseRow,
    run: {
      id: data.id,
      state: data.state,
      confidence: data.confidence,
      urgency: data.urgency,
      started_at: data.started_at,
      completed_at: data.completed_at,
    },
    pack,
    evidence: {
      pack_lineage: packLineage,
      approval_history: approvalHistory.map((approval) => ({
        id: approval.id,
        actor_user_id: approval.actor_user_id,
        actor_label: approval.actor_label,
        approved_at: approval.approved_at,
      })),
      action_log: actionAttempts.map((attempt) => ({
        id: attempt.id,
        attempt_no: attempt.attempt_no,
        status: attempt.status,
        action_intent: attempt.action_intent,
        action_label: attempt.action_label,
        target: attempt.target,
        detail: attempt.detail,
        attempted_at: attempt.attempted_at,
        idempotency_key: attempt.idempotency_key,
      })),
    },
  };

  if (format === "json") {
    return NextResponse.json(payload);
  }

  const text = format === "text" ? renderText(payload) : renderMarkdown(payload);
  return new NextResponse(text, {
    status: 200,
    headers: {
      "Content-Type": format === "text" ? "text/plain; charset=utf-8" : "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${caseRow?.case_ref ?? "export"}.${format === "text" ? "txt" : "md"}"`,
    },
  });
}

type ExportPayload = {
  case: {
    case_ref: string;
    title: string;
    customer_name: string | null;
    customer_account: string | null;
    customer_plan: string | null;
  } | null;
  run: {
    state: string;
    confidence: number | null;
    urgency: string | null;
    started_at: string | null;
    completed_at: string | null;
  };
  pack: {
    confidence: number;
    recommendation: string | null;
    internal_summary: string;
    draft_reply: string;
    citations: Citation[];
    staged_actions: StagedAction[];
    escalation_queue: string | null;
    approved: boolean;
  };
  evidence: {
    pack_lineage: ResponsePackLineage | null;
    approval_history: Array<
      Pick<ResponsePackApproval, "id" | "actor_user_id" | "actor_label" | "approved_at">
    >;
    action_log: Array<
      Pick<
        RunActionAttempt,
        | "id"
        | "attempt_no"
        | "status"
        | "action_intent"
        | "action_label"
        | "target"
        | "detail"
        | "attempted_at"
        | "idempotency_key"
      >
    >;
  };
};

function renderMarkdown(p: ExportPayload): string {
  const lines: string[] = [];
  lines.push(`# Response Pack — ${p.case?.case_ref ?? "untitled"}`);
  lines.push("");
  lines.push(`**Case:** ${p.case?.title ?? ""}`);
  if (p.case?.customer_name) lines.push(`**Customer:** ${p.case.customer_name}${p.case.customer_account ? ` (${p.case.customer_account})` : ""}`);
  lines.push(`**State:** ${p.run.state} · **Confidence:** ${p.pack.confidence}% · **Urgency:** ${p.run.urgency ?? "—"}`);
  lines.push(`**Approved:** ${p.pack.approved ? "yes" : "no"}`);
  if (p.pack.escalation_queue) lines.push(`**Escalation queue:** ${p.pack.escalation_queue}`);
  lines.push("");
  if (p.pack.recommendation) {
    lines.push("## Recommendation");
    lines.push(p.pack.recommendation);
    lines.push("");
  }
  lines.push("## Internal summary");
  lines.push(p.pack.internal_summary);
  lines.push("");
  lines.push("## Draft reply");
  lines.push("```");
  lines.push(p.pack.draft_reply);
  lines.push("```");
  lines.push("");
  if (p.pack.citations.length) {
    lines.push("## Citations");
    for (const c of p.pack.citations) {
      lines.push(`- **${c.source}** (${c.id}): ${c.note}`);
    }
    lines.push("");
  }
  if (p.pack.staged_actions.length) {
    lines.push("## Staged actions");
    for (const a of p.pack.staged_actions) {
      lines.push(`- [${a.status}] ${a.label} _(intent: ${a.intent})_`);
    }
    lines.push("");
  }
  appendMarkdownEvidence(lines, p.evidence);
  return lines.join("\n");
}

function renderText(p: ExportPayload): string {
  const L: string[] = [];
  L.push(`Response Pack — ${p.case?.case_ref ?? "untitled"}`);
  L.push("=".repeat(60));
  L.push(`Case: ${p.case?.title ?? ""}`);
  if (p.case?.customer_name) L.push(`Customer: ${p.case.customer_name}${p.case.customer_account ? ` (${p.case.customer_account})` : ""}`);
  L.push(`State: ${p.run.state} · Confidence: ${p.pack.confidence}% · Urgency: ${p.run.urgency ?? "—"}`);
  L.push(`Approved: ${p.pack.approved ? "yes" : "no"}`);
  if (p.pack.escalation_queue) L.push(`Escalation queue: ${p.pack.escalation_queue}`);
  L.push("");
  if (p.pack.recommendation) {
    L.push("Recommendation:"); L.push(p.pack.recommendation); L.push("");
  }
  L.push("Internal summary:"); L.push(p.pack.internal_summary); L.push("");
  L.push("Draft reply:"); L.push("-".repeat(60)); L.push(p.pack.draft_reply); L.push("-".repeat(60)); L.push("");
  if (p.pack.citations.length) {
    L.push("Citations:");
    for (const c of p.pack.citations) L.push(`  - ${c.source} (${c.id}): ${c.note}`);
    L.push("");
  }
  if (p.pack.staged_actions.length) {
    L.push("Staged actions:");
    for (const a of p.pack.staged_actions) L.push(`  - [${a.status}] ${a.label} (intent: ${a.intent})`);
    L.push("");
  }
  appendTextEvidence(L, p.evidence);
  return L.join("\n");
}

function appendMarkdownEvidence(lines: string[], evidence: ExportPayload["evidence"]) {
  if (
    !evidence.pack_lineage &&
    evidence.approval_history.length === 0 &&
    evidence.action_log.length === 0
  ) {
    return;
  }

  lines.push("## Trust evidence");
  if (evidence.pack_lineage) {
    lines.push(`- **Pack created:** ${formatAttempt(evidence.pack_lineage.created_at)}`);
    lines.push(`- **Execution:** ${evidence.pack_lineage.execution_summary}`);
    if (evidence.pack_lineage.timing_summary) {
      lines.push(`- **Timing:** ${evidence.pack_lineage.timing_summary}`);
    }
    if (evidence.pack_lineage.signals_summary) {
      lines.push(`- **Signals:** ${evidence.pack_lineage.signals_summary}`);
    }
    lines.push("");
    lines.push("### Stage lineage");
    for (const stage of evidence.pack_lineage.stages) {
      lines.push(
        `- ${String(stage.stage_order).padStart(2, "0")} ${stage.stage_label} — ${formatLineageExecutionLabel(stage.provenance)}`,
      );
    }
    lines.push("");
  }

  if (evidence.approval_history.length > 0) {
    lines.push("### Approval history");
    for (const approval of evidence.approval_history) {
      lines.push(`- ${formatAttempt(approval.approved_at)} — ${formatApprovalActor(approval)}`);
    }
    lines.push("");
  }

  if (evidence.action_log.length > 0) {
    lines.push("### Action log");
    for (const attempt of evidence.action_log) {
      lines.push(
        `- ${formatAttempt(attempt.attempted_at)} — Attempt #${attempt.attempt_no} [${attempt.status}] ${attempt.action_label}${attempt.target ? ` · ${attempt.target}` : ""}`,
      );
      if (attempt.detail) {
        lines.push(`  Detail: ${attempt.detail}`);
      }
      lines.push(`  Idempotency key: ${attempt.idempotency_key}`);
    }
    lines.push("");
  }
}

function appendTextEvidence(lines: string[], evidence: ExportPayload["evidence"]) {
  if (
    !evidence.pack_lineage &&
    evidence.approval_history.length === 0 &&
    evidence.action_log.length === 0
  ) {
    return;
  }

  lines.push("Trust evidence:");
  if (evidence.pack_lineage) {
    lines.push(`  Pack created: ${formatAttempt(evidence.pack_lineage.created_at)}`);
    lines.push(`  Execution: ${evidence.pack_lineage.execution_summary}`);
    if (evidence.pack_lineage.timing_summary) {
      lines.push(`  Timing: ${evidence.pack_lineage.timing_summary}`);
    }
    if (evidence.pack_lineage.signals_summary) {
      lines.push(`  Signals: ${evidence.pack_lineage.signals_summary}`);
    }
    lines.push("");
    lines.push("Stage lineage:");
    for (const stage of evidence.pack_lineage.stages) {
      lines.push(
        `  - ${String(stage.stage_order).padStart(2, "0")} ${stage.stage_label} — ${formatLineageExecutionLabel(stage.provenance)}`,
      );
    }
    lines.push("");
  }

  if (evidence.approval_history.length > 0) {
    lines.push("Approval history:");
    for (const approval of evidence.approval_history) {
      lines.push(`  - ${formatAttempt(approval.approved_at)} — ${formatApprovalActor(approval)}`);
    }
    lines.push("");
  }

  if (evidence.action_log.length > 0) {
    lines.push("Action log:");
    for (const attempt of evidence.action_log) {
      lines.push(
        `  - ${formatAttempt(attempt.attempted_at)} — Attempt #${attempt.attempt_no} [${attempt.status}] ${attempt.action_label}${attempt.target ? ` · ${attempt.target}` : ""}`,
      );
      if (attempt.detail) {
        lines.push(`    Detail: ${attempt.detail}`);
      }
      lines.push(`    Idempotency key: ${attempt.idempotency_key}`);
    }
    lines.push("");
  }
}

function formatLineageExecutionLabel(provenance: ResponsePackLineage["stages"][number]["provenance"]) {
  if (!provenance) {
    return "No runtime provenance";
  }

  return provenance.execution_mode === "ai" ? "AI" : "Synthetic fallback";
}

function formatApprovalActor(
  approval: Pick<ResponsePackApproval, "actor_label" | "actor_user_id">,
) {
  if (approval.actor_label && approval.actor_label.length > 0) {
    return approval.actor_label;
  }

  return approval.actor_user_id ? "Workspace reviewer" : "Historical approval";
}

function formatAttempt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const min = String(date.getUTCMinutes()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd} ${hh}:${min} UTC`;
}
