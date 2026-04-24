"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight, CircleNotch, EnvelopeSimple } from "@phosphor-icons/react/dist/ssr";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const searchParams = useSearchParams();
  const next = searchParams?.get("next") ?? "/app";

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const callbackUrl = new URL("/auth/callback", window.location.origin);
      callbackUrl.searchParams.set("next", next.startsWith("/") ? next : "/app");

      const { error: signInError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: callbackUrl.toString(),
        },
      });

      if (signInError) {
        throw signInError;
      }

      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 bg-grid px-6 py-16 text-gray-900">
      <div className="mx-auto flex max-w-5xl flex-col gap-12 lg:flex-row lg:items-center lg:justify-between">
        <section className="max-w-xl">
          <div className="mb-5 inline-flex items-center gap-2">
            <div className="h-5 w-5 rounded-sm bg-gray-950" aria-hidden />
            <span className="text-lg font-bold tracking-tight">Async Copilot</span>
          </div>
          <div className="mb-4 font-mono text-[11px] uppercase tracking-widest text-gray-500">
            Workspace Access
          </div>
          <h1 className="text-4xl font-semibold tracking-tight text-gray-950">
            Sign in to the triage workspace.
          </h1>
          <p className="mt-4 max-w-lg text-base leading-relaxed text-gray-500">
            Async Copilot now uses authenticated workspaces with role-aware approval boundaries and tenant-scoped run history.
          </p>
        </section>

        <section className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Email magic link</h2>
            <p className="mt-1 text-sm text-gray-500">
              Enter your workspace email. We&apos;ll send a one-time sign-in link.
            </p>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-mono uppercase tracking-widest text-gray-500">
                Work Email
              </span>
              <div className="relative">
                <EnvelopeSimple size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  placeholder="you@company.com"
                  className="w-full rounded-md border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 shadow-sm outline-none transition-all placeholder:text-gray-400 focus:border-black focus:ring-1 focus:ring-black"
                />
              </div>
            </label>

            {error ? <div className="text-sm text-red-600">{error}</div> : null}
            {sent ? (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                Magic link sent. Open the email on this device to continue.
              </div>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-gray-950 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-900 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              {loading ? (
                <>
                  <CircleNotch size={14} className="animate-spin" /> Sending link...
                </>
              ) : (
                <>
                  Send Magic Link <ArrowRight size={14} />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-xs text-gray-400">
            Need context first? <Link href="/" className="text-gray-600 hover:text-gray-900 hover:underline">Return to overview</Link>.
          </div>
        </section>
      </div>
    </main>
  );
}
