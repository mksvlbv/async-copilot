/**
 * Landing page — Unit 4 port of docs/design/variant-exports/01-landing
 * Plan-mandated fixes applied:
 *  - "Messy context in" → "Messy case in"
 *  - Removed "Integrates seamlessly with Zendesk, Intercom, and Jira" (R21)
 *  - "Start Workspace Trial" → "Open Demo"
 *  - "Talk to Sales" → "Contact"
 *  - Removed `Sign In` link from header (R21, no auth)
 *  - Year 2024 → 2026
 */
import Link from "next/link";
import {
  ArrowRight,
  TrayArrowDown,
  GitMerge,
  Package,
  FileMagnifyingGlass,
  Warning,
  ArrowElbowUpRight,
  CheckCircle,
  BookOpen,
  Ticket,
} from "@phosphor-icons/react/dist/ssr";
import { HeroMockup } from "./_sections/hero-mockup";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      <LandingHeader />
      <LandingHero />
      <HowItWorks />
      <SystemTrust />
      <ResponsePackShowcase />
      <ClosingCta />
      <LandingFooter />
    </main>
  );
}

function LandingHeader() {
  return (
    <header className="fixed top-0 w-full z-50 bg-white/90 backdrop-blur-sm border-b border-gray-200 transition-all duration-200">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-5 h-5 bg-black rounded-sm" aria-hidden />
          <span className="font-bold tracking-tight text-lg">Async Copilot</span>
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          <a href="#how-it-works" className="text-sm font-medium text-gray-500 hover:text-black transition-colors">
            How it Works
          </a>
          <a href="#system-trust" className="text-sm font-medium text-gray-500 hover:text-black transition-colors">
            System Trust
          </a>
          <a href="#output" className="text-sm font-medium text-gray-500 hover:text-black transition-colors">
            Output
          </a>
        </nav>

        <div className="flex items-center gap-4">
          <Link
            href="/app"
            className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-black rounded hover:bg-gray-800 transition-colors shadow-sm"
          >
            Open App
          </Link>
        </div>
      </div>
    </header>
  );
}

function LandingHero() {
  return (
    <section className="pt-32 pb-20 px-6 relative overflow-hidden bg-grid">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent to-gray-50" aria-hidden />
      <div className="max-w-4xl mx-auto text-center relative z-10">
        <h1 className="text-5xl md:text-6xl lg:text-hero-lg font-semibold tracking-tight leading-[1.1] text-gray-950 mb-6">
          From support case to <br className="hidden md:block" /> ready reply.
        </h1>
        <p className="text-lg md:text-xl text-gray-500 max-w-2xl mx-auto mb-10 leading-relaxed font-light">
          Visible staged triage for support teams under pressure. <br className="hidden md:block" />
          Messy case in, structured response pack out.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/app"
            className="w-full sm:w-auto px-6 py-3 text-sm font-medium text-white bg-black rounded shadow-sm hover:bg-gray-800 transition-all flex items-center justify-center gap-2"
          >
            Open App <ArrowRight size={14} weight="bold" />
          </Link>
          <Link
            href="/app"
            className="w-full sm:w-auto px-6 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded shadow-sm hover:bg-gray-50 hover:border-gray-400 transition-all"
          >
            View Demo Case
          </Link>
        </div>
      </div>
      <HeroMockup />
    </section>
  );
}

function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 bg-white border-y border-gray-200">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-semibold tracking-tight text-gray-900">
            A clear, deterministic pipeline.
          </h2>
          <p className="text-gray-500 mt-3 text-lg">
            No black boxes. Just a visible workflow built for specialists.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12 relative">
          <div className="hidden md:block absolute top-6 left-[15%] right-[15%] h-[1px] bg-gray-200 z-0" aria-hidden />

          <Step n="01" dark={false} icon={<TrayArrowDown size={32} weight="regular" />} title="Case In" copy="Ingests messy, unstructured customer inquiries, error logs, and thread history without requiring manual cleanup." />
          <Step n="02" dark={false} icon={<GitMerge size={32} weight="regular" />} title="Visible Triage" copy="Watches the system parse intent, query internal documentation, and formulate a strategy step-by-step." />
          <Step n="03" dark icon={<Package size={32} weight="regular" className="text-gray-300" />} title="Response Pack Out" copy="Delivers a complete asset bundle: situational summary, drafted reply, cited sources, and recommended next actions." />
        </div>
      </div>
    </section>
  );
}

