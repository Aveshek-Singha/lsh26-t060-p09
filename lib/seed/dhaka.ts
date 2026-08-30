import type { OwnerLocation } from "@/lib/domain/types";

/**
 * Real Dhaka neighbourhoods, with the approximate centroid of each.
 *
 * The published dataset carries names, phones and plates but no address, and a
 * home-service workshop needs somewhere to drive to. These are genuine areas of
 * Dhaka at their real coordinates — so the map shows a recognisable city rather
 * than scattered dots — but they are **area centroids, not street addresses**:
 * demo data of the same character as the synthetic names they belong to.
 *
 * Ordered roughly north to south, so seeding in order spreads owners across the
 * city instead of clustering them.
 */
export const DHAKA_AREAS: readonly Omit<OwnerLocation, "address">[] = [
  { area: "Uttara Sector 7", lat: 23.8759, lng: 90.3795 },
  { area: "Uttara Sector 4", lat: 23.8628, lng: 90.3987 },
  { area: "Bashundhara R/A", lat: 23.8203, lng: 90.4254 },
  { area: "Mirpur 10", lat: 23.8069, lng: 90.3687 },
  { area: "Baridhara", lat: 23.8041, lng: 90.4152 },
  { area: "Banani", lat: 23.7937, lng: 90.4066 },
  { area: "Mirpur DOHS", lat: 23.8283, lng: 90.3654 },
  { area: "Gulshan 1", lat: 23.7806, lng: 90.4142 },
  { area: "Mohakhali", lat: 23.7806, lng: 90.4014 },
  { area: "Badda", lat: 23.7806, lng: 90.4267 },
  { area: "Niketan", lat: 23.7776, lng: 90.4145 },
  { area: "Shyamoli", lat: 23.7749, lng: 90.3665 },
  { area: "Tejgaon", lat: 23.7639, lng: 90.3936 },
  { area: "Rampura", lat: 23.7614, lng: 90.4212 },
  { area: "Farmgate", lat: 23.758, lng: 90.3896 },
  { area: "Mohammadpur", lat: 23.757, lng: 90.359 },
  { area: "Lalmatia", lat: 23.7568, lng: 90.369 },
  { area: "Khilgaon", lat: 23.75, lng: 90.4256 },
  { area: "Kalabagan", lat: 23.7482, lng: 90.3818 },
  { area: "Malibagh", lat: 23.7481, lng: 90.4147 },
  { area: "Dhanmondi 27", lat: 23.7461, lng: 90.3742 },
  { area: "Shantinagar", lat: 23.7405, lng: 90.4114 },
  { area: "Mugda", lat: 23.7364, lng: 90.4306 },
  { area: "Segunbagicha", lat: 23.7361, lng: 90.4053 },
  { area: "Motijheel", lat: 23.733, lng: 90.4172 },
  { area: "Azimpur", lat: 23.728, lng: 90.3844 },
  { area: "Wari", lat: 23.7183, lng: 90.4184 },
  { area: "Jatrabari", lat: 23.7106, lng: 90.4364 },
  { area: "Sadarghat", lat: 23.7104, lng: 90.4074 },
];

/** The workshop itself — every route starts here. */
export const WORKSHOP: OwnerLocation = {
  area: "Tejgaon Industrial Area",
  address: "Service Register workshop, Tejgaon, Dhaka",
  lat: 23.7686,
  lng: 90.3934,
};

/**
 * Give each owner an area, spread across the city rather than clustered.
 *
 * Deterministic: the same owner always lands in the same place, so the map is
 * stable across re-seeds and a screenshot stays true.
 */
export function locationForOwner(index: number, houseSeed: number): OwnerLocation {
  const area = DHAKA_AREAS[index % DHAKA_AREAS.length]!;
  const house = (houseSeed % 60) + 1;
  const road = (houseSeed % 12) + 1;

  return {
    area: area.area,
    address: `House ${house}, Road ${road}, ${area.area}, Dhaka`,
    // Nudge each pin a little off the centroid so co-located owners do not
    // stack into a single marker. About 100-300 m, well inside the area.
    lat: Number((area.lat + ((houseSeed % 7) - 3) * 0.0009).toFixed(6)),
    lng: Number((area.lng + ((houseSeed % 5) - 2) * 0.0011).toFixed(6)),
  };
}
