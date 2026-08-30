import Link from "next/link";

import { getAsOfDate } from "@/lib/db/repo";
import { DEFAULT_AS_OF } from "@/lib/db/repo";
import { AsOfControl } from "./AsOfControl";
import { ThemeToggle } from "./ThemeToggle";
import { NavLink } from "./NavLink";

/**
 * The as-of date is read here rather than passed down, so it is correct on
 * every page. A database failure must not blank the whole shell, so it falls
 * back to the seeded date and lets the page below report the real problem.
 */
export async function SiteHeader() {
  const asOfDate = await getAsOfDate().catch(() => DEFAULT_AS_OF);

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-ground/85 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
        <Link href="/" className="group flex items-baseline gap-2">
          <span className="text-base font-semibold tracking-tight text-hi">
            Service Register
          </span>
          <span className="hidden text-xs text-low sm:inline">Dhaka workshop</span>
        </Link>

        <nav className="order-3 flex w-full items-center gap-1 sm:order-none sm:w-auto">
          <NavLink href="/">Call list</NavLink>
          <NavLink href="/vehicles">Vehicles</NavLink>
          <NavLink href="/forecast">Forecast</NavLink>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <AsOfControl asOfDate={asOfDate} />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
