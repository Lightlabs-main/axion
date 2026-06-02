import type {
  AgentIdentity,
  AxionState,
  Commitment,
  DecisionTree,
  Epoch,
  Policy,
  StrategyState,
} from "@/types";
import { DEFAULT_STRATEGY } from "./strategyForge";

const KEY = "axion.state.v1";

export const DEFAULT_POLICY: Policy = {
  maxSpend: 100,
  asset: "USDC",
  maxSlippageBps: 50, // 0.50%
  allowUnsafeApprovals: false,
  allowedAssets: ["USDC", "MNT"],
  allowedProtocols: ["BalancedYield", "HoldVault"],
  isPaused: false,
};

export function emptyState(): AxionState {
  return {
    agent: null,
    policy: { ...DEFAULT_POLICY },
    strategy: { ...DEFAULT_STRATEGY },
    trees: [],
    commitments: [],
    epochs: [],
  };
}

export function loadState(): AxionState {
  if (typeof window === "undefined") return emptyState();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<AxionState>;
    return {
      agent: parsed.agent ?? null,
      policy: { ...DEFAULT_POLICY, ...(parsed.policy ?? {}) },
      strategy: { ...DEFAULT_STRATEGY, ...(parsed.strategy ?? {}) },
      trees: parsed.trees ?? [],
      commitments: parsed.commitments ?? [],
      epochs: parsed.epochs ?? [],
    };
  } catch {
    return emptyState();
  }
}

export function saveState(state: AxionState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // storage full / disabled — non-fatal; the canonical record is on-chain
  }
}

export function resetState(): AxionState {
  const fresh = emptyState();
  saveState(fresh);
  return fresh;
}

// Convenience mutators (return a new state object).
export function withAgent(state: AxionState, agent: AgentIdentity): AxionState {
  return { ...state, agent };
}
export function withPolicy(state: AxionState, policy: Policy): AxionState {
  return { ...state, policy };
}
export function withStrategy(state: AxionState, strategy: StrategyState): AxionState {
  return { ...state, strategy };
}
export function addTree(state: AxionState, tree: DecisionTree): AxionState {
  return { ...state, trees: [tree, ...state.trees].slice(0, 50) };
}
export function addCommitment(state: AxionState, c: Commitment): AxionState {
  return { ...state, commitments: [c, ...state.commitments].slice(0, 50) };
}
export function addEpoch(state: AxionState, e: Epoch): AxionState {
  return { ...state, epochs: [e, ...state.epochs].slice(0, 100) };
}
