import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Next ticket reference (CASE-XXXX). Fresh-reads max existing case_ref. */
async function nextCaseRef(admin: ReturnType<typeof createAdminClient>): Promise<string> {
  const { data } = await admin
    .from("cases")
    .select("case_ref")
    .order("created_at", { ascending: false })
    .limit(1);
  const last = data?.[0]?.case_ref ?? "CASE-8923";
  const match = last.match(/CASE-(\d+)/);
  const n = match ? parseInt(match[1], 10) + 1 : 8925;
  return `CASE-${n}`;
}

/**
 * GET /api/cases
 * List cases newest-first. Optional ?limit=N.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 200);

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("cases")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ cases: data ?? [] });
}

/**
 * POST /api/cases
 * Body: { title, body, customer_name?, customer_account?, customer_plan?, sample_id? }
 * Creates a new case (source: intake unless sample_id provided).
 */
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const bodyText = typeof body.body === "string" ? body.body.trim() : "";
  if (!title || title.length < 3) {
    return NextResponse.json(
      { error: "Field 'title' is required (min 3 chars)" },
      { status: 400 },
    );
  }
  if (!bodyText || bodyText.length < 10) {
    return NextResponse.json(
      { error: "Field 'body' is required (min 10 chars)" },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const case_ref = await nextCaseRef(admin);

  const payload = {
    case_ref,
    title,
    body: bodyText,
    source: body.sample_id ? ("sample" as const) : ("intake" as const),
    sample_id: typeof body.sample_id === "string" ? body.sample_id : null,
    customer_name: typeof body.customer_name === "string" ? body.customer_name : null,
    customer_account:
      typeof body.customer_account === "string" ? body.customer_account : null,
    customer_plan:
      typeof body.customer_plan === "string" ? body.customer_plan : null,
  };

  const { data, error } = await admin
    .from("cases")
    .insert(payload)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ case: data }, { status: 201 });
}
