"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

import { markCalledAction } from "@/actions/workshop";
import type { ActionResult } from "@/actions/types";

/**
 * Marks an owner as rung for the working day.
 *
 * The list is a worklist, so it has to remember what has already been done —
 * otherwise the same person gets called twice on a busy morning. The flag is
 * stored against the working date, so advancing the date correctly brings
 * yesterday's calls back.
 */
export function CalledToggle({ ownerId, called }: { ownerId: string; called: boolean }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    markCalledAction,
    null,
  );
  const router = useRouter();

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  return (
    <form action={formAction} className="no-print">
      <input type="hidden" name="ownerId" value={ownerId} />
      <input type="hidden" name="called" value={called ? "no" : "yes"} />
      <button
        type="submit"
        disabled={pending}
        className={
          called
            ? "rounded border border-line px-2 py-1 text-[0.875rem] font-medium text-mid transition-colors hover:text-hi disabled:opacity-60"
            : "rounded border border-line bg-raised px-2 py-1 text-[0.875rem] font-medium text-hi transition-colors hover:border-accent hover:text-accent disabled:opacity-60"
        }
      >
        {pending ? "Saving…" : called ? "Undo" : "Mark called"}
      </button>
      {state && !state.ok && (
        <p role="alert" className="enter mt-1 text-[0.875rem] text-overdue">
          {state.message}
        </p>
      )}
    </form>
  );
}
