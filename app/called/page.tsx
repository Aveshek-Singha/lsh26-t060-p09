import Link from "next/link";

import { callListFor, loadFleet } from "@/lib/fleet";
import { formatDate } from "@/lib/domain/civilDate";
import { formatBdt, sumPaisa } from "@/lib/domain/money";
import { buildMailDraft, buildReminder, buildReminderSubject } from "@/features/owner/reminder";
import { CalledToggle } from "@/features/call-list/CalledToggle";
import { MailButton } from "@/features/owner/MailButton";
import { EmptyState, ErrorPanel, PageHeading } from "@/features/ui/states";

export const dynamic = "force-dynamic";

/**
 * The day's contact record: who has already been reached, and who is still
 * outstanding. The call list answers "who do I ring next"; this answers "what
 * have we actually done today", which is the question at the end of a shift.
 */
export default async function CalledPage() {
  let fleet;
  try {
    fleet = await loadFleet();
  } catch {
    return (
      <>
        <PageHeading title="Called today" />
        <ErrorPanel
          title="Could not load the fleet"
          detail="The database did not respond. Reload the page to try again."
        />
      </>
    );
  }

  const entries = callListFor(fleet);
  const called = entries.filter((entry) => entry.owner?.lastCalledOn === fleet.asOf);
  const outstanding = entries.length - called.length;
  const clearedValue = sumPaisa(called.map((entry) => entry.priority.totalCostPaisa));

  return (
    <>
      <PageHeading
        title="Called today"
        subtitle={`Everyone contacted on ${formatDate(
          fleet.asOf,
        )}. Marking a call moves an owner here; undoing it puts them back on the list.`}
        aside={
          <div className="text-right">
            <p className="eyebrow">Working date</p>
            <p className="nums text-sm font-semibold text-hi">{formatDate(fleet.asOf)}</p>
          </div>
        }
      />

      <section aria-label="Progress" className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Called" value={called.length} tone="fine" />
        <Stat label="Still to call" value={outstanding} tone={outstanding > 0 ? "due" : undefined} />
        <Stat label="Work discussed" value={formatBdt(clearedValue)} />
      </section>

      {called.length === 0 ? (
        <EmptyState
          title="No calls logged yet today"
          detail={`Nobody has been marked as called on ${formatDate(
            fleet.asOf,
          )}. Ring or email an owner from the call list and they will appear here.`}
          action={{ href: "/", label: "Go to the call list" }}
        />
      ) : (
        <ul className="stagger space-y-3">
          {called.map((entry) => {
            const owner = entry.owner!;
            const work = entry.vehicles.map(({ vehicle, actionable }) => ({
              vehicle,
              actionable,
            }));
            const body = buildReminder(owner, work, fleet.asOf);
            const draft = buildMailDraft(owner.email ?? "", buildReminderSubject(work), body);

            return (
              <li
                key={entry.key}
                data-called-owner={owner.id}
                className="rounded border border-line bg-surface px-4 py-3 sm:px-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                      <span className="inline-flex shrink-0 items-center rounded border border-fine/30 bg-fine-bg px-1.5 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-wide text-fine">
                        Called
                      </span>
                      <Link
                        href={`/owners/${owner.id}`}
                        className="text-sm font-semibold text-hi underline-offset-4 hover:underline"
                      >
                        {owner.name}
                      </Link>
                      <a
                        href={`tel:${owner.phone}`}
                        className="nums text-xs text-accent underline-offset-4 hover:underline"
                      >
                        {owner.phone}
                      </a>
                    </div>

                    {owner.email && (
                      <p className="mt-1 truncate text-xs text-low">{owner.email}</p>
                    )}

                    <p className="mt-2 text-xs text-mid">
                      {entry.vehicles.map((v) => v.vehicle.plate).join(" · ")}
                    </p>
                    <p className="nums mt-1 text-xs text-low">
                      {entry.actionable.length}{" "}
                      {entry.actionable.length === 1 ? "item" : "items"} ·{" "}
                      {formatBdt(entry.priority.totalCostPaisa)}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <MailButton
                      ownerId={owner.id}
                      email={owner.email}
                      gmailHref={draft.gmailHref}
                      truncated={draft.truncated}
                      compact
                    />
                    <CalledToggle ownerId={owner.id} called />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone?: "fine" | "due";
}) {
  const toneClass = tone === "fine" ? "text-fine" : tone === "due" ? "text-due-soon" : "text-hi";
  return (
    <div className="rise rounded border border-line bg-surface px-4 py-3">
      <p className="eyebrow">{label}</p>
      <p className={`nums mt-1 text-xl font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}
