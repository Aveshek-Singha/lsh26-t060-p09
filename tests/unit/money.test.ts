import { describe, expect, it } from "vitest";
import { formatBdt, formatTaka, parsePaisa, sumPaisa } from "@/lib/domain/money";

describe("parsePaisa", () => {
  it("parses the decimal strings used by the source data", () => {
    expect(parsePaisa("12000.00")).toBe(1_200_000);
    expect(parsePaisa("1200.00")).toBe(120_000);
    expect(parsePaisa("6000.50")).toBe(600_050);
    expect(parsePaisa("0.05")).toBe(5);
    expect(parsePaisa("0.5")).toBe(50);
    expect(parsePaisa("0.00")).toBe(0);
  });

  it("accepts plain numbers and negatives", () => {
    expect(parsePaisa(12000)).toBe(1_200_000);
    expect(parsePaisa("-250.25")).toBe(-25_025);
  });

  it("throws on unparseable values rather than yielding NaN", () => {
    expect(() => parsePaisa("abc")).toThrow();
    expect(() => parsePaisa("")).toThrow();
    expect(() => parsePaisa("12.345")).toThrow();
    expect(() => parsePaisa("1,200")).toThrow();
  });
});

describe("integer paisa arithmetic", () => {
  // The reason money is not stored as a float: this sum is exact.
  it("sums without floating point drift", () => {
    const amounts = [parsePaisa("0.10"), parsePaisa("0.20")];
    expect(sumPaisa(amounts)).toBe(30);
    expect(formatTaka(sumPaisa(amounts))).toBe("0.30");
  });

  it("sums a realistic basket exactly", () => {
    const basket = ["12000.00", "1200.00", "6000.00", "32000.00"].map(parsePaisa);
    expect(sumPaisa(basket)).toBe(5_120_000);
    expect(formatBdt(sumPaisa(basket))).toBe("৳51,200");
  });
});

describe("formatting", () => {
  it("drops decimals for whole taka and keeps them otherwise", () => {
    expect(formatBdt(1_200_000)).toBe("৳12,000");
    expect(formatBdt(600_050)).toBe("৳6,000.50");
    expect(formatBdt(0)).toBe("৳0");
    expect(formatBdt(5)).toBe("৳0.05");
  });
});
