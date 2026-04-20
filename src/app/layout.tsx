import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";

// Geist Sans — distinctive workspace sans-serif (avoids Inter overuse).
// Re-exported directly with its own variable class.

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-mono",
  display: "swap",
});

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
  "https://async-copilot.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Async Copilot — Support Triage",
    template: "%s · Async Copilot",
  },
  description:
    "Visible staged triage for support teams under pressure. Messy case in, structured response pack out.",
  keywords: [
    "support triage",
    "customer support",
    "ai copilot",
    "response pack",
    "help desk",
    "async workflow",
  ],
  authors: [{ name: "Async Copilot" }],
  openGraph: {
    type: "website",
    siteName: "Async Copilot",
    title: "Async Copilot — Support Triage",
    description:
      "Visible staged triage for support teams under pressure. Messy case in, structured response pack out.",
    url: SITE_URL,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Async Copilot — Support Triage",
    description:
      "Visible staged triage for support teams under pressure. Messy case in, structured response pack out.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${jetbrainsMono.variable}`}>
      <body>
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <main id="main-content">{children}</main>
      </body>
    </html>
  );
}
