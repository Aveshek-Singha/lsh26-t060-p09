import Link from "next/link";
import { notFound } from "next/navigation";

import { getAsOfDate, getOwnerById, getVehicleById } from "@/lib/db/repo";
import { assessVehicle } from "@/lib/domain/due";
import { formatDate, formatDayOffset } from "@/lib/domain/civilDate";
import { formatBdt, sumPaisa } from "@/lib/domain/money";
import { dailyKm, formatRate, latestReading, sortReadings } from "@/lib/domain/rate";
import { StatusBadge } from "@/features/ui/StatusBadge";
import { ErrorPanel } from "@/features/ui/states";
import { OdometerForm } from "@/features/vehicle/OdometerForm";
import { RecordServiceForm } from "@/features/vehicle/RecordServiceForm";

export const dynamic = "force-dynamic";

export default async function VehiclePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let vehicle;
  let asOf: string;
  try {
    [vehicle, asOf] = await Promise.all([getVehicleById(id), getAsOfDate()]);
  } catch {
    return (
      <ErrorPanel
        title="Could not load this vehicle"
        detail="The database did not respond. Reload the page to try again."
      />
    );
  }

  if (!vehicle) notFound();

  const owner = await getOwnerById(vehicle.ownerId).catch(() => null);
  const assessments = assessVehicle(vehicle, asOf);
  const reading = latestReading(vehicle.odometerReadings);
  const rate = dailyKm(vehicle.odometerReadings);
  const history = [...vehicle.serviceHistory].sort((a, b) => (a.date < b.date ? 1 : -1));
  const dueValue = sumPaisa(
    assessments
      .filter((a) => a.status === "overdue" || a.status === "due_soon")
      .map((a) => a.costPaisa),
  );

  return (
    <>
      <nav className="pt-6 text-xs text-low">
        <Link href="/" className="hover:text-hi">
          Call list
        </Link>
        <span aria-hidden> / </span>
        <Link href="/vehicles" className="hover:text-hi">
          Vehicles
        </Link>
        <span aria-hidden> / </span>
        <span className="text-mid">{vehicle.plate}</span>
      </nav>

      <header className="flex flex-wrap items-end justify-between gap-4 pt-4 pb-6">
        <div>
          <h1 className="plate text-2xl font-semibold tracking-tight text-hi sm:text-3xl">
            {vehicle.plate}
          </h1>
          <p className="mt-1 text-sm text-mid">{vehicle.model}</p>
          {owner && (
            <p className="mt-2 text-sm text-hi">
              {owner.name}
              {" · "}
              <a
                href={`tel:${owner.phone}`}
                className="nums text-accent underline-offset-4 hover:underline"
              >
                {owner.phone}
              </a>
              {" · "}
              <Link
                href={`/owners/${owner.id}`}
                className="text-mid underline-offset-4 hover:text-hi hover:underline"
              >
                owner page
              </Link>
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="eyebrow">Due now</p>
          <p className="nums text-xl font-semibold text-hi">{formatBdt(dueValue)}</p>
        </div>
      </header>

      {/* Odometer: the input every distance estimate depends on. */}
      <section
        className="mb-6 rounded border border-line bg-surface p-4"
        aria-label="Odometer"
        data-odometer={reading?.km ?? ""}
        data-rate={rate === null ? "" : formatRate(rate)}
      >
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="grid grid-cols-2 gap-x-8 gap-y-2 sm:grid-cols-3">
            <div>
              <p className="eyebrow">Odometer</p>
              <p className="nums text-lg font-semibold text-hi">
                {reading ? `${reading.km.toLocaleString("en-US")} km` : "—"}
              </p>
            </div>
            <div>
              <p className="eyebrow">Daily running</p>
              <p className="nums text-lg font-semibold text-hi">
                {rate === null ? "unknown" : `${formatRate(rate)} km`}
              </p>
            </div>
            <div>
              <p className="eyebrow">Last reading</p>
              <p className="nums text-lg font-semibold text-hi">
                {reading ? formatDate(reading.date) : "—"}
              </p>
            </div>
          </div>
          <OdometerForm
            vehicleId={vehicle.id}
            asOf={asOf}
            currentKm={reading?.km ?? null}
            lastReadingDate={reading?.date ?? null}
          />
        </div>
        {rate === null && (
          <p className="mt-3 rounded bg-unknown-bg px-2 py-1.5 text-xs text-unknown">
            Distance-based items cannot be estimated until this vehicle has at least two odometer
            readings showing forward progress.
          </p>
        )}
      </section>

      {/* Every item, its own rule, its next due date. */}
      <section aria-label="Service items" className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-hi">
          Service schedule
          <span className="ml-2 font-normal text-low">
            {assessments.length} items · as of {formatDate(asOf)}
          </span>
        </h2>

        <ul className="stagger space-y-2">
          {assessments.map((assessment) => {
            const item = vehicle.serviceItems.find((i) => i.name === assessment.itemName)!;
            return (
              <li
                key={assessment.itemName}
                className="rounded border border-line bg-surface px-4 py-3"
                data-item={assessment.itemName}
                data-status={assessment.status}
                data-due={assessment.dueDate ?? ""}
              >
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={assessment.status} />
                      <span className="text-sm font-semibold text-hi">{assessment.itemName}</span>
                      <span className="rounded bg-raised px-1.5 py-0.5 text-[0.625rem] uppercase tracking-wide text-low">
                        {ruleLabel(assessment.rule)}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs text-mid">{assessment.basis}</p>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="nums text-sm font-semibold text-hi">
                        {assessment.dueDate ? formatDate(assessment.dueDate) : "—"}
                      </p>
                      <p
                        className={`nums text-[0.6875rem] ${
                          assessment.status === "overdue"
                            ? "text-overdue"
                            : assessment.status === "due_soon"
                              ? "text-due-soon"
                              : "text-low"
                        }`}
                      >
                        {assessment.daysUntilDue === null
                          ? "no estimate"
                          : formatDayOffset(assessment.daysUntilDue)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="nums text-sm text-mid">{formatBdt(assessment.costPaisa)}</p>
                    </div>
                    <RecordServiceForm
                      vehicleId={vehicle.id}
                      item={item}
                      assessment={assessment}
                      asOf={asOf}
                      currentKm={reading?.km ?? null}
                    />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* History grows as services are recorded. */}
      <section aria-label="Service history">
        <h2 className="mb-3 text-sm font-semibold text-hi">
          Service history
          <span className="ml-2 font-normal text-low">{history.length} records</span>
        </h2>
        {history.length === 0 ? (
          <p className="rounded border border-dashed border-line bg-surface px-4 py-8 text-center text-sm text-mid">
            No services recorded for this vehicle yet.
          </p>
        ) : (
          <div className="overflow-x-auto rounded border border-line">
            <table className="w-full min-w-[32rem] border-collapse bg-surface text-sm">
              <thead>
                <tr className="border-b border-line text-left">
                  <Th>Date</Th>
                  <Th>Item</Th>
                  <Th align="right">Odometer</Th>
                  <Th align="right">Cost</Th>
                </tr>
              </thead>
              <tbody>
                {history.map((record, index) => (
                  <tr
                    key={`${record.item}-${record.date}-${index}`}
                    className="border-b border-line last:border-0"
                  >
                    <Td className="nums whitespace-nowrap">{formatDate(record.date)}</Td>
                    <Td>{record.item}</Td>
                    <Td className="nums text-right">
                      {record.km === null ? "—" : `${record.km.toLocaleString("en-US")} km`}
                    </Td>
                    <Td className="nums text-right">{formatBdt(record.costPaisa)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <details className="mt-6 rounded border border-line bg-surface">
        <summary className="cursor-pointer px-4 py-3 text-xs font-medium text-mid">
          Odometer history ({vehicle.odometerReadings.length} readings)
        </summary>
        <ul className="border-t border-line px-4 py-3 text-xs">
          {sortReadings(vehicle.odometerReadings)
            .reverse()
            .map((r) => (
              <li key={r.date} className="nums flex justify-between py-0.5 text-mid">
                <span>{formatDate(r.date)}</span>
                <span>{r.km.toLocaleString("en-US")} km</span>
              </li>
            ))}
        </ul>
      </details>
    </>
  );
}

function ruleLabel(rule: string): string {
  if (rule === "fixed_date") return "fixed date";
  if (rule === "period_months") return "time";
  return "distance";
}

function Th({ children, align }: { children: React.ReactNode; align?: "right" }) {
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

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 text-mid ${className}`}>{children}</td>;
}
