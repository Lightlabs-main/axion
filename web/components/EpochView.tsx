"use client";

import type { Epoch, StrategyState, Verdict } from "@/types";
import { Badge, CopyHash } from "./ui";

export const VERDICT_TONE: Record<Verdict, Parameters<typeof Badge>[0]["tone"]> = {
  Correct: "emerald",
  PartiallyCorrect: "amber",
  Wrong: "rose",
  RejectedSafely: "teal",
  UnsafeBlocked: "violet",
};

const STRATEGY_KEYS: { key: keyof StrategyState; label: string }[] = [
  { key: "riskWeight", label: "Risk weight" },
  { key: "yieldWeight", label: "Yield weight" },
  { key: "liquidityWeight", label: "Liquidity weight" },
  { key: "approvalSafetyWeight", label: "Approval safety" },
  { key: "sourceConfidenceWeight", label: "Source confidence" },
  { key: "slippageTolerance", label: "Slippage tolerance" },
];

export function EpochView({ epoch }: { epoch: Epoch }) {
  return (
    <div className="space-y-4">
      <div className="panel p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-base font-bold">Judged epoch</h3>
          <div className="flex items-center gap-2">
            <Badge tone={VERDICT_TONE[epoch.verdict]}>{epoch.verdict}</Badge>
            <Badge tone="neutral">
              Trust {epoch.score} ({epoch.scoreDelta >= 0 ? "+" : ""}
              {epoch.scoreDelta})
            </Badge>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-[var(--border)] bg-black/20 p-4">
            <div className="label mb-2">Committed prediction</div>
            <PredRow label="Expected yield" value={`${epoch.prediction.expectedYieldPct}%`} />
            <PredRow
              label="Expected slippage"
              value={`${(epoch.prediction.expectedSlippageBps / 100).toFixed(2)}%`}
            />
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-black/20 p-4">
            <div className="label mb-2">Actual outcome</div>
            <PredRow
              label="Actual yield"
              value={`${epoch.outcome.actualYieldPct}%`}
              delta={epoch.outcome.actualYieldPct - epoch.prediction.expectedYieldPct}
              goodWhenPositive
            />
            <PredRow
              label="Actual slippage"
              value={`${(epoch.outcome.actualSlippageBps / 100).toFixed(2)}%`}
              delta={(epoch.outcome.actualSlippageBps - epoch.prediction.expectedSlippageBps) / 100}
              goodWhenPositive={false}
              suffix="%"
            />
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="panel p-4">
          <div className="label mb-2 text-[var(--emerald)]">What was right</div>
          <ul className="space-y-1.5 text-sm">
            {epoch.postMortem.whatWasRight.map((x, i) => (
              <li key={i} className="flex gap-2 text-[var(--text)]">
                <span className="text-[var(--emerald)]">+</span>
                <span>{x}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="panel p-4">
          <div className="label mb-2 text-[var(--rose)]">What was wrong</div>
          <ul className="space-y-1.5 text-sm">
            {epoch.postMortem.whatWasWrong.map((x, i) => (
              <li key={i} className="flex gap-2 text-[var(--text)]">
                <span className="text-[var(--rose)]">–</span>
                <span>{x}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="panel p-5">
        <div className="mb-2 flex items-center justify-between">
          <div className="label">Post-mortem</div>
          <Badge tone={epoch.postMortem.source === "llm" ? "violet" : "neutral"}>
            {epoch.postMortem.source === "llm" ? "LLM-authored" : "Deterministic"}
          </Badge>
        </div>
        <p className="text-sm leading-relaxed text-[var(--text)]">{epoch.postMortem.narrative}</p>
      </div>

      <div className="panel p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="label">
            Strategy forge · v{epoch.strategyVersionBefore} → v{epoch.strategyVersionAfter}
          </div>
          <Badge tone="teal">EchoForge</Badge>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {STRATEGY_KEYS.map(({ key, label }) => {
            const before = epoch.strategyBefore[key];
            const after = epoch.strategyAfter[key];
            const changed = before !== after;
            return (
              <div
                key={key}
                className={`rounded-lg border bg-black/20 px-3 py-2 ${
                  changed ? "border-[var(--border-strong)]" : "border-[var(--border)]"
                }`}
              >
                <div className="label">{label}</div>
                <div className="mono mt-0.5 flex items-center gap-1.5 text-sm">
                  <span className={changed ? "text-[var(--muted)] line-through" : "text-[var(--text)]"}>
                    {before}
                  </span>
                  {changed && (
                    <>
                      <span className="text-[var(--muted)]">→</span>
                      <span className="font-bold text-[var(--teal-glow)]">{after}</span>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="panel p-5">
        <div className="label mb-3">Memory & proofs</div>
        <div className="grid gap-2 sm:grid-cols-2">
          <CopyHash label="Memory before" value={epoch.memoryRootBefore} />
          <CopyHash label="Memory after" value={epoch.memoryRootAfter} />
          <CopyHash label="Action" value={epoch.actionHash} />
          <CopyHash label="Outcome" value={epoch.outcomeHash} />
          <CopyHash label="Post-mortem" value={epoch.postMortemHash} />
          {epoch.txHash && <CopyHash label="Epoch tx" value={epoch.txHash} />}
        </div>
        <p className="mt-3 text-xs text-[var(--muted)]">
          The new memory root chains the previous root with this epoch&apos;s hash. The timeline is
          append-only — Axion cannot rewrite a past epoch without breaking the chain.
        </p>
      </div>
    </div>
  );
}

function PredRow({
  label,
  value,
  delta,
  goodWhenPositive,
  suffix = "%",
}: {
  label: string;
  value: string;
  delta?: number;
  goodWhenPositive?: boolean;
  suffix?: string;
}) {
  let tone = "text-[var(--text)]";
  if (typeof delta === "number" && Math.abs(delta) > 0.001) {
    const good = goodWhenPositive ? delta > 0 : delta < 0;
    tone = good ? "text-[var(--emerald)]" : "text-[var(--rose)]";
  }
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm text-[var(--muted)]">{label}</span>
      <span className="flex items-center gap-2">
        <span className="mono font-semibold text-[var(--text)]">{value}</span>
        {typeof delta === "number" && Math.abs(delta) > 0.001 && (
          <span className={`mono text-xs ${tone}`}>
            ({delta > 0 ? "+" : ""}
            {delta.toFixed(2)}
            {suffix})
          </span>
        )}
      </span>
    </div>
  );
}
