import { describe, expect, it } from "vitest";
import { assessItem, assessVehicle, DUE_SOON_DAYS, isActionable, lastServiceOf } from "@/lib/domain/due";
import type { ServiceItem, Vehicle } from "@/lib/domain/types";

const ASOF = "2026-08-30";

/** A vehicle running a steady 50 km/day, currently on 60,050 km. */
function vehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    id: "V01",
    ownerId: "O01",
    model: "Toyota Axio",
    plate: "Dhaka Metro Ga 12-3456",
    odometerReadings: [
      { date: "2026-07-31", km: 58_550 },
      { date: "2026-08-30", km: 60_050 },
    ],
    serviceItems: [],
    serviceHistory: [],
    ...overrides,
  };
}

const fixed = (dueDate: string): ServiceItem => ({
  name: "Insurance",
  rule: "fixed_date",
  dueDate,
  costPaisa: 1_200_000,
});

const period = (everyMonths: number): ServiceItem => ({
  name: "Air filter",
  rule: "period_months",
  everyMonths,
  costPaisa: 120_000,
});

const distance = (everyKm: number): ServiceItem => ({
  name: "Brake pads",
  rule: "distance_km",
  everyKm,
  costPaisa: 600_000,
});

describe("fixed_date rule", () => {
  it("uses the recorded expiry date directly", () => {
    const result = assessItem(fixed("2026-09-04"), vehicle(), ASOF);
    expect(result.dueDate).toBe("2026-09-04");
    expect(result.daysUntilDue).toBe(5);
    expect(result.status).toBe("due_soon");
    expect(result.basis).toContain("4 Sep 2026");
  });

  it("marks a past expiry overdue", () => {
    const result = assessItem(fixed("2026-08-25"), vehicle(), ASOF);
    expect(result.status).toBe("overdue");
    expect(result.daysUntilDue).toBe(-5);
  });

  it("degrades to no_estimate when the date is missing", () => {
    const result = assessItem({ ...fixed("2026-09-04"), dueDate: undefined }, vehicle(), ASOF);
    expect(result.status).toBe("no_estimate");
    expect(result.dueDate).toBeNull();
  });
});

describe("period_months rule", () => {
  it("counts months from the last service", () => {
    const v = vehicle({
      serviceHistory: [{ item: "Air filter", date: "2026-02-26", km: null, costPaisa: 120_000 }],
    });
    const result = assessItem(period(6), v, ASOF);
    expect(result.dueDate).toBe("2026-08-26");
    expect(result.status).toBe("overdue");
    expect(result.basis).toBe("Last done 26 Feb 2026 + 6 months");
  });

  it("clamps month-end dates instead of overflowing", () => {
    const v = vehicle({
      serviceHistory: [{ item: "Air filter", date: "2026-01-31", km: null, costPaisa: 120_000 }],
    });
    expect(assessItem(period(1), v, ASOF).dueDate).toBe("2026-02-28");
  });

  it("reports never-serviced items rather than guessing", () => {
    const result = assessItem(period(6), vehicle(), ASOF);
    expect(result.status).toBe("no_estimate");
    expect(result.basis).toContain("Never serviced");
  });

  it("uses the most recent service when several exist", () => {
    const v = vehicle({
      serviceHistory: [
        { item: "Air filter", date: "2025-08-26", km: null, costPaisa: 120_000 },
        { item: "Air filter", date: "2026-05-26", km: null, costPaisa: 120_000 },
      ],
    });
    expect(assessItem(period(6), v, ASOF).dueDate).toBe("2026-11-26");
  });
});

