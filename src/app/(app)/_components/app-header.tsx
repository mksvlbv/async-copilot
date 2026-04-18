"use client";

/**
 * Shared app-shell header вЂ” used by all (app) routes.
 * Reads pathname to highlight the active nav link.
 *
 * Plan-mandated fix: 'Knowledge Base' nav item removed (R21 вЂ” out of scope).
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Gear, Bell } from "@phosphor-icons/react/dist/ssr";
import clsx from "clsx";

type NavItem = { href: string; label: string };

const NAV: NavItem[] = [
  { href: "/app", label: "New Case" },
  { href: "/app/runs", label: "Runs" },
  { href: "/app/samples", label: "Samples" },
];

type Props = {
  /** Whether a run is actively progressing вЂ” controls the status pill. */
  active?: boolean;
};

export function AppHeader({ active = false }: Props) {
  const pathname = usePathname() ?? "";

  function isActive(href: string) {
    if (href === "/app") return pathname === "/app";
    return pathname.startsWith(href);
  }

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
        <nav className="flex items-center gap-6">
          {NAV.map((item) => {
            const activeItem = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href as never}
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
      </div>

      {/* Right cluster: system status, icon buttons, avatar */}
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
        <button
          type="button"
          className="text-gray-400 hover:text-gray-900 transition-colors"
          aria-label="Settings"
        >
          <Gear size={18} />
        </button>
        <button
          type="button"
          className="text-gray-400 hover:text-gray-900 transition-colors"
          aria-label="Notifications"
        >
          <Bell size={18} />
        </button>
        <div
          className="w-7 h-7 rounded-full bg-gradient-to-tr from-gray-200 to-gray-300 border border-gray-200 flex items-center justify-center text-[10px] font-semibold text-gray-600 shadow-sm ml-2 cursor-pointer"
          aria-label="Operator"
        >
          OP
        </div>
      </div>
    </header>
  );
}
