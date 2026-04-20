import type { StagedAction } from "@/lib/supabase/types";
import { retry } from "@/lib/retry";

export const SLACK_ACTION_INTENT = "slack.notify";

export type SlackDispatchResult = {
  ok: boolean;
  status: Extract<StagedAction["status"], "executed" | "dry_run" | "failed">;
  detail: string;
  target: string | null;
  last_attempt_at: string;
};

type SlackApprovalPayload = {
  runId: string;
  runState: string;
  confidence: number;
  urgency: string | null;
  caseRef: string;
  caseTitle: string;
  recommendation: string | null;
  escalationQueue: string | null;
  runUrl: string;
};

function slackDryRunEnabled() {
  return process.env.SLACK_WEBHOOK_DRY_RUN !== "false";
}

export function ensureSlackDispatchAction(
  actions: StagedAction[],
  escalationQueue: string | null,
) {
  if (actions.some((action) => action.intent === SLACK_ACTION_INTENT)) {
    return actions;
  }

  return [
    ...actions,
    {
      label: escalationQueue
        ? "Send escalation summary to Slack"
        : "Send approved run summary to Slack",
      intent: SLACK_ACTION_INTENT,
      status: "queued" as const,
      requires_approval: true,
      detail: escalationQueue
        ? "Dispatch a Tier-2 summary to Slack after human approval."
        : "Dispatch the approved run summary to Slack after human approval.",
      target: "Slack webhook",
      last_attempt_at: null,
    },
  ];
}

export async function dispatchApprovedRunToSlack(
   payload: SlackApprovalPayload,
 ): Promise<SlackDispatchResult> {
   const last_attempt_at = new Date().toISOString();
   const webhookUrl = process.env.SLACK_WEBHOOK_URL?.trim() || null;
   const dryRun = slackDryRunEnabled();

   if (!webhookUrl) {
     if (dryRun) {
       return {
         ok: true,
         status: "dry_run",
         detail:
           "Slack dispatch simulated because no SLACK_WEBHOOK_URL is configured. The approval boundary is still enforced.",
         target: "Slack webhook (simulated)",
         last_attempt_at,
       };
     }

     return {
       ok: false,
       status: "failed",
       detail: "Slack dispatch failed because SLACK_WEBHOOK_URL is not configured.",
       target: null,
       last_attempt_at,
     };
   }

   if (dryRun) {
     return {
       ok: true,
       status: "dry_run",
       detail:
         "Slack dispatch simulated in dry-run mode. Disable SLACK_WEBHOOK_DRY_RUN to send a real webhook.",
       target: "Slack webhook (dry-run)",
       last_attempt_at,
     };
   }

   const body = {
     text: `[Async Copilot] Approved ${payload.runState} run ${payload.caseRef} (${payload.confidence}% confidence)`,
     blocks: [
       {
         type: "section",
         text: {
           type: "mrkdwn",
           text:
             `*Async Copilot approval dispatched*\n` +
             `*Case:* ${payload.caseRef} — ${payload.caseTitle}\n` +
             `*State:* ${payload.runState} · *Confidence:* ${payload.confidence}% · *Urgency:* ${payload.urgency ?? "n/a"}`,
         },
       },
       payload.recommendation
         ? {
             type: "section",
             text: {
               type: "mrkdwn",
               text: `*Recommendation:* ${payload.recommendation}`,
             },
           }
         : null,
       payload.escalationQueue
         ? {
             type: "section",
             text: {
               type: "mrkdwn",
               text: `*Escalation queue:* ${payload.escalationQueue}`,
             },
           }
         : null,
       {
         type: "actions",
         elements: [
           {
             type: "button",
             text: {
               type: "plain_text",
               text: "Open run",
             },
             url: payload.runUrl,
           },
         ],
       },
     ].filter(Boolean),
   };

   try {
     const response = await retry(() => 
       fetch(webhookUrl, {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify(body),
       }),
     {
       maxAttempts: 3,
       baseDelay: 1000,
       maxDelay: 10000,
       // Retry on network errors or 5xx responses
       retryOn: (error: unknown) => {
         // If it's a fetch-related error or contains certain status codes, retry
         if (error instanceof Error) {
           return error.message.includes('fetch') || 
                  error.message.includes('NetworkError') ||
                  error.message.includes('500') ||
                  error.message.includes('502') ||
                  error.message.includes('503') ||
                  error.message.includes('504');
         }
         return false;
       }
     });

     if (!response.ok) {
       const text = await response.text();
       return {
         ok: false,
         status: "failed",
         detail: `Slack webhook returned ${response.status}. ${text || "No response body."}`,
         target: "Slack webhook",
         last_attempt_at,
       };
     }

     return {
       ok: true,
       status: "executed",
       detail: "Slack notification sent after human approval.",
       target: "Slack webhook",
       last_attempt_at,
     };
   } catch (err) {
     return {
       ok: false,
       status: "failed",
       detail:
         err instanceof Error
           ? `Slack dispatch failed after retries: ${err.message}`
           : "Slack dispatch failed with an unknown error after retries.",
       target: "Slack webhook",
       last_attempt_at,
     };
   }
 }
