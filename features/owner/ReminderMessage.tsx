"use client";

import { useState } from "react";

/**
 * A message the workshop can paste straight into SMS or WhatsApp.
 *
 * Built on the server from the same assessments that drive the call list, so
 * the figures quoted to the customer are the ones on screen.
 */
export function ReminderMessage({ message }: { message: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (insecure context or denied permission). The text is
      // selectable on screen, so the user can still copy it manually.
      setCopied(false);
    }
  }

  return (
    <div className="rounded border border-line bg-surface">
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <h2 className="text-sm font-semibold text-hi">Reminder message</h2>
        <button
          type="button"
          onClick={copy}
          className="rounded border border-line bg-raised px-2.5 py-1 text-xs font-medium text-hi transition-colors hover:border-accent hover:text-accent"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="max-h-80 overflow-auto whitespace-pre-wrap px-4 py-3 text-xs leading-relaxed text-mid">
        {message}
      </pre>
      <p role="status" className="sr-only">
        {copied ? "Message copied to clipboard" : ""}
      </p>
    </div>
  );
}
