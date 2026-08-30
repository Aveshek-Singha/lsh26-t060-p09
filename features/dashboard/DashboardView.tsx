"use client";

import { useMemo, useState } from "react";

import { formatBdt } from "@/lib/domain/money";
import { formatDateShort } from "@/lib/domain/civilDate";
import { buildForecast, FORECAST_WEEKS } from "@/lib/domain/forecast";
import {
  ruleBreakdown,
  statusBreakdown,
  summarise,
  topItemsByValue,
} from "@/lib/domain/stats";
import type { DueAssessment, ServiceRule } from "@/lib/domain/types";
import { ColumnChart, RankedBars, StackedBar } from "./charts";

/**
 * Rule colours.
 *
 * The three service rules are an identity, not a magnitude, so this is a
 * categorical set rather than shades of one hue. These are the first three
 * slots of the validated categorical palette, re-checked against this app's own
 * surfaces: all-pairs CVD deltaE 9.2 light / 9.4 dark, normal-vision 24.0 / 20.9.
 *
 * Aqua sits at 2.68:1 on the light surface, which the method allows only with
 * relief — so every segment is directly labelled and the table below carries
 * the same numbers.
 *
 * Deliberately *not* the status colours: those are reserved for state, and
 * reusing them for "series 3" would make a rule look like a warning.
 */
const RULE_COLORS: Record<ServiceRule, string> = {
  fixed_date: "var(--rule-fixed)",
  period_months: "var(--rule-time)",
  distance_km: "var(--rule-distance)",
};

type RuleFilter = ServiceRule | "all";

