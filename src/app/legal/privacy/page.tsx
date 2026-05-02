/**
 * Minimal privacy/legal page for a portfolio-demo app.
 * Honest language: this is not a real commercial product, no personal data
 * is collected beyond what is necessary to run the demo. Linked from the
 * landing footer.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";

export const metadata: Metadata = {
  title: "Privacy — Async Copilot",
  description:
    "Privacy notice for the Async Copilot portfolio demo. No marketing tracking, no personal data retention beyond demo operation.",
};

export default function PrivacyPage() {
  const updated = "April 18, 2026";
  const repoIssuesUrl = "https://github.com/mksvlbv/async-copilot/issues/new";

  return (
    <main className="min-h-screen bg-gray-50 bg-grid">
      <div className="max-w-3xl mx-auto px-4 py-10 sm:px-6 sm:py-16">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mb-10 transition-colors"
        >
          <ArrowLeft size={14} weight="bold" /> Back to landing
        </Link>

        <div className="inline-flex flex-wrap items-center gap-2 mb-6">
          <span className="px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200 rounded">
            Portfolio demo
          </span>
          <span className="text-xs text-gray-400 font-mono">Updated {updated}</span>
        </div>

        <h1 className="text-2xl font-semibold tracking-tight text-gray-900 mb-6 sm:text-3xl">
          Privacy Notice
        </h1>

        <div className="prose prose-gray max-w-none text-gray-700 space-y-6">
          <p className="text-base text-gray-600 leading-relaxed sm:text-lg">
            <strong>Async Copilot</strong> is a non-commercial portfolio
            demonstration of a visible, human-in-the-loop support-triage
            workflow. It is not offered as a product, and there is no user
            account, subscription, or customer support.
          </p>

          <Section title="What is collected">
            <p>
              The demo accepts short text inputs (customer name, case
              description, optional reported urgency) that you voluntarily
              paste or type into the intake form. Those inputs are stored in
              a Supabase project owned by the author, associated with the
              generated case and run records, for the sole purpose of
              rendering the triage pipeline back to you in real time.
            </p>
            <p>
              Pre-loaded sample cases contain fabricated customer names. Any
              real names or identifiers you paste into the demo will be
              visible to anyone with the run URL. <strong>Do not paste
              sensitive data into this demo.</strong>
            </p>
          </Section>

          <Section title="What is not collected">
            <ul className="list-disc pl-6 space-y-1.5">
              <li>No analytics or tracking pixels.</li>
              <li>No third-party advertising SDKs.</li>
              <li>No login, no cookies beyond session essentials.</li>
              <li>No email addresses or phone numbers are requested or stored.</li>
            </ul>
          </Section>

          <Section title="Third parties and processors">
            <p>
              Case and run data are stored in a Supabase project controlled by
              the author so the demo can render saved runs, samples, and
              response packs.
            </p>
            <p>
              When real AI inference is enabled, the demo sends case text to
              Groq&apos;s API to generate staged triage output. If no valid
              `GROQ_API_KEY` is configured, the demo falls back to synthetic
              stage output and no model provider receives your input.
            </p>
            <p>
              When a Slack webhook is configured, approving a response pack can
              send a short run summary to Slack. In dry-run mode, that
              dispatch is simulated and no Slack message is sent.
            </p>
            <p>
              No advertising networks, analytics vendors, or marketing pixels
              receive your inputs.
            </p>
          </Section>

          <Section title="Data retention & deletion">
            <p>
              Runs and cases are retained indefinitely for demo continuity.
              If you want a record removed, open an issue on the project&apos;s{" "}
              <a
                href={repoIssuesUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-900 underline underline-offset-4 hover:text-gray-700"
              >
                GitHub issue tracker
              </a>{" "}
              and include the run ID.
            </p>
          </Section>

          <Section title="Jurisdiction">
            <p>
              This demo is operated by an individual, not a company. It is
              not a contract, not a service-level agreement, and not a
              commitment of any kind. Use it as a reference implementation.
            </p>
          </Section>
        </div>

        <div className="mt-16 pt-8 border-t border-gray-200">
          <Link
            href="/"
            className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
          >
            ← Back to landing
          </Link>
        </div>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-base font-semibold tracking-tight text-gray-900 mt-8 mb-3">
        {title}
      </h2>
      <div className="text-sm leading-relaxed text-gray-700 space-y-3">
        {children}
      </div>
    </section>
  );
}
