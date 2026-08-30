"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Nav item that marks the current section for both sighted and screen readers. */
export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={
        active
          ? "rounded border border-line bg-surface px-2.5 py-1.5 text-xs font-medium text-hi"
          : "rounded border border-transparent px-2.5 py-1.5 text-xs font-medium text-mid transition-colors hover:text-hi"
      }
    >
      {children}
    </Link>
  );
}
