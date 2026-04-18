import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/samples
 * Returns the scenario library (golden first, then alternatives by created_at).
 */
export async function GET() {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("samples")
    .select("*")
    .order("is_golden", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ samples: data ?? [] });
}
