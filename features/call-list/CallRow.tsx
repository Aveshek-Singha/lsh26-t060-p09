import Link from "next/link";

import { formatDate, formatDayOffset } from "@/lib/domain/civilDate";
import { formatBdt } from "@/lib/domain/money";
import type { CallListEntry } from "@/lib/domain/priority";
import { StatusBadge } from "@/features/ui/StatusBadge";
import { RecordServiceForm } from "@/features/vehicle/RecordServiceForm";
import { latestReading } from "@/lib/domain/rate";
import { CalledToggle } from "./CalledToggle";
import { MailButton } from "@/features/owner/MailButton";
import { buildMailDraft, buildReminder, buildReminderSubject } from "@/features/owner/reminder";

/**
 * One phone call.
 *
 * Keyed by owner rather than by vehicle, because the workshop rings a person:
 * an owner with three vehicles is one call with three things to discuss, not
 * three separate calls. Their vehicles nest underneath.
 */
export function CallRow({
  entry,
  rank,
  asOf,
}: {
  entry: CallListEntry;
  rank: number;
  asOf: string;
}) {
  const { owner, vehicles, actionable, priority } = entry;
  const worst = actionable[0]!;
  const isOverdue = worst.status === "overdue";
  // Called *today* specifically: advancing the working date makes the call due
  // again, which is what a daily worklist should do.
  const called = owner?.lastCalledOn === asOf;

  // The same reminder the owner page shows, handed to the mail client as a
  // ready-written draft so the workshop never retypes it.
  const work = vehicles.map(({ vehicle, actionable: items }) => ({
    vehicle,
    actionable: items,
  }));
  const draft = owner
    ? buildMailDraft(owner.email ?? "", buildReminderSubject(work), buildReminder(owner, work, asOf))
    : null;

  return (
    <li
      // `transition-colors` alone excludes opacity, so marking an owner called
      // snapped the row to dim. Naming opacity lets the state change read.
      className={`relative rounded border border-line bg-surface transition-[color,background-color,border-color,opacity] duration-200 ease-out hover:border-line-strong ${
        called ? "opacity-55" : ""
      }`}
      data-owner={owner?.id ?? "unknown"}
      data-score={priority.score}
      data-called={called ? "yes" : "no"}
    >
      {/* Status spine: a glanceable colour edge down the left of each call. */}
      <span
        aria-hidden
        className={`absolute inset-y-0 left-0 w-1 rounded-l ${
          called ? "bg-fine" : isOverdue ? "bg-overdue" : "bg-due-soon"
        }`}
      />

      <div className="grid gap-x-6 gap-y-3 px-4 py-4 pl-5 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:px-5 sm:pl-6">
        <div className="flex items-center gap-3 sm:block sm:pt-0.5">
          <span className="nums text-lg font-semibold text-low sm:text-xl">
            {String(rank).padStart(2, "0")}
          </span>
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            {called ? (
              <span className="inline-flex shrink-0 items-center rounded border border-fine/30 bg-fine-bg px-1.5 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-wide text-fine">
                Called today
              </span>
            ) : (
              <StatusBadge status={worst.status} />
            )}
            {owner ? (
              <>
                <Link
                  href={`/owners/${owner.id}`}
                  className="text-sm font-semibold text-hi underline-offset-4 hover:underline"
                >
                  {owner.name}
                </Link>
                <a
                  href={`tel:${owner.phone}`}
                  className="nums text-xs text-accent underline-offset-4 hover:underline"
                >
                  {owner.phone}
                </a>
              </>
            ) : (
              <span className="text-sm font-semibold text-low">Unknown owner</span>
            )}
            <span className="text-xs text-low">
              {vehicles.length === 1
                ? "1 vehicle"
                : `${vehicles.length} vehicles · one call`}
            </span>
          </div>

          <div className="mt-3 space-y-3">
            {vehicles.map(({ vehicle, actionable: items }) => {
              const reading = latestReading(vehicle.odometerReadings);
              return (
              <div key={vehicle.id} className="border-l-2 border-line pl-3">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <Link
                    href={`/vehicles/${vehicle.id}`}
                    className="plate truncate text-xs font-semibold text-hi underline-offset-4 hover:underline"
                  >
                    {vehicle.plate}
                  </Link>
                  <span className="truncate text-[0.6875rem] text-low">{vehicle.model}</span>
                </div>

                <ul className="mt-1.5 space-y-2">
                  {items.map((item) => {
                    const definition = vehicle.serviceItems.find(
                      (candidate) => candidate.name === item.itemName,
                    );
                    return (
                      // One line per item, the way the owner page reads: the
                      // facts sit together on the left and the money lands in a
                      // fixed right-hand column, so costs align down the card
                      // instead of drifting with the text above them.
                      <li
                        key={item.itemName}
                        className="group/item grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 border-t border-line py-1.5 text-xs first:border-0 first:pt-0"
                      >
                        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
                          <span className="font-medium text-hi">{item.itemName}</span>
                          <span
                            className={`nums ${
                              item.status === "overdue" ? "text-overdue" : "text-due-soon"
                            }`}
                          >
                            {formatDayOffset(item.daysUntilDue ?? 0)}
                          </span>
                          <span className="text-low">
                            ({item.dueDate ? formatDate(item.dueDate) : "no date"})
                          </span>
                        </div>

                        <span className="nums whitespace-nowrap tabular-nums text-mid">
                          {formatBdt(item.costPaisa)}
                        </span>

                        {/* The reason and the action share the second line.
                            The action is the least important thing in the row,
                            so it is a quiet link that firms up on hover rather
                            than a boxed button repeated seven times down a card. */}
                        <div className="col-span-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                          <p className="min-w-0 text-low">{item.basis}</p>
                          {definition && (
                            <div className="no-print">
                              <RecordServiceForm
                                vehicleId={vehicle.id}
                                item={definition}
                                assessment={item}
                                asOf={asOf}
                                currentKm={reading?.km ?? null}
                                compact
                              />
                            </div>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-line pt-3 sm:block sm:border-0 sm:pt-0 sm:text-right">
          <div>
            <p className="eyebrow">Priority</p>
            <p className="nums text-2xl font-semibold text-hi">{priority.score}</p>
          </div>
          <div className="sm:mt-2">
            <p className="nums text-xs text-mid">{formatBdt(priority.totalCostPaisa)} of work</p>
            <p className="nums mt-0.5 text-[0.6875rem] text-low">
              {priority.urgencyPoints} urgency + {priority.valuePoints} value
            </p>
            <p className="nums mt-0.5 text-[0.6875rem] text-low">
              {actionable.length} {actionable.length === 1 ? "item" : "items"}
            </p>
            {owner && (
              <div className="mt-2 flex flex-wrap gap-2 sm:justify-end">
                {draft && (
                  <MailButton
                    ownerId={owner.id}
                    email={owner.email}
                    gmailHref={draft.gmailHref}
                    truncated={draft.truncated}
                    compact
                  />
                )}
                <CalledToggle ownerId={owner.id} called={called} />
              </div>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}
