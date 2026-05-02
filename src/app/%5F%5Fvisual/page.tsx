import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function VisualHarnessIndexPage() {
  redirect("/__visual/intake?sample=payments-dispute" as never);
}
