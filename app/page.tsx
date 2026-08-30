import { callListFor, loadFleet, totalsFor } from "@/lib/fleet";
import { formatDate } from "@/lib/domain/civilDate";
import { formatBdt } from "@/lib/domain/money";
import { sumPaisa } from "@/lib/domain/money";
import { CallListView } from "@/features/call-list/CallListView";
import { SortExplainer } from "@/features/call-list/SortExplainer";
import { EmptyState, ErrorPanel, PageHeading } from "@/features/ui/states";

// Everything on this page derives from live data that the user can change, so
// it is rendered per request rather than cached.
export const dynamic = "force-dynamic";

export default async function CallListPage() {
  let fleet;
  try {
    fleet = await loadFleet();
  } catch {
    return (
      <>
        <PageHeading title="Call list" />
        <ErrorPanel
          title="Could not load the fleet"
          detail="The database did not respond, so today's call list cannot be worked out. Reload the page to try again."
        />
      </>
    );
  }

  const totals = totalsFor(fleet);
  const callList = callListFor(fleet);
  const totalValue = sumPaisa(callList.map((entry) => entry.priority.totalCostPaisa));

  return (
    <>
      <PageHeading
        title="Call list"
        subtitle={`Everything due or overdue across ${totals.vehicles} vehicles, ordered by who to ring first.`}
        aside={
          <div className="text-right">
            <p className="eyebrow">Working date</p>
            <p className="nums text-sm font-semibold text-hi">{formatDate(fleet.asOf)}</p>
          </div>
        }
      />

      <section
        aria-label="Fleet summary"
        className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4"
      >
        <Stat label="Overdue items" value={totals.overdue} tone="overdue" />
        <Stat label="Due within 30 days" value={totals.dueSoon} tone="due-soon" />
        <Stat label="Calls to make" value={callList.length} />
        <Stat label="Value of work" value={formatBdt(totalValue)} />
      </section>

      <div className="mb-6">
        <SortExplainer />
      </div>

      {callList.length === 0 ? (
        <EmptyState
          title="Nothing to chase today"
          detail={`All ${totals.vehicles} vehicles are clear as of ${formatDate(
            fleet.asOf,
          )}. Nothing is overdue and nothing falls due in the next 30 days.`}
          action={{ href: "/vehicles", label: "Browse the fleet" }}
        />
      ) : (
        <CallListView entries={callList} />
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
  tone?: "overdue" | "due-soon";
}) {
  const toneClass =
    tone === "overdue" ? "text-overdue" : tone === "due-soon" ? "text-due-soon" : "text-hi";
  return (
    <div className="rise rounded border border-line bg-surface px-4 py-3">
      <p className="eyebrow">{label}</p>
      <p className={`nums mt-1 text-xl font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}
