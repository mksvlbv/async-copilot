import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Citation, StagedAction } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/runs/[runId]/export?format=markdown|text
 * Returns a human-readable export of the completed response pack.
 * Default format is markdown.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { runId } = await params;
  const { searchParams } = new URL(request.url);
  const format = (searchParams.get("format") ?? "markdown").toLowerCase();

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("runs")
    .select(
      `id, state, confidence, urgency, started_at, completed_at,
       case:cases ( id, case_ref, title, customer_name, customer_account, customer_plan ),
       response_pack:response_packs ( * )`,
    )
    .eq("id", runId)
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
    return NextResponse.json(
      { error: "No response pack — run not completed" },
      { status: 409 },
    );
  }

  const caseRow = Array.isArray(data.case) ? data.case[0] : data.case;
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
  return L.join("\n");
}
