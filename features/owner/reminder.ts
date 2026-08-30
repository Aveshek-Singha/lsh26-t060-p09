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

/** Subject line: specific enough to be useful in a crowded inbox. */
export function buildReminderSubject(work: VehicleWork[]): string {
  const plates = work
    .filter((entry) => entry.actionable.length > 0)
    .map((entry) => entry.vehicle.plate);

  if (plates.length === 0) return "Service reminder from the workshop";
  if (plates.length === 1) return `Service due on ${plates[0]}`;
  return `Service due on ${plates[0]} and ${plates.length - 1} other ${
    plates.length === 2 ? "vehicle" : "vehicles"
  }`;
}

/**
 * Some mail clients and browsers truncate very long mailto URLs — Outlook has
 * historically cut off around 2,000 characters. Anything longer drops the tail
 * of the message silently, which is worse than a shorter note.
 */
export const MAILTO_LIMIT = 1800;

export interface MailDraft {
  to: string;
  subject: string;
  body: string;
  href: string;
  /** Gmail's web compose window, prefilled. Opens a draft; never sends. */
  gmailHref: string;
  /** True when the body was shortened to stay inside the URL limit. */
  truncated: boolean;
}

/**
 * Gmail's compose URL.
 *
 * `view=cm` opens the compose window, `fs=1` makes it full-screen, and `to`,
 * `su` and `body` prefill the draft. Nothing is sent: Gmail opens the message
 * ready to review, and the workshop presses Send themselves. If the operator is
 * signed out, Gmail routes through its own login and returns to the draft.
 */
export function gmailComposeUrl(to: string, subject: string, body: string): string {
  const params = new URLSearchParams({
    view: "cm",
    fs: "1",
    to,
    su: subject,
    body,
  });
  return `https://mail.google.com/mail/?${params.toString()}`;
}

/**
 * Build a `mailto:` link that opens the workshop's own mail client with the
 * reminder already written.
 *
 * Deliberately not a server-side send: that needs an SMTP or API credential the
 * event did not provide, and the seeded addresses are on the reserved
 * example.com domain, so a real send would only ever bounce. Handing the draft
 * to the operator's own client also means replies land in their inbox and the
 * message is theirs to edit before it goes.
 */
export function buildMailDraft(
  email: string,
  subject: string,
  body: string,
): MailDraft {
  const encode = (text: string) => encodeURIComponent(text).replace(/%0A/g, "%0D%0A");

  let finalBody = body;
  let truncated = false;

  // Measure the encoded length, since that is what the client actually receives.
  if (`mailto:${email}?subject=${encode(subject)}&body=${encode(body)}`.length > MAILTO_LIMIT) {
    truncated = true;
    const keep = body.split("\n");
    while (
      keep.length > 4 &&
      `mailto:${email}?subject=${encode(subject)}&body=${encode(keep.join("\n"))}`.length >
        MAILTO_LIMIT
    ) {
      keep.splice(-6, 1);
    }
    finalBody = keep.join("\n");
  }

  return {
    to: email,
    subject,
    body: finalBody,
    href: `mailto:${email}?subject=${encode(subject)}&body=${encode(finalBody)}`,
    gmailHref: gmailComposeUrl(email, subject, finalBody),
    truncated,
  };
}
