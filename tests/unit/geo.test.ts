import { describe, expect, it } from "vitest";
import {
  DHAKA_AVERAGE_KMH,
  driveMinutes,
  estimatedRoadKm,
  formatKm,
  formatMinutes,
  ROAD_FACTOR,
  straightLineKm,
} from "@/lib/domain/geo";
import { DHAKA_AREAS, WORKSHOP } from "@/lib/seed/dhaka";

describe("straightLineKm", () => {
  it("is zero for the same point", () => {
    expect(straightLineKm(WORKSHOP, WORKSHOP)).toBe(0);
  });

  it("is symmetric", () => {
    const a = { lat: 23.8759, lng: 90.3795 };
    const b = { lat: 23.7104, lng: 90.4074 };
    expect(straightLineKm(a, b)).toBeCloseTo(straightLineKm(b, a), 9);
  });

  it("measures a known Dhaka span within a sensible range", () => {
    // Uttara in the north to Sadarghat on the river: roughly 18-20 km direct.
    const uttara = { lat: 23.8759, lng: 90.3795 };
    const sadarghat = { lat: 23.7104, lng: 90.4074 };
    const km = straightLineKm(uttara, sadarghat);
    expect(km).toBeGreaterThan(17);
    expect(km).toBeLessThan(20);
  });

  it("keeps every seeded area within greater Dhaka of the workshop", () => {
    // A coordinate typo would show up here as an absurd distance.
    for (const area of DHAKA_AREAS) {
      expect(straightLineKm(WORKSHOP, area)).toBeLessThan(25);
    }
  });
});

describe("driveMinutes", () => {
  it("uses the Dhaka traffic average", () => {
    expect(driveMinutes(DHAKA_AVERAGE_KMH)).toBe(60);
  });

  it("never reports zero for a real distance", () => {
    expect(driveMinutes(0.05)).toBe(1);
  });

  it("is zero only for no distance at all", () => {
    expect(driveMinutes(0)).toBe(0);
  });
});

describe("estimatedRoadKm", () => {
  it("is always longer than the straight line", () => {
    expect(estimatedRoadKm(10)).toBeCloseTo(10 * ROAD_FACTOR, 6);
    expect(estimatedRoadKm(10)).toBeGreaterThan(10);
  });
});

describe("formatting", () => {
  it("switches to metres below a kilometre", () => {
    expect(formatKm(0.42)).toBe("420 m");
    expect(formatKm(3.456)).toBe("3.5 km");
  });

  it("reads hours past sixty minutes", () => {
    expect(formatMinutes(45)).toBe("45 min");
    expect(formatMinutes(60)).toBe("1 hr");
    expect(formatMinutes(95)).toBe("1 hr 35 min");
  });
});
