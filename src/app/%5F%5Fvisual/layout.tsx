import { notFound } from "next/navigation";
import { AppHeader } from "@/components/shared/app-header";
import {
  visualCurrentUserEmail,
  visualHarnessEnabled,
  visualMemberships,
} from "@/lib/testing/visual-fixtures";

export const dynamic = "force-dynamic";

export default function VisualHarnessLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!visualHarnessEnabled()) {
    notFound();
  }

  return (
    <div className="h-dvh min-h-dvh flex flex-col bg-white overflow-hidden">
      <AppHeader memberships={visualMemberships} currentUserEmail={visualCurrentUserEmail} />
      <main className="flex-1 overflow-y-auto bg-gray-50/50">{children}</main>
    </div>
  );
}
