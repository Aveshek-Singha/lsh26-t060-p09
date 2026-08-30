import Link from "next/link";

import { loadFleet, totalsFor } from "@/lib/fleet";
import { formatDate } from "@/lib/domain/civilDate";
import { formatBdt, sumPaisa } from "@/lib/domain/money";
import { currentKm, dailyKm, formatRate } from "@/lib/domain/rate";
import { StatusBadge } from "@/features/ui/StatusBadge";
import { EmptyState, ErrorPanel, PageHeading } from "@/features/ui/states";
import type { DueAssessment } from "@/lib/domain/types";

export const dynamic = "force-dynamic";

/** The worst status present on a vehicle, which is how the fleet is triaged. */
function worstStatus(assessments: DueAssessment[]): DueAssessment["status"] {
  if (assessments.some((a) => a.status === "overdue")) return "overdue";
  if (assessments.some((a) => a.status === "due_soon")) return "due_soon";
  if (assessments.some((a) => a.status === "fine")) return "fine";
  return "no_estimate";
}

const RANK: Record<DueAssessment["status"], number> = {
  overdue: 0,
  due_soon: 1,
  no_estimate: 2,
  fine: 3,
};

export default async function VehiclesPage() {
  let fleet;
  try {
    fleet = await loadFleet();
  } catch {
    return (
      <>
        <PageHeading title="Vehicles" />
        <ErrorPanel
          title="Could not load the fleet"
          detail="The database did not respond. Reload the page to try again."
        />
      </>
    );
  }

  const totals = totalsFor(fleet);

  const rows = fleet.vehicles
    .map((vehicle) => {
      const assessments = fleet.assessments.get(vehicle.id) ?? [];
      const status = worstStatus(assessments);
      const due = assessments.filter((a) => a.status === "overdue" || a.status === "due_soon");
      return {
        vehicle,
        owner: fleet.owners.get(vehicle.ownerId) ?? null,
        assessments,
        status,
        dueCount: due.length,
        dueValue: sumPaisa(due.map((a) => a.costPaisa)),
        km: currentKm(vehicle.odometerReadings),
        rate: dailyKm(vehicle.odometerReadings),
      };
    })
    .sort((a, b) => RANK[a.status] - RANK[b.status] || a.vehicle.plate.localeCompare(b.vehicle.plate));

  return (
    <>
      <PageHeading
        title="Vehicles"
        subtitle={`${totals.vehicles} vehicles belonging to ${totals.owners} owners, worst first.`}
        aside={
          <div className="text-right">
            <p className="eyebrow">Working date</p>
            <p className="nums text-sm font-semibold text-hi">{formatDate(fleet.asOf)}</p>
          </div>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          title="No vehicles yet"
          detail="The fleet is empty. Run the seed script to load the workshop's register."
        />
      ) : (
        <div className="overflow-x-auto rounded border border-line">
          <table className="w-full min-w-[46rem] border-collapse bg-surface text-sm">
            <thead>
              <tr className="border-b border-line text-left">
                <th scope="col" className="px-3 py-2.5 text-[0.6875rem] font-semibold uppercase tracking-wide text-low">
                  Status
                </th>
                <th scope="col" className="px-3 py-2.5 text-[0.6875rem] font-semibold uppercase tracking-wide text-low">
                  Vehicle
                </th>
                <th scope="col" className="px-3 py-2.5 text-[0.6875rem] font-semibold uppercase tracking-wide text-low">
                  Owner
                </th>
                <th scope="col" className="px-3 py-2.5 text-right text-[0.6875rem] font-semibold uppercase tracking-wide text-low">
                  Odometer
                </th>
                <th scope="col" className="px-3 py-2.5 text-right text-[0.6875rem] font-semibold uppercase tracking-wide text-low">
                  Per day
                </th>
                <th scope="col" className="px-3 py-2.5 text-right text-[0.6875rem] font-semibold uppercase tracking-wide text-low">
                  Due now
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.vehicle.id}
                  className="border-b border-line last:border-0 hover:bg-raised"
                  data-vehicle={row.vehicle.id}
                >
                  <td className="px-3 py-2.5">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="px-3 py-2.5">
                    <Link
                      href={`/vehicles/${row.vehicle.id}`}
                      className="plate font-medium text-hi underline-offset-4 hover:underline"
                    >
                      {row.vehicle.plate}
                    </Link>
                    <span className="ml-2 text-xs text-low">{row.vehicle.model}</span>
                  </td>
                  <td className="px-3 py-2.5 text-mid">
                    {row.owner ? (
                      <Link
                        href={`/owners/${row.owner.id}`}
                        className="underline-offset-4 hover:text-hi hover:underline"
                      >
                        {row.owner.name}
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
                        {row.dueCount} · {formatBdt(row.dueValue)}
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
