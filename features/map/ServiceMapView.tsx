"use client";

import Link from "next/link";
import { useState } from "react";

import { formatBdt } from "@/lib/domain/money";
import { DirectionsButton } from "./DirectionsButton";
import { ServiceMap, type MapPin, type RouteInfo } from "./ServiceMap";
import { formatKm, formatMinutes } from "@/lib/domain/geo";
import type { OwnerLocation } from "@/lib/domain/types";

export interface MapCustomer {
  ownerId: string;
  name: string;
  location: OwnerLocation;
  itemCount: number;
  valuePaisa: number;
  overdue: boolean;
}

export interface AreaGroup {
  area: string;
  customers: MapCustomer[];
  valuePaisa: number;
}

/**
 * The map and the round list, sharing one selection.
 *
 * Selecting a customer in the list flies the map to their pin and opens it, so
 * the two halves stay in step — a name in a list means nothing until you can see
 * where it is. Selection is by click rather than hover: a hover-driven map on a
 * long list fires constantly as the pointer crosses rows on its way somewhere
 * else, and on a phone there is no hover at all.
 */
export function ServiceMapView({ areas, pins }: { areas: AreaGroup[]; pins: MapPin[] }) {
  const [focusId, setFocusId] = useState<string | null>(null);
  const [route, setRoute] = useState<RouteInfo | null>(null);

  const selected = focusId
    ? areas.flatMap((a) => a.customers).find((c) => c.ownerId === focusId) ?? null
    : null;

  return (
    <>
      <ServiceMap
        pins={pins}
        height="28rem"
        focusId={focusId}
        showRoute
        onRoute={setRoute}
      />

      {/* The route summary: distance and drive time from the workshop, plus
          which of the two it is — a measured road route or a fallback estimate.
          Saying which matters; a guess presented as a measurement is worse than
          no number. */}
      {selected && (
        <div
          data-route-panel
          data-route-source={route?.source ?? "pending"}
          className="enter mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 rounded border border-accent/30 bg-surface px-4 py-3"
        >
          <div className="min-w-0">
            <p className="eyebrow">Route from workshop</p>
            <p className="truncate text-sm font-semibold text-hi">{selected.name}</p>
            <p className="truncate text-xs text-low">{selected.location.address}</p>
          </div>
          <div className="text-right">
            <p className="eyebrow">Distance</p>
            <p data-route-km className="nums text-lg font-semibold text-hi">
              {route ? formatKm(route.km) : "—"}
            </p>
          </div>
          <div className="text-right">
            <p className="eyebrow">Drive time</p>
            <p data-route-time className="nums text-lg font-semibold text-hi">
              {route ? formatMinutes(route.minutes) : "—"}
            </p>
          </div>
          <p className="w-full text-[0.6875rem] text-low sm:w-auto">
            {route?.source === "road"
              ? "Measured road route"
              : "Straight-line estimate — the routing service did not answer"}
          </p>
          <div className="ml-auto">
            <DirectionsButton location={selected.location} compact />
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
        <Key color="var(--accent)" label="The workshop" shape="square" />
        <Key color="var(--overdue)" label="Overdue" shape="solid" />
        <Key color="var(--due-soon)" label="Due soon" shape="hollow" />
        <span className="text-low">
          Select a customer below to zoom to them, or click a pin directly.
        </span>
        {focusId && (
          <button
            type="button"
            onClick={() => setFocusId(null)}
            className="text-mid underline-offset-4 hover:text-hi hover:underline"
          >
            Clear selection
          </button>
        )}
      </div>

      <h2 className="mt-8 mb-3 text-sm font-semibold text-hi">
        By area
        <span className="ml-2 font-normal text-low">
          {areas.length} {areas.length === 1 ? "area" : "areas"} · plan a round
        </span>
      </h2>

      <ul className="stagger space-y-3">
        {areas.map((group) => (
          <li key={group.area} className="rounded border border-line bg-surface px-4 py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-sm font-semibold text-hi">{group.area}</h3>
              <p className="nums text-xs text-low">
                {group.customers.length}{" "}
                {group.customers.length === 1 ? "customer" : "customers"} ·{" "}
                {formatBdt(group.valuePaisa)}
              </p>
            </div>

            <ul className="mt-2 space-y-1">
              {group.customers.map((customer) => {
                const isSelected = focusId === customer.ownerId;
                return (
                  <li
                    key={customer.ownerId}
                    data-map-owner={customer.ownerId}
                    data-selected={isSelected ? "yes" : "no"}
                    className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded px-2 py-2 transition-colors ${
                      isSelected ? "bg-raised" : ""
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        aria-hidden
                        className="inline-block size-2 shrink-0 rounded-full"
                        style={{
                          backgroundColor: customer.overdue
                            ? "var(--overdue)"
                            : "var(--due-soon)",
                        }}
                      />
                      <div className="min-w-0">
                        {/* The row selects; the name still navigates. */}
                        <button
                          type="button"
                          onClick={() => setFocusId(isSelected ? null : customer.ownerId)}
                          aria-pressed={isSelected}
                          className="block max-w-full truncate text-left text-xs font-medium text-hi transition-colors hover:text-accent"
                        >
                          {customer.name}
                        </button>
                        <p className="truncate text-[0.6875rem] text-low">
                          {customer.location.address}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span className="nums text-[0.6875rem] text-low">
                        {customer.itemCount} · {formatBdt(customer.valuePaisa)}
                      </span>
                      <Link
                        href={`/owners/${customer.ownerId}`}
                        className="text-[0.6875rem] text-mid underline-offset-4 hover:text-hi hover:underline"
                      >
                        open
                      </Link>
                      <DirectionsButton location={customer.location} compact />
                    </div>
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>
    </>
  );
}

/** Mirrors the marker shapes exactly; a legend that does not match is worse
    than none. */
function Key({
  color,
  label,
  shape,
}: {
  color: string;
  label: string;
  shape: "solid" | "hollow" | "square";
}) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        aria-hidden
        className={`inline-block size-2.5 shrink-0 ${shape === "square" ? "rounded-sm" : "rounded-full"}`}
        style={
          shape === "hollow"
            ? { backgroundColor: "var(--surface)", border: `2px solid ${color}` }
            : { backgroundColor: color }
        }
      />
      <span className="text-mid">{label}</span>
    </span>
  );
}
