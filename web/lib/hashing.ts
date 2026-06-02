import { keccak256, toHex, stringToHex } from "viem";
import type {
  Branch,
  DecisionTree,
  ExecutionResult,
  Policy,
  PostMortem,
} from "@/types";

/**
 * Canonical JSON stringify: object keys sorted recursively so the same logical
 * payload always produces the same string (and therefore the same hash).
 */
export function canonicalize(value: unknown): string {
  return JSON.stringify(sortDeep(value));
}

function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortDeep);
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return Object.keys(obj)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = sortDeep(obj[key]);
        return acc;
      }, {});
  }
  return value;
}

/** keccak256 of the canonical JSON string of any payload. */
export function hashPayload(payload: unknown): `0x${string}` {
  return keccak256(stringToHex(canonicalize(payload)));
}

export function hashGoal(goal: string): `0x${string}` {
  return keccak256(stringToHex(goal.trim().toLowerCase()));
}

export function hashPolicy(policy: Policy): `0x${string}` {
  return hashPayload({
    maxSpend: policy.maxSpend,
    asset: policy.asset,
    maxSlippageBps: policy.maxSlippageBps,
    allowUnsafeApprovals: policy.allowUnsafeApprovals,
    allowedAssets: policy.allowedAssets,
    allowedProtocols: policy.allowedProtocols,
    isPaused: policy.isPaused,
  });
}

export function hashBranch(branch: Omit<Branch, "branchHash">): `0x${string}` {
  return hashPayload({
    id: branch.id,
    name: branch.name,
    action: branch.action,
    expectedOutcome: branch.expectedOutcome,
    riskLevel: branch.riskLevel,
    confidence: branch.confidence,
    reason: branch.reason,
    fallbackTrigger: branch.fallbackTrigger,
    routeId: branch.routeId ?? null,
  });
}

export function hashDecisionTree(
  tree: Pick<DecisionTree, "goal" | "branches" | "selectedBranchId" | "strategyVersion">
): `0x${string}` {
  return hashPayload({
    goal: tree.goal,
    selectedBranchId: tree.selectedBranchId,
    strategyVersion: tree.strategyVersion,
    branches: tree.branches.map((b) => ({
      id: b.id,
      branchHash: b.branchHash,
      status: b.status,
      score: b.score,
    })),
  });
}

export function hashAction(action: {
  branchId: string;
  routeId?: string;
  spend: number;
}): `0x${string}` {
  return hashPayload(action);
}

export function hashOutcome(
  outcome: Pick<
    ExecutionResult,
    "actualYieldPct" | "actualSlippageBps" | "succeeded" | "blockedReason"
  >
): `0x${string}` {
  return hashPayload({
    actualYieldPct: outcome.actualYieldPct,
    actualSlippageBps: outcome.actualSlippageBps,
    succeeded: outcome.succeeded,
    blockedReason: outcome.blockedReason ?? null,
  });
}

export function hashPostMortem(pm: PostMortem): `0x${string}` {
  return hashPayload({
    whatWasRight: pm.whatWasRight,
    whatWasWrong: pm.whatWasWrong,
    narrative: pm.narrative,
  });
}

/**
 * Memory root = keccak256(previousRoot || epochHash). This makes the agent's
 * memory an append-only chained hash, so the timeline cannot be silently
 * rewritten without changing every subsequent root.
 */
export function calculateMemoryRoot(
  previousRoot: string,
  epochHash: string
): `0x${string}` {
  const prev = (previousRoot && previousRoot.startsWith("0x")
    ? previousRoot
    : "0x0000000000000000000000000000000000000000000000000000000000000000") as `0x${string}`;
  const epoch = epochHash as `0x${string}`;
  // concatenate the two 32-byte hashes and hash again
  const combined = (prev + epoch.slice(2)) as `0x${string}`;
  return keccak256(combined);
}

export const ZERO_ROOT =
  "0x0000000000000000000000000000000000000000000000000000000000000000" as const;

/** Shorten a hash for display, e.g. 0x1234…abcd */
export function shortHash(hash: string, lead = 6, tail = 4): string {
  if (!hash || hash.length <= lead + tail + 2) return hash;
  return `${hash.slice(0, lead)}…${hash.slice(-tail)}`;
}

export { toHex };