function Step({ n, dark, icon, title, copy }: { n: string; dark: boolean; icon: React.ReactNode; title: string; copy: string }) {
  return (
    <div className="relative z-10 flex flex-col items-center text-center group">
      <div
        className={
          dark
            ? "w-12 h-12 bg-black rounded-full flex items-center justify-center font-mono text-sm font-medium text-white mb-6 shadow-md"
            : "w-12 h-12 bg-white border border-gray-200 rounded-full flex items-center justify-center font-mono text-sm font-medium text-gray-900 mb-6 shadow-sm group-hover:border-black transition-colors"
        }
      >
        {n}
      </div>
      <div
        className={
          dark
            ? "p-4 bg-gray-900 rounded-lg border border-gray-800 mb-4 w-full flex items-center justify-center h-24 shadow-inner"
            : "p-4 bg-gray-50 rounded-lg border border-gray-100 mb-4 w-full flex items-center justify-center h-24 text-gray-400"
        }
      >
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-500 leading-relaxed">{copy}</p>
    </div>
  );
}

function SystemTrust() {
  return (
    <section id="system-trust" className="py-24 bg-gray-950 text-white dark-grid relative overflow-hidden">
      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-gray-800/20 via-gray-950 to-gray-950"
        aria-hidden
      />
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
          <div className="lg:col-span-4 flex flex-col justify-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/10 text-[11px] font-mono text-gray-300 w-fit mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400" /> SYSTEM TRUST
            </div>
            <h2 className="text-3xl lg:text-4xl font-semibold tracking-tight mb-4">
              Engineered for high-stakes environments.
            </h2>
            <p className="text-gray-400 text-lg leading-relaxed mb-8">
              AI shouldn&apos;t be a black box when revenue or reputation is on the line. Every output is verifiable, bounded, and safe.
            </p>
          </div>

          <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TrustCard icon={<FileMagnifyingGlass size={20} className="text-gray-200" />} title="Inspectable Evidence" copy="Every claim in a generated draft is linked directly to internal knowledge base articles or past resolved tickets." />
            <TrustCard icon={<Warning size={20} className="text-yellow-400" />} title="Low-Confidence Warnings" copy="If the system cannot find a deterministic answer, it flags the draft as low confidence rather than hallucinating." />

            <div className="bg-white/5 border border-white/10 rounded-xl p-6 hover:bg-white/10 transition-colors sm:col-span-2">
              <div className="w-10 h-10 rounded bg-white/10 flex items-center justify-center mb-4">
                <ArrowElbowUpRight size={20} className="text-gray-200" />
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h4 className="text-base font-semibold mb-2">Escalation Guidance</h4>
                  <p className="text-sm text-gray-400 leading-relaxed max-w-xl">
                    When issues exceed Tier 1 scope, the system automatically packages the context and suggests the correct engineering queue.
                  </p>
                </div>
                <div className="shrink-0 bg-black/50 border border-white/10 rounded p-3 font-mono text-[10px] text-gray-300">
                  <div className="text-red-400 mb-1">STATUS: OUT_OF_SCOPE</div>
                  <div>ACTION: ESCALATE_TIER_2</div>
                  <div>QUEUE: /eng/payments</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function TrustCard({ icon, title, copy }: { icon: React.ReactNode; title: string; copy: string }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-6 hover:bg-white/10 transition-colors">
      <div className="w-10 h-10 rounded bg-white/10 flex items-center justify-center mb-4">{icon}</div>
      <h4 className="text-base font-semibold mb-2">{title}</h4>
      <p className="text-sm text-gray-400 leading-relaxed">{copy}</p>
    </div>
  );
}

function ResponsePackShowcase() {
  return (
    <section id="output" className="py-24 bg-gray-50 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Left: copy */}
          <div>
            <h2 className="text-3xl lg:text-4xl font-semibold tracking-tight text-gray-900 mb-6">
              The Response Pack.
            </h2>
            <p className="text-lg text-gray-500 mb-8 leading-relaxed">
              Don&apos;t just get a generated text blob. Get a complete, structured asset designed to give the support agent immediate situational awareness and a ready-to-send resolution.
            </p>

            <ul className="space-y-6">
              <Bullet title="Actionable Summary" copy="A TL;DR of the technical state without the fluff." />
              <Bullet title="Tone-Matched Draft" copy="Replies formatted to your company's exact voice guidelines." />
              <Bullet title="Deterministic Next Steps" copy="Clear buttons to send, close, or escalate based on policy." />
            </ul>
          </div>

          {/* Right: floating response pack card */}
          <div className="relative">
            <div className="absolute -top-6 -right-6 w-32 h-32 bg-gray-200 rounded-full blur-3xl opacity-50" aria-hidden />
            <div className="bg-white border border-gray-200 rounded-xl shadow-xl p-6 relative z-10 transform lg:rotate-1 hover:rotate-0 transition-transform duration-300">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <div className="text-[10px] font-mono text-gray-400 uppercase tracking-wider mb-1">Generated Asset</div>
                  <h4 className="font-semibold text-gray-900">Resolution Payload</h4>
                </div>
                <div className="bg-gray-50 border border-gray-200 px-2 py-1 rounded text-[10px] font-mono text-gray-600 flex gap-2">
                  <span>CONFIDENCE:</span>
                  <span className="text-green-600 font-bold">98%</span>
                </div>
              </div>

              <div className="space-y-4">
                <div className="p-3 bg-gray-50 rounded border border-gray-100">
                  <div className="text-[10px] font-mono text-gray-500 uppercase mb-2">Sources Cited</div>
                  <div className="flex gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-gray-200 rounded text-[10px] text-gray-600">
                      <BookOpen size={12} /> Doc: Resetting 2FA
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-gray-200 rounded text-[10px] text-gray-600">
                      <Ticket size={12} /> Ticket #7721
                    </span>
                  </div>
                </div>

                <div className="border border-gray-200 rounded overflow-hidden">
                  <div className="bg-gray-50 px-3 py-2 border-b border-gray-200 text-[10px] font-mono text-gray-500 uppercase">
                    Approved Draft
                  </div>
                  <div className="p-4 text-sm text-gray-800 font-sans leading-relaxed">
                    Hello,
                    <br />
                    <br />
                    I can help you reset your two-factor authentication. Since you no longer have access to your backup codes, I have sent a secure verification link to the secondary email on file (m***@domain.com).
                    <br />
                    <br />
                    Please click that link to reset your 2FA device.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Bullet({ title, copy }: { title: string; copy: string }) {
  return (
    <li className="flex gap-4">
      <div className="mt-1">
        <CheckCircle size={20} weight="fill" className="text-gray-900" />
      </div>
      <div>
        <h5 className="font-semibold text-gray-900 text-sm">{title}</h5>
        <p className="text-sm text-gray-500 mt-1">{copy}</p>
      </div>
    </li>
  );
}

function ClosingCta() {
  return (
    <section className="py-32 bg-white text-center border-t border-gray-200">
      <div className="max-w-3xl mx-auto px-6">
        <h2 className="text-4xl font-semibold tracking-tight text-gray-900 mb-6">
          Stop managing chaos. Start managing outcomes.
        </h2>
        <p className="text-lg text-gray-500 mb-10">
          A focused demo — open the workspace, pick a scenario, and watch the triage work.
        </p>
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <Link
            href="/app"
            className="px-8 py-4 text-sm font-medium text-white bg-black rounded shadow-md hover:bg-gray-800 transition-transform hover:-translate-y-0.5"
          >
            Open Demo
          </Link>
          <a
            href="mailto:hello@example.com"
            className="px-8 py-4 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded shadow-sm hover:bg-gray-50 transition-colors"
          >
            Contact
          </a>
        </div>
      </div>
    </section>
  );
}

function LandingFooter() {
  return (
    <footer className="bg-gray-50 py-12 border-t border-gray-200">
      <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-gray-400 rounded-sm" aria-hidden />
          <span className="font-semibold text-sm text-gray-600">Async Copilot</span>
        </div>
        <div className="flex gap-6 text-sm text-gray-500">
          <a href="#" className="hover:text-gray-900 transition-colors">Security</a>
          <a href="#" className="hover:text-gray-900 transition-colors">Privacy</a>
          <a href="#" className="hover:text-gray-900 transition-colors">Terms</a>
          <a href="#" className="hover:text-gray-900 transition-colors">Documentation</a>
        </div>
        <div className="text-sm text-gray-400">© 2026 Async Copilot Inc.</div>
      </div>
    </footer>
  );
}
