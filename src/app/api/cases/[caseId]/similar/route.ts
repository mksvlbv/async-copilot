import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/cases/[caseId]/similar
 *
 * Returns up to 5 similar cases using Postgres full-text search + trigram
 * similarity (pgvector + pg_trgm). No external embedding API needed.
 *
 * Query: ?limit=5
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ caseId: string }> },
) {
  const { caseId } = await params;
  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "5", 10), 10);

  const admin = createAdminClient();

  // Fetch the source case
  const { data: sourceCase, error: caseErr } = await admin
    .from("cases")
    .select("title, body")
    .eq("id", caseId)
    .maybeSingle();

  if (caseErr || !sourceCase) {
    return NextResponse.json({ error: "Case not found" }, { status: 404 });
  }

  // Call the similarity search function
  const { data: similar, error: searchErr } = await admin.rpc(
    "search_similar_cases",
    {
      query_title: sourceCase.title,
      query_body: sourceCase.body,
      exclude_case_id: caseId,
      match_limit: limit,
    },
  );

  if (searchErr) {
    return NextResponse.json({ error: searchErr.message }, { status: 500 });
  }

  return NextResponse.json({
    source_case_id: caseId,
    similar: similar ?? [],
    count: similar?.length ?? 0,
  });
}
