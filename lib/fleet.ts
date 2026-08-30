import "server-only";

import { getAsOfDate, listVehicles, ownersById } from "@/lib/db/repo";
import { assessVehicle } from "@/lib/domain/due";
import { buildCallList, type CallListEntry } from "@/lib/domain/priority";
import type { CivilDate, DueAssessment, Owner, Vehicle } from "@/lib/domain/types";

export interface Fleet {
  asOf: CivilDate;
  vehicles: Vehicle[];
  owners: Map<string, Owner>;
  assessments: Map<string, DueAssessment[]>;
}

/**
 * Load the fleet and work out what is due on all of it.
 *
 * Due dates and statuses are derived on every read rather than stored. At 42
 * vehicles the whole pass is sub-millisecond, and it removes a whole class of
 * bug: nothing can go stale after a service is recorded or the as-of date moves.
 */
export async function loadFleet(): Promise<Fleet> {
  const [vehicles, owners, asOf] = await Promise.all([
    listVehicles(),
    ownersById(),
    getAsOfDate(),
  ]);

  const assessments = new Map(
    vehicles.map((vehicle) => [vehicle.id, assessVehicle(vehicle, asOf)] as const),
  );

  return { asOf, vehicles, owners, assessments };
}

export function callListFor(fleet: Fleet): CallListEntry[] {
  return buildCallList(fleet.vehicles, fleet.assessments, fleet.owners);
}

export interface FleetTotals {
  vehicles: number;
  owners: number;
  overdue: number;
  dueSoon: number;
  fine: number;
  noEstimate: number;
  vehiclesNeedingAction: number;
}

export function totalsFor(fleet: Fleet): FleetTotals {
  let overdue = 0;
  let dueSoon = 0;
  let fine = 0;
  let noEstimate = 0;
  let vehiclesNeedingAction = 0;

  for (const assessments of fleet.assessments.values()) {
    let needsAction = false;
    for (const assessment of assessments) {
      if (assessment.status === "overdue") {
        overdue += 1;
        needsAction = true;
      } else if (assessment.status === "due_soon") {
        dueSoon += 1;
        needsAction = true;
      } else if (assessment.status === "fine") {
        fine += 1;
      } else {
        noEstimate += 1;
      }
    }
    if (needsAction) vehiclesNeedingAction += 1;
  }

  return {
    vehicles: fleet.vehicles.length,
    owners: fleet.owners.size,
    overdue,
    dueSoon,
    fine,
    noEstimate,
    vehiclesNeedingAction,
  };
}
