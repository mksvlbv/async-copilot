/**
 * App surface layout — workspace shell.
 * Wraps all (app) routes with the shared AppHeader.
 */
import { AppHeader } from "./_components/app-header";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-screen flex flex-col bg-white overflow-hidden">
      <AppHeader />
      <main className="flex-1 overflow-y-auto bg-gray-50/50">{children}</main>
    </div>
  );
}
