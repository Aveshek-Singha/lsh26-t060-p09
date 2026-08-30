/**
 * Date arithmetic on `YYYY-MM-DD` strings.
 *
 * Two hazards this module exists to avoid:
 *
 * 1. `new Date("2026-08-30")` parses as UTC midnight, so reading it back with
 *    local getters returns the 29th anywhere west of Greenwich. Everything here
 *    stays in UTC and only ever hands back a string.
 *
 * 2. `Date.prototype.setMonth` overflows: 31 Jan + 1 month becomes 3 March, not
 *    28 Feb. The seed data has 113 service records dated on the 29th-31st, so
 *    this is a real wrong-answer bug, not a theoretical one. `addMonths` clamps.
 */
import type { CivilDate } from "./types";

const MS_PER_DAY = 86_400_000;
const PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isCivilDate(value: unknown): value is CivilDate {
  if (typeof value !== "string" || !PATTERN.test(value)) return false;
  const { year, month, day } = split(value);
  if (month < 1 || month > 12) return false;
  return day >= 1 && day <= daysInMonth(year, month);
}

/** Throws on anything that is not a real calendar date. */
export function assertCivilDate(value: unknown, label = "date"): CivilDate {
  if (!isCivilDate(value)) {
    throw new Error(`Invalid ${label}: expected YYYY-MM-DD, received ${String(value)}`);
  }
  return value;
}

function split(date: CivilDate): { year: number; month: number; day: number } {
  return {
    year: Number(date.slice(0, 4)),
    month: Number(date.slice(5, 7)),
    day: Number(date.slice(8, 10)),
  };
}

export function daysInMonth(year: number, month: number): number {
  // Day 0 of the next month is the last day of this one.
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function toUtcMs(date: CivilDate): number {
  const { year, month, day } = split(date);
  return Date.UTC(year, month - 1, day);
}

function fromUtcMs(ms: number): CivilDate {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Signed day count from `from` to `to`. Negative when `to` is earlier. */
export function diffDays(from: CivilDate, to: CivilDate): number {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / MS_PER_DAY);
}

export function addDays(date: CivilDate, days: number): CivilDate {
  return fromUtcMs(toUtcMs(date) + days * MS_PER_DAY);
}

/**
 * Add calendar months, clamping to the end of the target month.
 *
 *   addMonths("2026-01-31", 1)  -> "2026-02-28"
 *   addMonths("2026-08-31", 6)  -> "2027-02-28"
 *   addMonths("2026-03-30", -1) -> "2026-02-28"
 */
export function addMonths(date: CivilDate, months: number): CivilDate {
  const { year, month, day } = split(date);
  const total = year * 12 + (month - 1) + months;
  const targetYear = Math.floor(total / 12);
  const targetMonth = total - targetYear * 12 + 1;
  const clampedDay = Math.min(day, daysInMonth(targetYear, targetMonth));
  const mm = String(targetMonth).padStart(2, "0");
  const dd = String(clampedDay).padStart(2, "0");
  return `${targetYear}-${mm}-${dd}`;
}

/** Sort comparator. Lexicographic order is chronological for this format. */
export function compareDates(a: CivilDate, b: CivilDate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function maxDate(a: CivilDate, b: CivilDate): CivilDate {
  return a >= b ? a : b;
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

/** "2026-08-30" -> "30 Aug 2026". Deliberately not locale-dependent. */
export function formatDate(date: CivilDate): string {
  const { year, month, day } = split(date);
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

/** "2026-08-30" -> "30 Aug". For dense table cells. */
export function formatDateShort(date: CivilDate): string {
  const { month, day } = split(date);
  return `${day} ${MONTHS[month - 1]}`;
}

/** Human phrasing for a signed day offset, e.g. "12 days overdue", "in 5 days". */
export function formatDayOffset(days: number): string {
  if (days === 0) return "due today";
  if (days < 0) {
    const n = Math.abs(days);
    return `${n} ${n === 1 ? "day" : "days"} overdue`;
  }
  return `in ${days} ${days === 1 ? "day" : "days"}`;
}

/** Today from the system clock, as a civil date. Used only as a seed default. */
export function todayFromClock(): CivilDate {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${mm}-${dd}`;
}
