/**
 * Loading placeholders.
 *
 * Each page's data comes from a round trip to Atlas, so there is a real moment
 * where the screen would otherwise be blank. These hold the shape of what is
 * coming, which reads as "loading" rather than "broken".
 */

export function SkeletonBar({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-raised ${className}`} />;
}

export function SkeletonRows({ count = 5 }: { count?: number }) {
  return (
    <ol className="space-y-3" aria-hidden>
      {Array.from({ length: count }, (_, index) => (
        <li key={index} className="rounded border border-line bg-surface px-5 py-4">
          <div className="flex items-center gap-3">
            <SkeletonBar className="h-4 w-8" />
            <SkeletonBar className="h-4 w-20" />
            <SkeletonBar className="h-4 w-40" />
          </div>
          <div className="mt-3 space-y-2 pl-3">
            <SkeletonBar className="h-3 w-1/2" />
            <SkeletonBar className="h-3 w-2/3" />
          </div>
        </li>
      ))}
    </ol>
  );
}

export function LoadingPage({ title, rows = 5 }: { title: string; rows?: number }) {
  return (
    <>
      <div className="pt-8 pb-5">
        <h1 className="text-2xl font-semibold tracking-tight text-hi sm:text-3xl">{title}</h1>
        <p className="mt-1.5 text-sm text-mid" role="status">
          Loading…
        </p>
      </div>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="rounded border border-line bg-surface px-4 py-3">
            <SkeletonBar className="h-2.5 w-20" />
            <SkeletonBar className="mt-2 h-5 w-12" />
          </div>
        ))}
      </div>
      <SkeletonRows count={rows} />
    </>
  );
}
