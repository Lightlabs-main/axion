"use client";

import type { AgentIdentity } from "@/types";
import { Badge, CopyHash, Stat } from "./ui";
import { PermissionMeter } from "./PolicyCard";
import { addressExplorerLink, isOnchainConfigured } from "@/lib/config";

function formatDate(ts: number): string {
  try {
    return new Date(ts).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return String(ts);
  }
}

export function AgentIdentityCard({ agent }: { agent: AgentIdentity }) {
  return (
    <div className="space-y-4">
      <div className="panel p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="label mb-1">ERC-8004-style identity</div>
            <h2 className="font-display text-2xl font-extrabold">{agent.agentName}</h2>
            <div className="mt-1 flex items-center gap-2 text-xs text-[var(--muted)]">
              <span className="mono">{agent.agentId}</span>
              <Badge tone={agent.mode === "onchain" ? "emerald" : "violet"}>
                {agent.mode === "onchain" ? "On-chain · Mantle" : "Pending"}
              </Badge>
            </div>
          </div>
          <div className="text-right">
            <div className="label">Trust score</div>
            <div className="gradient-text font-display text-4xl font-extrabold">
              {agent.trustScore}
            </div>
            <div className="text-xs text-[var(--muted)]">strategy v{agent.strategyVersion}</div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Total epochs" value={agent.totalEpochs} />
          <Stat label="Correct" value={agent.correctPredictions} accent />
          <Stat label="Safe rejections" value={agent.safeRejections} />
          <Stat label="Failed" value={agent.failedPredictions} />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Self-corrections" value={agent.selfCorrections} />
          <Stat label="Strategy version" value={`v${agent.strategyVersion}`} />
          <Stat label="Created" value={formatDate(agent.createdAt)} />
          <Stat
            label="Owner"
            value={
              agent.owner && agent.owner.startsWith("0x")
                ? `${agent.owner.slice(0, 6)}…${agent.owner.slice(-4)}`
                : "Local"
            }
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="panel p-5">
          <div className="label mb-3">Memory & metadata</div>
          <div className="space-y-2">
            <CopyHash label="Memory root" value={agent.memoryRoot} />
            <CopyHash label="Metadata URI" value={agent.metadataURI} full />
            {agent.owner.startsWith("0x") && (
              <CopyHash
                label="Owner"
                value={agent.owner}
                href={isOnchainConfigured() ? addressExplorerLink(agent.owner) : undefined}
              />
            )}
            {agent.txHash && <CopyHash label="Register tx" value={agent.txHash} />}
          </div>
        </div>
        <PermissionMeter trustScore={agent.trustScore} />
      </div>
    </div>
  );
}
