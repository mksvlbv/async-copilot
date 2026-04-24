/**
 * App surface layout — workspace shell.
 * Wraps all (app) routes with the shared AppHeader.
 */
import { AppHeader } from "@/components/shared/app-header";
import {
  getSessionUser,
  listCurrentWorkspaceMemberships,
} from "@/lib/auth/workspace";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, memberships] = await Promise.all([
    getSessionUser(),
    listCurrentWorkspaceMemberships(),
  ]);

  return (
    <div className="h-screen flex flex-col bg-white overflow-hidden">
      <AppHeader memberships={memberships} currentUserEmail={user?.email ?? null} />
      <main className="flex-1 overflow-y-auto bg-gray-50/50">{children}</main>
    </div>
  );
}
