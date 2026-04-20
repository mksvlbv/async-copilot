import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
};

export default withSentryConfig(nextConfig, {
  // Suppress build logs unless debugging
  silent: true,
});
