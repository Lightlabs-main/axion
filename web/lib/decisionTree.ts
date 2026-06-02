import type {
  Branch,
  DecisionTree,
  Policy,
  Route,
  StrategyState,
} from "@/types";
import { ROUTE_CATALOG } from "./routes";
import { hashBranch, hashDecisionTree, hashGoal, hashPolicy } from "./hashing";

const RISK_RANK: Record<string, number> = {
  lowest: 0,
  low: 1,
  "low-medium": 2,
  medium: 3,
  "medium-high": 4,
  high: 5,
};

interface ScoredRoute {
  route: Route;
  score: number;
  rejected: boolean;
  rejectReasons: string[];
}

/**
 * Score a route against the active policy + strategy weights. Higher is better.
 * Hard violations (unsafe approval when not allowed, slippage over policy) mark
 * the route as rejected.
 */
function scoreRoute(
  route: Route,
  policy: Policy,
  strategy: StrategyState,
  preferLowRisk: boolean
): ScoredRoute {
  const rejectReasons: string[] = [];
  let rejected = false;

  if (route.approvalRisk === "unsafe" && !policy.allowUnsafeApprovals) {
    rejected = true;
    rejectReasons.push("Unsafe token approval blocked by policy");
  }
  if (route.slippageBps > policy.maxSlippageBps) {
    rejected = true;
    rejectReasons.push(
      `Slippage ${(route.slippageBps / 100).toFixed(2)}% exceeds policy max ${(
        policy.maxSlippageBps / 100
      ).toFixed(2)}%`
    );
  }

  // Utility scoring (continuous, used to rank non-rejected routes).
  const liquidityScore =
    route.liquidity === "full"
      ? 1
      : route.liquidity === "high"
      ? 0.85
      : route.liquidity === "medium"
      ? 0.6
      : 0.25;

  const approvalScore =
    route.approvalRisk === "none" ? 1 : route.approvalRisk === "safe" ? 0.9 : 0.1;

  const slippagePenalty = Math.min(route.slippageBps / 200, 1); // 2% -> full penalty
  const riskPenalty = RISK_RANK[route.risk] / 5;
  const trustScore =
    route.protocolTrust === "high"
      ? 1
      : route.protocolTrust === "medium"
      ? 0.6
      : route.protocolTrust === "low"
      ? 0.3
      : 0.7; // n/a (holding) is neutral-safe

  // Normalised yield contribution (cap at the high-APY route).
  const yieldScore = Math.min(route.expectedYieldPct / 12, 1);

  const lowRiskBoost = preferLowRisk ? 1.4 : 1;

  const score =
    strategy.yieldWeight * yieldScore +
    strategy.liquidityWeight * liquidityScore +
    strategy.approvalSafetyWeight * approvalScore +
    strategy.sourceConfidenceWeight * trustScore -
    strategy.slippageTolerance * 0 - // slippageTolerance influences policy, not score directly
    strategy.riskWeight * riskPenalty * lowRiskBoost -
    slippagePenalty * 1.5;

  return { route, score: Number(score.toFixed(4)), rejected, rejectReasons };
}

function riskFromRoute(route: Route): Branch["riskLevel"] {
  return route.risk;
}

/**
 * Generate the full A/B/C/D decision tree for a goal. Deterministic.
 *  - A = high-yield route (expected to be rejected due to unsafe approval/slippage)
 *  - B = balanced safe route (default selection)
 *  - C = hold (fallback)
 *  - D = reject execution (chosen only if no safe yield route exists)
 */
