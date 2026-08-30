import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  daysInMonth,
  diffDays,
  formatDate,
  formatDayOffset,
  isCivilDate,
} from "@/lib/domain/civilDate";

describe("addMonths", () => {
  // The seed data has 113 service records dated on the 29th-31st. Date.setMonth
  // would roll these into the following month and produce wrong due dates.
  it("clamps to the last day of a shorter target month", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2026-08-31", 6)).toBe("2027-02-28");
    expect(addMonths("2026-03-31", 1)).toBe("2026-04-30");
    expect(addMonths("2026-05-31", 1)).toBe("2026-06-30");
  });

  it("clamps into a leap February", () => {
    expect(addMonths("2024-01-30", 1)).toBe("2024-02-29");
    expect(addMonths("2023-01-30", 1)).toBe("2023-02-28");
  });

  it("keeps the day when the target month is long enough", () => {
    expect(addMonths("2026-02-26", 6)).toBe("2026-08-26");
    expect(addMonths("2026-04-12", 3)).toBe("2026-07-12");
    expect(addMonths("2026-07-04", 12)).toBe("2027-07-04");
  });

  it("rolls across year boundaries in both directions", () => {
    expect(addMonths("2026-11-15", 3)).toBe("2027-02-15");
    expect(addMonths("2026-02-15", -3)).toBe("2025-11-15");
    expect(addMonths("2026-03-30", -1)).toBe("2026-02-28");
    expect(addMonths("2026-01-15", -12)).toBe("2025-01-15");
  });

  it("is a no-op for zero", () => {
    expect(addMonths("2026-08-30", 0)).toBe("2026-08-30");
  });
});

describe("diffDays and addDays", () => {
  it("counts signed days across a month boundary", () => {
    expect(diffDays("2026-08-30", "2026-09-04")).toBe(5);
    expect(diffDays("2026-09-04", "2026-08-30")).toBe(-5);
    expect(diffDays("2026-08-30", "2026-08-30")).toBe(0);
  });

  it("counts across a leap day", () => {
    expect(diffDays("2024-02-28", "2024-03-01")).toBe(2);
    expect(diffDays("2023-02-28", "2023-03-01")).toBe(1);
  });

  it("round-trips with addDays", () => {
    expect(addDays("2026-08-30", 5)).toBe("2026-09-04");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(addDays("2026-08-30", 365)).toBe("2027-08-30");
  });

  // Guards the "new Date('2026-08-30') is UTC midnight" trap: any local-time
  // arithmetic would shift these by a day west of Greenwich.
  it("does not drift when adding and subtracting the same offset", () => {
    const start = "2026-08-30";
    for (const offset of [1, 7, 30, 200, -45]) {
      expect(addDays(addDays(start, offset), -offset)).toBe(start);
    }
  });
});

describe("isCivilDate", () => {
  it("accepts real dates and rejects impossible ones", () => {
    expect(isCivilDate("2026-08-30")).toBe(true);
    expect(isCivilDate("2024-02-29")).toBe(true);
    expect(isCivilDate("2023-02-29")).toBe(false);
    expect(isCivilDate("2026-13-01")).toBe(false);
    expect(isCivilDate("2026-04-31")).toBe(false);
    expect(isCivilDate("30-08-2026")).toBe(false);
    expect(isCivilDate("")).toBe(false);
    expect(isCivilDate(null)).toBe(false);
  });
});

describe("daysInMonth", () => {
  it("knows February", () => {
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2026, 1)).toBe(31);
    expect(daysInMonth(2026, 4)).toBe(30);
  });
});

describe("formatting", () => {
  it("renders a readable date", () => {
    expect(formatDate("2026-08-30")).toBe("30 Aug 2026");
    expect(formatDate("2026-01-05")).toBe("5 Jan 2026");
  });

  it("phrases day offsets", () => {
    expect(formatDayOffset(0)).toBe("due today");
    expect(formatDayOffset(-1)).toBe("1 day overdue");
    expect(formatDayOffset(-266)).toBe("266 days overdue");
    expect(formatDayOffset(12)).toBe("in 12 days");
  });
});
