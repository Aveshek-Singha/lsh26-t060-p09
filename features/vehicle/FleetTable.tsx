"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { formatBdt } from "@/lib/domain/money";
import { formatRate } from "@/lib/domain/rate";
import type { DueStatus } from "@/lib/domain/types";
import { StatusBadge } from "@/features/ui/StatusBadge";

export interface FleetRow {
  id: string;
  plate: string;
  model: string;
  ownerId: string | null;
  ownerName: string | null;
  status: DueStatus;
  dueCount: number;
  dueValuePaisa: number;
  km: number | null;
  rate: number | null;
}

type StatusFilter = DueStatus | "all";
type SortKey = "worst" | "value" | "plate" | "km";

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "overdue", label: "Overdue" },
  { key: "due_soon", label: "Due soon" },
  { key: "fine", label: "Fine" },
  { key: "no_estimate", label: "No estimate" },
];

const RANK: Record<DueStatus, number> = {
  overdue: 0,
  due_soon: 1,
  no_estimate: 2,
  fine: 3,
};

/**
 * The fleet, filterable and sortable.
 *
 * 42 vehicles is past the point where scanning works. The controls answer the
 * questions actually asked of a fleet list: what is worst, what is worth most,
 * and where is that one plate.
 */
export function FleetTable({ rows }: { rows: FleetRow[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortKey>("worst");

  const counts = useMemo(() => {
    const map: Record<string, number> = { all: rows.length };
    for (const row of rows) map[row.status] = (map[row.status] ?? 0) + 1;
    return map;
  }, [rows]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows
      .filter(
        (r) =>
          needle === "" ||
          `${r.plate} ${r.model} ${r.ownerName ?? ""}`.toLowerCase().includes(needle),
      )
      .filter((r) => status === "all" || r.status === status)
      .sort((a, b) => {
        if (sort === "value") return b.dueValuePaisa - a.dueValuePaisa;
        if (sort === "plate") return a.plate.localeCompare(b.plate);
        if (sort === "km") return (b.km ?? -1) - (a.km ?? -1);
        return RANK[a.status] - RANK[b.status] || b.dueValuePaisa - a.dueValuePaisa;
      });
  }, [rows, query, status, sort]);

  const shownValue = visible.reduce((sum, r) => sum + r.dueValuePaisa, 0);
  const filtering = query.trim() !== "" || status !== "all";

  return (
    <>
      <div className="no-print mb-4 flex flex-wrap items-center gap-2">
        <label htmlFor="fleet-search" className="sr-only">
          Search vehicles by plate, model or owner
        </label>
        <input
          id="fleet-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search plate, model or owner..."
          className="min-w-0 flex-1 rounded border border-line bg-surface px-3 py-2 text-sm text-hi placeholder:text-low sm:max-w-xs"
        />

        <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Filter by status">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setStatus(f.key)}
              aria-pressed={status === f.key}
              className={`nums rounded border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                status === f.key
                  ? "border-line-strong bg-raised text-hi"
                  : "border-line bg-surface text-mid hover:text-hi"
              }`}
            >
              {f.label} {counts[f.key] ?? 0}
            </button>
          ))}
        </div>

        <label htmlFor="fleet-sort" className="sr-only">
          Sort vehicles
        </label>
        <select
          id="fleet-sort"
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="rounded border border-line bg-surface px-2 py-1.5 text-xs text-hi"
        >
          <option value="worst">Worst first</option>
          <option value="value">Highest value</option>
          <option value="km">Highest odometer</option>
          <option value="plate">Plate A-Z</option>
        </select>

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

      <p className="mb-3 text-sm text-mid" aria-live="polite">
        <span className="nums font-semibold text-hi">{visible.length}</span>{" "}
        {visible.length === 1 ? "vehicle" : "vehicles"}
        {shownValue > 0 && (
          <span className="text-low"> · {formatBdt(shownValue)} outstanding</span>
        )}
      </p>

      {visible.length === 0 ? (
        <div className="enter-fade rounded border border-dashed border-line bg-surface px-6 py-12 text-center">
          <p className="text-sm font-semibold text-hi">No matching vehicles</p>
          <p className="mt-1.5 text-sm text-mid">
            Nothing in the fleet matches{query.trim() && <> &ldquo;{query.trim()}&rdquo;</>}
            {status !== "all" && " with that status"}.
          </p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setStatus("all");
            }}
            className="mt-4 rounded border border-line bg-raised px-3 py-1.5 text-xs font-medium text-hi hover:border-line-strong"
          >
            Show all {rows.length}
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded border border-line">
          <table className="w-full min-w-[46rem] border-collapse bg-surface text-sm">
            <thead>
              <tr className="border-b border-line text-left">
                <Th>Status</Th>
                <Th>Vehicle</Th>
                <Th>Owner</Th>
                <Th align="right">Odometer</Th>
                <Th align="right">Per day</Th>
                <Th align="right">Due now</Th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-line last:border-0 hover:bg-raised"
                  data-vehicle={row.id}
                >
                  <td className="px-3 py-2.5">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="px-3 py-2.5">
                    <Link
                      href={`/vehicles/${row.id}`}
                      className="plate font-medium text-hi underline-offset-4 hover:underline"
                    >
                      {row.plate}
                    </Link>
                    <span className="ml-2 text-xs text-low">{row.model}</span>
                  </td>
                  <td className="px-3 py-2.5 text-mid">
                    {row.ownerId ? (
                      <Link
                        href={`/owners/${row.ownerId}`}
                        className="underline-offset-4 hover:text-hi hover:underline"
                      >
                        {row.ownerName}
                      </Link>
                    ) : (
                      <span className="text-low">unknown</span>
                    )}
                  </td>
                  <td className="nums px-3 py-2.5 text-right text-mid">
                    {row.km === null ? "—" : row.km.toLocaleString("en-US")}
                  </td>
                  <td className="nums px-3 py-2.5 text-right text-mid">
                    {row.rate === null ? "—" : formatRate(row.rate)}
                  </td>
                  <td className="nums px-3 py-2.5 text-right">
                    {row.dueCount === 0 ? (
                      <span className="text-low">—</span>
                    ) : (
                      <span className="text-hi">
                        {row.dueCount} · {formatBdt(row.dueValuePaisa)}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function Th({ children, align }: { children: React.ReactNode; align?: "right" }) {
  return (
    <th
      scope="col"
      className={`px-3 py-2.5 text-[0.875rem] font-semibold uppercase tracking-wide text-low ${
        align === "right" ? "text-right" : ""
      }`}
    >
      {children}
    </th>
  );
}
