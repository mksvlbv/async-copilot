/**
 * Groq AI client — wraps Vercel AI SDK with Groq provider.
 * Uses Llama 3.3 70B for real LLM inference on every triage stage.
 *
 * Falls back gracefully: if GROQ_API_KEY is missing, callers should
 * use the synthetic (regex-based) fallback in run-model.ts.
 */
import { createGroq } from "@ai-sdk/groq";

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY ?? "" });

/** Default model — Llama 3.3 70B on Groq (free tier). */
export const triageModel = groq("llama-3.3-70b-versatile");

/** Returns true when a valid Groq API key is configured. */
export function isAIEnabled(): boolean {
  const key = process.env.GROQ_API_KEY;
  return typeof key === "string" && key.length > 0 && key.startsWith("gsk_");
}
