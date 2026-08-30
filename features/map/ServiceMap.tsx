"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Map as LeafletMap, Marker, Polyline } from "leaflet";

import { WORKSHOP } from "@/lib/seed/dhaka";
import { driveMinutes, estimatedRoadKm, straightLineKm } from "@/lib/domain/geo";

export interface RouteInfo {
  km: number;
  minutes: number;
  /** "road" when a routing service answered; "direct" when it did not. */
  source: "road" | "direct";
}

export interface MapPin {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  /** Drives the pin colour; the status palette, reserved for state. */
  status: "overdue" | "due_soon" | "fine" | "no_estimate";
  detail?: string;
  href?: string;
}

/**
 * Customer locations on a real map, for planning home service.
 *
 * Leaflet directly rather than react-leaflet: the React wrapper ships under the
 * Hippocratic licence, which is not on the permitted list, while Leaflet itself
 * is BSD-2-Clause. Leaflet touches `window` on import, so it is loaded inside an
 * effect rather than at module scope — importing it on the server throws.
 *
 * Tiles come from OpenStreetMap, which needs no key but does require the
 * attribution rendered bottom-right.
 */
export function ServiceMap({
  pins,
  height = "24rem",
  zoom,
  showWorkshop = true,
  focusId = null,
  showRoute = false,
  onRoute,
}: {
  pins: MapPin[];
  height?: string;
  zoom?: number;
  showWorkshop?: boolean;
  /** Fly to this pin and open its popup. */
  focusId?: string | null;
  /** Draw a workshop-to-customer route for the focused pin. */
  showRoute?: boolean;
  onRoute?: (info: RouteInfo | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<Map<string, Marker>>(new Map());
  const routeRef = useRef<Polyline | null>(null);
  const [failed, setFailed] = useState(false);

  // The map is rebuilt only when the pins genuinely change. Depending on the
  // array itself would tear down and recreate the whole map on every parent
  // render — including every hover.
  const pinsKey = useMemo(
    () => pins.map((p) => `${p.id}:${p.lat},${p.lng}:${p.status}`).join("|"),
    [pins],
  );

  useEffect(() => {
    let cancelled = false;
    let map: LeafletMap | null = null;

    async function draw() {
      const container = containerRef.current;
      if (!container) return;

      try {
        const L = (await import("leaflet")).default;
        if (cancelled || !containerRef.current) return;

        map = L.map(container, { scrollWheelZoom: false });
        mapRef.current = map;
        markersRef.current = new Map();

        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(map);

        // A dot rather than Leaflet's default icon: the default pulls a PNG
        // from a relative path that does not survive bundling, and a coloured
        // dot carries the status without another asset.
        // Shape and fill carry identity alongside colour. In the light theme
        // --accent and --due-soon resolve to the same hex, so the workshop
        // could not be told from a due-soon customer by colour at all; and at
        // 14px, overdue red and due-soon amber are marginal even when they do
        // differ. A hollow dot and a square are unambiguous at any size.
        const pinIcon = (
          color: string,
          size: number,
          shape: "solid" | "hollow" | "square",
        ) => {
          const radius = shape === "square" ? "3px" : "9999px";
          const fill = shape === "hollow" ? "var(--surface)" : color;
          const border = shape === "hollow" ? `border:3px solid ${color};` : "";
          return L.divIcon({
            className: "",
            html: `<span style="display:block;box-sizing:border-box;width:${size}px;height:${size}px;border-radius:${radius};background:${fill};${border}box-shadow:0 0 0 2px var(--surface),0 1px 3px rgb(0 0 0/.45)"></span>`,
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2],
          });
        };

        const statusColor: Record<MapPin["status"], string> = {
          overdue: "var(--overdue)",
          due_soon: "var(--due-soon)",
          fine: "var(--fine)",
          no_estimate: "var(--unknown)",
        };

        // Overdue is filled, everything else hollow: the urgent pins read as
        // heavier even in greyscale or under colour-vision deficiency.
        const statusShape = (status: MapPin["status"]) =>
          status === "overdue" ? ("solid" as const) : ("hollow" as const);

        const all: Marker[] = [];

        for (const pin of pins) {
          const marker = L.marker([pin.lat, pin.lng], {
            icon: pinIcon(statusColor[pin.status], 15, statusShape(pin.status)),
            title: pin.name,
          }).addTo(map);

          marker.bindPopup(
            `<strong>${escapeHtml(pin.name)}</strong><br>` +
              `<span style="opacity:.75">${escapeHtml(pin.address)}</span>` +
              (pin.detail ? `<br>${escapeHtml(pin.detail)}` : "") +
              (pin.href
                ? `<br><a href="${pin.href}" style="color:var(--accent)">Open customer</a>`
                : ""),
          );

          markersRef.current.set(pin.id, marker);
          all.push(marker);
        }

        if (showWorkshop) {
          const workshop = L.marker([WORKSHOP.lat, WORKSHOP.lng], {
            icon: pinIcon("var(--accent)", 17, "square"),
            title: "The workshop",
            zIndexOffset: 1000,
          }).addTo(map);
          workshop.bindPopup(`<strong>The workshop</strong><br>${escapeHtml(WORKSHOP.area)}`);
          all.push(workshop);
        }

        if (all.length === 1 && zoom) {
          map.setView(all[0]!.getLatLng(), zoom);
        } else if (all.length > 0) {
          map.fitBounds(L.featureGroup(all).getBounds(), { padding: [32, 32], maxZoom: 15 });
        } else {
          map.setView([WORKSHOP.lat, WORKSHOP.lng], 12);
        }
      } catch {
        if (!cancelled) setFailed(true);
      }
    }

    void draw();

    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
      markersRef.current = new Map();
    };
    // pinsKey, not pins: see the comment above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinsKey, zoom, showWorkshop]);

  // Focus is a separate effect so selecting a customer pans the existing map
  // rather than rebuilding it.
  useEffect(() => {
    let cancelled = false;

    async function focus() {
      const map = mapRef.current;

      // Clear any previous route first, so a fast second click never leaves two.
      if (routeRef.current) {
        routeRef.current.remove();
        routeRef.current = null;
      }

      if (!focusId || !map) {
        onRoute?.(null);
        return;
      }

      const marker = markersRef.current.get(focusId);
      const pin = pins.find((p) => p.id === focusId);
      if (!marker || !pin) return;

      map.flyTo(marker.getLatLng(), 15, { duration: 0.6 });
      marker.openPopup();

      if (!showRoute) return;

      const L = (await import("leaflet")).default;
      if (cancelled) return;

      // The straight line is drawn immediately and its distance reported at
      // once, so the panel is never empty while the network is thinking.
      const straight = straightLineKm(WORKSHOP, pin);
      const estimated = estimatedRoadKm(straight);
      onRoute?.({
        km: estimated,
        minutes: driveMinutes(estimated),
        source: "direct",
      });

      let latlngs: [number, number][] = [
        [WORKSHOP.lat, WORKSHOP.lng],
        [pin.lat, pin.lng],
      ];
      let info: RouteInfo = {
        km: estimated,
        minutes: driveMinutes(estimated),
        source: "direct",
      };

      // Upgrade to a real road route when the public router answers. It is a
      // demo server with no uptime guarantee, so this is strictly an
      // enhancement on top of a distance the app can always produce itself.
      try {
        const url =
          `https://router.project-osrm.org/route/v1/driving/` +
          `${WORKSHOP.lng},${WORKSHOP.lat};${pin.lng},${pin.lat}` +
          `?overview=full&geometries=geojson`;
        const response = await fetch(url, { signal: AbortSignal.timeout(4000) });
        if (response.ok) {
          const data = (await response.json()) as {
            routes?: { distance: number; duration: number; geometry: { coordinates: [number, number][] } }[];
          };
          const route = data.routes?.[0];
          if (route && !cancelled) {
            latlngs = route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
            info = {
              km: route.distance / 1000,
              minutes: Math.max(1, Math.round(route.duration / 60)),
              source: "road",
            };
          }
        }
      } catch {
        // Offline, blocked or slow: the straight line already drawn stands.
      }

      if (cancelled || !mapRef.current) return;

      routeRef.current = L.polyline(latlngs, {
        color: "var(--accent)",
        weight: 4,
        opacity: 0.85,
        dashArray: info.source === "direct" ? "6 8" : undefined,
      }).addTo(mapRef.current);

      onRoute?.(info);
      mapRef.current.fitBounds(routeRef.current.getBounds(), { padding: [40, 40] });
    }

    void focus();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId, showRoute, pinsKey]);

  if (failed) {
    return (
      <div
        style={{ height }}
        className="flex items-center justify-center rounded border border-line bg-surface px-6 text-center text-sm text-mid"
      >
        The map could not load. The addresses are still listed below.
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{ height }}
      role="application"
      aria-label={`Map of ${pins.length} customer ${pins.length === 1 ? "location" : "locations"}`}
      className="w-full overflow-hidden rounded border border-line bg-raised"
    />
  );
}

/** Popup content is built as an HTML string, so anything interpolated is escaped. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
