import type { Collection } from "mongodb";
import { getDb } from "./client";
import type {
  CivilDate,
  OdometerReading,
  ServiceItem,
  ServiceRecord,
} from "@/lib/domain/types";

/**
 * Stored shapes.
 *
 * Service items and history are embedded in the vehicle rather than split into
 * their own collections: they are always read with the vehicle, they are
 * bounded (3-5 items, a handful of records), and embedding lets a recorded
 * service be one atomic update instead of a multi-document write.
 *
 * Ids are the domain's own strings ("V01", "O01"), so nothing has to translate
 * between an ObjectId and a route parameter.
 */

export interface OwnerDoc {
  _id: string;
  name: string;
  phone: string;
}

export interface VehicleDoc {
  _id: string;
  ownerId: string;
  model: string;
  plate: string;
  odometerReadings: OdometerReading[];
  serviceItems: ServiceItem[];
  serviceHistory: ServiceRecord[];
}

export interface SettingsDoc {
  _id: string;
  asOfDate: CivilDate;
}

export const SETTINGS_ID = "app";

export async function owners(): Promise<Collection<OwnerDoc>> {
  return (await getDb()).collection<OwnerDoc>("owners");
}

export async function vehicles(): Promise<Collection<VehicleDoc>> {
  return (await getDb()).collection<VehicleDoc>("vehicles");
}

export async function settings(): Promise<Collection<SettingsDoc>> {
  return (await getDb()).collection<SettingsDoc>("settings");
}

/** Called once by the seed script. Cheap and idempotent. */
export async function ensureIndexes(): Promise<void> {
  const vehicleCollection = await vehicles();
  await vehicleCollection.createIndex({ ownerId: 1 });
  await vehicleCollection.createIndex({ plate: 1 });
}
