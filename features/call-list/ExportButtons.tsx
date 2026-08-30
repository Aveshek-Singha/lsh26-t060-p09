"use client";

import { formatDate } from "@/lib/domain/civilDate";
import { formatTaka } from "@/lib/domain/money";
import type { CallListEntry } from "@/lib/domain/priority";

/**
 * Take the day's list off the screen.
 *
 * A workshop runs on paper as much as on a browser: the list gets printed and
 * carried to the phone, or opened in a spreadsheet. Both are built in the
 * browser from data already on the page, so neither needs a server round trip.
 */
export function ExportButtons({ entries, asOf }: { entries: CallListEntry[]; asOf: string }) {
  function downloadCsv() {
    const rows: string[][] = [
      ["Priority", "Owner", "Phone", "Plate", "Model", "Item", "Due date", "Days overdue", "Cost (BDT)", "Reason"],
    ];

    entries.forEach((entry, index) => {
      for (const { vehicle, actionable } of entry.vehicles) {
        for (const item of actionable) {
          rows.push([
            String(index + 1),
            entry.owner?.name ?? "Unknown owner",
            entry.owner?.phone ?? "",
            vehicle.plate,
            vehicle.model,
            item.itemName,
            item.dueDate ?? "",
            item.daysUntilDue === null ? "" : String(-item.daysUntilDue),
            formatTaka(item.costPaisa).replace(/,/g, ""),
            item.basis,
          ]);
        }
      }
    });

    // Quote every field and double any embedded quotes: owner names and reasons
    // contain commas, and a naive join would silently corrupt the columns.
    const csv = rows
      .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))
      .join("\r\n");

    // A BOM so Excel opens the taka amounts and Bengali-transliterated plates
    // as UTF-8 rather than mojibake.
    const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `call-list-${asOf}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="no-print flex items-center gap-2">
      <button
        type="button"
        onClick={() => window.print()}
        className="rounded border border-line bg-surface px-2.5 py-1.5 text-xs font-medium text-mid transition-colors hover:border-line-strong hover:text-hi"
      >
        Print
      </button>
      <button
        type="button"
        onClick={downloadCsv}
        className="rounded border border-line bg-surface px-2.5 py-1.5 text-xs font-medium text-mid transition-colors hover:border-line-strong hover:text-hi"
      >
        Export CSV
      </button>
      <span className="sr-only">Call list as of {formatDate(asOf)}</span>
    </div>
  );
}
