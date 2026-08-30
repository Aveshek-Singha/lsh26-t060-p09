import type { Metadata } from "next";
import { Archivo, IBM_Plex_Mono } from "next/font/google";

import { SiteHeader } from "@/features/shell/SiteHeader";
import "./globals.css";

const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-archivo",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Service Register — vehicle service due predictor",
  description:
    "Works out what is due on every vehicle in the workshop and who to call today.",
};

/**
 * Applies the stored theme before first paint.
 *
 * Without this the page renders in the default theme and then snaps to the
 * chosen one on hydration, which is the most visible polish bug a themed app
 * can ship. Kept tiny and inline; a failure here must never block rendering.
 */
const themeScript = `
(function () {
  try {
    var stored = localStorage.getItem("theme");
    var dark = stored ? stored === "dark"
      : window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.classList.toggle("dark", dark);
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${archivo.variable} ${plexMono.variable} min-h-screen`}>
        <SiteHeader />
        <main className="mx-auto w-full max-w-6xl px-4 pb-20 sm:px-6">{children}</main>
      </body>
    </html>
  );
}
