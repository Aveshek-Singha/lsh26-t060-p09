import { owners, settings, vehicles, SETTINGS_ID } from "./collections";
import type { OwnerDoc, VehicleDoc } from "./collections";
import { compareDates, diffDays } from "@/lib/domain/civilDate";
import { latestReading } from "@/lib/domain/rate";
import { lastServiceOf } from "@/lib/domain/due";
import type {
  CivilDate,
  Owner,
  ServiceRecord,
  Vehicle,
} from "@/lib/domain/types";

/** Fallback used only when the settings document is missing (pre-seed). */
export const DEFAULT_AS_OF: CivilDate = "2026-08-30";

/**
 * An error whose message is safe and useful to show a user.
 * Anything else that escapes is a bug and gets a generic message instead.
 */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

function toOwner(doc: OwnerDoc): Owner {
  return {
    id: doc._id,
    name: doc.name,
    phone: doc.phone,
    ...(doc.email ? { email: doc.email } : {}),
    ...(doc.lastCalledOn ? { lastCalledOn: doc.lastCalledOn } : {}),
  };
}

function toVehicle(doc: VehicleDoc): Vehicle {
  return {
    id: doc._id,
    ownerId: doc.ownerId,
    model: doc.model,
    plate: doc.plate,
    odometerReadings: doc.odometerReadings ?? [],
    serviceItems: doc.serviceItems ?? [],
    serviceHistory: doc.serviceHistory ?? [],
  };
}

/* ------------------------------------------------------------------ reads */

/**
 * The date the whole application treats as "today".
 *
 * The dataset is explicit that `today` is a property of the data, not the wall
 * clock, so every due calculation resolves it from here. It is also what makes
 * the app deterministic for tests and lets a user move time forward to watch
 * the distance estimates shift.
 */
export async function getAsOfDate(): Promise<CivilDate> {
  const collection = await settings();
  const doc = await collection.findOne({ _id: SETTINGS_ID });
  return doc?.asOfDate ?? DEFAULT_AS_OF;
}

export async function listOwners(): Promise<Owner[]> {
  const collection = await owners();
  const docs = await collection.find({}).sort({ name: 1 }).toArray();
  return docs.map(toOwner);
}

export async function listVehicles(): Promise<Vehicle[]> {
  const collection = await vehicles();
  const docs = await collection.find({}).sort({ _id: 1 }).toArray();
  return docs.map(toVehicle);
}

export async function getVehicleById(id: string): Promise<Vehicle | null> {
  const collection = await vehicles();
  const doc = await collection.findOne({ _id: id });
  return doc ? toVehicle(doc) : null;
}

export async function getOwnerById(id: string): Promise<Owner | null> {
  const collection = await owners();
  const doc = await collection.findOne({ _id: id });
  return doc ? toOwner(doc) : null;
}

export async function listVehiclesByOwner(ownerId: string): Promise<Vehicle[]> {
  const collection = await vehicles();
  const docs = await collection.find({ ownerId }).sort({ _id: 1 }).toArray();
  return docs.map(toVehicle);
}

/** Owners keyed by id, for joining onto a vehicle list without an N+1. */
export async function ownersById(): Promise<Map<string, Owner>> {
  const all = await listOwners();
  return new Map(all.map((owner) => [owner.id, owner]));
}

/* ----------------------------------------------------------------- writes */

export async function setAsOfDate(asOfDate: CivilDate): Promise<void> {
  const collection = await settings();
  await collection.updateOne(
    { _id: SETTINGS_ID },
    { $set: { asOfDate } },
    { upsert: true },
  );
}

export interface RecordServiceInput {
  vehicleId: string;
  itemName: string;
  date: CivilDate;
  /** Odometer at the time of service. Required for distance-ruled items. */
  km: number | null;
  costPaisa: number;
  /** Fixed-date items only: the new expiry after renewal. */
  newDueDate?: CivilDate;
}

/**
 * Record a completed service.
 *
 * The brief requires that this resets *that item only*. Two things enforce it:
 * the history row is tagged with the item name so only that item's next-due
 * calculation moves, and the fixed-date renewal uses an array filter targeting
 * one element rather than rewriting the items array. No sibling item is read,
 * written, or reordered.
 */
