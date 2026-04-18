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
  };

  try {
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.listUsers({ perPage: 1 });
    if (error) {
      checks.supabase = "error";
      checks.supabaseError = error.message;
    } else {
      checks.supabase = "connected";
    }
  } catch (e) {
    checks.supabase = "error";
    checks.supabaseError = e instanceof Error ? e.message : String(e);
  }

  const ok =
    checks.server &&
    checks.env.url &&
    checks.env.publishable &&
    checks.env.secret &&
    checks.supabase === "connected";

  return NextResponse.json(
    {
      ok,
      timestamp: new Date().toISOString(),
      checks,
    },
    { status: ok ? 200 : 503 },
  );
}