export function generateDecisionTree(
  goal: string,
  policy: Policy,
  strategy: StrategyState,
  strategyVersion: number,
  routes: Route[] = ROUTE_CATALOG
): DecisionTree {
  const preferLowRisk = /low[\s-]?risk|safe|avoid|conserv/i.test(goal);

  const routeA = routes.find((r) => r.id === "route-a")!;
  const routeB = routes.find((r) => r.id === "route-b")!;
  const routeC = routes.find((r) => r.id === "route-c")!;

  const sA = scoreRoute(routeA, policy, strategy, preferLowRisk);
  const sB = scoreRoute(routeB, policy, strategy, preferLowRisk);
  const sC = scoreRoute(routeC, policy, strategy, preferLowRisk);

  // A safe yield route is one that is not rejected AND earns yield.
  const safeYieldRoutes = [sA, sB].filter(
    (s) => !s.rejected && s.route.expectedYieldPct > 0
  );
  const hasSafeYield = safeYieldRoutes.length > 0;

  // Best safe yield route (used to decide which branch is selected).
  const bestSafeYield = [...safeYieldRoutes].sort((a, b) => b.score - a.score)[0];

  const rawBranches: Omit<Branch, "branchHash">[] = [
    {
      id: "A",
      name: "Chase High Yield",
      action: `Deposit ${policy.maxSpend} ${policy.asset} into ${routeA.name}`,
      expectedOutcome: `~${routeA.expectedYieldPct}% APY (higher yield, lower liquidity)`,
      riskLevel: riskFromRoute(routeA),
      confidence: 38,
      reason:
        "Best raw APY but low liquidity and an unsafe approval pattern. Higher reward, materially higher risk.",
      fallbackTrigger:
        "Reject if approval is unsafe, liquidity is low, or slippage exceeds policy.",
      status: "candidate",
      score: sA.score,
      routeId: routeA.id,
    },
    {
      id: "B",
      name: "Balanced Safe Yield",
      action: `Deposit ${policy.maxSpend} ${policy.asset} into ${routeB.name}`,
      expectedOutcome: `~${routeB.expectedYieldPct}% APY with safe approvals and low slippage`,
      riskLevel: riskFromRoute(routeB),
      confidence: 82,
      reason:
        "Lower yield than route A but safe approvals, high protocol trust and slippage well within policy. Best risk-adjusted outcome.",
      fallbackTrigger: "Rebalance to Hold (C) if the route becomes unstable.",
      status: "candidate",
      score: sB.score,
      routeId: routeB.id,
    },
    {
      id: "C",
      name: "Hold USDC",
      action: `Keep ${policy.maxSpend} ${policy.asset} in the wallet`,
      expectedOutcome: "0% yield, full liquidity, zero approval risk",
      riskLevel: riskFromRoute(routeC),
      confidence: 60,
      reason:
        "Capital-preserving fallback. Chosen when no yield route clears safety checks.",
      fallbackTrigger: "Used as fallback when all yield routes are rejected.",
      status: "candidate",
      score: sC.score,
      routeId: routeC.id,
    },
    {
      id: "D",
      name: "Reject Execution",
      action: "Refuse to act and return funds untouched",
      expectedOutcome: "No action taken; policy mismatch reported",
      riskLevel: "lowest",
      confidence: 40,
      reason:
        "Selected only when there is no safe route and even holding is not aligned with the goal/policy (e.g. policy paused).",
      fallbackTrigger: "Activated on suspicious contract, paused policy, or full safety failure.",
      status: "candidate",
      score: -1,
    },
  ];

  // Decide selection + statuses.
  let selectedBranchId: Branch["id"];
  if (policy.isPaused) {
    selectedBranchId = "D";
  } else if (hasSafeYield) {
    selectedBranchId = bestSafeYield.route.id === routeB.id ? "B" : "A";
  } else {
    // No safe yield route; hold if holding is acceptable, otherwise reject.
    selectedBranchId = "C";
  }

  const branches: Branch[] = rawBranches.map((b) => {
    let status: Branch["status"] = "candidate";
    if (b.id === selectedBranchId) {
      status = "selected";
    } else if (b.id === "A" && sA.rejected) {
      status = "unsafe";
    } else if (b.id === "C") {
      status = "fallback";
    } else if (b.id === "D") {
      status = hasSafeYield && !policy.isPaused ? "rejected" : "fallback";
    } else if (b.id === "B" && sB.rejected) {
      status = "rejected";
    } else {
      status = "rejected";
    }

    // Enrich reason with concrete rejection causes from the scorer.
    let reason = b.reason;
    if (b.id === "A" && sA.rejectReasons.length) {
      reason = `${b.reason} Rejected: ${sA.rejectReasons.join("; ")}.`;
    }
    if (b.id === "B" && sB.rejectReasons.length) {
      reason = `${b.reason} Note: ${sB.rejectReasons.join("; ")}.`;
    }

    const withReason = { ...b, reason, status };
    return { ...withReason, branchHash: hashBranch(withReason) };
  });

  const selectedBranch = branches.find((b) => b.id === selectedBranchId)!;

  const partial = {
    goal,
    branches,
    selectedBranchId,
    strategyVersion,
  };

  const tree: DecisionTree = {
    ...partial,
    policySnapshot: policy,
    goalHash: hashGoal(goal),
    treeHash: hashDecisionTree(partial),
    selectedBranchHash: selectedBranch.branchHash,
    policyHash: hashPolicy(policy),
    createdAt: Date.now(),
  };

  return tree;
}