describe("distance_km rule", () => {
  const serviced = (km: number) =>
    vehicle({
      serviceHistory: [{ item: "Brake pads", date: "2026-04-11", km, costPaisa: 600_000 }],
    });

  it("projects a due date from the vehicle's own daily running", () => {
    // Serviced at 50,050 km with a 10,000 km interval gives a 60,050 km target.
    // The odometer reads exactly 60,050, so it falls due today.
    const result = assessItem(distance(10_000), serviced(50_050), ASOF);
    expect(result.dailyKm).toBe(50);
    expect(result.kmRemaining).toBe(0);
    expect(result.dueDate).toBe(ASOF);
    expect(result.daysUntilDue).toBe(0);
    expect(result.status).toBe("due_soon");
  });

  it("converts remaining km into days at that vehicle's rate", () => {
    // Target 61,050, current 60,050: 1,000 km to go at 50 km/day is 20 days.
    const result = assessItem(distance(11_000), serviced(50_050), ASOF);
    expect(result.kmRemaining).toBe(1_000);
    expect(result.daysUntilDue).toBe(20);
    expect(result.dueDate).toBe("2026-09-19");
    expect(result.basis).toBe("Runs 50.0 km/day · 1,000 km to go");
  });

  it("back-dates an item whose target km has already passed", () => {
    // Target 55,050, current 60,050: 5,000 km past due at 50 km/day is 100 days.
    const result = assessItem(distance(5_000), serviced(50_050), ASOF);
    expect(result.kmRemaining).toBe(-5_000);
    expect(result.status).toBe("overdue");
    expect(result.daysUntilDue).toBe(-100);
    expect(result.basis).toBe("Runs 50.0 km/day · 5,000 km past due");
  });

  // The brief's core constraint: same interval, same last service, different
  // daily running must produce different dates.
  it("gives a faster vehicle an earlier due date than a slower one", () => {
    const history = [{ item: "Brake pads", date: "2026-04-11", km: 50_050, costPaisa: 600_000 }];
    const fast = vehicle({
      serviceHistory: history,
      odometerReadings: [
        { date: "2026-07-31", km: 57_050 },
        { date: "2026-08-30", km: 60_050 },
      ],
    });
    const slow = vehicle({
      serviceHistory: history,
      odometerReadings: [
        { date: "2026-07-31", km: 59_750 },
        { date: "2026-08-30", km: 60_050 },
      ],
    });
    const fastResult = assessItem(distance(11_000), fast, ASOF);
    const slowResult = assessItem(distance(11_000), slow, ASOF);

    expect(fastResult.dailyKm).toBe(100);
    expect(slowResult.dailyKm).toBe(10);
    expect(fastResult.daysUntilDue).toBe(10);
    expect(slowResult.daysUntilDue).toBe(100);
    expect(fastResult.dueDate! < slowResult.dueDate!).toBe(true);
  });

  it("refuses to estimate without enough odometer history", () => {
    const oneReading = vehicle({
      odometerReadings: [{ date: "2026-08-30", km: 60_050 }],
      serviceHistory: [{ item: "Brake pads", date: "2026-04-11", km: 50_050, costPaisa: 600_000 }],
    });
    const result = assessItem(distance(10_000), oneReading, ASOF);
    expect(result.status).toBe("no_estimate");
    expect(result.dueDate).toBeNull();
  });

  it("refuses to estimate for a vehicle that has not moved", () => {
    const parked = vehicle({
      odometerReadings: [
        { date: "2026-07-31", km: 60_050 },
        { date: "2026-08-30", km: 60_050 },
      ],
      serviceHistory: [{ item: "Brake pads", date: "2026-04-11", km: 50_050, costPaisa: 600_000 }],
    });
    // A zero rate would divide to Infinity; it must degrade instead.
    const result = assessItem(distance(10_000), parked, ASOF);
    expect(result.status).toBe("no_estimate");
    expect(result.basis).toContain("daily running");
  });

  it("refuses to estimate when the last service has no odometer reading", () => {
    const v = vehicle({
      serviceHistory: [{ item: "Brake pads", date: "2026-04-11", km: null, costPaisa: 600_000 }],
    });
    const result = assessItem(distance(10_000), v, ASOF);
    expect(result.status).toBe("no_estimate");
    expect(result.basis).toContain("no odometer reading");
  });
});

describe("status boundaries", () => {
  it("treats today as due_soon and yesterday as overdue", () => {
    expect(assessItem(fixed("2026-08-30"), vehicle(), ASOF).status).toBe("due_soon");
    expect(assessItem(fixed("2026-08-29"), vehicle(), ASOF).status).toBe("overdue");
  });

  it("puts the far edge of the window in due_soon and one day later in fine", () => {
    // DUE_SOON_DAYS is 30, so 29 Sep is day 30 and 30 Sep is day 31.
    expect(assessItem(fixed("2026-09-29"), vehicle(), ASOF).daysUntilDue).toBe(DUE_SOON_DAYS);
    expect(assessItem(fixed("2026-09-29"), vehicle(), ASOF).status).toBe("due_soon");
    expect(assessItem(fixed("2026-09-30"), vehicle(), ASOF).status).toBe("fine");
  });

  it("counts overdue and due_soon as actionable, nothing else", () => {
    expect(isActionable(assessItem(fixed("2026-08-01"), vehicle(), ASOF))).toBe(true);
    expect(isActionable(assessItem(fixed("2026-09-04"), vehicle(), ASOF))).toBe(true);
    expect(isActionable(assessItem(fixed("2027-09-04"), vehicle(), ASOF))).toBe(false);
    expect(isActionable(assessItem(period(6), vehicle(), ASOF))).toBe(false);
  });
});

describe("assessVehicle", () => {
  it("returns every item, most urgent first", () => {
    const v = vehicle({
      serviceItems: [fixed("2027-01-31"), period(6), distance(11_000), { ...fixed("2026-08-25"), name: "Battery warranty" }],
      serviceHistory: [
        { item: "Air filter", date: "2026-02-26", km: null, costPaisa: 120_000 },
        { item: "Brake pads", date: "2026-04-11", km: 50_050, costPaisa: 600_000 },
      ],
    });
    const results = assessVehicle(v, ASOF);
    expect(results).toHaveLength(4);
    expect(results.map((r) => r.daysUntilDue)).toEqual([-5, -4, 20, 154]);
    expect(results.every((r) => r.status !== "no_estimate")).toBe(true);
  });

  it("sorts unestimatable items last instead of dropping them", () => {
    const v = vehicle({
      serviceItems: [period(6), fixed("2026-09-04")],
      serviceHistory: [],
    });
    const results = assessVehicle(v, ASOF);
    expect(results.map((r) => r.status)).toEqual(["due_soon", "no_estimate"]);
  });
});

describe("lastServiceOf", () => {
  it("ignores records belonging to other items", () => {
    const history = [
      { item: "Tyres", date: "2026-06-01", km: 55_000, costPaisa: 3_200_000 },
      { item: "Brake pads", date: "2026-04-11", km: 50_050, costPaisa: 600_000 },
    ];
    expect(lastServiceOf(history, "Brake pads")?.date).toBe("2026-04-11");
    expect(lastServiceOf(history, "Coolant")).toBeNull();
  });
});
