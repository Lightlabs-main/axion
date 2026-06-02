"use client";

import { useState } from "react";
import { shortHash } from "@/lib/hashing";

export function CopyHash({
  value,
  label,
  full = false,
  href,
}: {
  value: string;
  label?: string;
  full?: boolean;
  href?: string;
}) {
  const [copied, setCopied] = useState(false);
  const display = full ? value : shortHash(value);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-black/20 px-3 py-2">
      {label && <span className="label shrink-0">{label}</span>}
      <div className="flex min-w-0 items-center gap-2">
        <code className="mono truncate text-xs text-[var(--teal-glow)]" title={value}>
          {display || "—"}
        </code>
        {href && (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-[var(--violet)] hover:underline"
          >
            ↗
          </a>
        )}
        <button
          onClick={copy}
          className="shrink-0 rounded-md border border-[var(--border)] px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-[var(--muted)] transition-colors hover:text-[var(--teal-glow)]"
          aria-label="Copy"
        >
          {copied ? "✓" : "copy"}
        </button>
      </div>
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "teal" | "violet" | "emerald" | "amber" | "rose";
}) {
  const tones: Record<string, string> = {
    neutral: "border-[var(--border)] text-[var(--muted)]",
    teal: "border-[rgba(45,212,191,0.4)] text-[var(--teal-glow)] bg-[rgba(45,212,191,0.08)]",
    violet: "border-[rgba(167,139,250,0.4)] text-[var(--violet)] bg-[rgba(167,139,250,0.08)]",
    emerald: "border-[rgba(52,211,153,0.4)] text-[var(--emerald)] bg-[rgba(52,211,153,0.08)]",
    amber: "border-[rgba(251,191,36,0.4)] text-[var(--amber)] bg-[rgba(251,191,36,0.08)]",
    rose: "border-[rgba(251,113,133,0.4)] text-[var(--rose)] bg-[rgba(251,113,133,0.08)]",
  };
  return <span className={`chip border ${tones[tone]}`}>{children}</span>;
}

export function Stat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-black/20 p-4">
      <div className="label">{label}</div>
      <div
        className={`mt-1 font-display text-2xl font-bold ${
          accent ? "gradient-text" : ""
        }`}
      >
        {value}
      </div>
      {sub && <div className="mt-0.5 text-xs text-[var(--muted)]">{sub}</div>}
    </div>
  );
}

export function SectionTitle({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      {eyebrow && <div className="label mb-1.5">{eyebrow}</div>}
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-xl font-bold">{title}</h2>
        {children}
      </div>
    </div>
  );
}
