"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  addOdometerReading,
  getAsOfDate,
  getVehicleById,
  recordService,
  setAsOfDate,
  setOwnerCalled,
} from "@/lib/db/repo";
import { isCivilDate } from "@/lib/domain/civilDate";
import { parsePaisa } from "@/lib/domain/money";
import { failure, messageFor, success, type ActionResult } from "./types";

const civilDate = z.string().refine(isCivilDate, "Enter a valid date.");

/**
 * Taka typed by a human: "1200", "1,200", "1200.50" are all fine; anything
 * else is rejected before it can become NaN in a total.
 */
const taka = z
  .string()
  .trim()
  .min(1, "Enter a cost.")
  .transform((value) => value.replace(/,/g, ""))
  .refine((value) => /^\d+(\.\d{1,2})?$/.test(value), "Cost must be a number, for example 1200 or 1200.50")
  .transform((value) => parsePaisa(value));

const odometer = z
  .string()
  .trim()
  .min(1, "Enter the odometer reading.")
  .transform((value) => value.replace(/[,\s]/g, ""))
  .refine((value) => /^\d+$/.test(value), "Odometer must be a whole number of kilometres.")
  .transform((value) => Number(value));

/** Formats the first Zod issue as the message the user sees. */
function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Please check the form and try again.";
}

/* ------------------------------------------------------------- as-of date */

const asOfSchema = z.object({ asOfDate: civilDate });

export async function updateAsOfDate(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = asOfSchema.safeParse({ asOfDate: formData.get("asOfDate") });
  if (!parsed.success) return failure(firstIssue(parsed.error));

  try {
    await setAsOfDate(parsed.data.asOfDate);
    revalidatePath("/", "layout");
    return success(`Now working as of ${parsed.data.asOfDate}.`);
  } catch (error) {
    return failure(messageFor(error));
  }
}

/* -------------------------------------------------------- record service */

const recordSchema = z.object({
  vehicleId: z.string().min(1),
  itemName: z.string().min(1),
  date: civilDate,
  costPaisa: taka,
  km: z.string().trim().optional(),
  newDueDate: z.string().trim().optional(),
});

export async function recordServiceAction(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = recordSchema.safeParse({
    vehicleId: formData.get("vehicleId"),
    itemName: formData.get("itemName"),
    date: formData.get("date"),
    costPaisa: formData.get("cost"),
    km: formData.get("km") ?? undefined,
    newDueDate: formData.get("newDueDate") ?? undefined,
  });
  if (!parsed.success) return failure(firstIssue(parsed.error));

  const { vehicleId, itemName, date, costPaisa, km, newDueDate } = parsed.data;

  // The odometer field is only required for distance-ruled items, so it is
  // validated conditionally rather than in the base schema.
  let kmValue: number | null = null;
  if (km) {
    const parsedKm = odometer.safeParse(km);
    if (!parsedKm.success) return failure(firstIssue(parsedKm.error));
    kmValue = parsedKm.data;
  }

  if (newDueDate && !isCivilDate(newDueDate)) {
    return failure("Enter a valid new expiry date.");
  }

  try {
    await recordService({
      vehicleId,
      itemName,
      date,
      km: kmValue,
      costPaisa,
      ...(newDueDate ? { newDueDate } : {}),
    });
    revalidatePath("/", "layout");
    revalidatePath(`/vehicles/${vehicleId}`);
    return success(`${itemName} recorded as serviced on ${date}.`);
  } catch (error) {
    return failure(messageFor(error));
  }
}

/* ------------------------------------------------------- odometer reading */

const readingSchema = z.object({
  vehicleId: z.string().min(1),
  date: civilDate,
  km: odometer,
});

export async function addReadingAction(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = readingSchema.safeParse({
    vehicleId: formData.get("vehicleId"),
    date: formData.get("date"),
    km: formData.get("km"),
  });
  if (!parsed.success) return failure(firstIssue(parsed.error));

  try {
    await addOdometerReading(parsed.data);
    const vehicle = await getVehicleById(parsed.data.vehicleId);
    revalidatePath("/", "layout");
    revalidatePath(`/vehicles/${parsed.data.vehicleId}`);
    return success(
      `Odometer updated to ${parsed.data.km.toLocaleString("en-US")} km.` +
        (vehicle ? " Distance-based estimates have been recalculated." : ""),
    );
  } catch (error) {
    return failure(messageFor(error));
  }
}

/* --------------------------------------------------------- mark as called */

const calledSchema = z.object({
  ownerId: z.string().min(1),
  called: z.enum(["yes", "no"]),
});

export async function markCalledAction(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = calledSchema.safeParse({
    ownerId: formData.get("ownerId"),
    called: formData.get("called"),
  });
  if (!parsed.success) return failure(firstIssue(parsed.error));

  try {
    const asOf = await getAsOfDate();
    const called = parsed.data.called === "yes";
    await setOwnerCalled(parsed.data.ownerId, called ? asOf : null);
    revalidatePath("/", "layout");
    return success(called ? "Marked as called." : "Moved back onto the list.");
  } catch (error) {
    return failure(messageFor(error));
  }
}
