"use client";

import { useState } from "react";
import type { Branch, DecisionTree } from "@/types";
import { Badge, CopyHash } from "./ui";
import { shortHash } from "@/lib/hashing";

const STATUS_TONE: Record<Branch["status"], Parameters<typeof Badge>[0]["tone"]> = {
  selected: "teal",
  rejected: "neutral",
  fallback: "violet",
  unsafe: "rose",
  candidate: "neutral",
};

const STATUS_LABEL: Record<Branch["status"], string> = {
  selected: "Selected",
  rejected: "Rejected",
  fallback: "Fallback",
  unsafe: "Unsafe · blocked",
  candidate: "Candidate",
};

const RISK_TONE: Record<string, Parameters<typeof Badge>[0]["tone"]> = {
  lowest: "emerald",
  low: "emerald",
  "low-medium": "teal",
  medium: "amber",
  "medium-high": "amber",
  high: "rose",
};

export function BranchCard({ branch }: { branch: Branch }) {
  const selected = branch.status === "selected";
  const unsafe = branch.status === "unsafe";
  return (
    <div
      className={`panel panel-hover flex flex-col gap-3 p-4 ${
        selected ? "shadow-glow" : ""
      } ${unsafe ? "opacity-90" : ""}`}
      style={
        selected
          ? { borderColor: "var(--border-strong)" }
          : unsafe
          ? { borderColor: "rgba(251,113,133,0.35)" }
          : undefined
      }
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--border)] font-mono text-sm font-bold text-[var(--teal-glow)]">
            {branch.id}
          </span>
          <h3 className="font-display text-base font-bold">{branch.name}</h3>
        </div>
        <Badge tone={STATUS_TONE[branch.status]}>{STATUS_LABEL[branch.status]}</Badge>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <Field label="Action" value={branch.action} span />
        <Field label="Expected outcome" value={branch.expectedOutcome} span />
        <div>
          <div className="label">Risk</div>
          <div className="mt-1">
            <Badge tone={RISK_TONE[branch.riskLevel] ?? "neutral"}>{branch.riskLevel}</Badge>
          </div>
        </div>
        <div>
          <div className="label">Confidence</div>
          <div className="mt-1.5 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/40">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[var(--teal-glow)] to-[var(--violet)]"
                style={{ width: `${branch.confidence}%` }}
              />
            </div>
            <span className="mono text-[11px] text-[var(--muted)]">
              {branch.confidence}%
            </span>
          </div>
        </div>
      </div>

      <p className="text-xs leading-relaxed text-[var(--muted)]">{branch.reason}</p>

      <div className="rounded-lg border border-[var(--border)] bg-black/20 px-3 py-2 text-[11px] text-[var(--muted)]">
        <span className="label mr-1.5">Fallback</span>
        {branch.fallbackTrigger}
      </div>

      <div className="flex items-center justify-between border-t border-[var(--border)] pt-2 text-[11px]">
        <span className="label">Branch hash</span>
        <code className="mono text-[var(--teal-glow)]">{shortHash(branch.branchHash)}</code>
      </div>
    </div>
  );
}

function Field({ label, value, span }: { label: string; value: string; span?: boolean }) {
  return (
    <div className={span ? "col-span-2" : ""}>
      <div className="label">{label}</div>
      <div className="mt-0.5 text-[var(--text)]">{value}</div>
    </div>
  );
}

export function DecisionTreeView({ tree }: { tree: DecisionTree }) {
  const [showTechnical, setShowTechnical] = useState(false);
  const selected = tree.branches.find((b) => b.id === tree.selectedBranchId) ?? tree.branches[0];
  const alternatives = tree.branches.filter((b) => b.id !== selected.id);

  return (
    <div className="space-y-4">
      <div className="panel overflow-hidden">
        <div className="border-b border-[var(--border)] bg-[rgba(45,212,191,0.05)] p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="label mb-2 text-[var(--teal-glow)]">Axion recommendation</div>
              <h3 className="font-display text-2xl font-extrabold">{selected.name}</h3>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">
                {selected.reason}
              </p>
            </div>
            <Badge tone={STATUS_TONE[selected.status]}>{STATUS_LABEL[selected.status]}</Badge>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <PlanMetric label="Action" value={selected.action} />
            <PlanMetric label="Expected result" value={selected.expectedOutcome} />
            <PlanMetric label="Fallback" value={selected.fallbackTrigger} />
          </div>
        </div>

        <div className="p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <div className="label">Other paths considered</div>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Axion still commits the full tree, but the user sees the clearest path first.
              </p>
            </div>
            <button
              onClick={() => setShowTechnical((open) => !open)}
              className="btn btn-ghost text-xs"
            >
              {showTechnical ? "Hide technical view" : "Show technical view"}
            </button>
          </div>

          <div className="grid gap-2">
            {alternatives.map((branch) => (
              <div
                key={branch.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-black/20 px-4 py-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] font-mono text-xs font-bold text-[var(--teal-glow)]">
                    {branch.id}
                  </span>
                  <div className="min-w-0">
                    <div className="font-semibold">{branch.name}</div>
                    <div className="truncate text-xs text-[var(--muted)]">{branch.expectedOutcome}</div>
                  </div>
                </div>
                <Badge tone={STATUS_TONE[branch.status]}>{STATUS_LABEL[branch.status]}</Badge>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showTechnical && (
        <div className="grid gap-4 md:grid-cols-2">
          {tree.branches.map((b) => (
            <BranchCard key={b.id} branch={b} />
          ))}
        </div>
      )}

      <div className="panel p-4">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <div className="label">Proof package</div>
            <p className="mt-1 text-xs text-[var(--muted)]">
              These hashes are frozen before execution so Axion cannot rewrite the story later.
            </p>
          </div>
          <Badge tone="violet">Ready to commit</Badge>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <CopyHash label="Goal" value={tree.goalHash} />
          <CopyHash label="Tree" value={tree.treeHash} />
          <CopyHash label="Selected branch" value={tree.selectedBranchHash} />
          <CopyHash label="Policy" value={tree.policyHash} />
        </div>
      </div>
    </div>
  );
}

function PlanMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-black/20 p-4">
      <div className="label">{label}</div>
      <div className="mt-1 text-sm leading-relaxed text-[var(--text)]">{value}</div>
    </div>
  );
}
