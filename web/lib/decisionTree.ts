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

type GoalIntent = "protection" | "trading" | "rwa" | "savings" | "liquidity" | "generic";

interface GoalProfile {
  intent: GoalIntent;
  branchAName: string;
  branchBName: string;
  branchCName: string;
  branchAReason: string;
  branchBReason: string;
  branchCReason: string;
  branchAOutcome: (route: Route) => string;
  branchBOutcome: (route: Route) => string;
  branchCFallback: string;
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

function isProtectionOnlyGoal(goal: string): boolean {
  const asksForProtection = /protect|approval|unsafe|guard|audit|revoke|permission|wallet/i.test(goal);
  const asksForYield = /yield|apy|earn|grow|rwa|house|save|fund|deposit|allocate/i.test(goal);
  return asksForProtection && !asksForYield;
}

function classifyGoal(goal: string): GoalIntent {
  if (/trade|trading|swap|rebalance|hedge|momentum|alpha|market|position/i.test(goal)) {
    return "trading";
  }
  if (/rwa|real[\s-]?world|usdy|treasury|stable yield|income/i.test(goal)) {
    return "rwa";
  }
  if (/house|save|saving|goal|college|rent|emergency|retire|future/i.test(goal)) {
    return "savings";
  }
  if (/liquid|liquidity|cash|withdraw|accessible|emergency/i.test(goal)) {
    return "liquidity";
  }
  if (/protect|approval|unsafe|guard|audit|revoke|permission|wallet/i.test(goal)) {
    return "protection";
  }
  return "generic";
}

function profileForGoal(goal: string): GoalProfile {
  const intent = classifyGoal(goal);
  const profiles: Record<GoalIntent, GoalProfile> = {
    protection: {
      intent,
      branchAName: "Risky Permission Path",
      branchBName: "Guarded Wallet Mode",
      branchCName: "Observe Only",
      branchAReason:
        "Fast execution would require broader permissions than this goal should allow. Axion treats that as a danger path.",
      branchBReason:
        "Best fit for a protection goal: preserve capital, block unsafe approvals and only allow scoped, explainable actions.",
      branchCReason:
        "Read-only fallback for users who want visibility without changing wallet state.",
      branchAOutcome: (route) => `Potential ${route.expectedYieldPct}% APY, but approval risk is not acceptable for this goal`,
      branchBOutcome: (route) => `Guarded action only if safety checks pass; otherwise no funds move (${route.expectedYieldPct}% target route available)`,
      branchCFallback: "Used when explanation is useful but execution should stay off.",
    },
    trading: {
      intent,
      branchAName: "Aggressive Market Move",
      branchBName: "Guarded Rebalance",
      branchCName: "Hold & Watch",
      branchAReason:
        "Highest upside path, but Axion flags the wider approval surface, weaker liquidity and larger execution drift.",
      branchBReason:
        "Translates the trading goal into a constrained on-chain action with safer approvals, lower slippage and better route confidence.",
      branchCReason:
        "Capital-preserving fallback when the market signal is not strong enough to justify action.",
      branchAOutcome: (route) => `~${route.expectedYieldPct}% opportunity profile with materially higher execution risk`,
      branchBOutcome: (route) => `Guarded rebalance targeting ~${route.expectedYieldPct}% with safe approvals and low slippage`,
      branchCFallback: "Used when volatility or policy constraints make action unattractive.",
    },
    rwa: {
      intent,
      branchAName: "Max RWA Yield",
      branchBName: "Balanced RWA Allocation",
      branchCName: "Stable Reserve",
      branchAReason:
        "Higher advertised yield, but the route asks for more trust than Axion should grant without a stronger safety record.",
      branchBReason:
        "Best fit for RWA-style goals: steady yield, better liquidity, safer approvals and high protocol confidence.",
      branchCReason:
        "Keeps assets liquid when available RWA routes do not clear the user's safety constraints.",
      branchAOutcome: (route) => `~${route.expectedYieldPct}% RWA-style APY, with higher liquidity and approval risk`,
      branchBOutcome: (route) => `~${route.expectedYieldPct}% steady yield with safe approvals and low slippage`,
      branchCFallback: "Used when yield routes stop matching the policy.",
    },
    savings: {
      intent,
      branchAName: "Max Growth Path",
      branchBName: "Goal-Safe Growth",
      branchCName: "Keep Liquid",
      branchAReason:
        "The goal has a real-life time horizon, so Axion rejects growth that depends on unsafe approvals or fragile liquidity.",
      branchBReason:
        "Balances growth with capital protection, matching a consumer savings goal better than raw APY chasing.",
      branchCReason:
        "Keeps funds accessible if available routes do not justify the risk.",
      branchAOutcome: (route) => `~${route.expectedYieldPct}% growth target, but with higher risk than the goal allows`,
      branchBOutcome: (route) => `~${route.expectedYieldPct}% goal-safe yield with guarded execution`,
      branchCFallback: "Used when preserving the goal principal matters more than earning yield.",
    },
    liquidity: {
      intent,
      branchAName: "Yield With Lockup Risk",
      branchBName: "Liquid Yield Route",
      branchCName: "Full Liquidity",
      branchAReason:
        "This path may earn more, but it weakens the user's liquidity requirement and adds avoidable execution risk.",
      branchBReason:
        "Prioritizes access to funds while still allowing a conservative yield action when policy permits.",
      branchCReason:
        "Most liquid fallback: no approvals, no deposits, no waiting.",
      branchAOutcome: (route) => `~${route.expectedYieldPct}% APY, but liquidity and approval tradeoffs are material`,
      branchBOutcome: (route) => `~${route.expectedYieldPct}% with safer liquidity and approval posture`,
      branchCFallback: "Used when immediate access matters more than yield.",
    },
    generic: {
      intent,
      branchAName: "Chase High Yield",
      branchBName: "Balanced Safe Yield",
      branchCName: "Hold USDC",
      branchAReason:
        "Best raw APY but low liquidity and an unsafe approval pattern. Higher reward, materially higher risk.",
      branchBReason:
        "Lower yield than route A but safe approvals, high protocol trust and slippage well within policy. Best risk-adjusted outcome.",
      branchCReason:
        "Capital-preserving fallback. Chosen when no yield route clears safety checks.",
      branchAOutcome: (route) => `~${route.expectedYieldPct}% APY (higher yield, lower liquidity)`,
      branchBOutcome: (route) => `~${route.expectedYieldPct}% APY with safe approvals and low slippage`,
      branchCFallback: "Used as fallback when all yield routes are rejected.",
    },
  };
  return profiles[intent];
}

function buildProtectionTree(
  goal: string,
  policy: Policy,
  strategyVersion: number
): DecisionTree {
  const selectedBranchId: Branch["id"] = policy.isPaused ? "D" : "B";
  const rawBranches: Omit<Branch, "branchHash">[] = [
    {
      id: "A",
      name: "Allow Risky Approval",
      action: "Permit a broad approval and continue toward execution",
      expectedOutcome: "Rejected because the active goal asks Axion to protect the wallet",
      riskLevel: "high",
      confidence: 18,
      reason:
        "This branch represents the dangerous path Axion should avoid: broad approvals, unclear spend scope and weak user protection.",
      fallbackTrigger: "Blocked when the goal or policy forbids unsafe approvals.",
      status: "unsafe",
      score: -2,
    },
    {
      id: "B",
      name: "Protection Mode",
      action: "Keep funds in the wallet, block unsafe approvals and require proof before any future movement",
      expectedOutcome: "No funds moved; unsafe approvals remain blocked; policy stays conservative",
      riskLevel: "lowest",
      confidence: 90,
      reason:
        "The user asked for wallet protection, not yield. Axion chooses the safest branch and preserves capital while recording the reasoning path.",
      fallbackTrigger: "Escalate to Reject Execution if the policy is paused or any approval request becomes ambiguous.",
      status: "candidate",
      score: 3,
    },
    {
      id: "C",
      name: "Observe Only",
      action: "Do not execute; only monitor wallet policy and explain the current safety posture",
      expectedOutcome: "Read-only review with no approvals and no asset movement",
      riskLevel: "lowest",
      confidence: 76,
      reason:
        "A passive fallback that still helps the user understand risk without changing wallet state.",
      fallbackTrigger: "Used when the user wants explanation without any execution.",
      status: "fallback",
      score: 2,
    },
    {
      id: "D",
      name: "Reject Execution",
      action: "Refuse to act and return funds untouched",
      expectedOutcome: "No action taken; policy mismatch reported",
      riskLevel: "lowest",
      confidence: 88,
      reason:
        "Selected when the active wallet policy is paused or the safest action is to refuse execution entirely.",
      fallbackTrigger: "Activated on suspicious contract, paused policy or full safety failure.",
      status: "fallback",
      score: 1,
    },
  ];

  const branches: Branch[] = rawBranches.map((b) => {
    const status: Branch["status"] =
      b.id === selectedBranchId
        ? "selected"
        : b.id === "A"
          ? "unsafe"
          : b.status;
    const withStatus = { ...b, status };
    return { ...withStatus, branchHash: hashBranch(withStatus) };
  });

  const selectedBranch = branches.find((b) => b.id === selectedBranchId)!;
  const partial = {
    goal,
    branches,
    selectedBranchId,
    strategyVersion,
  };

  return {
    ...partial,
    policySnapshot: policy,
    goalHash: hashGoal(goal),
    treeHash: hashDecisionTree(partial),
    selectedBranchHash: selectedBranch.branchHash,
    policyHash: hashPolicy(policy),
    createdAt: Date.now(),
  };
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
  if (isProtectionOnlyGoal(goal)) {
    return buildProtectionTree(goal, policy, strategyVersion);
  }

  const profile = profileForGoal(goal);
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
      name: profile.branchAName,
      action: `Deposit ${policy.maxSpend} ${policy.asset} into ${routeA.name}`,
      expectedOutcome: profile.branchAOutcome(routeA),
      riskLevel: riskFromRoute(routeA),
      confidence: 38,
      reason: profile.branchAReason,
      fallbackTrigger:
        "Reject if approval is unsafe, liquidity is low, or slippage exceeds policy.",
      status: "candidate",
      score: sA.score,
      routeId: routeA.id,
    },
    {
      id: "B",
      name: profile.branchBName,
      action: `Deposit ${policy.maxSpend} ${policy.asset} into ${routeB.name}`,
      expectedOutcome: profile.branchBOutcome(routeB),
      riskLevel: riskFromRoute(routeB),
      confidence: 82,
      reason: profile.branchBReason,
      fallbackTrigger: "Rebalance to Hold (C) if the route becomes unstable.",
      status: "candidate",
      score: sB.score,
      routeId: routeB.id,
    },
    {
      id: "C",
      name: profile.branchCName,
      action: `Keep ${policy.maxSpend} ${policy.asset} in the wallet`,
      expectedOutcome: "0% yield, full liquidity, zero approval risk",
      riskLevel: riskFromRoute(routeC),
      confidence: 60,
      reason: profile.branchCReason,
      fallbackTrigger: profile.branchCFallback,
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
