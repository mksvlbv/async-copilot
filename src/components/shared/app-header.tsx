"use client";

/**
 * Shared app-shell header - used by all (app) routes.
 * Reads pathname to highlight the active nav link.
 *
 * Plan-mandated fix: 'Knowledge Base' nav item removed (R21 - out of scope).
 */
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import clsx from "clsx";
import { createClient } from "@/lib/supabase/client";
import type { WorkspaceMembershipWithWorkspace } from "@/lib/supabase/types";

type NavItem = { suffix: string; label: string };

const NAV: NavItem[] = [
  { suffix: "", label: "New Case" },
  { suffix: "/runs", label: "Runs" },
  { suffix: "/samples", label: "Samples" },
];

type Props = {
  /** Whether a run is actively progressing - controls the status pill. */
  active?: boolean;
  memberships?: WorkspaceMembershipWithWorkspace[];
  currentUserEmail?: string | null;
};

export function AppHeader({
  active = false,
  memberships = [],
  currentUserEmail = null,
}: Props) {
  const pathname = usePathname() ?? "";
  const router = useRouter();

  const currentWorkspaceSlug = extractWorkspaceSlug(pathname);
  const currentMembership = memberships.find(
    (membership) => membership.workspace.slug === currentWorkspaceSlug,
  ) ?? memberships[0] ?? null;
  const basePath = currentMembership
    ? `/app/w/${currentMembership.workspace.slug}`
    : "/app";

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  function isActive(href: string) {
    if (href === basePath) return pathname === href;
    return pathname.startsWith(href);
  }

  const showWorkspaceNav = Boolean(currentMembership);

  return (
    <header className="h-14 border-b border-gray-200 bg-white flex items-center justify-between px-5 shrink-0 z-10">
      <div className="flex items-center gap-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-4 h-4 bg-gray-950 rounded-[3px] shadow-sm" aria-hidden />
          <span className="font-semibold text-[13px] tracking-tight">Async Copilot</span>
        </Link>

        <div className="h-4 w-px bg-gray-200" aria-hidden />

        {/* Primary nav */}
        {showWorkspaceNav ? (
          <nav className="flex items-center gap-6">
            {NAV.map((item) => {
              const href = `${basePath}${item.suffix}`;
              const activeItem = isActive(href);
              return (
                <Link
                  key={item.label}
                  href={href as never}
                  className={clsx(
                    "text-[13px] font-medium relative flex items-center h-14 transition-colors",
                    activeItem ? "text-black" : "text-gray-500 hover:text-black",
                  )}
                >
                  {item.label}
                  {activeItem && (
                    <div className="absolute bottom-0 left-0 w-full h-[2px] bg-gray-950 rounded-t" aria-hidden />
                  )}
                </Link>
              );
            })}
          </nav>
        ) : (
          <div className="text-[11px] font-mono uppercase tracking-widest text-gray-400">
            Workspace setup
          </div>
        )}
      </div>

      {/* Right cluster: system status + operator context */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded px-2 py-1 text-xs text-gray-500 font-mono">
          <span
            className={clsx(
              "w-1.5 h-1.5 rounded-full",
              active ? "bg-blue-500 animate-pulse" : "bg-green-500",
            )}
          />
          {active ? "SYSTEM ACTIVE" : "SYSTEM IDLE"}
        </div>
        <div className="h-4 w-px bg-gray-200 mx-1" aria-hidden />
        {memberships.length > 1 ? (
          <label className="hidden sm:block">
            <span className="sr-only">Switch workspace</span>
            <select
              value={currentMembership?.workspace.slug ?? ""}
              onChange={(event) => {
                const nextSlug = event.target.value;
                if (!nextSlug) {
                  return;
                }

                router.push(`/app/w/${nextSlug}` as never);
              }}
              className="rounded border border-gray-200 bg-gray-50 px-2 py-1 text-[11px] text-gray-600 shadow-sm outline-none focus:border-black focus:ring-1 focus:ring-black"
            >
              {memberships.map((membership) => (
                <option key={membership.workspace.id} value={membership.workspace.slug}>
                  {membership.workspace.name}
                </option>
              ))}
            </select>
          </label>
        ) : currentMembership ? (
          <div className="hidden sm:flex items-center gap-2">
            <div
              className="flex items-center rounded border border-gray-200 bg-gray-50 px-2 py-1 text-[10px] font-mono uppercase tracking-widest text-gray-400"
              aria-label="Current workspace"
            >
              {currentMembership.workspace.name}
            </div>
            <div className="rounded border border-gray-200 bg-white px-2 py-1 text-[10px] font-mono uppercase tracking-widest text-gray-500">
              {currentMembership.role}
            </div>
          </div>
        ) : null}
        {currentUserEmail ? (
          <div className="hidden md:block text-xs text-gray-500">{currentUserEmail}</div>
        ) : null}
        <button
          type="button"
          onClick={handleSignOut}
          className="text-[11px] font-medium text-gray-500 transition-colors hover:text-gray-900"
        >
          Sign out
        </button>
        <div
          className="w-7 h-7 rounded-full bg-gradient-to-tr from-gray-200 to-gray-300 border border-gray-200 flex items-center justify-center text-[10px] font-semibold text-gray-600 shadow-sm ml-1"
          aria-label="Operator session"
          title={currentUserEmail ?? "Operator session"}
        >
          {(currentUserEmail?.[0] ?? "U").toUpperCase()}
        </div>
      </div>
    </header>
  );
}

function extractWorkspaceSlug(pathname: string) {
  const match = pathname.match(/^\/app\/w\/([^/]+)/);
  return match?.[1] ?? null;
}
