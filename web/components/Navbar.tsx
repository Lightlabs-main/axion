"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AxionMark } from "./AxionMark";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/console", label: "Console" },
  { href: "/identity", label: "Identity" },
  { href: "/about", label: "How it works" },
];

export function Navbar() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[rgba(5,7,11,0.6)] backdrop-blur-xl">
      <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-3.5 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <AxionMark />
          <span className="font-display text-lg font-extrabold tracking-tight">
            Axion
          </span>
          <span className="chip ml-1 hidden border border-[var(--border)] text-[var(--muted)] sm:inline-flex">
            on Mantle
          </span>
        </Link>

        <div className="flex items-center gap-1">
          {LINKS.map((l) => {
            const active =
              l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "text-[var(--teal-glow)]"
                    : "text-[var(--muted)] hover:text-[var(--text)]"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
          <Link href="/console" className="btn btn-primary ml-2 hidden sm:inline-flex">
            Launch Demo
          </Link>
        </div>
      </nav>
    </header>
  );
}
