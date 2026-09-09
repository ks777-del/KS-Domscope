import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "DOMScope — Inspect the anatomy of any website",
  description: "DOMScope analyzes the real HTML, DOM structure, links, assets, scripts, SEO, accessibility signals and technologies of any public website.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-full bg-bg text-fg antialiased">{children}</body>
    </html>
  );
}
