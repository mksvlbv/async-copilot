/**
 * Hero workspace mockup — 3-column lockup (Case Context / Visible Triage / Response Pack).
 * Static visual element; mirrors the signature screen at smaller scale.
 */
import {
  SidebarSimple,
  Paperclip,
  Database,
  WarningCircle,
  Info,
  PaperPlaneTilt,
  Copy,
  PencilSimple,
} from "@phosphor-icons/react/dist/ssr";

export function HeroMockup() {
  return (
    <div className="max-w-[1200px] mx-auto mt-20 relative z-10">
      <div className="absolute -inset-1 bg-gray-200/50 rounded-xl blur-xl z-0" aria-hidden />
      <div className="relative z-10 bg-white border border-gray-200 rounded-xl shadow-2xl shadow-gray-200/50 overflow-hidden flex flex-col h-[640px]">
        {/* Window chrome */}
        <div className="h-12 border-b border-gray-100 bg-gray-50 flex items-center justify-between px-4 select-none">
          <div className="flex gap-2 items-center">
            <div className="w-3 h-3 rounded-full bg-gray-300" />
            <div className="w-3 h-3 rounded-full bg-gray-300" />
            <div className="w-3 h-3 rounded-full bg-gray-300" />
          </div>
          <div className="font-mono text-[11px] text-gray-400 tracking-wider">WORKSPACE / CASE-8924</div>
          <div className="flex gap-2">
            <SidebarSimple size={16} className="text-gray-400" />
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden bg-gray-50/30">
          {/* ---- Left: Case Context ---- */}
          <div className="w-[30%] border-r border-gray-200 bg-white flex flex-col">
            <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <span className="text-[11px] font-mono font-medium text-gray-500 uppercase tracking-widest">Case Context</span>
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">Raw</span>
            </div>
            <div className="p-5 overflow-y-auto mockup-scroll space-y-5">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">API Timeout on /v2/orders</h3>
                <div className="flex gap-2 mt-1">
                  <span className="text-[11px] text-gray-500">Acme Corp</span>
                  <span className="text-[11px] text-gray-300">•</span>
                  <span className="text-[11px] text-gray-500">2 mins ago</span>
                </div>
              </div>
              <div className="space-y-4">
                <div className="p-4 bg-gray-50 border border-gray-100 rounded-md">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-5 h-5 rounded bg-gray-200 flex items-center justify-center text-[10px] font-medium text-gray-600">J</div>
                    <span className="text-xs font-medium">Jane Doe</span>
                  </div>
                  <p className="text-xs text-gray-700 leading-relaxed font-sans">
                    Hi Support,
                    <br />
                    <br />
                    We are seeing persistent 504 timeouts when calling the /v2/orders endpoint since 10:00 AM PST. This is blocking our checkout flow.
                    <br />
                    <br />
                    Trace ID: req_98xZ2pL1
                    <br />
                    Please advise urgently.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-400 font-mono">
                  <Paperclip size={14} /> 1 attachment (logs.txt)
                </div>
              </div>
            </div>
          </div>

          {/* ---- Center: Visible Triage ---- */}
          <div className="w-[35%] border-r border-gray-200 bg-gray-50/50 flex flex-col relative">
            <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center bg-white">
              <span className="text-[11px] font-mono font-medium text-gray-500 uppercase tracking-widest">Visible Triage</span>
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-black opacity-20" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-black" />
                </span>
                <span className="text-[10px] font-mono text-gray-900">PROCESSING</span>
              </div>
            </div>
            <div className="p-6 overflow-y-auto mockup-scroll">
              <div className="relative border-l border-gray-300 ml-3 space-y-8 pb-4">
                {/* Stage 1 */}
                <div className="relative pl-6">
                  <div className="absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full bg-gray-300 ring-4 ring-gray-50" />
                  <div className="text-xs font-mono font-medium text-gray-900 mb-1">Parse Intent &amp; Entities</div>
                  <div className="bg-white border border-gray-200 rounded p-2.5 shadow-sm">
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div className="text-gray-500">Issue:</div>
                      <div className="font-medium text-gray-900">504 Gateway Timeout</div>
                      <div className="text-gray-500">Endpoint:</div>
                      <div className="font-mono text-gray-900 bg-gray-100 px-1 rounded inline-block">/v2/orders</div>
                      <div className="text-gray-500">Urgency:</div>
                      <div className="text-red-600 font-medium">High (Checkout Blocked)</div>
                    </div>
                  </div>
                </div>
                {/* Stage 2 */}
                <div className="relative pl-6">
                  <div className="absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full bg-gray-300 ring-4 ring-gray-50" />
                  <div className="text-xs font-mono font-medium text-gray-900 mb-1">Query Internal State</div>
                  <div className="bg-white border border-gray-200 rounded p-2.5 shadow-sm space-y-2">
                    <div className="flex items-center gap-2 text-[11px] text-gray-600">
                      <Database size={12} /> Checking system status...
                    </div>
                    <div className="flex items-center justify-between text-[11px] bg-yellow-50 border border-yellow-100 text-yellow-800 p-1.5 rounded">
                      <span className="flex items-center gap-1">
                        <WarningCircle size={12} /> INC-1042 Active
                      </span>
                      <a href="#" className="underline">View Status</a>
                    </div>
                  </div>
                </div>
                {/* Stage 3 (active) */}
                <div className="relative pl-6">
                  <div className="absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full bg-black ring-4 ring-gray-50" />
                  <div className="text-xs font-mono font-medium text-gray-900 mb-1">Formulate Strategy</div>
                  <div className="text-[11px] text-gray-500 leading-relaxed">
                    Drafting acknowledgment of known incident. Linking to status page. Setting expectation for updates.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ---- Right: Response Pack ---- */}
          <div className="w-[35%] bg-white flex flex-col">
            <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <span className="text-[11px] font-mono font-medium text-gray-500 uppercase tracking-widest">Response Pack</span>
              <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded border border-green-200">Ready</span>
            </div>
            <div className="p-5 overflow-y-auto mockup-scroll flex flex-col gap-4">
              {/* Internal summary */}
              <div className="border border-gray-200 rounded-md overflow-hidden shadow-sm">
                <div className="bg-gray-50 border-b border-gray-200 px-3 py-2 flex items-center gap-2">
                  <Info size={14} className="text-gray-500" />
                  <span className="text-[10px] font-mono uppercase text-gray-600">Internal Summary</span>
                </div>
                <div className="p-3 text-xs text-gray-800 leading-relaxed">
                  Customer is blocked by active database migration incident (
                  <span className="font-mono text-[10px] bg-gray-100 px-1">INC-1042</span>
                  ). Engineering ETA is 30 mins. No workarounds available for /v2/orders.
                </div>
              </div>

              {/* Draft reply */}
              <div className="border border-gray-200 rounded-md overflow-hidden shadow-sm flex-1 flex flex-col">
                <div className="bg-gray-50 border-b border-gray-200 px-3 py-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <PaperPlaneTilt size={14} className="text-gray-500" />
                    <span className="text-[10px] font-mono uppercase text-gray-600">Draft Reply</span>
                  </div>
                  <div className="flex gap-1">
                    <button className="p-1 hover:bg-gray-200 rounded text-gray-500" aria-label="Copy">
                      <Copy size={14} />
                    </button>
                    <button className="p-1 hover:bg-gray-200 rounded text-gray-500" aria-label="Edit">
                      <PencilSimple size={14} />
                    </button>
                  </div>
                </div>
                <div className="p-4 text-sm text-gray-700 leading-relaxed font-sans whitespace-pre-line flex-1 bg-white">{`Hi Jane,

Thanks for reaching out and providing the trace ID.

We are currently investigating a known issue affecting the \`/v2/orders\` endpoint across all regions, which is causing the 504 timeouts you are seeing.

Our engineering team is actively working on a fix. You can follow real-time updates on our status page here: status.acme.com.

I will keep this ticket open and notify you personally as soon as we see recovery.

Best,
Support Team`}</div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button className="flex-1 bg-black text-white text-xs font-medium py-2 rounded shadow-sm hover:bg-gray-800 transition-colors">
                  Send &amp; Pending
                </button>
                <button className="px-3 bg-white border border-gray-300 text-gray-700 text-xs font-medium rounded shadow-sm hover:bg-gray-50 transition-colors">
                  Escalate
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
