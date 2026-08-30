"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { recordServiceAction } from "@/actions/workshop";
import type { ActionResult } from "@/actions/types";
import { addMonths } from "@/lib/domain/civilDate";
import type { DueAssessment, ServiceItem } from "@/lib/domain/types";

/**
 * Records a completed service against one item.
 *
 * Fields adapt to the rule, because the three rules need different facts:
 *   distance_km   also needs the odometer at service, to re-baseline the item
 *   fixed_date    also needs the new expiry, since renewals go to a set date
 *                 rather than a computed interval
 *
 * Nothing here touches any other item on the vehicle.
 */
export function RecordServiceForm({
  vehicleId,
  item,
  assessment,
  asOf,
  currentKm,
}: {
  vehicleId: string;
  item: ServiceItem;
  assessment: DueAssessment;
  asOf: string;
  currentKm: number | null;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    recordServiceAction,
    null,
  );
  const router = useRouter();

  // revalidatePath on the server does not refresh the client router cache in
  // the same request, so the new due date would not appear without this.
  useEffect(() => {
    if (state?.ok) {
      router.refresh();
      const timer = setTimeout(() => setOpen(false), 1200);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [state, router]);

  const takaDefault = (item.costPaisa / 100).toFixed(2).replace(/\.00$/, "");

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded border border-line bg-raised px-2.5 py-1.5 text-xs font-medium text-hi transition-colors hover:border-accent hover:text-accent"
      >
        Record service
      </button>
    );
  }

  return (
    <form
      action={formAction}
      className="mt-3 w-full rounded border border-accent/40 bg-raised p-3"
      aria-label={`Record service for ${item.name}`}
    >
      <input type="hidden" name="vehicleId" value={vehicleId} />
      <input type="hidden" name="itemName" value={item.name} />

      <p className="mb-3 text-xs font-semibold text-hi">Record {item.name} as done</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Date of service" htmlFor={`date-${item.name}`}>
          <input
            id={`date-${item.name}`}
            name="date"
            type="date"
            required
            defaultValue={asOf}
            max={asOf}
            className="nums w-full rounded border border-line bg-surface px-2 py-1.5 text-xs text-hi"
          />
        </Field>

        <Field label="Cost (৳)" htmlFor={`cost-${item.name}`}>
          <input
            id={`cost-${item.name}`}
            name="cost"
            type="text"
            inputMode="decimal"
            required
            defaultValue={takaDefault}
            className="nums w-full rounded border border-line bg-surface px-2 py-1.5 text-xs text-hi"
          />
        </Field>

        {item.rule === "distance_km" && (
          <Field
            label="Odometer at service (km)"
            htmlFor={`km-${item.name}`}
            hint={
              currentKm === null
                ? "No reading on file"
                : `Current reading ${currentKm.toLocaleString("en-US")} km`
            }
          >
            <input
              id={`km-${item.name}`}
              name="km"
              type="text"
              inputMode="numeric"
              required
              defaultValue={currentKm ?? ""}
              className="nums w-full rounded border border-line bg-surface px-2 py-1.5 text-xs text-hi"
            />
          </Field>
        )}

        {item.rule === "fixed_date" && (
          <Field
            label="New expiry date"
            htmlFor={`due-${item.name}`}
            hint="Renewals run to a set date, not an interval"
          >
            <input
              id={`due-${item.name}`}
              name="newDueDate"
              type="date"
              required
              defaultValue={addMonths(assessment.dueDate ?? asOf, 12)}
              className="nums w-full rounded border border-line bg-surface px-2 py-1.5 text-xs text-hi"
            />
          </Field>
        )}
      </div>

      {state && (
        <p
          role={state.ok ? "status" : "alert"}
          className={`mt-3 rounded px-2 py-1.5 text-xs ${
            state.ok ? "bg-fine-bg text-fine" : "bg-overdue-bg text-overdue"
          }`}
        >
          {state.message}
        </p>
      )}

      <div className="mt-3 flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-accent px-3 py-1.5 text-xs font-semibold text-accent-contrast transition-opacity disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save service"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={pending}
          className="rounded border border-line px-3 py-1.5 text-xs font-medium text-mid hover:text-hi"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 block text-[0.6875rem] font-medium text-mid">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-[0.6875rem] text-low">{hint}</p>}
    </div>
  );
}
