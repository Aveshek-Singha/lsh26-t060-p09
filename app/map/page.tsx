import { callListFor, loadFleet } from "@/lib/fleet";
import { formatDate } from "@/lib/domain/civilDate";
import type { MapPin } from "@/features/map/ServiceMap";
import { ServiceMapView, type AreaGroup, type MapCustomer } from "@/features/map/ServiceMapView";
import { EmptyState, ErrorPanel, PageHeading } from "@/features/ui/states";

export const dynamic = "force-dynamic";

/**
 * The home-service map: everyone needing a call today, placed on the city.
 *
 * The call list says who to ring; this says who is worth visiting in one trip.
 * Two customers in Uttara are an afternoon; the same two in Uttara and Jatrabari
 * are a day, and no priority score can tell you that — geography can.
 */
export default async function MapPage() {
  let fleet;
  try {
    fleet = await loadFleet();
  } catch {
    return (
      <>
        <PageHeading title="Service map" />
        <ErrorPanel
          title="Could not load the fleet"
          detail="The database did not respond. Reload the page to try again."
        />
      </>
    );
  }

  const located = callListFor(fleet).filter((c) => c.owner?.location);

  const pins: MapPin[] = located.map((entry) => {
    const owner = entry.owner!;
    return {
      id: owner.id,
      name: owner.name,
      address: owner.location!.address,
      lat: owner.location!.lat,
      lng: owner.location!.lng,
      status: entry.actionable[0]!.status === "overdue" ? "overdue" : "due_soon",
      detail: `${entry.actionable.length} items outstanding`,
      href: `/owners/${owner.id}`,
    };
  });

  // Grouping by area is what turns a map into a round.
  const byArea = new Map<string, MapCustomer[]>();
  for (const entry of located) {
    const owner = entry.owner!;
    const area = owner.location!.area;
    byArea.set(area, [
      ...(byArea.get(area) ?? []),
      {
        ownerId: owner.id,
        name: owner.name,
        location: owner.location!,
        itemCount: entry.actionable.length,
        valuePaisa: entry.priority.totalCostPaisa,
        overdue: entry.actionable[0]!.status === "overdue",
      },
    ]);
  }

  const areas: AreaGroup[] = [...byArea.entries()]
    .map(([area, customers]) => ({
      area,
      customers,
      valuePaisa: customers.reduce((sum, c) => sum + c.valuePaisa, 0),
    }))
    // Densest area first: that is where a round pays for itself.
    .sort((a, b) => b.customers.length - a.customers.length || b.valuePaisa - a.valuePaisa);

  return (
    <>
      <PageHeading
        title="Service map"
        subtitle={`Where today's ${pins.length} calls are, so a home-service round can be planned by geography rather than by list order.`}
        aside={
          <div className="text-right">
            <p className="eyebrow">Working date</p>
            <p className="nums text-sm font-semibold text-hi">{formatDate(fleet.asOf)}</p>
          </div>
        }
      />

      {pins.length === 0 ? (
        <EmptyState
          title="Nothing to visit today"
          detail="No customer on the call list has an address on file, or there is nothing outstanding."
          action={{ href: "/", label: "Go to the call list" }}
        />
      ) : (
        <ServiceMapView areas={areas} pins={pins} />
      )}
    </>
  );
}
