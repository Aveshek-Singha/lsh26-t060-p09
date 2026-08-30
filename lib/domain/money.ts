/**
 * Money handling.
 *
 * The source data carries costs as decimal strings ("12000.00"). Parsing those
 * into JS numbers and adding them up drifts — 0.1 + 0.2 territory. Everything
 * downstream therefore works in integer paisa and only formats at the edge.
 */

const DECIMAL = /^-?\d+(\.\d{1,2})?$/;

/**
 * "12000.00" -> 1200000 paisa. Also accepts a plain number of taka.
 * Throws on anything unparseable, so bad seed data fails loudly at import
 * rather than silently becoming NaN in a total.
 */
export function parsePaisa(value: string | number): number {
  const text = typeof value === "number" ? value.toString() : value.trim();
  if (!DECIMAL.test(text)) {
    throw new Error(`Invalid money value: ${String(value)}`);
  }
  const negative = text.startsWith("-");
  const [whole = "0", fraction = ""] = text.replace("-", "").split(".");
  const paisa = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return negative ? -paisa : paisa;
}

/** 1200000 -> "12,000". Drops the decimals when the amount is whole taka. */
export function formatTaka(paisa: number): string {
  const negative = paisa < 0;
  const abs = Math.abs(paisa);
  const whole = Math.floor(abs / 100);
  const remainder = abs % 100;
  const grouped = whole.toLocaleString("en-US");
  const body = remainder === 0
    ? grouped
    : `${grouped}.${String(remainder).padStart(2, "0")}`;
  return negative ? `-${body}` : body;
}

/** 1200000 -> "৳12,000". */
export function formatBdt(paisa: number): string {
  return `৳${formatTaka(paisa)}`;
}

export function sumPaisa(amounts: readonly number[]): number {
  return amounts.reduce((total, amount) => total + amount, 0);
}
