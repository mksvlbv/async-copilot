import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createWorkspaceSlug, getSessionUser } from "@/lib/auth/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const requestedSlug = typeof body.slug === "string" ? body.slug.trim() : "";
  const slug = createWorkspaceSlug(requestedSlug || name);

  if (name.length < 3) {
    return NextResponse.json({ error: "Workspace name must be at least 3 characters" }, { status: 400 });
  }

  if (slug.length < 3) {
    return NextResponse.json({ error: "Workspace slug must be at least 3 characters" }, { status: 400 });
  }

  const admin = createAdminClient();

  await admin
    .from("profiles")
    .upsert({ id: user.id, email: user.email ?? null }, { onConflict: "id" });

  const { data: existing } = await admin
    .from("workspaces")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "Workspace slug is already in use" }, { status: 409 });
  }

  const { data: workspace, error: workspaceError } = await admin
    .from("workspaces")
    .insert({ name, slug, created_by: user.id })
    .select("id, slug, name, created_by, created_at, updated_at")
    .single();

  if (workspaceError || !workspace) {
    return NextResponse.json({ error: workspaceError?.message ?? "Workspace creation failed" }, { status: 500 });
  }

  const { error: membershipError } = await admin
    .from("workspace_memberships")
    .insert({ workspace_id: workspace.id, user_id: user.id, role: "admin" });

  if (membershipError) {
    return NextResponse.json({ error: membershipError.message }, { status: 500 });
  }

  return NextResponse.json({ workspace }, { status: 201 });
}
