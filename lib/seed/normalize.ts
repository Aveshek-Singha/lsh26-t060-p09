/**
 * Translate the published case format into the app's own domain shapes.
 *
 * Two deliberate conversions happen here, at the boundary, so nothing
 * downstream has to think about them again:
 *   - `cost_bdt` decimal strings become integer paisa
 *   - snake_case fields become the camelCase the domain uses
 *
 * Every date is validated on the way in, so malformed seed data fails loudly
 * here rather than producing a silently wrong due date later.
 */
import { assertCivilDate } from "@/lib/domain/civilDate";
import { parsePaisa } from "@/lib/domain/money";
import type {
  CivilDate,
  OdometerReading,
  Owner,
  ServiceItem,
  ServiceRecord,
  Vehicle,
} from "@/lib/domain/types";

export interface RawCase {
  case_id: string;
  today: string;
  owners: RawOwner[];
  vehicles: RawVehicle[];
}

interface RawOwner {
  id: string;
  name: string;
  phone: string;
}

interface RawVehicle {
  id: string;
  owner_id: string;
  model: string;
  plate: string;
  odometer_readings: { date: string; km: number }[];
  service_items: RawServiceItem[];
  service_history: RawServiceRecord[];
}

interface RawServiceItem {
  name: string;
  rule: string;
  due_date?: string;
  every_months?: number;
  every_km?: number;
  cost_bdt: string;
}

interface RawServiceRecord {
  item: string;
  date: string;
  km: number | null;
  cost_bdt: string;
}

export interface NormalisedCase {
  caseId: string;
  today: CivilDate;
  owners: Owner[];
  vehicles: Vehicle[];
}

function normaliseItem(raw: RawServiceItem, vehicleId: string): ServiceItem {
  const costPaisa = parsePaisa(raw.cost_bdt);

  switch (raw.rule) {
    case "fixed_date":
      return {
        name: raw.name,
        rule: "fixed_date",
        dueDate: assertCivilDate(raw.due_date, `${vehicleId} ${raw.name} due_date`),
        costPaisa,
      };
    case "period_months":
      if (!raw.every_months) {
        throw new Error(`${vehicleId} ${raw.name}: period_months item has no every_months`);
      }
      return { name: raw.name, rule: "period_months", everyMonths: raw.every_months, costPaisa };
    case "distance_km":
      if (!raw.every_km) {
        throw new Error(`${vehicleId} ${raw.name}: distance_km item has no every_km`);
      }
      return { name: raw.name, rule: "distance_km", everyKm: raw.every_km, costPaisa };
    default:
      throw new Error(`${vehicleId} ${raw.name}: unknown rule "${raw.rule}"`);
  }
}

function normaliseRecord(raw: RawServiceRecord, vehicleId: string): ServiceRecord {
  return {
    item: raw.item,
    date: assertCivilDate(raw.date, `${vehicleId} ${raw.item} service date`),
    km: raw.km,
    costPaisa: parsePaisa(raw.cost_bdt),
  };
}

function normaliseReading(raw: { date: string; km: number }, vehicleId: string): OdometerReading {
  return {
    date: assertCivilDate(raw.date, `${vehicleId} odometer date`),
    km: raw.km,
  };
}

export function normaliseCase(raw: RawCase): NormalisedCase {
  const owners: Owner[] = raw.owners.map((owner) => ({
    id: owner.id,
    name: owner.name,
    phone: owner.phone,
  }));

  const ownerIds = new Set(owners.map((owner) => owner.id));

  const vehicles: Vehicle[] = raw.vehicles.map((vehicle) => {
    if (!ownerIds.has(vehicle.owner_id)) {
      throw new Error(`${vehicle.id} references unknown owner ${vehicle.owner_id}`);
    }
    return {
      id: vehicle.id,
      ownerId: vehicle.owner_id,
      model: vehicle.model,
      plate: vehicle.plate,
      odometerReadings: vehicle.odometer_readings.map((r) => normaliseReading(r, vehicle.id)),
      serviceItems: vehicle.service_items.map((i) => normaliseItem(i, vehicle.id)),
      serviceHistory: vehicle.service_history.map((h) => normaliseRecord(h, vehicle.id)),
    };
  });

  return {
    caseId: raw.case_id,
    today: assertCivilDate(raw.today, "case today"),
    owners,
    vehicles,
  };
}
