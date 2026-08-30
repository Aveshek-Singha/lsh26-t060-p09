import { loadFleet, totalsFor } from "@/lib/fleet";
import { formatDate } from "@/lib/domain/civilDate";
import { sumPaisa } from "@/lib/domain/money";
import { currentKm, dailyKm } from "@/lib/domain/rate";
import { FleetTable, type FleetRow } from "@/features/vehicle/FleetTable";
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

  const rows: FleetRow[] = fleet.vehicles.map((vehicle) => {
    const assessments = fleet.assessments.get(vehicle.id) ?? [];
    const due = assessments.filter(
      (a) => a.status === "overdue" || a.status === "due_soon",
    );
    const owner = fleet.owners.get(vehicle.ownerId) ?? null;

    return {
      id: vehicle.id,
      plate: vehicle.plate,
      model: vehicle.model,
      ownerId: owner?.id ?? null,
      ownerName: owner?.name ?? null,
      status: worstStatus(assessments),
      dueCount: due.length,
      dueValuePaisa: sumPaisa(due.map((a) => a.costPaisa)),
      km: currentKm(vehicle.odometerReadings),
      rate: dailyKm(vehicle.odometerReadings),
    };
  });

  return (
    <>
      <PageHeading
        title="Vehicles"
        subtitle={`${totals.vehicles} vehicles belonging to ${totals.owners} owners. Search, filter by status, or sort by what matters.`}
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
        <FleetTable rows={rows} />
      )}
    </>
  );
}