export async function recordService(input: RecordServiceInput): Promise<void> {
  const collection = await vehicles();
  const doc = await collection.findOne({ _id: input.vehicleId });
  if (!doc) throw new NotFoundError(`No vehicle with id ${input.vehicleId}`);

  const vehicle = toVehicle(doc);
  const item = vehicle.serviceItems.find((candidate) => candidate.name === input.itemName);
  if (!item) {
    throw new NotFoundError(`${vehicle.plate} has no service item called "${input.itemName}"`);
  }

  const asOf = await getAsOfDate();
  if (compareDates(input.date, asOf) > 0) {
    throw new ValidationError("A service cannot be recorded with a future date.");
  }

  const previous = lastServiceOf(vehicle.serviceHistory, input.itemName);
  if (previous && compareDates(input.date, previous.date) < 0) {
    throw new ValidationError(
      `This item was last serviced on ${previous.date}. A new record cannot be older than that.`,
    );
  }

  // Double-submit guard: an identical row for the same item on the same day is
  // almost certainly a duplicated request, not two real services.
  const duplicate = vehicle.serviceHistory.some(
    (record) => record.item === input.itemName && record.date === input.date,
  );
  if (duplicate) {
    throw new ValidationError(
      `${input.itemName} is already recorded as serviced on ${input.date}.`,
    );
  }

  if (item.rule === "distance_km") {
    if (input.km === null) {
      throw new ValidationError(
        `${item.name} is a distance-based item, so the odometer reading at service is required.`,
      );
    }
    const current = latestReading(vehicle.odometerReadings);
    if (current && input.km < current.km) {
      throw new ValidationError(
        `Odometer cannot be below the last recorded reading of ${current.km.toLocaleString("en-US")} km.`,
      );
    }
  }

  if (input.costPaisa < 0) {
    throw new ValidationError("Cost cannot be negative.");
  }

  if (item.rule === "fixed_date" && !input.newDueDate) {
    throw new ValidationError(
      `${item.name} renews to a specific date, so a new expiry date is required.`,
    );
  }
  if (input.newDueDate && compareDates(input.newDueDate, input.date) <= 0) {
    throw new ValidationError("The new expiry date must be after the service date.");
  }

  const record: ServiceRecord = {
    item: input.itemName,
    date: input.date,
    // km is only meaningful for distance-ruled work.
    km: item.rule === "distance_km" ? input.km : null,
    costPaisa: input.costPaisa,
  };

  if (item.rule === "fixed_date" && input.newDueDate) {
    // $[target] with arrayFilters touches exactly the one matching element.
    // The plain `$` operator would only ever match the first array entry.
    await collection.updateOne(
      { _id: input.vehicleId },
      {
        $push: { serviceHistory: record },
        $set: { "serviceItems.$[target].dueDate": input.newDueDate },
      },
      { arrayFilters: [{ "target.name": input.itemName }] },
    );
  } else {
    await collection.updateOne(
      { _id: input.vehicleId },
      { $push: { serviceHistory: record } },
    );
  }
}

export interface AddReadingInput {
  vehicleId: string;
  date: CivilDate;
  km: number;
}

/**
 * Add an odometer reading. Every distance-based estimate on the vehicle moves
 * as a consequence, because the daily-running rate is derived from these.
 */
export async function addOdometerReading(input: AddReadingInput): Promise<void> {
  const collection = await vehicles();
  const doc = await collection.findOne({ _id: input.vehicleId });
  if (!doc) throw new NotFoundError(`No vehicle with id ${input.vehicleId}`);

  const vehicle = toVehicle(doc);
  const asOf = await getAsOfDate();

  if (compareDates(input.date, asOf) > 0) {
    throw new ValidationError("An odometer reading cannot be dated in the future.");
  }
  if (!Number.isInteger(input.km) || input.km < 0) {
    throw new ValidationError("Odometer reading must be a whole number of kilometres.");
  }

  const current = latestReading(vehicle.odometerReadings);
  if (current) {
    if (compareDates(input.date, current.date) < 0) {
      throw new ValidationError(
        `The last reading is dated ${current.date}. A new reading cannot be older than that.`,
      );
    }
    if (input.km < current.km) {
      throw new ValidationError(
        `Odometer cannot go backwards. The last reading was ${current.km.toLocaleString("en-US")} km.`,
      );
    }
    // Same-day entry is a correction to today's figure, not a second reading,
    // so it has to actually move the number. (Every vehicle in the seed has its
    // latest reading dated today, so this is the common path, not an edge case.)
    if (compareDates(input.date, current.date) === 0 && input.km === current.km) {
      throw new ValidationError(
        `The reading for ${current.date} is already ${current.km.toLocaleString("en-US")} km. Enter a higher figure to correct it.`,
      );
    }
    // A plausibility ceiling: 1,000 km/day sustained is not a Dhaka city car,
    // it is a typo with an extra digit.
    const days = diffDays(current.date, input.date);
    if (days > 0 && (input.km - current.km) / days > 1000) {
      throw new ValidationError(
        `That reading implies over 1,000 km per day since ${current.date}. Please check the figure.`,
      );
    }
  }

  const sameDay = current !== null && compareDates(input.date, current.date) === 0;

  if (sameDay) {
    // Correct the existing entry in place rather than storing two readings for
    // one date, which would make the daily-running rate ambiguous.
    await collection.updateOne(
      { _id: input.vehicleId },
      { $set: { "odometerReadings.$[entry].km": input.km } },
      { arrayFilters: [{ "entry.date": input.date }] },
    );
  } else {
    await collection.updateOne(
      { _id: input.vehicleId },
      { $push: { odometerReadings: { date: input.date, km: input.km } } },
    );
  }
}

/**
 * Record that an owner has been rung.
 *
 * Stored as the working date rather than a timestamp, so it stays consistent
 * with the rest of the app: move the working date on and yesterday's calls
 * correctly reappear as still needing a call.
 */
export async function setOwnerCalled(ownerId: string, calledOn: CivilDate | null): Promise<void> {
  const collection = await owners();
  const existing = await collection.findOne({ _id: ownerId });
  if (!existing) throw new NotFoundError(`No owner with id ${ownerId}`);

  await collection.updateOne(
    { _id: ownerId },
    calledOn ? { $set: { lastCalledOn: calledOn } } : { $unset: { lastCalledOn: "" } },
  );
}
