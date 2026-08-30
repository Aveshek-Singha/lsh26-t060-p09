/**
 * How far a vehicle actually runs per day.
 *
 * This is the number that makes distance-ruled items (brake pads, tyres, timing
 * belt) predictable as *dates* rather than as a flat interval. Every vehicle
 * gets its own rate from its own odometer history.
 *
 * Measured across the full reading span rather than the last two readings: both
 * agree to within 10% on every vehicle in the dataset, and the full span is less
 * sensitive to one short or noisy gap.
 */
import { compareDates, diffDays } from "./civilDate";
import type { CivilDate, OdometerReading } from "./types";

export function sortReadings(readings: readonly OdometerReading[]): OdometerReading[] {
  return [...readings].sort((a, b) => compareDates(a.date, b.date));
}

/** The most recent odometer reading, or null when the vehicle has none. */
export function latestReading(readings: readonly OdometerReading[]): OdometerReading | null {
  const sorted = sortReadings(readings);
  return sorted[sorted.length - 1] ?? null;
}

export function currentKm(readings: readonly OdometerReading[]): number | null {
  return latestReading(readings)?.km ?? null;
}

export function currentKmDate(readings: readonly OdometerReading[]): CivilDate | null {
  return latestReading(readings)?.date ?? null;
}

/**
 * Average km per day across the reading history.
 *
 * Returns null — never zero, never Infinity — whenever no honest rate exists:
 * fewer than two readings, all readings on one date, or an odometer that went
 * backwards. Callers surface that as "no estimate" instead of dividing by it.
 */
export function dailyKm(readings: readonly OdometerReading[]): number | null {
  const sorted = sortReadings(readings);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (!first || !last || sorted.length < 2) return null;

  const days = diffDays(first.date, last.date);
  if (days <= 0) return null;

  const travelled = last.km - first.km;
  if (travelled <= 0) return null;

  return travelled / days;
}

/** One decimal place, for display in a `basis` string. */
export function formatRate(kmPerDay: number): string {
  return kmPerDay.toFixed(1);
}
