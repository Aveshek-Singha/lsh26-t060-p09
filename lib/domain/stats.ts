import { sumPaisa } from "./money";
import { isActionable } from "./due";
import type { DueAssessment, DueStatus, ServiceRule } from "./types";

/**
 * Dashboard arithmetic.
 *
 * Pure and separate from rendering, so the figures a judge reads on screen are
 * the same ones the unit tests assert. Nothing here reads the clock or the
 * database.
 */

export interface StatusSlice {
  status: DueStatus;
  label: string;
  count: number;
  valuePaisa: number;
  /** Share of all items, 0–100, rounded to one decimal. */
  share: number;
}

export interface RuleSlice {
  rule: ServiceRule;
  label: string;
  count: number;
  actionable: number;
  valuePaisa: number;
  share: number;
}

export interface ItemSlice {
  name: string;
  count: number;
  valuePaisa: number;
}

const STATUS_LABELS: Record<DueStatus, string> = {
  overdue: "Overdue",
  due_soon: "Due soon",
  fine: "Fine",
  no_estimate: "No estimate",
};

const RULE_LABELS: Record<ServiceRule, string> = {
  fixed_date: "Fixed date",
  period_months: "Time",
  distance_km: "Distance",
};

/** Ordered worst-first, which is the order the reader cares about. */
const STATUS_ORDER: DueStatus[] = ["overdue", "due_soon", "fine", "no_estimate"];
const RULE_ORDER: ServiceRule[] = ["fixed_date", "period_months", "distance_km"];

function share(part: number, whole: number): number {
  if (whole === 0) return 0;
  return Math.round((part / whole) * 1000) / 10;
}

export function statusBreakdown(assessments: readonly DueAssessment[]): StatusSlice[] {
  const total = assessments.length;
  return STATUS_ORDER.map((status) => {
    const matching = assessments.filter((a) => a.status === status);
    return {
      status,
      label: STATUS_LABELS[status],
      count: matching.length,
      valuePaisa: sumPaisa(matching.map((a) => a.costPaisa)),
      share: share(matching.length, total),
    };
  });
}

export function ruleBreakdown(assessments: readonly DueAssessment[]): RuleSlice[] {
  const total = assessments.length;
  return RULE_ORDER.map((rule) => {
    const matching = assessments.filter((a) => a.rule === rule);
    const actionable = matching.filter(isActionable);
    return {
      rule,
      label: RULE_LABELS[rule],
      count: matching.length,
      actionable: actionable.length,
      valuePaisa: sumPaisa(actionable.map((a) => a.costPaisa)),
      share: share(matching.length, total),
    };
  });
}

/**
 * Which service items carry the most outstanding money.
 *
 * Sorted by value rather than count, because that is what the workshop is
 * deciding about: a hundred air filters matter less than a dozen sets of tyres.
 */
export function topItemsByValue(
  assessments: readonly DueAssessment[],
  limit = 8,
): ItemSlice[] {
  const byName = new Map<string, ItemSlice>();

  for (const assessment of assessments.filter(isActionable)) {
    const existing = byName.get(assessment.itemName);
    if (existing) {
      existing.count += 1;
      existing.valuePaisa += assessment.costPaisa;
    } else {
      byName.set(assessment.itemName, {
        name: assessment.itemName,
        count: 1,
        valuePaisa: assessment.costPaisa,
      });
    }
  }

  return [...byName.values()]
    .sort((a, b) => b.valuePaisa - a.valuePaisa || a.name.localeCompare(b.name))
    .slice(0, limit);
}

export interface FleetTotalsSummary {
  items: number;
  actionable: number;
  overdue: number;
  dueSoon: number;
  valueAtRiskPaisa: number;
  /** Value of overdue work only — the part already costing the customer. */
  overdueValuePaisa: number;
  worstDaysOverdue: number;
}

export function summarise(assessments: readonly DueAssessment[]): FleetTotalsSummary {
  const actionable = assessments.filter(isActionable);
  const overdue = assessments.filter((a) => a.status === "overdue");

  return {
    items: assessments.length,
    actionable: actionable.length,
    overdue: overdue.length,
    dueSoon: assessments.filter((a) => a.status === "due_soon").length,
    valueAtRiskPaisa: sumPaisa(actionable.map((a) => a.costPaisa)),
    overdueValuePaisa: sumPaisa(overdue.map((a) => a.costPaisa)),
    worstDaysOverdue: overdue.reduce(
      (worst, a) => Math.max(worst, -(a.daysUntilDue ?? 0)),
      0,
    ),
  };
}
