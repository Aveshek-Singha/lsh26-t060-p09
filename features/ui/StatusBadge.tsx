import type { DueStatus } from "@/lib/domain/types";

const STYLES: Record<DueStatus, { label: string; className: string }> = {
  overdue: {
    label: "Overdue",
    className: "bg-overdue-bg text-overdue border-overdue/30",
  },
  due_soon: {
    label: "Due soon",
    className: "bg-due-soon-bg text-due-soon border-due-soon/30",
  },
  fine: {
    label: "Fine",
    className: "bg-fine-bg text-fine border-fine/30",
  },
  no_estimate: {
    label: "No estimate",
    className: "bg-unknown-bg text-unknown border-unknown/30",
  },
};

/**
 * Status is carried by label as well as colour, so the three states stay
 * distinguishable without relying on colour vision.
 */
export function StatusBadge({ status, className = "" }: { status: DueStatus; className?: string }) {
  const style = STYLES[status];
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded border px-1.5 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-wide ${style.className} ${className}`}
    >
      {style.label}
    </span>
  );
}

export function statusLabel(status: DueStatus): string {
  return STYLES[status].label;
}
