"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Buildings, CircleNotch } from "@phosphor-icons/react/dist/ssr";

export default function OnboardingPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, slug }),
      });

      const body = (await response.json()) as {
        error?: string;
        workspace?: { slug: string };
      };

      if (!response.ok || !body.workspace) {
        throw new Error(body.error ?? "Workspace creation failed");
      }

      router.replace(`/app/w/${body.workspace.slug}` as never);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Workspace creation failed");
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-3xl items-center px-4 py-8 sm:px-8 sm:py-12">
      <div className="w-full rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-8">
        <div className="mb-6">
          <div className="mb-2 font-mono text-[11px] uppercase tracking-widest text-gray-500">
            Workspace Bootstrap
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
            Create your first triage workspace.
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-gray-500">
            Milestone 3 introduces explicit workspaces and role-based approval boundaries. Start by creating the workspace that will own cases, runs, and event history.
          </p>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-mono uppercase tracking-widest text-gray-500">
              Workspace Name
            </span>
            <div className="relative">
              <Buildings size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Acme Support Ops"
                required
                className="w-full rounded-md border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 shadow-sm outline-none transition-all placeholder:text-gray-400 focus:border-black focus:ring-1 focus:ring-black"
              />
            </div>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[11px] font-mono uppercase tracking-widest text-gray-500">
              Workspace Slug
            </span>
            <input
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
              placeholder="acme-support-ops"
              className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none transition-all placeholder:text-gray-400 focus:border-black focus:ring-1 focus:ring-black"
            />
            <div className="mt-1 text-xs text-gray-400">
              Optional. Leave blank to derive it from the workspace name.
            </div>
          </label>

          {error ? <div className="text-sm text-red-600">{error}</div> : null}

          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-gray-950 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-900 disabled:cursor-not-allowed disabled:bg-gray-300 sm:w-auto"
          >
            {loading ? (
              <>
                <CircleNotch size={14} className="animate-spin" /> Creating workspace...
              </>
            ) : (
              <>
                Create Workspace <ArrowRight size={14} />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
