/**
 * Admin Supabase client — bypasses RLS.
 * Uses SECRET key. NEVER import from Client Components or browser code.
 * Safe only in: API routes (app/api/**), server actions, server scripts.
 */
import { createClient as createJsClient } from "@supabase/supabase-js";

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;

  if (!url || !secret) {
    throw new Error(
      "createAdminClient: missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY",
    );
  }

  return createJsClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
