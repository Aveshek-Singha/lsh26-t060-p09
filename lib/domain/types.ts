/**
 * Domain types for the vehicle service due predictor.
 *
 * Everything here is plain data. No database types, no React, no I/O — so the
 * whole due-date engine can be unit tested without a running Mongo.
 */

/** A calendar date with no time and no timezone, always `YYYY-MM-DD`. */
export type CivilDate = string;

export type ServiceRule = "fixed_date" | "period_months" | "distance_km";

export interface OdometerReading {
  date: CivilDate;
  km: number;
}

/**
 * A thing that falls due on a vehicle. Exactly one of the three rule fields is
 * meaningful, decided by `rule`:
 *   fixed_date    -> dueDate      (insurance, tax token, fitness, warranty)
 *   period_months -> everyMonths  (engine oil, air filter, AC service)
 *   distance_km   -> everyKm      (brake pads, tyres, timing belt)
 */
export interface ServiceItem {
  name: string;
  rule: ServiceRule;
  dueDate?: CivilDate;
  everyMonths?: number;
  everyKm?: number;
  /** Money is always integer paisa. Never a float. */
  costPaisa: number;
}

/** A completed service. `km` is only meaningful for distance-ruled items. */
export interface ServiceRecord {
  item: string;
  date: CivilDate;
  km: number | null;
  costPaisa: number;
}

export interface Owner {
  id: string;
  name: string;
  phone: string;
}

export interface Vehicle {
  id: string;
  ownerId: string;
  model: string;
  plate: string;
  odometerReadings: OdometerReading[];
  serviceItems: ServiceItem[];
  serviceHistory: ServiceRecord[];
}

export type DueStatus = "overdue" | "due_soon" | "fine" | "no_estimate";

/**
 * The result of running one service item through its own rule.
 *
 * `basis` is the plain-language reason shown in the UI. It is what proves to a
 * reader that a distance item was actually estimated from that vehicle's daily
 * running rather than from a flat interval.
 */
export interface DueAssessment {
  itemName: string;
  rule: ServiceRule;
  status: DueStatus;
  /** null only when status is `no_estimate`. */
  dueDate: CivilDate | null;
  /** Negative means overdue by that many days. null when `no_estimate`. */
  daysUntilDue: number | null;
  basis: string;
  costPaisa: number;
  /** Distance rule only: km still to run before the item falls due. */
  kmRemaining?: number;
  /** Distance rule only: the vehicle's measured average daily running. */
  dailyKm?: number;
}
