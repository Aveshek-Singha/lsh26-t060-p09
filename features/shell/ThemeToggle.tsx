"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

/**
 * Theme switch.
 *
 * The class is already on <html> before first paint (see the inline script in
 * the root layout); this only reads it back so the button shows the right
 * label, then writes both the class and localStorage on click.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.classList.toggle("dark", next === "dark");
    try {
      localStorage.setItem("theme", next);
    } catch {
      // Private browsing or blocked storage: the theme still applies for this
      // page view, it just will not be remembered.
    }
    setTheme(next);
  }

  // Render a stable placeholder until the theme is known, so the button does
  // not flicker between labels during hydration.
  const label = theme === null ? "Theme" : theme === "dark" ? "Dark" : "Light";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={
        theme === null ? "Switch theme" : `Switch to ${theme === "dark" ? "light" : "dark"} theme`
      }
      className="inline-flex items-center gap-2 rounded border border-line bg-surface px-2.5 py-1.5 text-xs font-medium text-mid transition-colors hover:border-line-strong hover:text-hi"
    >
      <span aria-hidden className="text-sm leading-none">
        {theme === "dark" ? "◐" : "◑"}
      </span>
      {label}
    </button>
  );
}
