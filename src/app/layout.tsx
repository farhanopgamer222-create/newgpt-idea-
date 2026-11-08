import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
export const metadata: Metadata = {
  title: "FarhanGPT — A little curiosity. Endless possibilities.",
  description: "Your personal AI companion for big ideas and everyday questions. Write, build, learn, and explore with FarhanGPT.",
  applicationName: "FarhanGPT",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "FarhanGPT" },
  icons: { icon: "/icon.svg", apple: "/icons/icon-192.png" },
  manifest: "/manifest.webmanifest",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0b0b10" };
export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en" suppressHydrationWarning><body>{children}</body></html>;
}
