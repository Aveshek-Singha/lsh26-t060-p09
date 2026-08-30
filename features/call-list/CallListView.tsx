"use client";

import { useMemo, useState } from "react";

import type { CallListEntry } from "@/lib/domain/priority";
import { formatBdt, sumPaisa } from "@/lib/domain/money";
import { CallRow } from "./CallRow";
import { SearchBox } from "./SearchBox";

type StatusFilter = "all" | "overdue" | "due_soon" | "to_call";

/**
 * The call list, with a search box and status filter.
 *
 * 27 calls covering 41 vehicles is more than fits on a screen, and the workshop
 * looks things up by the thing in front of them — a number plate, or the name of
 * whoever just rang. Filtering happens in the browser over data already sent, so
 * it is instant and needs no round trip.
 */
export function CallListView({
  entries,
  asOf,
}: {
  entries: CallListEntry[];
  asOf: string;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");

  // Build the haystack once, not on every keystroke.
  const indexed = useMemo(
    () =>
      entries.map((entry) => ({
        entry,
        haystack: [
          entry.owner?.name ?? "",
          entry.owner?.phone ?? "",
          ...entry.vehicles.flatMap(({ vehicle }) => [vehicle.plate, vehicle.model]),
          ...entry.actionable.map((item) => item.itemName),
        ]
          .join(" ")
          .toLowerCase(),
        hasOverdue: entry.actionable.some((item) => item.status === "overdue"),
        called: entry.owner?.lastCalledOn === asOf,
      })),
    [entries, asOf],
  );

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return indexed
      .filter(({ haystack }) => needle === "" || haystack.includes(needle))
      .filter(({ hasOverdue, called }) => {
        if (status === "overdue") return hasOverdue;
        if (status === "due_soon") return !hasOverdue;
        if (status === "to_call") return !called;
        return true;
      })
      // Calls already made sink to the bottom rather than vanishing, so the
      // day's work stays visible and the mark can be undone.
      .sort((a, b) => Number(a.called) - Number(b.called))
      .map(({ entry }) => entry);
  }, [indexed, query, status]);

  const counts = useMemo(
    () => ({
      all: indexed.length,
      overdue: indexed.filter((i) => i.hasOverdue).length,
      due_soon: indexed.filter((i) => !i.hasOverdue).length,
      to_call: indexed.filter((i) => !i.called).length,
    }),
    [indexed],
  );

  const shownVehicles = visible.reduce((sum, entry) => sum + entry.vehicles.length, 0);
  const shownValue = sumPaisa(visible.map((entry) => entry.priority.totalCostPaisa));
  const filtering = query.trim() !== "" || status !== "all";

  return (
    <>
      <div className="no-print mb-4 flex flex-wrap items-center gap-3">
        <SearchBox entries={entries} query={query} onQueryChange={setQuery} />

        <div className="flex items-center gap-1" role="group" aria-label="Filter by status">
          <FilterChip active={status === "all"} onClick={() => setStatus("all")}>
            All {counts.all}
          </FilterChip>
          <FilterChip active={status === "to_call"} onClick={() => setStatus("to_call")}>
            Still to call {counts.to_call}
          </FilterChip>
          <FilterChip
            active={status === "overdue"}
            onClick={() => setStatus("overdue")}
            tone="overdue"
          >
            Overdue {counts.overdue}
          </FilterChip>
          <FilterChip
            active={status === "due_soon"}
            onClick={() => setStatus("due_soon")}
            tone="due-soon"
          >
            Due soon {counts.due_soon}
          </FilterChip>
        </div>

        {filtering && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setStatus("all");
            }}
            className="text-xs text-mid underline-offset-4 hover:text-hi hover:underline"
          >
            Clear
          </button>
        )}
      </div>

      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-hi" aria-live="polite">
          {visible.length} {visible.length === 1 ? "owner" : "owners"} to call
          <span className="ml-2 font-normal text-low">
            {shownVehicles} {shownVehicles === 1 ? "vehicle" : "vehicles"} ·{" "}
            {formatBdt(shownValue)}
          </span>
        </h2>
        <p className="text-xs text-low">Highest priority first</p>
      </div>

      {visible.length === 0 ? (
        <div className="enter-fade rounded border border-dashed border-line bg-surface px-6 py-12 text-center">
          <p className="text-sm font-semibold text-hi">No matching calls</p>
          <p className="mt-1.5 text-sm text-mid">
            Nothing on the call list matches
            {query.trim() && <> “{query.trim()}”</>}
            {query.trim() && status !== "all" && " with that status"}
            {!query.trim() && status !== "all" && " that status"}.
          </p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setStatus("all");
            }}
            className="mt-4 rounded border border-line bg-raised px-3 py-1.5 text-xs font-medium text-hi hover:border-line-strong"
          >
            Show all {counts.all}
          </button>
        </div>
      ) : (
        // The stagger is a page-load flourish, not a filter effect. Filtering
        // re-inserts rows, and a freshly inserted row replays the entrance — so
        // typing would animate the list on every keystroke that widens the
        // match. Dropping the class while filtering keeps results instant.
        <ol className={filtering ? "space-y-3" : "stagger space-y-3"}>
          {visible.map((entry, index) => (
            <CallRow key={entry.key} entry={entry} rank={index + 1} asOf={asOf} />
          ))}
        </ol>
      )}
    </>
  );
}

function FilterChip({
  active,
  onClick,
  tone,
  children,
}: {
  active: boolean;
  onClick: () => void;
  tone?: "overdue" | "due-soon";
  children: React.ReactNode;
}) {
  const activeTone =
    tone === "overdue"
      ? "border-overdue/40 bg-overdue-bg text-overdue"
      : tone === "due-soon"
        ? "border-due-soon/40 bg-due-soon-bg text-due-soon"
        : "border-line-strong bg-raised text-hi";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`nums rounded border px-2.5 py-1.5 text-xs font-medium transition-colors ${
        active ? activeTone : "border-line bg-surface text-mid hover:text-hi"
      }`}
    >
      {children}
    </button>
  );
}
