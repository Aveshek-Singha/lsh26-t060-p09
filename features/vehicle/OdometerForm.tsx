"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { addReadingAction } from "@/actions/workshop";
import type { ActionResult } from "@/actions/types";

/**
 * Adds an odometer reading.
 *
 * This is the input that drives every distance-based estimate on the vehicle:
 * the daily-running rate is measured from these readings, so a new one moves
 * all of the distance due dates at once.
 */
export function OdometerForm({
  vehicleId,
  asOf,
  currentKm,
  lastReadingDate,
}: {
  vehicleId: string;
  asOf: string;
  currentKm: number | null;
  lastReadingDate: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    addReadingAction,
    null,
  );
  const router = useRouter();

  useEffect(() => {
    if (state?.ok) {
      router.refresh();
      const timer = setTimeout(() => setOpen(false), 1400);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [state, router]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded border border-line bg-raised px-3 py-1.5 text-xs font-medium text-hi transition-colors hover:border-accent hover:text-accent"
      >
        Add odometer reading
      </button>
    );
  }

  return (
    <form
      action={formAction}
      className="enter w-full rounded border border-accent/40 bg-raised p-3"
      aria-label="Add odometer reading"
    >
      <input type="hidden" name="vehicleId" value={vehicleId} />
      <p className="mb-3 text-xs font-semibold text-hi">New odometer reading</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="reading-date" className="mb-1 block text-[0.6875rem] font-medium text-mid">
            Date
          </label>
          <input
            id="reading-date"
            name="date"
            type="date"
            required
            defaultValue={asOf}
            max={asOf}
            className="nums w-full rounded border border-line bg-surface px-2 py-1.5 text-xs text-hi"
          />
          {lastReadingDate && (
            <p className="mt-1 text-[0.6875rem] text-low">Last reading {lastReadingDate}</p>
          )}
        </div>
        <div>
          <label htmlFor="reading-km" className="mb-1 block text-[0.6875rem] font-medium text-mid">
            Odometer (km)
          </label>
          <input
            id="reading-km"
            name="km"
            type="text"
            inputMode="numeric"
            required
            placeholder={currentKm ? String(currentKm + 500) : "e.g. 60500"}
            className="nums w-full rounded border border-line bg-surface px-2 py-1.5 text-xs text-hi"
          />
          {currentKm !== null && (
            <p className="mt-1 text-[0.6875rem] text-low">
              Must be at least {currentKm.toLocaleString("en-US")} km
            </p>
          )}
        </div>
      </div>

      {state && (
        <p
          role={state.ok ? "status" : "alert"}
          className={`enter mt-3 rounded px-2 py-1.5 text-xs ${
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
          className="rounded bg-accent px-3 py-1.5 text-xs font-semibold text-accent-contrast disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save reading"}
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
