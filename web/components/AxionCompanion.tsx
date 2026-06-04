"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import type { AgentIdentity, Epoch } from "@/types";
import { Badge } from "./ui";
import { shortHash } from "@/lib/hashing";

type CompanionMood = "idle" | "thinking" | "committed" | "executing" | "evolved";

const MOOD_COPY: Record<CompanionMood, string> = {
  idle: "Listening for a goal",
  thinking: "Building branches",
  committed: "Reasoning frozen on-chain",
  executing: "Running guarded action",
  evolved: "Strategy upgraded",
};

export function AxionCompanion({
  agent,
  latestEpoch,
  mood = "idle",
  compact = false,
}: {
  agent?: AgentIdentity | null;
  latestEpoch?: Epoch | null;
  mood?: CompanionMood;
  compact?: boolean;
}) {
  const level = Math.max(1, agent?.strategyVersion ?? 1);
  const trust = agent?.trustScore ?? 70;
  const epochCount = agent?.totalEpochs ?? 0;

  return (
    <div className={`companion-shell ${compact ? "p-5" : "p-6"}`}>
      <div className="flex flex-col items-center text-center">
        <div
          className={`companion-orb mood-${mood}`}
          style={{ "--evolution": Math.min(level, 8) } as CSSProperties}
          aria-hidden
        >
          <div className="companion-ring companion-ring-a" />
          <div className="companion-ring companion-ring-b" />
          <div className="companion-core">
            <span>A</span>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Badge tone={mood === "evolved" ? "emerald" : "teal"}>{MOOD_COPY[mood]}</Badge>
          <Badge tone="violet">v{level}</Badge>
        </div>

        <h2 className="mt-4 font-display text-2xl font-extrabold">
          Your Axion is learning in public
        </h2>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-[var(--muted)]">
          Give it a real financial goal. Axion turns the goal into a committed decision tree, acts
          through guarded skills, then forges the next strategy from the judged outcome.
        </p>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-2">
        <CompanionStat label="Trust" value={trust} />
        <CompanionStat label="Epochs" value={epochCount} />
        <CompanionStat label="Memory" value={agent ? shortHash(agent.memoryRoot, 4, 4) : "fresh"} />
      </div>

      {latestEpoch ? (
        <div className="mt-4 rounded-xl border border-[var(--border)] bg-black/20 p-4">
          <div className="label mb-2">Latest forged upgrade</div>
          <div className="font-display text-lg font-bold">
            {upgradeName(latestEpoch)}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
            {latestEpoch.postMortem.narrative}
          </p>
          <Link href="/identity" className="mt-3 inline-flex text-xs font-semibold text-[var(--teal-glow)] hover:underline">
            View evolution timeline
          </Link>
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-[var(--border)] bg-black/20 p-4">
          <div className="label mb-2">First forge target</div>
          <div className="font-display text-lg font-bold">Risk Sentinel Lv. 1</div>
          <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
            Axion will earn its first visible upgrade after a goal is committed, executed, judged
            and written as an epoch.
          </p>
        </div>
      )}
    </div>
  );
}

export function ShareableEpochCard({ epoch }: { epoch: Epoch }) {
  return (
    <div className="share-card overflow-hidden p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="label text-[var(--teal-glow)]">Share card</div>
          <h3 className="mt-2 font-display text-2xl font-extrabold">
            Axion forged {upgradeName(epoch)}
          </h3>
        </div>
        <Badge tone={epoch.scoreDelta >= 0 ? "emerald" : "amber"}>
          {epoch.scoreDelta >= 0 ? "+" : ""}
          {epoch.scoreDelta} trust
        </Badge>
      </div>
      <p className="mt-4 text-sm leading-relaxed text-[var(--muted)]">{epoch.goal}</p>
      <div className="mt-5 grid grid-cols-3 gap-2 text-center">
        <CompanionStat label="Branch" value={epoch.selectedBranchId} />
        <CompanionStat label="Verdict" value={epoch.verdict.replace(/([A-Z])/g, " $1").trim()} />
        <CompanionStat label="Strategy" value={`v${epoch.strategyVersionAfter}`} />
      </div>
      <div className="mt-4 rounded-lg border border-[var(--border)] bg-black/25 px-3 py-2 text-xs text-[var(--muted)]">
        Proof root <span className="mono text-[var(--teal-glow)]">{shortHash(epoch.memoryRootAfter)}</span>
      </div>
    </div>
  );
}

function CompanionStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-black/20 px-3 py-2">
      <div className="label">{label}</div>
      <div className="mt-1 truncate font-display text-base font-bold text-[var(--text)]">
        {value}
      </div>
    </div>
  );
}

function upgradeName(epoch: Epoch): string {
  if (epoch.verdict === "RejectedSafely" || epoch.verdict === "UnsafeBlocked") {
    return "Risk Sentinel";
  }
  if (epoch.verdict === "Correct") return "Yield Memory";
  if (epoch.verdict === "PartiallyCorrect") return "Volatility Guard";
  return "Correction Engine";
}
