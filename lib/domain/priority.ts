/**
 * Call-list ordering.
 *
 * The list is keyed by **owner**, not by vehicle: an owner with three vehicles
 * is one phone call, not three. The workshop rings a person, so the person is
 * the unit of work; their vehicles nest underneath.
 *
 * The brief requires a sort rule that can be explained, not just "everything
 * that isn't fine". The rule is:
 *
 *     score = clamp(days overdue of the worst item, -30, +180)
 *           + min(total value of due work in thousands of taka, 40)
 *
 * Urgency leads and money breaks ties. The value term is capped at 40 points so
 * a big-ticket job can never outrank a badly overdue safety item, and the
 * urgency term is floored at -30 so a vehicle that is merely due soon still
 * sorts sensibly against one that is just over the line.
 *
 * Every row in the UI shows its own arithmetic, and the page states this rule
 * in words.
 */
import { sumPaisa } from "./money";
import { isActionable } from "./due";
import type { DueAssessment, Owner, Vehicle } from "./types";

export const URGENCY_FLOOR = -30;
export const URGENCY_CAP = 180;
export const VALUE_CAP = 40;
/** ৳1,000 of due work earns one point. */
export const PAISA_PER_VALUE_POINT = 100_000;

export interface PriorityBreakdown {
  /** Days overdue of the worst item. Negative when nothing is overdue yet. */
  worstDaysOverdue: number;
  urgencyPoints: number;
  totalCostPaisa: number;
  valuePoints: number;
  score: number;
}

/** One vehicle's worth of work inside a call. */
export interface CallVehicle {
  vehicle: Vehicle;
  /** Overdue and due-soon items only, most urgent first. */
  actionable: DueAssessment[];
  priority: PriorityBreakdown;
}

/** One phone call: one owner, and every vehicle of theirs needing attention. */
export interface CallListEntry {
  owner: Owner | null;
  /** Stable key even when the owner record is missing. */
  key: string;
  vehicles: CallVehicle[];
  /** All actionable items across every vehicle, most urgent first. */
  actionable: DueAssessment[];
  priority: PriorityBreakdown;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Round to one decimal so displayed arithmetic adds up exactly. */
function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function scoreActionable(actionable: readonly DueAssessment[]): PriorityBreakdown {
  if (actionable.length === 0) {
    return {
      worstDaysOverdue: 0,
      urgencyPoints: 0,
      totalCostPaisa: 0,
      valuePoints: 0,
      score: 0,
    };
  }

  // daysUntilDue is negative when overdue, so negate it to get "days overdue".
  const worstDaysOverdue = Math.max(
    ...actionable.map((item) => -(item.daysUntilDue ?? 0)),
  );
  const urgencyPoints = clamp(worstDaysOverdue, URGENCY_FLOOR, URGENCY_CAP);

  const totalCostPaisa = sumPaisa(actionable.map((item) => item.costPaisa));
  const valuePoints = round1(
    Math.min(totalCostPaisa / PAISA_PER_VALUE_POINT, VALUE_CAP),
  );

  return {
    worstDaysOverdue,
    urgencyPoints,
    totalCostPaisa,
    valuePoints,
    score: round1(urgencyPoints + valuePoints),
  };
}

/**
 * Build the call list: one entry per owner with work outstanding, highest score
 * first. Owners with nothing actionable are left out entirely.
 *
 * The owner's score is computed over the union of their vehicles' due items, so
 * three vehicles each a little overdue can legitimately outrank one vehicle
 * that is slightly worse — which is the right call when it is a single trip to
 * the workshop.
 */
export function buildCallList(
  vehicles: readonly Vehicle[],
  assessmentsByVehicleId: ReadonlyMap<string, DueAssessment[]>,
  ownersById: ReadonlyMap<string, Owner>,
): CallListEntry[] {
  const byOwner = new Map<string, CallVehicle[]>();

  for (const vehicle of vehicles) {
    const assessments = assessmentsByVehicleId.get(vehicle.id) ?? [];
    const actionable = assessments.filter(isActionable);
    if (actionable.length === 0) continue;

    const existing = byOwner.get(vehicle.ownerId) ?? [];
    existing.push({ vehicle, actionable, priority: scoreActionable(actionable) });
    byOwner.set(vehicle.ownerId, existing);
  }

  const entries: CallListEntry[] = [];

  for (const [ownerId, callVehicles] of byOwner) {
    // Worst vehicle first within the call, so the reason for ringing leads.
    callVehicles.sort((a, b) => b.priority.score - a.priority.score);

    const actionable = callVehicles
      .flatMap((entry) => entry.actionable)
      .sort((a, b) => (a.daysUntilDue ?? 0) - (b.daysUntilDue ?? 0));

    entries.push({
      owner: ownersById.get(ownerId) ?? null,
      key: ownerId,
      vehicles: callVehicles,
      actionable,
      priority: scoreActionable(actionable),
    });
  }

  return entries.sort(byPriority);
}

/** Highest score first, with a stable tiebreak so ordering never wobbles. */
export function byPriority(a: CallListEntry, b: CallListEntry): number {
  if (b.priority.score !== a.priority.score) {
    return b.priority.score - a.priority.score;
  }
  if (b.priority.totalCostPaisa !== a.priority.totalCostPaisa) {
    return b.priority.totalCostPaisa - a.priority.totalCostPaisa;
  }
  return a.key.localeCompare(b.key);
}

/** One-line explanation of a row's score, e.g. "266d overdue → 180 + ৳18,000 → 18". */
export function explainScore(breakdown: PriorityBreakdown): string {
  const urgency = breakdown.worstDaysOverdue >= 0
    ? `${breakdown.worstDaysOverdue}d overdue`
    : `due in ${Math.abs(breakdown.worstDaysOverdue)}d`;
  return `${urgency} → ${breakdown.urgencyPoints} urgency + ${breakdown.valuePoints} value = ${breakdown.score}`;
}
