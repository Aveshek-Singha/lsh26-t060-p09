import Link from "next/link";

import { formatDate, formatDayOffset } from "@/lib/domain/civilDate";
import { formatBdt } from "@/lib/domain/money";
import type { CallListEntry } from "@/lib/domain/priority";
import { StatusBadge } from "@/features/ui/StatusBadge";

/**
 * One vehicle on the call list.
 *
 * Answers the four questions the workshop actually has: who to ring, about
 * which vehicle, what is due, and why it is this high up the list.
 */
export function CallRow({ entry, rank }: { entry: CallListEntry; rank: number }) {
  const { vehicle, owner, actionable, priority } = entry;
  const worst = actionable[0]!;
  const isOverdue = worst.status === "overdue";

  return (
    <li
      className={`relative rounded border border-line bg-surface transition-colors hover:border-line-strong ${
        isOverdue ? "hazard" : ""
      }`}
    >
      {/* Status spine: a glanceable colour edge down the left of each row. */}
      <span
        aria-hidden
        className={`absolute inset-y-0 left-0 w-1 rounded-l ${
          isOverdue ? "bg-overdue" : "bg-due-soon"
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
            <StatusBadge status={worst.status} />
            <Link
              href={`/vehicles/${vehicle.id}`}
              className="plate truncate text-sm font-semibold text-hi underline-offset-4 hover:underline"
            >
              {vehicle.plate}
            </Link>
            <span className="truncate text-xs text-low">{vehicle.model}</span>
          </div>

          <p className="mt-2 text-sm text-hi">
            Call{" "}
            <span className="font-semibold">{owner?.name ?? "unknown owner"}</span>
            {owner && (
              <>
                {" · "}
                <a
                  href={`tel:${owner.phone}`}
                  className="nums text-accent underline-offset-4 hover:underline"
                >
                  {owner.phone}
                </a>
              </>
            )}
          </p>

          <ul className="mt-3 space-y-1.5">
            {actionable.map((item) => (
              <li
                key={item.itemName}
                className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs"
              >
                <span className="font-medium text-hi">{item.itemName}</span>
                <span
                  className={`nums ${item.status === "overdue" ? "text-overdue" : "text-due-soon"}`}
                >
                  {formatDayOffset(item.daysUntilDue ?? 0)}
                </span>
                <span className="text-low">
                  ({item.dueDate ? formatDate(item.dueDate) : "no date"})
                </span>
                <span className="nums ml-auto text-mid">{formatBdt(item.costPaisa)}</span>
                {/* The reason, verbatim from the engine that produced the date. */}
                <span className="w-full text-low">{item.basis}</span>
              </li>
            ))}
          </ul>
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
          </div>
        </div>
      </div>
    </li>
  );
}
