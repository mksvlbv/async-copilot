"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { EmailOtpType } from "@supabase/supabase-js";
import { CircleNotch } from "@phosphor-icons/react/dist/ssr";
import { createClient } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<AuthCallbackFallback />}>
      <AuthCallbackResolver />
    </Suspense>
  );
}

function AuthCallbackResolver() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function resolveSession() {
      const supabase = createClient();
      const next = sanitizeNext(searchParams.get("next"));
      const code = searchParams.get("code");
      const tokenHash = searchParams.get("token_hash");
      const type = searchParams.get("type") as EmailOtpType | null;

      try {
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            throw exchangeError;
          }
        } else if (tokenHash && type) {
          const { error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type,
          });
          if (verifyError) {
            throw verifyError;
          }
        } else {
          const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
          const accessToken = hashParams.get("access_token");
          const refreshToken = hashParams.get("refresh_token");

          if (accessToken && refreshToken) {
            const { error: setError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            if (setError) {
              throw setError;
            }
          }
        }

        if (!cancelled) {
          router.replace(next as never);
          router.refresh();
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Authentication callback failed");
        }
      }
    }

    resolveSession();

    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  if (error) {
    return (
      <main className="min-h-screen bg-gray-50 px-6 py-16 flex items-center justify-center">
        <div className="w-full max-w-md rounded-xl border border-red-200 bg-white p-6 shadow-sm">
          <div className="font-mono text-[11px] uppercase tracking-widest text-red-600">
            Auth Error
          </div>
          <h1 className="mt-3 text-xl font-semibold tracking-tight text-gray-900">
            Sign-in could not be completed.
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-gray-500">{error}</p>
          <button
            type="button"
            onClick={() => router.replace("/login")}
            className="mt-5 inline-flex items-center justify-center rounded-md bg-gray-950 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-900"
          >
            Return to Login
          </button>
        </div>
      </main>
    );
  }

  return <AuthCallbackFallback />;
}

function AuthCallbackFallback() {
  return (
    <main className="min-h-screen bg-gray-50 px-6 py-16 flex items-center justify-center">
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-sm text-center">
        <div className="font-mono text-[11px] uppercase tracking-widest text-gray-500">
          Completing Sign-in
        </div>
        <div className="mt-4 flex items-center justify-center text-gray-500">
          <CircleNotch size={22} className="animate-spin" />
        </div>
      </div>
    </main>
  );
}

function sanitizeNext(next: string | null) {
  if (!next || !next.startsWith("/")) {
    return "/app";
  }

  return next;
}