export function DashboardView({
  assessments,
  asOf,
  fleet,
}: {
  assessments: DueAssessment[];
  asOf: string;
  fleet: { vehicles: number; owners: number; calls: number; called: number };
}) {
  const [rule, setRule] = useState<RuleFilter>("all");
  const [actionableOnly, setActionableOnly] = useState(false);

  const filtered = useMemo(
    () =>
      assessments
        .filter((a) => rule === "all" || a.rule === rule)
        .filter((a) => !actionableOnly || a.status === "overdue" || a.status === "due_soon"),
    [assessments, rule, actionableOnly],
  );

  const totals = useMemo(() => summarise(filtered), [filtered]);
  const statuses = useMemo(() => statusBreakdown(filtered), [filtered]);
  const rules = useMemo(() => ruleBreakdown(assessments), [assessments]);
  const items = useMemo(() => topItemsByValue(filtered), [filtered]);
  const forecast = useMemo(() => buildForecast(filtered, asOf), [filtered, asOf]);

  const filtering = rule !== "all" || actionableOnly;

  return (
    <>
      {/* Filters sit in one row above the charts and drive all of them. */}
      <div className="no-print mb-6 flex flex-wrap items-center gap-2">
        <span className="eyebrow mr-1">Filter</span>
        <Chip active={rule === "all"} onClick={() => setRule("all")}>
          All rules
        </Chip>
        {rules.map((r) => (
          <Chip key={r.rule} active={rule === r.rule} onClick={() => setRule(r.rule)}>
            <span
              aria-hidden
              className="mr-1.5 inline-block size-2 translate-y-px rounded-sm"
              style={{ backgroundColor: RULE_COLORS[r.rule] }}
            />
            {r.label} {r.count}
          </Chip>
        ))}
        <span aria-hidden className="mx-1 h-4 w-px bg-line" />
        <Chip active={actionableOnly} onClick={() => setActionableOnly((v) => !v)}>
          Needs action only
        </Chip>
        {filtering && (
          <button
            type="button"
            onClick={() => {
              setRule("all");
              setActionableOnly(false);
            }}
            className="text-xs text-mid underline-offset-4 hover:text-hi hover:underline"
          >
            Reset
          </button>
        )}
      </div>

      {/* The dashboard leads with the number the workshop acts on. */}
      <section aria-label="Headline figures" className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Hero
          label="Value at risk"
          value={formatBdt(totals.valueAtRiskPaisa)}
          detail={`${totals.actionable} items overdue or due within 30 days`}
        />
        <Tile
          label="Overdue items"
          value={totals.overdue}
          tone="overdue"
          detail={
            totals.worstDaysOverdue > 0
              ? `worst is ${totals.worstDaysOverdue} days late`
              : "nothing overdue"
          }
        />
        <Tile
          label="Due within 30 days"
          value={totals.dueSoon}
          tone="due"
          detail={`${formatBdt(totals.valueAtRiskPaisa - totals.overdueValuePaisa)} of work`}
        />
        <Tile
          label="Calls made today"
          value={`${fleet.called}/${fleet.calls}`}
          detail={`${fleet.vehicles} vehicles · ${fleet.owners} owners`}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title="Fleet health"
          note={`${totals.items} service items${filtering ? " (filtered)" : ""}`}
        >
          <StackedBar
            ariaLabel="Service items by status"
            total={Math.max(totals.items, 1)}
            segments={statuses.map((s) => ({
              key: s.status,
              label: s.label,
              value: s.count,
              color: `var(--${s.status === "due_soon" ? "due-soon" : s.status === "no_estimate" ? "unknown" : s.status})`,
              detail: `${s.share}%`,
            }))}
          />
        </Panel>

        <Panel title="Work by rule" note="how the fleet's schedule is driven">
          <StackedBar
            ariaLabel="Service items by rule type"
            total={Math.max(
              rules.reduce((sum, r) => sum + r.count, 0),
              1,
            )}
            segments={rules.map((r) => ({
              key: r.rule,
              label: r.label,
              value: r.count,
              color: RULE_COLORS[r.rule],
              detail: formatBdt(r.valuePaisa),
            }))}
          />
        </Panel>

        <Panel
          title={`Workload, next ${FORECAST_WEEKS} weeks`}
          note={`${forecast.backlog.count} overdue held back as backlog`}
        >
          <ColumnChart
            ariaLabel="Items falling due per week"
            columns={forecast.weeks.map((w) => ({
              key: String(w.index),
              label: formatDateShort(w.start),
              value: w.count,
              detail: `${w.count} items, ${formatBdt(w.valuePaisa)}`,
              emphasis: w.index === forecast.busiestIndex && w.count > 0,
            }))}
          />
        </Panel>

        <Panel title="Where the money is" note="outstanding work by item, highest first">
          {items.length === 0 ? (
            <p className="py-8 text-center text-sm text-mid">
              Nothing outstanding under this filter.
            </p>
          ) : (
            <RankedBars
              ariaLabel="Outstanding value by service item"
              rows={items.map((i) => ({
                key: i.name,
                label: i.name,
                value: i.valuePaisa,
                valuePaisa: i.valuePaisa,
                count: i.count,
              }))}
            />
          )}
        </Panel>
      </div>

      {/* The table view: the same numbers, readable without colour, and the
          relief the light-mode contrast warning requires. */}
      <details className="mt-6 rounded border border-line bg-surface">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-hi">
          The numbers behind these charts
        </summary>
        <div className="overflow-x-auto border-t border-line">
          <table className="w-full min-w-[34rem] border-collapse text-sm">
            <caption className="sr-only">
              Service items by status and by rule, with outstanding value
            </caption>
            <thead>
              <tr className="border-b border-line text-left">
                <Th>Breakdown</Th>
                <Th align="right">Items</Th>
                <Th align="right">Share</Th>
                <Th align="right">Value</Th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-line">
                <Td className="font-semibold text-hi">By status</Td>
                <Td />
                <Td />
                <Td />
              </tr>
              {statuses.map((s) => (
                <tr key={s.status} className="border-b border-line">
                  <Td className="pl-6">{s.label}</Td>
                  <Td align="right">{s.count}</Td>
                  <Td align="right">{s.share}%</Td>
                  <Td align="right">{formatBdt(s.valuePaisa)}</Td>
                </tr>
              ))}
              <tr className="border-b border-line">
                <Td className="font-semibold text-hi">By rule</Td>
                <Td />
                <Td />
                <Td />
              </tr>
              {rules.map((r) => (
                <tr key={r.rule} className="border-b border-line last:border-0">
                  <Td className="pl-6">{r.label}</Td>
                  <Td align="right">{r.count}</Td>
                  <Td align="right">{r.share}%</Td>
                  <Td align="right">{formatBdt(r.valuePaisa)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}

function Panel({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rise rounded border border-line bg-surface p-4">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-hi">{title}</h2>
        {note && <p className="text-xs text-low">{note}</p>}
      </div>
      {children}
    </section>
  );
}

function Hero({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rise rounded border border-accent/30 bg-surface px-4 py-3">
      <p className="eyebrow">{label}</p>
      <p className="nums mt-1 text-3xl font-semibold text-accent">{value}</p>
      <p className="mt-1 text-xs text-low">{detail}</p>
    </div>
  );
}

function Tile({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: number | string;
  detail: string;
  tone?: "overdue" | "due";
}) {
  const toneClass =
    tone === "overdue" ? "text-overdue" : tone === "due" ? "text-due-soon" : "text-hi";
  return (
    <div className="rise rounded border border-line bg-surface px-4 py-3">
      <p className="eyebrow">{label}</p>
      <p className={`nums mt-1 text-3xl font-semibold ${toneClass}`}>{value}</p>
      <p className="mt-1 text-xs text-low">{detail}</p>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`nums inline-flex items-center rounded border px-2.5 py-1.5 text-xs font-medium transition-colors ${
        active
          ? "border-line-strong bg-raised text-hi"
          : "border-line bg-surface text-mid hover:text-hi"
      }`}
    >
      {children}
    </button>
  );
}

function Th({ children, align }: { children?: React.ReactNode; align?: "right" }) {
  return (
    <th
      scope="col"
      className={`px-3 py-2 text-[0.6875rem] font-semibold uppercase tracking-wide text-low ${
        align === "right" ? "text-right" : ""
      }`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align,
  className = "",
}: {
  children?: React.ReactNode;
  align?: "right";
  className?: string;
}) {
  return (
    <td
      className={`px-3 py-2 text-mid ${align === "right" ? "nums text-right" : ""} ${className}`}
    >
      {children}
    </td>
  );
}
