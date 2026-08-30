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
    // Light is the product's default. Dark is opt-in and remembered, rather
    // than following the operating system: a workshop screen in daylight
    // should not open dark because someone's laptop is set that way.
    document.documentElement.classList.toggle(
      "dark",
      localStorage.getItem("theme") === "dark",
    );
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
