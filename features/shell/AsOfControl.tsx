"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { updateAsOfDate } from "@/actions/workshop";
import type { ActionResult } from "@/actions/types";

/**
 * The date the whole application treats as "today".
 *
 * The dataset states that today is a field of the case, not the clock, so it is
 * stored and shown rather than assumed. It also makes the app demonstrable:
 * move the date forward and every distance-based estimate recalculates.
 */
export function AsOfControl({ asOfDate }: { asOfDate: string }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    updateAsOfDate,
    null,
  );
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  // revalidatePath in the action does not clear the client router cache in the
  // same request, so without this refresh the page keeps rendering stale dates.
  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex items-center gap-2"
      aria-label="Working date"
    >
      <label htmlFor="asOfDate" className="eyebrow hidden sm:block">
        As of
      </label>
      <input
        id="asOfDate"
        name="asOfDate"
        type="date"
        defaultValue={asOfDate}
        onChange={() => formRef.current?.requestSubmit()}
        disabled={pending}
        className="nums rounded border border-line bg-surface px-2 py-1.5 text-xs text-hi disabled:opacity-60"
      />
      {pending && (
        <span className="text-xs text-low" role="status">
          Recalculating…
        </span>
      )}
      {state && !state.ok && (
        <span className="text-xs text-overdue" role="alert">
          {state.message}
        </span>
      )}
    </form>
  );
}
