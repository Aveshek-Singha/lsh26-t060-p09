import Link from "next/link";
import { notFound } from "next/navigation";

import { getAsOfDate, getOwnerById, listVehiclesByOwner } from "@/lib/db/repo";
import { assessVehicle, isActionable } from "@/lib/domain/due";
import { formatDate, formatDayOffset } from "@/lib/domain/civilDate";
import { formatBdt, sumPaisa } from "@/lib/domain/money";
import { StatusBadge } from "@/features/ui/StatusBadge";
import { ErrorPanel } from "@/features/ui/states";
import { ReminderMessage } from "@/features/owner/ReminderMessage";
import { buildMailDraft, buildReminder, buildReminderSubject } from "@/features/owner/reminder";
import { MailButton } from "@/features/owner/MailButton";
import { ServiceMap } from "@/features/map/ServiceMap";
import { DirectionsButton } from "@/features/map/DirectionsButton";

export const dynamic = "force-dynamic";

export default async function OwnerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let owner;
  let vehicles;
  let asOf: string;
  try {
    [owner, vehicles, asOf] = await Promise.all([
      getOwnerById(id),
      listVehiclesByOwner(id),
      getAsOfDate(),
    ]);
  } catch {
    return (
      <ErrorPanel
        title="Could not load this owner"
        detail="The database did not respond. Reload the page to try again."
      />
    );
  }

  if (!owner) notFound();

  const work = vehicles.map((vehicle) => {
    const assessments = assessVehicle(vehicle, asOf);
    return { vehicle, assessments, actionable: assessments.filter(isActionable) };
  });

  const dueTotal = sumPaisa(
    work.flatMap((entry) => entry.actionable.map((item) => item.costPaisa)),
  );
  const actionableCount = work.reduce((sum, entry) => sum + entry.actionable.length, 0);
  const reminder = buildReminder(owner, work, asOf);
  const draft = buildMailDraft(owner.email ?? "", buildReminderSubject(work), reminder);

  return (
    <>
      <nav className="pt-6 text-xs text-low">
        <Link href="/" className="hover:text-hi">
          Call list
        </Link>
        <span aria-hidden> / </span>
        <span className="text-mid">{owner.name}</span>
      </nav>

      <header className="flex flex-wrap items-end justify-between gap-4 pt-4 pb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-hi sm:text-3xl">{owner.name}</h1>
          <p className="mt-1 text-sm text-mid">
            <a href={`tel:${owner.phone}`} className="nums text-accent underline-offset-4 hover:underline">
              {owner.phone}
            </a>
            {owner.email && (
              <>
                {" · "}
                <a
                  href={`mailto:${owner.email}`}
                  className="text-accent underline-offset-4 hover:underline"
                >
                  {owner.email}
                </a>
              </>
            )}
            <span className="text-low">
              {" · "}
              {vehicles.length} {vehicles.length === 1 ? "vehicle" : "vehicles"}
            </span>
          </p>
        </div>
        <div className="text-right">
          <p className="eyebrow">Work due</p>
          <p className="nums text-xl font-semibold text-hi">{formatBdt(dueTotal)}</p>
          <p className="text-xs text-low">
            {actionableCount} {actionableCount === 1 ? "item" : "items"}
          </p>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          {work.map(({ vehicle, assessments }) => (
            <section
              key={vehicle.id}
              className="rounded border border-line bg-surface"
              aria-label={vehicle.plate}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-4 py-3">
                <Link
                  href={`/vehicles/${vehicle.id}`}
                  className="plate text-sm font-semibold text-hi underline-offset-4 hover:underline"
                >
                  {vehicle.plate}
                </Link>
                <span className="text-xs text-low">{vehicle.model}</span>
              </div>
              <ul className="divide-y divide-line">
                {assessments.map((assessment) => (
                  <li
                    key={assessment.itemName}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-xs"
                  >
                    <StatusBadge status={assessment.status} />
                    <span className="font-medium text-hi">{assessment.itemName}</span>
                    <span className="nums text-mid">
                      {assessment.dueDate ? formatDate(assessment.dueDate) : "no estimate"}
                    </span>
                    <span
                      className={`nums ${
                        assessment.status === "overdue"
                          ? "text-overdue"
                          : assessment.status === "due_soon"
                            ? "text-due-soon"
                            : "text-low"
                      }`}
                    >
                      {assessment.daysUntilDue === null
                        ? ""
                        : formatDayOffset(assessment.daysUntilDue)}
                    </span>
                    <span className="nums ml-auto text-mid">{formatBdt(assessment.costPaisa)}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <aside className="space-y-3 lg:sticky lg:top-24 lg:self-start">
          {owner.location && (
            <section
              aria-label="Home service location"
              className="rounded border border-line bg-surface p-4"
            >
              <p className="eyebrow mb-2">Home service</p>
              <ServiceMap
                pins={[
                  {
                    id: owner.id,
                    name: owner.name,
                    address: owner.location.address,
                    lat: owner.location.lat,
                    lng: owner.location.lng,
                    status: actionableCount > 0 ? "overdue" : "fine",
                  },
                ]}
                height="12rem"
                zoom={15}
                showWorkshop={false}
              />
              <p className="mt-2.5 text-xs text-mid">{owner.location.address}</p>
              <div className="mt-2.5">
                <DirectionsButton location={owner.location} compact />
              </div>
            </section>
          )}

          {actionableCount === 0 ? (
            <div className="rounded border border-dashed border-line bg-surface px-4 py-8 text-center">
              <p className="text-sm font-semibold text-hi">Nothing due</p>
              <p className="mt-1 text-xs text-mid">
                No reminder needed for {owner.name} as of {formatDate(asOf)}.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded border border-line bg-surface px-4 py-3">
                <p className="eyebrow mb-2">Send it</p>
                <MailButton
                  ownerId={owner.id}
                  email={owner.email}
                  gmailHref={draft.gmailHref}
                  truncated={draft.truncated}
                />
                <p className="mt-2 text-[0.875rem] text-low">
                  Opens your mail client with this message already written, and logs
                  the owner as contacted.
                </p>
              </div>
              <ReminderMessage message={reminder} />
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
