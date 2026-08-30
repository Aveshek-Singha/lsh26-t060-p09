import { formatBdt } from "@/lib/domain/money";

/**
 * Chart primitives, built from CSS and SVG.
 *
 * No charting library: the whole dashboard is three simple forms, and a library
 * would cost more in bundle than it saves in code. Everything paints with the
 * app's own tokens, so both themes come free.
 *
 * Mark specs followed throughout: 2px surface gaps between adjacent fills, 4px
 * rounded data-ends, recessive axes, and direct labels rather than a number on
 * every mark.
 */

export interface Segment {
  key: string;
  label: string;
  value: number;
  /** A CSS colour — a token reference, not a raw hex. */
  color: string;
  detail?: string;
}

/**
 * Part-to-whole across a handful of classes.
 *
 * Horizontal because the class names are words, not dates, and a horizontal bar
 * gives them room to be read.
 */
export function StackedBar({
  segments,
  total,
  ariaLabel,
}: {
  segments: Segment[];
  total: number;
  ariaLabel: string;
}) {
  const shown = segments.filter((s) => s.value > 0);

  return (
    <div>
      <div
        role="img"
        aria-label={`${ariaLabel}: ${shown
          .map((s) => `${s.label} ${s.value}`)
          .join(", ")}`}
        // gap-0.5 is the 2px surface gap that keeps adjacent fills legible
        // without a border, and matters most under colour-vision deficiency.
        className="flex h-8 w-full gap-0.5 overflow-hidden rounded"
      >
        {shown.map((s) => (
          <div
            key={s.key}
            title={`${s.label}: ${s.value} (${((s.value / total) * 100).toFixed(1)}%)`}
            style={{ width: `${(s.value / total) * 100}%`, backgroundColor: s.color }}
            className="first:rounded-l last:rounded-r"
          />
        ))}
      </div>

      {/* A legend is always present for two or more classes, and every class is
          also directly labelled — identity never rests on colour alone. */}
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
        {segments.map((s) => (
          <li key={s.key} className="flex items-baseline gap-1.5 text-xs">
            <span
              aria-hidden
              className="inline-block size-2.5 shrink-0 translate-y-px rounded-sm"
              style={{ backgroundColor: s.color }}
            />
            <span className="text-mid">{s.label}</span>
            <span className="nums font-semibold text-hi">{s.value}</span>
            {s.detail && <span className="nums text-low">{s.detail}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

export interface Column {
  key: string;
  label: string;
  value: number;
  detail?: string;
  emphasis?: boolean;
}

/**
 * Magnitude over time.
 *
 * One series, so a single hue rather than a categorical set, and the heading
 * names it — no legend box needed. The tallest column is emphasised because
 * "which week is worst" is the question being asked.
 *
 * The bar track stretches rather than hugging its content: a percentage height
 * resolves to zero against a parent whose own height is indefinite, which is
 * exactly how this chart rendered as bare numbers with no bars at all.
 */
export function ColumnChart({
  columns,
  ariaLabel,
  valueFormatter = (n: number) => String(n),
}: {
  columns: Column[];
  ariaLabel: string;
  valueFormatter?: (value: number) => string;
}) {
  const max = columns.reduce((m, c) => Math.max(m, c.value), 0);

  return (
    <div
      role="img"
      aria-label={`${ariaLabel}: ${columns.map((c) => `${c.label} ${c.value}`).join(", ")}`}
      className="flex h-44 items-stretch gap-1.5"
    >
      {columns.map((c) => {
        const pct = max === 0 ? 0 : (c.value / max) * 100;
        return (
          <div key={c.key} className="flex min-w-0 flex-1 flex-col gap-1.5">
            {/* min-h-0 lets this shrink inside the column; without it the
                track refuses to give ground to the labels below. */}
            <div className="flex min-h-0 flex-1 flex-col justify-end">
              <span className="nums mb-1 text-center text-[0.875rem] font-semibold text-hi">
                {c.value}
              </span>
              <div
                title={`${c.label}: ${c.detail ?? valueFormatter(c.value)}`}
                style={{ height: `${Math.max(pct, c.value > 0 ? 4 : 0)}%` }}
                className={`w-full rounded-t ${
                  c.value === 0 ? "bg-line" : c.emphasis ? "bg-accent" : "bg-accent/40"
                }`}
              />
            </div>
            <span className="nums w-full truncate border-t border-line pt-1.5 text-center text-[0.8125rem] text-low">
              {c.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Ranked magnitude.
 *
 * A single hue at varying length — the ranking is the message, so colour would
 * only add noise. Values are direct-labelled at the end of each bar.
 */
export function RankedBars({
  rows,
  ariaLabel,
}: {
  rows: { key: string; label: string; value: number; valuePaisa: number; count: number }[];
  ariaLabel: string;
}) {
  const max = rows.reduce((m, r) => Math.max(m, r.value), 0);

  return (
    <ul role="img" aria-label={ariaLabel} className="space-y-2">
      {rows.map((r) => (
        <li key={r.key} className="grid grid-cols-[7.5rem_minmax(0,1fr)_auto] items-center gap-3">
          <span className="truncate text-xs text-mid">{r.label}</span>
          <div className="h-4 w-full rounded bg-raised">
            <div
              title={`${r.label}: ${formatBdt(r.valuePaisa)} across ${r.count} items`}
              style={{ width: `${max === 0 ? 0 : Math.max((r.value / max) * 100, 2)}%` }}
              className="h-full rounded bg-accent/70"
            />
          </div>
          <span className="nums whitespace-nowrap text-xs text-hi">
            {formatBdt(r.valuePaisa)}
          </span>
        </li>
      ))}
    </ul>
  );
}
