import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 bg-grid flex items-center justify-center px-4 py-10 sm:px-6">
      <div className="max-w-md w-full text-center">
        <div className="inline-flex items-center gap-2 mb-6">
          <div className="w-5 h-5 bg-gray-950 rounded-sm" aria-hidden />
          <span className="font-bold tracking-tight text-lg">Async Copilot</span>
        </div>
        <div className="font-mono text-[10px] uppercase tracking-widest text-gray-500 mb-3">
          404
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900 mb-3 sm:text-3xl">
          This run doesn&apos;t exist.
        </h1>
        <p className="text-sm text-gray-500 mb-8">
          The case or run you&apos;re looking for wasn&apos;t found. It might have been wiped by a seed reset,
          or the link is from a demo environment.
        </p>
        <div className="flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
          <Link
            href={"/app" as never}
            className="px-5 py-2.5 text-sm font-medium text-white bg-gray-950 rounded-md shadow-sm hover:bg-gray-900 transition-colors"
          >
            Open workspace
          </Link>
          <Link
            href={"/app/samples" as never}
            className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 transition-colors"
          >
            Browse samples
          </Link>
        </div>
      </div>
    </div>
  );
}
