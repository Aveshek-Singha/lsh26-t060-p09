import { describe, expect, it } from "vitest";
import {
  buildCallList,
  byPriority,
  explainScore,
  scoreActionable,
  URGENCY_CAP,
  URGENCY_FLOOR,
  VALUE_CAP,
} from "@/lib/domain/priority";
import type { DueAssessment, Owner, Vehicle } from "@/lib/domain/types";

function due(daysUntilDue: number, costPaisa: number, itemName = "Brake pads"): DueAssessment {
  return {
    itemName,
    rule: "fixed_date",
    status: daysUntilDue < 0 ? "overdue" : "due_soon",
    dueDate: "2026-08-30",
    daysUntilDue,
    basis: "test",
    costPaisa,
  };
}

describe("scoreActionable", () => {
  it("adds urgency and value points", () => {
    // 40 days overdue, ৳12,000 of work -> 40 + 12 = 52
    const result = scoreActionable([due(-40, 1_200_000)]);
    expect(result.worstDaysOverdue).toBe(40);
    expect(result.urgencyPoints).toBe(40);
    expect(result.valuePoints).toBe(12);
    expect(result.score).toBe(52);
  });

  it("takes urgency from the worst item and value from all of them", () => {
    const result = scoreActionable([due(-10, 100_000), due(-90, 200_000), due(5, 300_000)]);
    expect(result.worstDaysOverdue).toBe(90);
    expect(result.totalCostPaisa).toBe(600_000);
    expect(result.valuePoints).toBe(6);
    expect(result.score).toBe(96);
  });

  it("caps urgency so an ancient item cannot run away with the list", () => {
    const result = scoreActionable([due(-500, 0)]);
    expect(result.worstDaysOverdue).toBe(500);
    expect(result.urgencyPoints).toBe(URGENCY_CAP);
  });

  it("floors urgency for vehicles that are only due soon", () => {
    const result = scoreActionable([due(45, 0)]);
    expect(result.urgencyPoints).toBe(URGENCY_FLOOR);
  });

  it("caps value so expensive work cannot outrank a badly overdue item", () => {
    const expensive = scoreActionable([due(1, 100_000_000)]);
    expect(expensive.valuePoints).toBe(VALUE_CAP);

    const overdueSafety = scoreActionable([due(-200, 600_000)]);
    // Even ৳1,000,000 of work due tomorrow loses to a 200-day-overdue item.
    expect(overdueSafety.score).toBeGreaterThan(expensive.score);
  });

  it("returns a zeroed breakdown for a vehicle with nothing to do", () => {
    expect(scoreActionable([]).score).toBe(0);
  });

  it("keeps displayed arithmetic exact to one decimal", () => {
    const result = scoreActionable([due(-3, 125_000)]);
    expect(result.valuePoints).toBe(1.3);
    expect(result.score).toBe(4.3);
    expect(result.urgencyPoints + result.valuePoints).toBe(result.score);
  });
});

describe("buildCallList", () => {
  const vehicle = (id: string, plate: string, ownerId = "O01"): Vehicle => ({
    id,
    ownerId,
    model: "Toyota Axio",
    plate,
    odometerReadings: [],
    serviceItems: [],
    serviceHistory: [],
  });

  const owner: Owner = { id: "O01", name: "Salma Ahmed", phone: "01481704039" };

  it("orders by score and leaves out vehicles with nothing due", () => {
    const vehicles = [
      vehicle("V01", "Ga 12-3456"),
      vehicle("V02", "Cha 76-9961"),
      vehicle("V03", "Kha 45-1122"),
    ];
    const assessments = new Map<string, DueAssessment[]>([
      ["V01", [due(5, 100_000)]],
      ["V02", [due(-120, 1_800_000)]],
      ["V03", [{ ...due(400, 0), status: "fine" }]],
    ]);

    const list = buildCallList(vehicles, assessments, new Map([[owner.id, owner]]));

    expect(list.map((e) => e.vehicle.id)).toEqual(["V02", "V01"]);
    expect(list[0]!.priority.score).toBe(138);
    expect(list[0]!.owner?.name).toBe("Salma Ahmed");
  });

  it("keeps a vehicle whose owner record is missing rather than dropping it", () => {
    const list = buildCallList(
      [vehicle("V09", "Ga 99-0000", "MISSING")],
      new Map([["V09", [due(-5, 100_000)]]]),
      new Map(),
    );
    expect(list).toHaveLength(1);
    expect(list[0]!.owner).toBeNull();
  });

  it("returns an empty list when the whole fleet is fine", () => {
    const list = buildCallList(
      [vehicle("V01", "Ga 12-3456")],
      new Map([["V01", [{ ...due(200, 0), status: "fine" }]]]),
      new Map(),
    );
    expect(list).toEqual([]);
  });

  it("breaks score ties deterministically", () => {
    const a = { vehicle: vehicle("V01", "Aa 11-1111"), owner: null, actionable: [], priority: scoreActionable([due(-10, 100_000)]) };
    const b = { vehicle: vehicle("V02", "Bb 22-2222"), owner: null, actionable: [], priority: scoreActionable([due(-10, 100_000)]) };
    expect(byPriority(a, b)).toBeLessThan(0);
    expect(byPriority(b, a)).toBeGreaterThan(0);
  });
});

describe("explainScore", () => {
  it("states the arithmetic behind a row", () => {
    expect(explainScore(scoreActionable([due(-266, 1_800_000)]))).toBe(
      "266d overdue → 180 urgency + 18 value = 198",
    );
  });

  it("phrases a not-yet-overdue vehicle correctly", () => {
    expect(explainScore(scoreActionable([due(12, 600_000)]))).toBe(
      "due in 12d → -12 urgency + 6 value = -6",
    );
  });
});
