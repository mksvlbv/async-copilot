import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type {
  Case,
  Run,
  Workspace,
  WorkspaceMembership,
  WorkspaceMembershipWithWorkspace,
  WorkspaceRole,
} from "@/lib/supabase/types";

type WorkspaceAccess = {
  user: User;
  workspace: Workspace;
  membership: WorkspaceMembership;
};

type CaseAccess = {
  user: User;
  membership: WorkspaceMembership;
  caseRow: Case;
};

type RunAccess = {
  user: User;
  membership: WorkspaceMembership;
  run: Run;
};

export function hasRequiredRole(
  role: WorkspaceRole,
  allowedRoles: WorkspaceRole[] | undefined,
) {
  if (!allowedRoles || allowedRoles.length === 0) {
    return true;
  }

  return allowedRoles.includes(role);
}

export function createWorkspaceSlug(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export async function getSessionUser() {
  if (!hasSupabaseEnv()) {
    return null;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user ?? null;
}

export async function listCurrentWorkspaceMemberships() {
  if (!hasSupabaseEnv()) {
    return [] as WorkspaceMembershipWithWorkspace[];
  }

  const user = await getSessionUser();
  if (!user) {
    return [] as WorkspaceMembershipWithWorkspace[];
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workspace_memberships")
    .select(
      `id, workspace_id, user_id, role, created_at, updated_at,
       workspace:workspaces!inner ( id, slug, name, created_by, created_at, updated_at )`,
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (error || !data) {
    return [] as WorkspaceMembershipWithWorkspace[];
  }

  return data.map((row) => ({
    ...(row as WorkspaceMembership),
    workspace: normalizeEmbeddedWorkspace((row as { workspace: Workspace | Workspace[] }).workspace),
  }));
}

export async function getDefaultWorkspaceMembership() {
  const memberships = await listCurrentWorkspaceMemberships();
  return memberships[0] ?? null;
}

export async function getWorkspaceAccessBySlug(workspaceSlug: string) {
  if (!hasSupabaseEnv()) {
    return null as WorkspaceAccess | null;
  }

  const user = await getSessionUser();
  if (!user) {
    return null as WorkspaceAccess | null;
  }

  const supabase = await createClient();
  const { data: workspace, error: workspaceError } = await supabase
    .from("workspaces")
    .select("id, slug, name, created_by, created_at, updated_at")
    .eq("slug", workspaceSlug)
    .maybeSingle();

  if (workspaceError || !workspace) {
    return null as WorkspaceAccess | null;
  }

  const { data: membership, error: membershipError } = await supabase
    .from("workspace_memberships")
    .select("id, workspace_id, user_id, role, created_at, updated_at")
    .eq("workspace_id", workspace.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (membershipError || !membership) {
    return null as WorkspaceAccess | null;
  }

  return {
    user,
    workspace: workspace as Workspace,
    membership: membership as WorkspaceMembership,
  };
}

export async function getWorkspaceAccessForMutation(
  workspaceSlug: string,
  allowedRoles?: WorkspaceRole[],
) {
  const access = await getWorkspaceAccessBySlug(workspaceSlug);
  if (!access) {
    return null as WorkspaceAccess | null;
  }

  if (!hasRequiredRole(access.membership.role, allowedRoles)) {
    return null as WorkspaceAccess | null;
  }

  return access;
}

export async function getCaseAccess(caseId: string, allowedRoles?: WorkspaceRole[]) {
  const user = await getSessionUser();
  if (!user) {
    return null as CaseAccess | null;
  }

  const admin = createAdminClient();
  const { data: caseRow, error } = await admin
    .from("cases")
    .select("*")
    .eq("id", caseId)
    .maybeSingle();

  if (error || !caseRow) {
    return null as CaseAccess | null;
  }

  const membership = await getMembershipByWorkspaceId(user.id, caseRow.workspace_id as string);
  if (!membership || !hasRequiredRole(membership.role, allowedRoles)) {
    return null as CaseAccess | null;
  }

  return {
    user,
    membership,
    caseRow: caseRow as Case,
  };
}

export async function getRunAccess(runId: string, allowedRoles?: WorkspaceRole[]) {
  const user = await getSessionUser();
  if (!user) {
    return null as RunAccess | null;
  }

  const admin = createAdminClient();
  const { data: run, error } = await admin
    .from("runs")
    .select("*")
    .eq("id", runId)
    .maybeSingle();

  if (error || !run) {
    return null as RunAccess | null;
  }

  const membership = await getMembershipByWorkspaceId(user.id, run.workspace_id as string);
  if (!membership || !hasRequiredRole(membership.role, allowedRoles)) {
    return null as RunAccess | null;
  }

  return {
    user,
    membership,
    run: run as Run,
  };
}

async function getMembershipByWorkspaceId(userId: string, workspaceId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("workspace_memberships")
    .select("id, workspace_id, user_id, role, created_at, updated_at")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) {
    return null as WorkspaceMembership | null;
  }

  return data as WorkspaceMembership;
}

function normalizeEmbeddedWorkspace(value: Workspace | Workspace[]) {
  return Array.isArray(value) ? value[0] : value;
}

function hasSupabaseEnv() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY &&
      process.env.SUPABASE_SECRET_KEY,
  );
}
