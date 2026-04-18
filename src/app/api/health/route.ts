import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Health check endpoint.
 * Verifies:
 *  1. Next.js server is up
 *  2. Supabase env vars are present
 *  3. Supabase connection works (via admin.auth.admin.listUsers)
 */
export async function GET() {
  const checks = {
    server: true,
    env: {
      url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      publishable: !!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      secret: !!process.env.SUPABASE_SECRET_KEY,
    },
    supabase: "unknown" as "unknown" | "connected" | "error",
    supabaseError: null as string | null,
    schema: "unknown" as "unknown" | "ready" | "missing",
    counts: {
      samples: 0,
      cases: 0,
      runs: 0,
      run_stages: 0,
      response_packs: 0,
    },
  };

  try {
    const admin = createAdminClient();

    // Connection + auth check
    const { error: authErr } = await admin.auth.admin.listUsers({ perPage: 1 });
    if (authErr) {
      checks.supabase = "error";
      checks.supabaseError = authErr.message;
    } else {
      checks.supabase = "connected";
    }

    // Schema check : count rows in each table
    const tables = ["samples", "cases", "runs", "run_stages", "response_packs"] as const;
    let schemaReady = true;
    for (const t of tables) {
      const { count, error } = await admin
        .from(t)
        .select("*", { count: "exact", head: true });
      if (error) {
        schemaReady = false;
        checks.supabaseError = `${t}: ${error.message}`;
        break;
      }
      checks.counts[t] = count ?? 0;
    }
    checks.schema = schemaReady ? "ready" : "missing";
  } catch (e) {
    checks.supabase = "error";
    checks.supabaseError = e instanceof Error ? e.message : String(e);
  }

  const ok =
    checks.server &&
    checks.env.url &&
    checks.env.publishable &&
    checks.env.secret &&
    checks.supabase === "connected" &&
    checks.schema === "ready";

  return NextResponse.json(
    {
      ok,
      timestamp: new Date().toISOString(),
      checks,
    },
    { status: ok ? 200 : 503 },
  );
}
