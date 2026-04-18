import Link from "next/link";
import clsx from "clsx";
import { createAdminClient } from "@/lib/supabase/admin";
import { ArrowRight, Sparkle } from "@phosphor-icons/react/dist/ssr";
import type { Sample } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Samples library (Unit 8) вЂ” browsable scenario cards with body preview.
 * Each card links back to /app where the intake form can load the sample.
 */
export default async function SamplesLibraryPage() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("samples")
    .select("*")
    .order("is_golden", { ascending: false })
    .order("created_at", { ascending: false });

  const samples = (data ?? []) as Sample[];
  const golden = samples.filter((s) => s.is_golden);
  const rest = samples.filter((s) => !s.is_golden);

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
          Curated cases for testing the triage pipeline. Head to <Link href={"/app" as never} className="text-gray-900 font-medium hover:underline">New Case</Link> and click a scenario card to load it into a fresh run.
        </p>
      </div>

      {/* Golden path */}
      {golden.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Sparkle size={14} weight="fill" className="text-black" />
            <h2 className="text-[10px] font-mono font-semibold text-gray-500 uppercase tracking-widest">
              Golden Path
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-4">
            {golden.map((s) => (
              <SampleCard key={s.id} sample={s} featured />
            ))}
          </div>
        </section>
      )}

      {/* Alternatives */}
      {rest.length > 0 && (
        <section>
          <h2 className="text-[10px] font-mono font-semibold text-gray-500 uppercase tracking-widest mb-3">
            Alternative Scenarios
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rest.map((s) => (
              <SampleCard key={s.id} sample={s} />
            ))}
          </div>
        </section>
      )}

      {samples.length === 0 && (
        <div className="text-center text-sm text-gray-400 py-16 bg-white border border-dashed border-gray-200 rounded-lg">
          No samples seeded yet. Run <code className="font-mono text-gray-600">npm run db:seed</code> locally.
        </div>
      )}
    </div>
  );
}

function SampleCard({ sample: s, featured = false }: { sample: Sample; featured?: boolean }) {
  const urgencyCls =
    s.urgency === "high"
      ? "bg-red-50 text-red-700 border-red-100"
      : s.urgency === "medium"
        ? "bg-amber-50 text-amber-700 border-amber-100"
        : "bg-gray-100 text-gray-600 border-gray-200";

  const bodyPreview = s.body.length > 260 ? s.body.slice(0, 260) + "вЂ¦" : s.body;

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
              {s.urgency.toUpperCase()}
            </span>
            {s.is_golden && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-mono font-medium bg-gray-950 text-white border border-black">
                GOLDEN
              </span>
            )}
            {s.expected_confidence != null && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-mono font-medium bg-gray-50 text-gray-600 border border-gray-200">
                {s.expected_confidence}% expected
              </span>
            )}
          </div>
          <span className="text-[10px] font-mono text-gray-400 uppercase tracking-wider">
            {s.expected_stages.length ?? 6} stages
          </span>
        </div>

        <h3 className="text-base font-semibold text-gray-900">{s.name}</h3>
        <p className="text-sm text-gray-500 leading-relaxed">{s.summary}</p>

        <div className="bg-gray-50/70 border border-gray-100 rounded-md p-3">
          <div className="text-[10px] font-mono uppercase tracking-widest text-gray-500 mb-1.5">
            Case Preview
          </div>
          <p className="text-[11px] text-gray-700 leading-relaxed font-sans whitespace-pre-line line-clamp-4">
            {bodyPreview}
          </p>
        </div>

        {s.tags.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {s.tags.map((t) => (
              <span
                key={t}
                className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono text-gray-500 bg-gray-50 border border-gray-200"
              >
                {t}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-gray-100 px-5 py-3 bg-gray-50/30 flex items-center justify-between">
        <span className="font-mono text-[10px] text-gray-400 tracking-wider">slug: {s.slug}</span>
        <Link
          href={`/app?sample=${s.slug}` as never}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-900 hover:text-gray-950 transition-colors"
        >
          Load in New Case <ArrowRight size={12} weight="bold" />
        </Link>
      </div>
    </div>
  );
}
