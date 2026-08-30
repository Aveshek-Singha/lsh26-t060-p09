/**
 * Constraint check: `npm run verify:reset`
 *
 * The brief is explicit that recording a completed service must reset that one
 * item only. This proves it against the real database rather than a mock:
 * snapshot every item's computed due date, record one service, then diff.
 *
 * Runs for all three rules, because each takes a different write path
 * (fixed_date uses an arrayFilters update; the others are driven purely by the
 * new history row). Re-seed afterwards to restore the demo state.
 */
import { getClient } from "@/lib/db/client";
import { getAsOfDate, getVehicleById, listVehicles, recordService } from "@/lib/db/repo";
import { assessVehicle } from "@/lib/domain/due";
import { addMonths } from "@/lib/domain/civilDate";
import { currentKm } from "@/lib/domain/rate";
import type { ServiceRule, Vehicle } from "@/lib/domain/types";

interface Snapshot {
  due: Map<string, string>;
  historyCount: number;
}

function snapshot(vehicle: Vehicle, asOf: string): Snapshot {
  const due = new Map<string, string>();
  for (const assessment of assessVehicle(vehicle, asOf)) {
    due.set(assessment.itemName, `${assessment.dueDate ?? "none"}|${assessment.status}`);
  }
  return { due, historyCount: vehicle.serviceHistory.length };
}

let failures = 0;

function check(condition: boolean, label: string): void {
  console.log(`${condition ? "  PASS" : "  FAIL"}  ${label}`);
  if (!condition) failures += 1;
}

async function testRule(
  rule: ServiceRule,
  vehicles: Vehicle[],
  asOf: string,
  used: Set<string>,
): Promise<void> {
  // A different vehicle per rule, and re-read fresh from the database, so an
  // earlier iteration's write cannot be mistaken for a sibling changing.
  const candidate = vehicles.find(
    (v) => !used.has(v.id) && v.serviceItems.some((i) => i.rule === rule),
  );
  if (!candidate) {
    console.log(`\n${rule}: no unused vehicle in the fleet has this rule, skipping`);
    return;
  }
  used.add(candidate.id);

  const vehicle = await getVehicleById(candidate.id);
  if (!vehicle) throw new Error(`vehicle ${candidate.id} not found`);
  const item = vehicle.serviceItems.find((i) => i.rule === rule)!;

  console.log(`\n${rule}  —  ${vehicle.plate}, item "${item.name}"`);

  const before = snapshot(vehicle, asOf);
  const beforeDue = before.due.get(item.name)!;

  await recordService({
    vehicleId: vehicle.id,
    itemName: item.name,
    date: asOf,
    km: rule === "distance_km" ? currentKm(vehicle.odometerReadings) : null,
    costPaisa: item.costPaisa,
    ...(rule === "fixed_date" ? { newDueDate: addMonths(asOf, 12) } : {}),
  });

  const updated = await getVehicleById(vehicle.id);
  if (!updated) throw new Error("vehicle vanished after recording a service");
  const after = snapshot(updated, asOf);

  check(after.due.get(item.name) !== beforeDue, `"${item.name}" moved: ${beforeDue} -> ${after.due.get(item.name)}`);

  const siblings = [...before.due.keys()].filter((name) => name !== item.name);
  const changed = siblings.filter((name) => before.due.get(name) !== after.due.get(name));
  check(
    changed.length === 0,
    changed.length === 0
      ? `all ${siblings.length} sibling items untouched`
      : `siblings changed when they should not have: ${changed.join(", ")}`,
  );

  check(
    after.historyCount === before.historyCount + 1,
    `history grew by exactly 1 (${before.historyCount} -> ${after.historyCount})`,
  );

  check(
    updated.serviceItems.length === vehicle.serviceItems.length,
    `item count unchanged (${updated.serviceItems.length})`,
  );

  // The duplicate guard should now reject an identical resubmission.
  let rejected = false;
  try {
    await recordService({
      vehicleId: vehicle.id,
      itemName: item.name,
      date: asOf,
      km: rule === "distance_km" ? currentKm(updated.odometerReadings) : null,
      costPaisa: item.costPaisa,
      ...(rule === "fixed_date" ? { newDueDate: addMonths(asOf, 12) } : {}),
    });
  } catch (error) {
    rejected = error instanceof Error && error.name === "ValidationError";
  }
  check(rejected, "identical resubmission rejected (double-submit guard)");
}

async function main(): Promise<void> {
  const asOf = await getAsOfDate();
  const vehicles = await listVehicles();
  console.log(`Fleet: ${vehicles.length} vehicles, as of ${asOf}`);

  const used = new Set<string>();
  for (const rule of ["fixed_date", "period_months", "distance_km"] as const) {
    await testRule(rule, vehicles, asOf, used);
  }

  console.log(
    failures === 0
      ? "\nAll constraint checks passed. Run `npm run seed` to restore the demo data."
      : `\n${failures} check(s) FAILED.`,
  );
  if (failures > 0) process.exitCode = 1;
}

main()
  .catch((error: unknown) => {
    console.error("\nVerification failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    const client = await getClient().catch(() => null);
    await client?.close().catch(() => undefined);
  });
