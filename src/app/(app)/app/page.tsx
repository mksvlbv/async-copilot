import Link from "next/link";

/**
 * App intake — placeholder for Unit 1.
 * Real case intake form with sample picker lands in Unit 5.
 */
export default function AppIntakePage() {
  return (
    <main className="min-h-screen">
      <div className="max-w-6xl mx-auto px-6 py-20">
        <div className="flex items-center gap-2 mb-12">
          <div className="w-5 h-5 bg-black rounded-sm" aria-hidden />
          <span className="font-bold tracking-tight text-lg">Async Copilot</span>
          <span className="font-mono text-xs uppercase tracking-wider text-gray-500 ml-4">
            Workspace
          </span>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-8 shadow-sm">
          <span className="font-mono text-xs uppercase tracking-wider text-gray-500">
            New Case
          </span>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900 mt-2 mb-4">
            App scaffold placeholder
          </h1>
          <p className="text-gray-600 mb-6">
            The real intake form (paste ticket, pick a sample, submit) arrives
            in Unit 5. Right now this is just proof that the app shell renders.
          </p>
          <Link
            href="/"
            className="inline-flex items-center text-sm font-medium text-gray-900 hover:text-black"
          >
            ← Back to landing
          </Link>
        </div>
      </div>
    </main>
  );
}
