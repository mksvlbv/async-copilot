import Link from "next/link";

/**
 * Landing (placeholder for Unit 1).
 * Final pixel-perfect landing lands in Unit 4.
 */
export default function LandingPage() {
  return (
    <main className="min-h-screen bg-grid">
      <div className="max-w-4xl mx-auto px-6 pt-32 pb-20 text-center">
        <div className="inline-flex items-center gap-2 mb-6">
          <div className="w-5 h-5 bg-black rounded-sm" aria-hidden />
          <span className="font-bold tracking-tight text-lg">Async Copilot</span>
        </div>

        <h1 className="text-5xl md:text-6xl lg:text-hero-lg font-semibold tracking-tight text-gray-950 mb-6">
          From support case to ready reply.
        </h1>

        <p className="text-lg md:text-xl text-gray-600 mb-10 max-w-2xl mx-auto">
          Visible staged triage for support teams under pressure. Messy case in,
          structured response pack out.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/app"
            className="inline-flex items-center justify-center px-5 py-3 text-sm font-medium text-white bg-black rounded hover:bg-gray-800 transition-colors shadow-sm"
          >
            Open App →
          </Link>
          <Link
            href="/api/health"
            className="inline-flex items-center justify-center px-5 py-3 text-sm font-medium text-gray-900 bg-white border border-gray-200 rounded hover:border-gray-400 transition-colors"
          >
            Health check
          </Link>
        </div>

        <p className="mt-16 font-mono text-xs uppercase tracking-wider text-gray-500">
          Unit 1 scaffold · Deployed via Vercel · Powered by Supabase
        </p>
      </div>
    </main>
  );
}
