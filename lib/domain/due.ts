/**
 * The due-date engine: one service item, one rule, one answer.
 *
 * Each rule is evaluated on its own terms, and every result carries a `basis`
 * string explaining how the date was reached. That string is rendered in the UI
 * so a reader can see that a distance item was estimated from that vehicle's
 * own daily running, which the brief requires ("a fixed interval for everything
 * will not score").
 *
 * `asOf` is always passed in. Nothing here reads the system clock.
 */
import { addDays, addMonths, compareDates, diffDays, formatDate } from "./civilDate";
import { currentKm, dailyKm, formatRate } from "./rate";
import type {
  CivilDate,
  DueAssessment,
  DueStatus,
  ServiceItem,
  ServiceRecord,
  Vehicle,
} from "./types";

/** Anything falling due within this many days is "due soon". */
export const DUE_SOON_DAYS = 30;

/** The most recent completed service for an item, or null if never done. */
export function lastServiceOf(
  history: readonly ServiceRecord[],
  itemName: string,
): ServiceRecord | null {
  const matches = history
    .filter((record) => record.item === itemName)
    .sort((a, b) => compareDates(a.date, b.date));
  return matches[matches.length - 1] ?? null;
}

function statusFor(daysUntilDue: number): DueStatus {
  if (daysUntilDue < 0) return "overdue";
  if (daysUntilDue <= DUE_SOON_DAYS) return "due_soon";
  return "fine";
}

function noEstimate(item: ServiceItem, reason: string): DueAssessment {
  return {
    itemName: item.name,
    rule: item.rule,
    status: "no_estimate",
    dueDate: null,
    daysUntilDue: null,
    basis: reason,
    costPaisa: item.costPaisa,
  };
}

function resolved(
  item: ServiceItem,
  dueDate: CivilDate,
  asOf: CivilDate,
  basis: string,
  extra: Partial<DueAssessment> = {},
): DueAssessment {
  const daysUntilDue = diffDays(asOf, dueDate);
  return {
    itemName: item.name,
    rule: item.rule,
    status: statusFor(daysUntilDue),
    dueDate,
    daysUntilDue,
    basis,
    costPaisa: item.costPaisa,
    ...extra,
  };
}

/** Run one service item through its own rule. Never throws. */
export function assessItem(
  item: ServiceItem,
  vehicle: Vehicle,
  asOf: CivilDate,
): DueAssessment {
  switch (item.rule) {
    case "fixed_date": {
      if (!item.dueDate) {
        return noEstimate(item, "No expiry date on record");
      }
      return resolved(item, item.dueDate, asOf, `Fixed expiry date ${formatDate(item.dueDate)}`);
    }

    case "period_months": {
      const every = item.everyMonths;
      if (!every || every <= 0) {
        return noEstimate(item, "No service interval on record");
      }
      const last = lastServiceOf(vehicle.serviceHistory, item.name);
      if (!last) {
        return noEstimate(item, `Never serviced — no record to count ${every} months from`);
      }
      const dueDate = addMonths(last.date, every);
      const basis = `Last done ${formatDate(last.date)} + ${every} months`;
      return resolved(item, dueDate, asOf, basis);
    }

    case "distance_km": {
      const every = item.everyKm;
      if (!every || every <= 0) {
        return noEstimate(item, "No distance interval on record");
      }
      const last = lastServiceOf(vehicle.serviceHistory, item.name);
      if (!last) {
        return noEstimate(item, `Never serviced — no odometer baseline to add ${every} km to`);
      }
      if (last.km === null) {
        return noEstimate(item, "Last service has no odometer reading, cannot project");
      }
      const nowKm = currentKm(vehicle.odometerReadings);
      if (nowKm === null) {
        return noEstimate(item, "No odometer readings on this vehicle");
      }
      const rate = dailyKm(vehicle.odometerReadings);
      if (rate === null) {
        return noEstimate(item, "Not enough odometer history to work out daily running");
      }

      const targetKm = last.km + every;
      const kmRemaining = targetKm - nowKm;
      // Negative days project backwards, i.e. the item fell due some time ago.
      const dueDate = addDays(asOf, Math.ceil(kmRemaining / rate));
      const perDay = formatRate(rate);
      const basis = kmRemaining >= 0
        ? `Runs ${perDay} km/day · ${kmRemaining.toLocaleString("en-US")} km to go`
        : `Runs ${perDay} km/day · ${Math.abs(kmRemaining).toLocaleString("en-US")} km past due`;

      return resolved(item, dueDate, asOf, basis, { kmRemaining, dailyKm: rate });
    }

    default: {
      // Defensive: unrecognised rule from bad data must not crash a page.
      const exhaustive: never = item.rule;
      return noEstimate(item, `Unknown service rule: ${String(exhaustive)}`);
    }
  }
}

/** Assess every item on a vehicle, most urgent first. */
export function assessVehicle(vehicle: Vehicle, asOf: CivilDate): DueAssessment[] {
  return vehicle.serviceItems
    .map((item) => assessItem(item, vehicle, asOf))
    .sort(byUrgency);
}

/** Overdue first, then soonest due, with unestimatable items last. */
export function byUrgency(a: DueAssessment, b: DueAssessment): number {
  if (a.daysUntilDue === null && b.daysUntilDue === null) {
    return a.itemName.localeCompare(b.itemName);
  }
  if (a.daysUntilDue === null) return 1;
  if (b.daysUntilDue === null) return -1;
  return a.daysUntilDue - b.daysUntilDue;
}

/** Items the workshop should actually act on today. */
export function isActionable(assessment: DueAssessment): boolean {
  return assessment.status === "overdue" || assessment.status === "due_soon";
}
