import Link from "next/link";

/** Shown when a list has no rows for a reason worth explaining. */
export function EmptyState({
  title,
  detail,
  action,
}: {
  title: string;
  detail: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="rounded border border-dashed border-line bg-surface px-6 py-14 text-center">
      <p className="text-base font-semibold text-hi">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-mid">{detail}</p>
      {action && (
        <Link
          href={action.href}
          className="mt-5 inline-block rounded border border-line bg-raised px-3 py-1.5 text-xs font-medium text-hi transition-colors hover:border-line-strong"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}

/**
 * Shown when the page could not load its data at all.
 *
 * A blank screen tells the user nothing. This says what failed, what it usually
 * means, and gives them a way to retry.
 */
export function ErrorPanel({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded border border-overdue/40 bg-overdue-bg px-6 py-8">
      <p className="text-base font-semibold text-overdue">{title}</p>
      <p className="mt-2 max-w-2xl text-sm text-mid">{detail}</p>
      <p className="mt-4 text-xs text-low">
        If this persists, check that <span className="nums">MONGODB_URI</span> is set and that the
        database allows connections from this address.
      </p>
    </div>
  );
}

export function PageHeading({
  title,
  subtitle,
  aside,
}: {
  title: string;
  subtitle?: string;
  aside?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 pt-8 pb-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-hi sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-2xl text-sm text-mid">{subtitle}</p>}
      </div>
      {aside}
    </div>
  );
}
