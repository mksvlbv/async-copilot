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
    <header className="min-h-14 border-b border-gray-200 bg-white flex flex-col gap-2 px-4 py-2 shrink-0 z-10 sm:px-5 lg:h-14 lg:flex-row lg:items-center lg:justify-between lg:gap-0 lg:py-0">
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-6 lg:gap-8">
        {/* Logo */}
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <div className="w-4 h-4 bg-gray-950 rounded-[3px] shadow-sm" aria-hidden />
          <span className="font-semibold text-[13px] tracking-tight whitespace-nowrap">Async Copilot</span>
        </Link>

        <div className="hidden h-4 w-px bg-gray-200 sm:block" aria-hidden />

        {/* Primary nav */}
        {showWorkspaceNav ? (
          <nav className="-mx-4 flex min-w-0 items-center gap-5 overflow-x-auto px-4 pb-0.5 sm:mx-0 sm:gap-6 sm:overflow-visible sm:px-0 sm:pb-0">
            {NAV.map((item) => {
              const href = `${basePath}${item.suffix}`;
              const activeItem = isActive(href);
              return (
                <Link
                  key={item.label}
                  href={href as never}
                  className={clsx(
                    "text-[13px] font-medium relative flex shrink-0 items-center py-1.5 transition-colors lg:h-14 lg:py-0",
                    activeItem ? "text-black" : "text-gray-500 hover:text-black",
                  )}
                >
                  {item.label}
                  {activeItem && (
                    <div className="absolute bottom-0 left-0 w-full h-[2px] bg-gray-950 rounded-t lg:bottom-0" aria-hidden />
                  )}
                </Link>
              );
            })}
          </nav>
        ) : (
          <div className="text-[11px] font-mono uppercase tracking-widest text-gray-500">
            Workspace setup
          </div>
        )}
      </div>

      {/* Right cluster: system status + operator context */}
      <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3 lg:flex-nowrap lg:gap-4">
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded px-2 py-1 text-[10px] text-gray-700 font-mono sm:text-xs">
          <span
            className={clsx(
              "w-1.5 h-1.5 rounded-full",
              active ? "bg-blue-500 animate-pulse" : "bg-green-500",
            )}
          />
          <span className="whitespace-nowrap">{active ? "SYSTEM ACTIVE" : "SYSTEM IDLE"}</span>
        </div>
        <div className="hidden h-4 w-px bg-gray-200 mx-1 sm:block" aria-hidden />
        {memberships.length > 1 ? (
          <label className="block max-w-full">
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
              className="max-w-[11rem] rounded border border-gray-200 bg-gray-50 px-2 py-1 text-[11px] text-gray-600 shadow-sm outline-none focus:border-black focus:ring-1 focus:ring-black sm:max-w-[14rem]"
            >
              {memberships.map((membership) => (
                <option key={membership.workspace.id} value={membership.workspace.slug}>
                  {membership.workspace.name}
                </option>
              ))}
            </select>
          </label>
        ) : currentMembership ? (
          <div className="hidden items-center gap-2 sm:flex">
            <div
                className="flex items-center rounded border border-gray-200 bg-gray-50 px-2 py-1 text-[10px] font-mono uppercase tracking-widest text-gray-600"
                aria-label="Current workspace"
              >
                {currentMembership.workspace.name}
              </div>
            <div className="rounded border border-gray-200 bg-white px-2 py-1 text-[10px] font-mono uppercase tracking-widest text-gray-700">
              {currentMembership.role}
            </div>
          </div>
        ) : null}
        {currentUserEmail ? (
          <div className="hidden max-w-[13rem] truncate text-xs text-gray-500 xl:block">{currentUserEmail}</div>
        ) : null}
        <button
          type="button"
          onClick={handleSignOut}
          className="text-[11px] font-medium text-gray-500 transition-colors hover:text-gray-900"
        >
          Sign out
        </button>
        <div
          className="w-7 h-7 rounded-full bg-gradient-to-tr from-gray-200 to-gray-300 border border-gray-200 flex shrink-0 items-center justify-center text-[10px] font-semibold text-gray-600 shadow-sm sm:ml-1"
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
