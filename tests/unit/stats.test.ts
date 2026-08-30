import { describe, expect, it } from "vitest";
import {
  ruleBreakdown,
  statusBreakdown,
  summarise,
  topItemsByValue,
} from "@/lib/domain/stats";
import type { DueAssessment, DueStatus, ServiceRule } from "@/lib/domain/types";

function item(
  name: string,
  status: DueStatus,
  rule: ServiceRule,
  costPaisa: number,
  daysUntilDue: number | null = null,
): DueAssessment {
  return {
    itemName: name,
    rule,
    status,
    dueDate: status === "no_estimate" ? null : "2026-09-01",
    daysUntilDue,
    basis: "test",
    costPaisa,
  };
}

const fleet: DueAssessment[] = [
  item("Tyres", "overdue", "distance_km", 3_200_000, -40),
  item("Brake pads", "overdue", "distance_km", 600_000, -10),
  item("Engine oil", "due_soon", "period_months", 350_000, 12),
  item("Insurance", "fine", "fixed_date", 1_200_000, 200),
  item("Coolant", "no_estimate", "period_months", 100_000, null),
];

describe("statusBreakdown", () => {
  it("counts every status and reports its share", () => {
    const slices = statusBreakdown(fleet);
    expect(slices.map((s) => s.status)).toEqual([
      "overdue",
      "due_soon",
      "fine",
      "no_estimate",
    ]);
    expect(slices[0]!.count).toBe(2);
    expect(slices[0]!.share).toBe(40);
    expect(slices[0]!.valuePaisa).toBe(3_800_000);
  });

  it("shares sum to 100 across the whole fleet", () => {
    const total = statusBreakdown(fleet).reduce((sum, s) => sum + s.share, 0);
    expect(total).toBeCloseTo(100, 1);
  });

  it("returns zeroed slices rather than dividing by zero", () => {
    const slices = statusBreakdown([]);
    expect(slices).toHaveLength(4);
    expect(slices.every((s) => s.count === 0 && s.share === 0)).toBe(true);
  });
});

describe("ruleBreakdown", () => {
  it("separates what is due from what merely exists", () => {
    const slices = ruleBreakdown(fleet);
    const distance = slices.find((s) => s.rule === "distance_km")!;
    expect(distance.count).toBe(2);
    expect(distance.actionable).toBe(2);
    expect(distance.valuePaisa).toBe(3_800_000);

    // Insurance is fine, so it counts but carries no outstanding value.
    const fixed = slices.find((s) => s.rule === "fixed_date")!;
    expect(fixed.count).toBe(1);
    expect(fixed.actionable).toBe(0);
    expect(fixed.valuePaisa).toBe(0);
  });

  it("always reports all three rules, even at zero", () => {
    expect(ruleBreakdown([]).map((s) => s.rule)).toEqual([
      "fixed_date",
      "period_months",
      "distance_km",
    ]);
  });
});

describe("topItemsByValue", () => {
  it("ranks by outstanding money, not by count", () => {
    const many = [
      ...Array.from({ length: 9 }, (_, i) => item(`Air filter`, "due_soon", "period_months", 120_000, i)),
      item("Tyres", "overdue", "distance_km", 3_200_000, -5),
    ];
    const ranked = topItemsByValue(many);
    // Nine air filters at 1,200 total less than one set of tyres.
    expect(ranked[0]!.name).toBe("Tyres");
    expect(ranked[1]!.name).toBe("Air filter");
    expect(ranked[1]!.count).toBe(9);
  });

  it("counts only outstanding work", () => {
    const ranked = topItemsByValue(fleet);
    // Insurance is fine and Coolant has no estimate: neither is outstanding.
    expect(ranked.map((r) => r.name)).not.toContain("Insurance");
    expect(ranked.map((r) => r.name)).not.toContain("Coolant");
  });

  it("respects the limit", () => {
    const many = Array.from({ length: 20 }, (_, i) =>
      item(`Item ${i}`, "overdue", "fixed_date", (i + 1) * 1000, -1),
    );
    expect(topItemsByValue(many, 5)).toHaveLength(5);
  });
});

describe("summarise", () => {
  it("totals only what needs acting on", () => {
    const s = summarise(fleet);
    expect(s.items).toBe(5);
    expect(s.actionable).toBe(3);
    expect(s.overdue).toBe(2);
    expect(s.dueSoon).toBe(1);
    // Overdue + due soon, excluding the fine and unestimatable items.
    expect(s.valueAtRiskPaisa).toBe(4_150_000);
    expect(s.overdueValuePaisa).toBe(3_800_000);
    expect(s.worstDaysOverdue).toBe(40);
  });

  it("reports zero rather than -Infinity on an empty fleet", () => {
    const s = summarise([]);
    expect(s.worstDaysOverdue).toBe(0);
    expect(s.valueAtRiskPaisa).toBe(0);
  });
});
