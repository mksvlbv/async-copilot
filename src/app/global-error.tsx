"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Async Copilot global error boundary:", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
        <div className="max-w-md w-full bg-white border border-gray-200 rounded-xl shadow-sm p-8 text-center">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-5 h-5 bg-gray-950 rounded-sm" aria-hidden />
            <span className="font-bold tracking-tight text-lg">Async Copilot</span>
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Something broke.</h1>
          <p className="text-sm text-gray-500 mb-6">
            The workspace hit an unexpected render error. You can retry below or go back home.
          </p>
          {error?.digest && (
            <p className="font-mono text-[10px] text-gray-400 mb-6">digest: {error.digest}</p>
          )}
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={reset}
              className="px-5 py-2.5 text-sm font-medium text-white bg-gray-950 rounded-md shadow-sm hover:bg-gray-900 transition-colors"
            >
              Try again
            </button>
            <Link
              href={"/" as never}
              className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 transition-colors"
            >
              Home
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}
