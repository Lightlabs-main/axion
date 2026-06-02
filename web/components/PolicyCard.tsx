"use client";

import type { Policy } from "@/types";
import { Badge } from "./ui";
import { permissionLevel, permissionTier } from "@/lib/trustScore";

const TIER_LABEL = ["Read-only", "Suggest", "Execute low-value", "Higher autonomy"];

export function PermissionMeter({ trustScore }: { trustScore: number }) {
  const tier = permissionTier(trustScore);
  const level = permissionLevel(trustScore);
  return (
    <div className="rounded-xl border border-[var(--border)] bg-black/20 p-4">
      <div className="flex items-center justify-between">
        <div className="label">Wallet permission level</div>
        <Badge tone={tier >= 2 ? "emerald" : tier === 1 ? "amber" : "rose"}>{level}</Badge>
      </div>
      <div className="mt-3 flex gap-1.5">
        {TIER_LABEL.map((t, i) => (
          <div key={t} className="flex-1">
            <div
              className={`h-1.5 rounded-full ${
                i <= tier
                  ? "bg-gradient-to-r from-[var(--teal-glow)] to-[var(--violet)]"
                  : "bg-black/40"
              }`}
            />
            <div
              className={`mt-1 text-[10px] ${
                i === tier ? "text-[var(--text)]" : "text-[var(--muted)]"
              }`}
            >
              {t}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-[var(--muted)]">
        Permissions are not cosmetic — they are derived directly from the trust score, which only
        moves when verified epochs are written to memory.
      </p>
    </div>
  );
}

export function PolicyCard({
  policy,
  trustScore,
  onTogglePause,
  onToggleUnsafe,
}: {
  policy: Policy;
  trustScore?: number;
  onTogglePause?: () => void;
  onToggleUnsafe?: () => void;
}) {
  return (
    <div className="panel p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-display text-base font-bold">Active wallet policy</h3>
        <Badge tone={policy.isPaused ? "rose" : "teal"}>
          {policy.isPaused ? "Paused" : "Active"}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <Row label="Max spend" value={`${policy.maxSpend} ${policy.asset}`} />
        <Row label="Max slippage" value={`${(policy.maxSlippageBps / 100).toFixed(2)}%`} />
        <Row
          label="Unsafe approvals"
          value={policy.allowUnsafeApprovals ? "Allowed" : "Blocked"}
          tone={policy.allowUnsafeApprovals ? "amber" : "emerald"}
        />
        <Row label="Allowed assets" value={policy.allowedAssets.join(", ")} />
      </div>

      <div className="mt-4 rounded-lg border border-[var(--border)] bg-black/20 px-3 py-2">
        <div className="label mb-1">Allowed protocols</div>
        <div className="flex flex-wrap gap-1.5">
          {policy.allowedProtocols.map((p) => (
            <Badge key={p} tone="violet">
              {p}
            </Badge>
          ))}
        </div>
      </div>

      {(onTogglePause || onToggleUnsafe) && (
        <div className="mt-4 flex flex-wrap gap-2">
          {onToggleUnsafe && (
            <button onClick={onToggleUnsafe} className="btn btn-ghost text-xs">
              {policy.allowUnsafeApprovals ? "Block unsafe approvals" : "Allow unsafe approvals"}
            </button>
          )}
          {onTogglePause && (
            <button onClick={onTogglePause} className="btn btn-ghost text-xs">
              {policy.isPaused ? "Resume policy" : "Pause policy"}
            </button>
          )}
        </div>
      )}

      {typeof trustScore === "number" && (
        <div className="mt-4">
          <PermissionMeter trustScore={trustScore} />
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "emerald" | "amber";
}) {
  return (
    <div>
      <div className="label">{label}</div>
      <div
        className={`mt-0.5 font-semibold ${
          tone === "emerald"
            ? "text-[var(--emerald)]"
            : tone === "amber"
            ? "text-[var(--amber)]"
            : "text-[var(--text)]"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
