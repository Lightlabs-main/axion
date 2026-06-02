"use client";

import type { Branch, ExecutionResult } from "@/types";
import { Badge, CopyHash } from "./ui";
import { txExplorerLink } from "@/lib/config";

const SKILL_DESC: Record<string, string> = {
  RiskCheckSkill: "Checks slippage and liquidity against policy",
  RouteCompareSkill: "Compares candidate route metrics",
  ApprovalGuardSkill: "Blocks unsafe token approvals",
  ExecutionSkill: "Prepares and submits the action",
  OutcomeVerifierSkill: "Reads back the realised outcome",
};

export function ExecutionView({
  branch,
  execution,
  adapterName,
}: {
  branch: Branch;
  execution: ExecutionResult;
  adapterName: string;
}) {
  return (
    <div className="space-y-4">
      <div className="panel p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-bold">Selected branch</h3>
          <Badge tone={execution.succeeded ? "emerald" : "rose"}>
            {execution.succeeded
              ? branch.id === "D"
                ? "Safely rejected"
                : "Executed"
              : "Blocked"}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--border)] font-mono text-sm font-bold text-[var(--teal-glow)]">
            {branch.id}
          </span>
          <span className="font-semibold">{branch.name}</span>
        </div>
        <p className="mt-2 text-sm text-[var(--muted)]">{branch.action}</p>
        {execution.blockedReason && (
          <div className="mt-3 rounded-lg border border-[rgba(251,113,133,0.35)] bg-[rgba(251,113,133,0.08)] px-3 py-2 text-sm text-[var(--rose)]">
            Safety gate: {execution.blockedReason}
          </div>
        )}
      </div>

      <div className="panel p-5">
        <div className="mb-1 flex items-center justify-between">
          <h3 className="font-display text-base font-bold">Skill trace</h3>
          <Badge tone="violet">{adapterName}</Badge>
        </div>
        <p className="mb-4 text-xs text-[var(--muted)]">
          Each step runs through the swappable ByrealSkillAdapter. Replace the local adapter with a
          real Byreal Skills backend without touching the rest of the lifecycle.
        </p>
        <div className="space-y-2">
          {execution.skillTrace.map((s, i) => (
            <div
              key={`${s.skill}-${i}`}
              className="rounded-xl border border-[var(--border)] bg-black/20 p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="mono text-xs text-[var(--violet)]">{i + 1}</span>
                  <span className="font-semibold text-sm">{s.skill}</span>
                </div>
                <Badge tone={s.passed ? "emerald" : "rose"}>{s.passed ? "Pass" : "Fail"}</Badge>
              </div>
              <div className="mt-1 text-[11px] text-[var(--muted)]">
                {SKILL_DESC[s.skill] ?? ""}
              </div>
              <div className="mt-2 grid gap-1 text-xs sm:grid-cols-2">
                <div>
                  <span className="label mr-1">in</span>
                  <span className="text-[var(--text)]">{s.input}</span>
                </div>
                <div>
                  <span className="label mr-1">out</span>
                  <span className="text-[var(--text)]">{s.output}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="panel p-4">
          <div className="label mb-2">Realised outcome</div>
          <div className="grid grid-cols-2 gap-3">
            <Metric label="Yield" value={`${execution.actualYieldPct}%`} />
            <Metric label="Slippage" value={`${(execution.actualSlippageBps / 100).toFixed(2)}%`} />
          </div>
        </div>
        <div className="panel p-4">
          <div className="label mb-2">Execution proofs</div>
          <div className="space-y-2">
            <CopyHash label="Action" value={execution.actionHash} />
            <CopyHash label="Outcome" value={execution.outcomeHash} />
            {typeof execution.creditedUsdc === "number" && execution.creditedUsdc > 0 && (
              <div className="text-xs text-[var(--muted)]">
                Credited{" "}
                <span className="mono text-[var(--text)]">
                  {execution.creditedUsdc.toFixed(4)} aUSDC
                </span>
                {typeof execution.feePaidUsdc === "number" && (
                  <>
                    {" "}· fee{" "}
                    <span className="mono text-[var(--text)]">
                      {execution.feePaidUsdc.toFixed(4)}
                    </span>
                  </>
                )}
              </div>
            )}
            {execution.txHash && (
              <a
                href={txExplorerLink(execution.txHash)}
                target="_blank"
                rel="noreferrer"
                className="inline-block text-xs text-[var(--violet)] hover:underline"
              >
                View deposit transaction ↗
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-black/20 px-3 py-2">
      <div className="label">{label}</div>
      <div className="mono mt-0.5 text-lg font-bold text-[var(--teal-glow)]">{value}</div>
    </div>
  );
}
