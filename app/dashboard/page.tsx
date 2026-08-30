import { callListFor, loadFleet } from "@/lib/fleet";
import { formatDate } from "@/lib/domain/civilDate";
import { DashboardView } from "@/features/dashboard/DashboardView";
import { ErrorPanel, PageHeading } from "@/features/ui/states";

export const dynamic = "force-dynamic";

/**
 * The overview: how the whole fleet stands, in four charts and four figures.
 *
 * The call list answers "who next"; this answers "how are we doing" — the
 * question a manager asks, not the one the person on the phone asks.
 */
export default async function DashboardPage() {
  let fleet;
  try {
    fleet = await loadFleet();
  } catch {
    return (
      <>
        <PageHeading title="Dashboard" />
        <ErrorPanel
          title="Could not load the fleet"
          detail="The database did not respond. Reload the page to try again."
        />
      </>
    );
  }

  const assessments = [...fleet.assessments.values()].flat();
  const calls = callListFor(fleet);
  const called = calls.filter((c) => c.owner?.lastCalledOn === fleet.asOf).length;

  return (
    <>
      <PageHeading
        title="Dashboard"
        subtitle={`How the whole fleet stands as of ${formatDate(
          fleet.asOf,
        )}. Every figure is computed from the same engine that drives the call list.`}
        aside={
          <div className="text-right">
            <p className="eyebrow">Working date</p>
            <p className="nums text-sm font-semibold text-hi">{formatDate(fleet.asOf)}</p>
          </div>
        }
      />

      <DashboardView
        assessments={assessments}
        asOf={fleet.asOf}
        fleet={{
          vehicles: fleet.vehicles.length,
          owners: fleet.owners.size,
          calls: calls.length,
          called,
        }}
      />
    </>
  );
}
