import { describe, expect, it } from "vitest";
import {
  buildMailDraft,
  buildReminder,
  buildReminderSubject,
  MAILTO_LIMIT,
  type VehicleWork,
} from "@/features/owner/reminder";
import type { DueAssessment, Owner, Vehicle } from "@/lib/domain/types";

const owner: Owner = {
  id: "O01",
  name: "Salma Ahmed",
  phone: "01481704039",
  email: "salma.ahmed@example.com",
};

function vehicle(id: string, plate: string): Vehicle {
  return {
    id,
    ownerId: "O01",
    model: "Toyota Axio",
    plate,
    odometerReadings: [],
    serviceItems: [],
    serviceHistory: [],
  };
}

function due(name: string, daysUntilDue: number, costPaisa: number): DueAssessment {
  return {
    itemName: name,
    rule: "fixed_date",
    status: daysUntilDue < 0 ? "overdue" : "due_soon",
    dueDate: "2026-09-15",
    daysUntilDue,
    basis: "test",
    costPaisa,
  };
}

const work: VehicleWork[] = [
  { vehicle: vehicle("V01", "Dhaka Metro Cha 76-9961"), actionable: [due("Tyres", -5, 3_200_000)] },
  { vehicle: vehicle("V02", "Dhaka Metro Kha 78-5349"), actionable: [due("Engine oil", 12, 350_000)] },
];

describe("buildReminderSubject", () => {
  it("names the vehicle when there is only one", () => {
    expect(buildReminderSubject([work[0]!])).toBe("Service due on Dhaka Metro Cha 76-9961");
  });

  it("counts the rest when an owner has several", () => {
    expect(buildReminderSubject(work)).toBe(
      "Service due on Dhaka Metro Cha 76-9961 and 1 other vehicle",
    );
  });

  it("pluralises beyond two", () => {
    const three = [...work, { vehicle: vehicle("V03", "Ga 11-1111"), actionable: [due("Coolant", 3, 100_000)] }];
    expect(buildReminderSubject(three)).toContain("2 other vehicles");
  });

  it("falls back when nothing is actionable", () => {
    expect(buildReminderSubject([{ vehicle: vehicle("V01", "Ga 1"), actionable: [] }])).toBe(
      "Service reminder from the workshop",
    );
  });
});

describe("buildMailDraft", () => {
  const body = buildReminder(owner, work, "2026-08-30");

  it("addresses the owner and carries the message", () => {
    const draft = buildMailDraft(owner.email!, buildReminderSubject(work), body);
    expect(draft.href.startsWith("mailto:salma.ahmed@example.com?")).toBe(true);
    expect(draft.to).toBe("salma.ahmed@example.com");
    expect(draft.truncated).toBe(false);
  });

  it("encodes line breaks as CRLF, which mail clients expect", () => {
    const draft = buildMailDraft(owner.email!, "Subject", "line one\nline two");
    expect(draft.href).toContain("%0D%0A");
    // No bare %0A: every line feed must be preceded by its carriage return.
    expect(draft.href).not.toMatch(/(?<!%0D)%0A/);
  });

  it("escapes characters that would otherwise break the URL", () => {
    const draft = buildMailDraft(owner.email!, "Tyres & brakes", "cost is ৳3,200 + VAT");
    expect(draft.href).toContain("%26"); // &
    expect(draft.href).toContain("%2B"); // +
    // The raw ampersand must not appear inside the subject value.
    expect(draft.href.split("&body=")[0]).not.toContain("Tyres & brakes");
  });

  it("shortens an over-long body rather than letting the client truncate it", () => {
    const huge = Array.from({ length: 400 }, (_, i) => `  - Item ${i}: overdue, about 1,000`).join("\n");
    const draft = buildMailDraft(owner.email!, "Service due", huge);
    expect(draft.truncated).toBe(true);
    expect(draft.href.length).toBeLessThanOrEqual(MAILTO_LIMIT);
    // The sign-off survives: the tail is what matters in a reminder.
    expect(draft.body.split("\n").length).toBeGreaterThan(3);
  });

  it("stays intact for a realistic three-vehicle owner", () => {
    const three = [...work, { vehicle: vehicle("V03", "Dhaka Metro Ga 75-4053"), actionable: [due("Brake pads", 16, 600_000)] }];
    const draft = buildMailDraft(owner.email!, buildReminderSubject(three), buildReminder(owner, three, "2026-08-30"));
    expect(draft.truncated).toBe(false);
    expect(draft.href.length).toBeLessThan(MAILTO_LIMIT);
  });
});

describe("buildReminder", () => {
  it("groups by vehicle and totals the work", () => {
    const text = buildReminder(owner, work, "2026-08-30");
    expect(text).toContain("Salma Ahmed");
    expect(text).toContain("Dhaka Metro Cha 76-9961");
    expect(text).toContain("5 days overdue");
    expect(text).toContain("Estimated total: ৳35,500");
    expect(text).toContain("as of 30 Aug 2026");
  });

  it("says prices are estimates, so nobody is surprised at the counter", () => {
    expect(buildReminder(owner, work, "2026-08-30")).toContain("estimates");
  });
});
