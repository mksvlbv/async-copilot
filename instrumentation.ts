import * as Sentry from "@sentry/nextjs";

const sentryEnabled = Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN);

export async function register() {
  if (!sentryEnabled) return;

  if (process.env.NEXT_RUNTIME === "nodejs" || process.env.NEXT_RUNTIME === "edge") {
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      tracesSampleRate: 1.0,
      enabled: sentryEnabled,
    });
  }
}

export const onRequestError = Sentry.captureRequestError;
