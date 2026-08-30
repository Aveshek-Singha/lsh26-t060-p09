/**
 * Seed the workshop's fleet: `npm run seed`
 *
 * Loads the published PUB-01 case (27 owners, 42 vehicles, 165 service items),
 * normalises it into the app's domain shapes and replaces the contents of the
 * database. Idempotent: running it twice leaves the same state, which is what
 * makes the end-to-end tests repeatable.
 *
 * The case's own `today` is stored as the application's as-of date. The dataset
 * is explicit that today is a property of the case rather than the wall clock.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

import { getClient } from "@/lib/db/client";
import { ensureIndexes, owners, settings, vehicles, SETTINGS_ID } from "@/lib/db/collections";
import type { OwnerDoc, VehicleDoc } from "@/lib/db/collections";
import { normaliseCase, type RawCase } from "./normalize";

const SEED_FILE = path.join(process.cwd(), "data", "seed-case.json");

async function main(): Promise<void> {
  const raw = JSON.parse(await readFile(SEED_FILE, "utf8")) as RawCase;
  const data = normaliseCase(raw);

  console.log(`Case      ${data.caseId} (today ${data.today})`);
  console.log(`Loaded    ${data.owners.length} owners, ${data.vehicles.length} vehicles`);

  const itemCount = data.vehicles.reduce((sum, v) => sum + v.serviceItems.length, 0);
  const historyCount = data.vehicles.reduce((sum, v) => sum + v.serviceHistory.length, 0);
  console.log(`          ${itemCount} service items, ${historyCount} history records`);

  const ownerDocs: OwnerDoc[] = data.owners.map((owner) => ({
    _id: owner.id,
    name: owner.name,
    phone: owner.phone,
  }));

  const vehicleDocs: VehicleDoc[] = data.vehicles.map((vehicle) => ({
    _id: vehicle.id,
    ownerId: vehicle.ownerId,
    model: vehicle.model,
    plate: vehicle.plate,
    odometerReadings: vehicle.odometerReadings,
    serviceItems: vehicle.serviceItems,
    serviceHistory: vehicle.serviceHistory,
  }));

  const ownerCollection = await owners();
  const vehicleCollection = await vehicles();
  const settingsCollection = await settings();

  await ownerCollection.deleteMany({});
  await vehicleCollection.deleteMany({});
  await ownerCollection.insertMany(ownerDocs);
  await vehicleCollection.insertMany(vehicleDocs);
  await settingsCollection.updateOne(
    { _id: SETTINGS_ID },
    { $set: { asOfDate: data.today } },
    { upsert: true },
  );
  await ensureIndexes();

  console.log(`Seeded    ${await ownerCollection.countDocuments()} owners, ${await vehicleCollection.countDocuments()} vehicles`);
  console.log(`As-of     ${data.today}`);
  console.log("\nSeed complete.");
}

main()
  .catch((error: unknown) => {
    console.error("\nSeed failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    const client = await getClient().catch(() => null);
    await client?.close().catch(() => undefined);
  });
