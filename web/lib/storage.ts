import type {
  AgentIdentity,
  AxionDemoState,
  Commitment,
  DecisionTree,
  Epoch,
  Policy,
  StrategyState,
} from "@/types";
import { DEFAULT_STRATEGY } from "./strategyForge";

const KEY = "axion.demo.state.v1";

export const DEFAULT_POLICY: Policy = {
  maxSpend: 100,
  asset: "USDC",
  maxSlippageBps: 50, // 0.50%
  allowUnsafeApprovals: false,
  allowedAssets: ["USDC", "MNT"],
  allowedProtocols: ["BalancedYield", "HoldVault"],
  isPaused: false,
};

export function emptyState(): AxionDemoState {
  return {
    agent: null,
    policy: { ...DEFAULT_POLICY },
    strategy: { ...DEFAULT_STRATEGY },
    trees: [],
    commitments: [],
    epochs: [],
  };
}

export function loadState(): AxionDemoState {
  if (typeof window === "undefined") return emptyState();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<AxionDemoState>;
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

export function saveState(state: AxionDemoState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // storage full / disabled — non-fatal for the demo
  }
}

export function resetState(): AxionDemoState {
  const fresh = emptyState();
  saveState(fresh);
  return fresh;
}

// Convenience mutators (return a new state object).
export function withAgent(state: AxionDemoState, agent: AgentIdentity): AxionDemoState {
  return { ...state, agent };
}
export function withPolicy(state: AxionDemoState, policy: Policy): AxionDemoState {
  return { ...state, policy };
}
export function withStrategy(state: AxionDemoState, strategy: StrategyState): AxionDemoState {
  return { ...state, strategy };
}
export function addTree(state: AxionDemoState, tree: DecisionTree): AxionDemoState {
  return { ...state, trees: [tree, ...state.trees].slice(0, 50) };
}
export function addCommitment(state: AxionDemoState, c: Commitment): AxionDemoState {
  return { ...state, commitments: [c, ...state.commitments].slice(0, 50) };
}
export function addEpoch(state: AxionDemoState, e: Epoch): AxionDemoState {
  return { ...state, epochs: [e, ...state.epochs].slice(0, 100) };
}
