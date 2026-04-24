import Link from "next/link";
import clsx from "clsx";
import { ArrowRight, Sparkle } from "@phosphor-icons/react/dist/ssr";
import { getWorkspaceAccessBySlug } from "@/lib/auth/workspace";
import { createClient } from "@/lib/supabase/server";
import type { Sample } from "@/lib/supabase/types";
import { notFound } from "next/navigation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function WorkspaceSamplesPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const access = await getWorkspaceAccessBySlug(workspaceSlug);

  if (!access) {
    notFound();
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("samples")
    .select("*")
    .order("is_golden", { ascending: false })
    .order("created_at", { ascending: false });

  const samples = (data ?? []) as Sample[];
  const golden = samples.filter((sample) => sample.is_golden);
  const rest = samples.filter((sample) => !sample.is_golden);

  return (
    <div className="max-w-6xl mx-auto px-8 py-10 space-y-8">
      <div>
        <span className="font-mono text-[10px] uppercase tracking-widest text-gray-500">
          Library
        </span>
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900 mt-2">
          Pre-configured Scenarios
        </h1>
        <p className="text-sm text-gray-500 mt-1 max-w-xl">
          Curated cases for testing the triage pipeline. Head to <Link href={`/app/w/${access.workspace.slug}` as never} className="text-gray-900 font-medium hover:underline">New Case</Link> and click a scenario card to load it into a fresh run.
        </p>
      </div>

      {golden.length > 0 ? (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Sparkle size={14} weight="fill" className="text-black" />
            <h2 className="text-[10px] font-mono font-semibold text-gray-500 uppercase tracking-widest">
              Golden Path
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-4">
            {golden.map((sample) => (
              <SampleCard key={sample.id} sample={sample} workspaceSlug={access.workspace.slug} featured />
            ))}
          </div>
        </section>
      ) : null}

      {rest.length > 0 ? (
        <section>
          <h2 className="text-[10px] font-mono font-semibold text-gray-500 uppercase tracking-widest mb-3">
            Alternative Scenarios
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rest.map((sample) => (
              <SampleCard key={sample.id} sample={sample} workspaceSlug={access.workspace.slug} />
            ))}
          </div>
        </section>
      ) : null}

      {samples.length === 0 ? (
        <div className="text-center text-sm text-gray-400 py-16 bg-white border border-dashed border-gray-200 rounded-lg">
          No samples seeded yet. Run <code className="font-mono text-gray-600">npm run db:seed</code> locally.
        </div>
      ) : null}
    </div>
  );
}

function SampleCard({
  sample,
  workspaceSlug,
  featured = false,
}: {
  sample: Sample;
  workspaceSlug: string;
  featured?: boolean;
}) {
  const urgencyCls =
    sample.urgency === "high"
      ? "bg-red-50 text-red-700 border-red-100"
      : sample.urgency === "medium"
        ? "bg-amber-50 text-amber-700 border-amber-100"
        : "bg-gray-100 text-gray-600 border-gray-200";

  const bodyPreview = sample.body.length > 260 ? `${sample.body.slice(0, 260)}...` : sample.body;

  return (
    <div
      className={clsx(
        "bg-white rounded-lg shadow-sm overflow-hidden flex flex-col",
        featured ? "border border-gray-900 ring-1 ring-gray-900 ring-offset-1 ring-offset-gray-50" : "border border-gray-200",
      )}
    >
      <div className="p-5 space-y-3 flex-1">
        <div className="flex items-start justify-between">
          <div className="flex gap-1.5 flex-wrap">
            <span className={clsx("inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-mono font-medium border", urgencyCls)}>
              {sample.urgency.toUpperCase()}
            </span>
            {sample.is_golden ? (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-mono font-medium bg-gray-950 text-white border border-black">
                GOLDEN
              </span>
            ) : null}
            {sample.expected_confidence != null ? (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-mono font-medium bg-gray-50 text-gray-600 border border-gray-200">
                {sample.expected_confidence}% expected
              </span>
            ) : null}
          </div>
          <span className="text-[10px] font-mono text-gray-400 uppercase tracking-wider">
            {sample.expected_stages.length ?? 6} stages
          </span>
        </div>

        <h3 className="text-base font-semibold text-gray-900">{sample.name}</h3>
        <p className="text-sm text-gray-500 leading-relaxed">{sample.summary}</p>

        <div className="bg-gray-50/70 border border-gray-100 rounded-md p-3">
          <div className="text-[10px] font-mono uppercase tracking-widest text-gray-500 mb-1.5">
            Case Preview
          </div>
          <p className="text-[11px] text-gray-700 leading-relaxed font-sans whitespace-pre-line line-clamp-4">
            {bodyPreview}
          </p>
        </div>

        {sample.tags.length > 0 ? (
          <div className="flex items-center gap-1.5 flex-wrap">
            {sample.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono text-gray-500 bg-gray-50 border border-gray-200"
              >
                {tag}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <div className="border-t border-gray-100 px-5 py-3 bg-gray-50/30 flex items-center justify-between">
        <span className="font-mono text-[10px] text-gray-400 tracking-wider">slug: {sample.slug}</span>
        <Link
          href={`/app/w/${workspaceSlug}?sample=${sample.slug}` as never}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-900 hover:text-gray-950 transition-colors"
        >
          Load in New Case <ArrowRight size={12} weight="bold" />
        </Link>
      </div>
    </div>
  );
}
