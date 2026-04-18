import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://async-copilot.vercel.app"),
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
    url: "https://async-copilot.vercel.app",
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
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
