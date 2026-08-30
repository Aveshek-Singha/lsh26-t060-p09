import Link from "next/link";

import { loadFleet } from "@/lib/fleet";
import { buildForecast, FORECAST_WEEKS } from "@/lib/domain/forecast";
import { formatDate, formatDateShort } from "@/lib/domain/civilDate";
import { formatBdt } from "@/lib/domain/money";
import { ErrorPanel, PageHeading } from "@/features/ui/states";

export const dynamic = "force-dynamic";

export default async function ForecastPage() {
  let fleet;
  try {
    fleet = await loadFleet();
  } catch {
    return (
      <>
        <PageHeading title="Workload forecast" />
        <ErrorPanel
          title="Could not load the fleet"
          detail="The database did not respond. Reload the page to try again."
        />
      </>
    );
  }

  const all = [...fleet.assessments.values()].flat();
  const forecast = buildForecast(all, fleet.asOf);
  const vehicleByItem = new Map<string, string>();
  for (const vehicle of fleet.vehicles) {
    for (const assessment of fleet.assessments.get(vehicle.id) ?? []) {
      vehicleByItem.set(`${vehicle.id}:${assessment.itemName}`, vehicle.plate);
    }
  }

  return (
    <>
      <PageHeading
        title="Workload forecast"
        subtitle={`Work falling due over the next ${FORECAST_WEEKS} weeks, so busy weeks are visible before they arrive.`}
        aside={
          <div className="text-right">
            <p className="eyebrow">Working date</p>
            <p className="nums text-sm font-semibold text-hi">{formatDate(fleet.asOf)}</p>
          </div>
        }
      />

      <section className="mb-6 rounded border border-overdue/30 bg-overdue-bg px-4 py-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <p className="eyebrow">Backlog — already overdue</p>
            <p className="nums mt-0.5 text-xl font-semibold text-overdue">
              {forecast.backlog.count} items
            </p>
          </div>
          <p className="nums text-sm text-mid">{formatBdt(forecast.backlog.valuePaisa)}</p>
        </div>
        <p className="mt-1.5 text-xs text-mid">
          Kept out of the weekly bars below: this is work to clear, not capacity that lands on a
          particular week.{" "}
          <Link href="/" className="text-accent underline-offset-4 hover:underline">
            See the call list
          </Link>
        </p>
      </section>

      <section aria-label="Weekly workload" className="rounded border border-line bg-surface p-4">
        <ol className="space-y-2.5">
          {forecast.weeks.map((week) => {
            const share = forecast.maxCount === 0 ? 0 : (week.count / forecast.maxCount) * 100;
            const busiest = week.index === forecast.busiestIndex && week.count > 0;
            return (
              <li key={week.index} className="grid grid-cols-[6.5rem_1fr_auto] items-center gap-3">
                <div className="nums text-xs text-mid">
                  {formatDateShort(week.start)}
                  <span className="text-low"> – {formatDateShort(week.end)}</span>
                </div>
                <div
                  className="h-7 rounded bg-raised"
                  role="img"
                  aria-label={`${week.count} items due, ${formatBdt(week.valuePaisa)}`}
                >
                  <div
                    className={`flex h-full items-center rounded px-2 ${
                      busiest ? "bg-accent" : "bg-accent/35"
                    }`}
                    style={{ width: `${Math.max(share, week.count > 0 ? 8 : 0)}%` }}
                  >
                    {week.count > 0 && (
                      <span
                        className={`nums text-[0.6875rem] font-semibold ${
                          busiest ? "text-accent-contrast" : "text-hi"
                        }`}
                      >
                        {week.count}
                      </span>
                    )}
                  </div>
                </div>
                <div className="nums w-24 text-right text-xs text-mid">
                  {week.count === 0 ? (
                    <span className="text-low">clear</span>
                  ) : (
                    formatBdt(week.valuePaisa)
                  )}
                </div>
              </li>
            );
          })}
        </ol>

        {forecast.maxCount === 0 && (
          <p className="mt-4 text-center text-sm text-mid">
            Nothing falls due in the next {FORECAST_WEEKS} weeks.
          </p>
        )}
      </section>

      <p className="mt-4 text-xs text-low">
        Distance-based items are placed using each vehicle&apos;s own daily running, so these weeks
        shift as new odometer readings come in.
      </p>
    </>
  );
}
