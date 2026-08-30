"use client";

import { useState } from "react";

import { WORKSHOP } from "@/lib/seed/dhaka";
import type { OwnerLocation } from "@/lib/domain/types";

/**
 * Directions to a customer, for the van going out on home service.
 *
 * Two routes on purpose. The default is workshop-to-customer, because that is
 * the journey the workshop actually makes. "From where I am" uses the browser's
 * geolocation for a mechanic already out on the road, and is offered rather than
 * assumed: asking for location on page load is the kind of prompt people refuse
 * on reflex.
 *
 * Google Maps rather than an embedded router — it has Dhaka traffic, and it is
 * already on the phone in the driver's pocket.
 */
export function DirectionsButton({
  location,
  compact = false,
}: {
  location: OwnerLocation;
  compact?: boolean;
}) {
  const [status, setStatus] = useState<"idle" | "locating" | "denied">("idle");

  const destination = `${location.lat},${location.lng}`;
  const fromWorkshop = `https://www.google.com/maps/dir/?api=1&origin=${WORKSHOP.lat},${WORKSHOP.lng}&destination=${destination}&travelmode=driving`;

  function fromHere() {
    if (!("geolocation" in navigator)) {
      setStatus("denied");
      return;
    }
    setStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setStatus("idle");
        const origin = `${pos.coords.latitude},${pos.coords.longitude}`;
        window.open(
          `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`,
          "_blank",
          "noopener,noreferrer",
        );
      },
      // Denial is a normal answer, not an error: fall back to the workshop route.
      () => setStatus("denied"),
      { timeout: 10_000, maximumAge: 300_000 },
    );
  }

  const buttonClass = compact
    ? "inline-flex min-h-7 items-center rounded border border-line px-2.5 py-1 text-[0.6875rem] font-medium text-mid transition-colors hover:border-accent hover:text-accent"
    : "inline-flex min-h-8 items-center rounded border border-line bg-raised px-3 py-1.5 text-xs font-medium text-hi transition-colors hover:border-accent hover:text-accent";

  return (
    <div className="no-print flex flex-wrap items-center gap-2">
      <a href={fromWorkshop} target="_blank" rel="noopener noreferrer" className={buttonClass}>
        Directions from workshop
      </a>
      <button type="button" onClick={fromHere} disabled={status === "locating"} className={buttonClass}>
        {status === "locating" ? "Finding you..." : "From my location"}
      </button>
      {status === "denied" && (
        <span className="enter-fade text-[0.6875rem] text-low">
          Location unavailable — use the workshop route above.
        </span>
      )}
    </div>
  );
}
