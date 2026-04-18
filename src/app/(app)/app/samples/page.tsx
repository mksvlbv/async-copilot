import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Samples library — placeholder for Unit 8.
 * Shows the full scenario library so operators can browse & preview.
 */
export default async function SamplesLibraryPlaceholder() {
  const admin = createAdminClient();
  const { data: samples } = await admin
    .from("samples")
    .select("*")
    .order("is_golden", { ascending: false })
    .order("created_at", { ascending: false });

  return (
    <div className="max-w-5xl mx-auto px-8 py-10">
      <div className="mb-6">
        <span className="font-mono text-[10px] uppercase tracking-widest text-gray-500">
          Library
        </span>
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900 mt-2">
          Pre-configured Scenarios
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Curated cases for testing the triage pipeline. Click `Open` to load one into a new run.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(samples ?? []).map((s) => (
          <div
            key={s.id}
            className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex gap-1.5">
                <span
                  className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-mono font-medium border ${
                    s.urgency === "high"
                      ? "bg-red-50 text-red-700 border-red-100"
                      : s.urgency === "medium"
                        ? "bg-amber-50 text-amber-700 border-amber-100"
                        : "bg-gray-100 text-gray-600 border-gray-200"
                  }`}
                >
                  {s.urgency.toUpperCase()}
                </span>
                {s.is_golden && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-mono font-medium bg-black text-white border border-black">
                    GOLDEN
                  </span>
                )}
                {s.expected_confidence != null && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-mono font-medium bg-gray-50 text-gray-600 border border-gray-200">
                    {s.expected_confidence}%
                  </span>
                )}
              </div>
            </div>
            <h3 className="text-base font-semibold text-gray-900 mb-2">{s.name}</h3>
            <p className="text-sm text-gray-500 leading-relaxed mb-4 line-clamp-3">
              {s.summary}
            </p>
            <div className="flex items-center gap-2 flex-wrap mb-4">
              {s.tags.map((t: string) => (
                <span
                  key={t}
                  className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono text-gray-500 bg-gray-50 border border-gray-200"
                >
                  {t}
                </span>
              ))}
            </div>
            <Link
              href={"/app" as never}
              className="inline-flex items-center gap-1 text-sm font-medium text-black hover:text-gray-700 transition-colors"
            >
              Open →
            </Link>
          </div>
        ))}
        {(!samples || samples.length === 0) && (
          <div className="col-span-2 text-center text-sm text-gray-400 py-16">
            No samples seeded yet. Run `npm run db:seed` locally.
          </div>
        )}
      </div>
    </div>
  );
}
