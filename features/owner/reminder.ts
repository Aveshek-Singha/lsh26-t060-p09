import { formatDate, formatDayOffset } from "@/lib/domain/civilDate";
import { formatBdt, sumPaisa } from "@/lib/domain/money";
import type { DueAssessment, Owner, Vehicle } from "@/lib/domain/types";

export interface VehicleWork {
  vehicle: Vehicle;
  actionable: DueAssessment[];
}

/**
 * Compose the reminder an owner receives.
 *
 * Plain text on purpose: it has to survive being pasted into SMS or WhatsApp.
 * Every item names what is due, when, and what it costs, and the message ends
 * with a total so there is no surprise at the counter.
 */
export function buildReminder(owner: Owner, work: VehicleWork[], asOf: string): string {
  const lines: string[] = [];
  lines.push(`Assalamu alaikum ${owner.name},`);
  lines.push("");
  lines.push("A quick service reminder from the workshop:");

  let total = 0;

  for (const { vehicle, actionable } of work) {
    if (actionable.length === 0) continue;
    lines.push("");
    lines.push(`${vehicle.plate} (${vehicle.model})`);
    for (const item of actionable) {
      const when =
        item.daysUntilDue === null
          ? "due date unknown"
          : item.daysUntilDue < 0
            ? `${formatDayOffset(item.daysUntilDue)}`
            : `due ${formatDate(item.dueDate!)}`;
      lines.push(`  - ${item.itemName}: ${when}, about ${formatBdt(item.costPaisa)}`);
    }
    total += sumPaisa(actionable.map((item) => item.costPaisa));
  }

  lines.push("");
  lines.push(`Estimated total: ${formatBdt(total)}`);
  lines.push("");
  lines.push("Please call us to book a slot. Prices are estimates and may change after inspection.");
  lines.push("");
  lines.push(`— Service Register, as of ${formatDate(asOf)}`);

  return lines.join("\n");
}
