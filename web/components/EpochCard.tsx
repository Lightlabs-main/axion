"use client";

import { useState } from "react";
import type { Epoch } from "@/types";
import { Badge } from "./ui";
import { EpochView, VERDICT_TONE } from "./EpochView";
import { shortHash } from "@/lib/hashing";

function formatTime(ts: number): string {
  try {
    return new Date(ts).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(ts);
  }
}

export function EpochCard({ epoch, index }: { epoch: Epoch; index: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="panel panel-hover overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-4 p-4 text-left"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--border)] font-mono text-sm font-bold text-[var(--teal-glow)]">
          {index}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-semibold">{epoch.goal}</span>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--muted)]">
            <span>Branch {epoch.selectedBranchId}</span>
            <span>·</span>
            <span>
              v{epoch.strategyVersionBefore} → v{epoch.strategyVersionAfter}
            </span>
            <span>·</span>
            <span className="mono">root {shortHash(epoch.memoryRootAfter, 6, 4)}</span>
            <span>·</span>
            <span>{formatTime(epoch.timestamp)}</span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge tone={VERDICT_TONE[epoch.verdict]}>{epoch.verdict}</Badge>
          <Badge tone="neutral">
            {epoch.scoreDelta >= 0 ? "+" : ""}
            {epoch.scoreDelta}
          </Badge>
          <span className="text-[var(--muted)]">{open ? "▾" : "▸"}</span>
        </div>
      </button>
      {open && (
        <div className="border-t border-[var(--border)] bg-black/20 p-4">
          <EpochView epoch={epoch} />
        </div>
      )}
    </div>
  );
}

export function Timeline({ epochs }: { epochs: Epoch[] }) {
  if (epochs.length === 0) {
    return (
      <div className="panel p-8 text-center">
        <div className="label mb-2">Chronos timeline</div>
        <p className="text-sm text-[var(--muted)]">
          No epochs yet. Run a full lifecycle in the console and the verified epoch will appear here
          as a permanent record.
        </p>
      </div>
    );
  }
  // epochs are stored newest-first; number them so the oldest is #1.
  const total = epochs.length;
  return (
    <div className="space-y-3">
      {epochs.map((e, i) => (
        <EpochCard key={e.epochId} epoch={e} index={total - i} />
      ))}
    </div>
  );
}
