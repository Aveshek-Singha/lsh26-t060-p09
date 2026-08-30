"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { markCalledAction } from "@/actions/workshop";
import type { ActionResult } from "@/actions/types";

/**
 * Opens Gmail's compose window with the reminder already written.
 *
 * Gmail opens a *draft*: recipient, subject and body are filled in, and the
 * operator reads it and presses Send themselves. Nothing leaves automatically —
 * a workshop should see what is going to its customer before it goes.
 *
 * Not a server-side send: the event supplied no mail credential, and the seeded
 * addresses sit on the reserved example.com domain, so an automatic send could
 * only bounce. Composing in the operator's own account also means replies come
 * back to them.
 *
 * A real link rather than `window.open`, so the browser opens the tab itself —
 * no pop-up blocker to negotiate. The click also submits the surrounding form,
 * which logs the owner as contacted so the call list and the called section
 * agree about who has been reached today.
 */
export function MailButton({
  ownerId,
  email,
  gmailHref,
  truncated,
  compact = false,
}: {
  ownerId: string;
  email: string | undefined;
  gmailHref: string;
  truncated: boolean;
  compact?: boolean;
}) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    markCalledAction,
    null,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  if (!email) {
    return (
      <span className={`text-low ${compact ? "text-[0.875rem]" : "text-xs"}`}>
        No email on file
      </span>
    );
  }

  return (
    <form ref={formRef} action={formAction} className="no-print inline-flex items-center gap-2">
      <input type="hidden" name="ownerId" value={ownerId} />
      <input type="hidden" name="called" value="yes" />

      <a
        href={gmailHref}
        target="_blank"
        rel="noopener noreferrer"
        title={`Compose a reminder to ${email} — opens a Gmail draft, does not send`}
        onClick={() => formRef.current?.requestSubmit()}
        className={
          compact
            ? "inline-flex min-h-7 items-center rounded border border-line px-2.5 py-1 text-[0.875rem] font-medium text-mid transition-colors hover:border-accent hover:text-accent"
            : "inline-flex min-h-8 items-center rounded border border-line bg-raised px-3 py-1.5 text-xs font-medium text-hi transition-colors hover:border-accent hover:text-accent"
        }
      >
        {pending ? "Opening..." : "Email reminder"}
      </a>

      {truncated && (
        <span
          className={`text-low ${compact ? "text-[0.875rem]" : "text-xs"}`}
          title="Shortened to stay inside the mail client's URL length limit"
        >
          shortened
        </span>
      )}

      {state && !state.ok && (
        <span role="alert" className="enter-fade text-[0.875rem] text-overdue">
          {state.message}
        </span>
      )}
    </form>
  );
}
