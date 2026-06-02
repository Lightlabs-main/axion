import type {
  Branch,
  ExecutionResult,
  PostMortem,
  Route,
  StrategyState,
  Verdict,
} from "@/types";
import { getRoute } from "./routes";

export const DEFAULT_STRATEGY: StrategyState = {
  riskWeight: 1.0,
  yieldWeight: 1.0,
  liquidityWeight: 0.8,
  approvalSafetyWeight: 1.2,
  sourceConfidenceWeight: 0.9,
  slippageTolerance: 50, // bps
};

interface Prediction {
  expectedYieldPct: number;
  expectedSlippageBps: number;
}

export function predictionForBranch(branch: Branch): Prediction {
  const route = branch.routeId ? getRoute(branch.routeId) : undefined;
  return {
    expectedYieldPct: route?.expectedYieldPct ?? 0,
    expectedSlippageBps: route?.slippageBps ?? 0,
  };
}

/**
 * Judge the outcome against the original prediction. This is the core honesty
 * mechanism: it compares what Axion committed to BEFORE acting with what
 * actually happened.
 */
export function judgeOutcome(
  branch: Branch,
  prediction: Prediction,
  outcome: ExecutionResult
): { verdict: Verdict; critical: boolean } {
  // Branch D / blocked unsafe routes => the safety system did its job.
  if (branch.id === "D") {
    return { verdict: "RejectedSafely", critical: false };
  }
  if (!outcome.succeeded && outcome.blockedReason) {
    // An unsafe action was blocked before it could do harm.
    return { verdict: "UnsafeBlocked", critical: false };
  }

  const yieldGap = prediction.expectedYieldPct - outcome.actualYieldPct;
  const slipGap = outcome.actualSlippageBps - prediction.expectedSlippageBps;

  // Critical failure: large negative surprise.
  if (yieldGap >= 6 || slipGap >= 120) {
    return { verdict: "Wrong", critical: true };
  }
  if (yieldGap > 3 || slipGap > 60) {
    return { verdict: "Wrong", critical: false };
  }
  if (yieldGap > 1 || slipGap > 20) {
    return { verdict: "PartiallyCorrect", critical: false };
  }
  return { verdict: "Correct", critical: false };
}

/** Score (0-100) describing how close prediction was to reality. */
export function epochScore(
  branch: Branch,
  prediction: Prediction,
  outcome: ExecutionResult,
  verdict: Verdict
): number {
  if (verdict === "RejectedSafely" || verdict === "UnsafeBlocked") return 90;
  const yieldGap = Math.abs(prediction.expectedYieldPct - outcome.actualYieldPct);
  const slipGap = Math.abs(outcome.actualSlippageBps - prediction.expectedSlippageBps);
  const raw = 100 - yieldGap * 8 - slipGap * 0.4;
  return Math.max(5, Math.min(100, Math.round(raw)));
}

/**
 * EchoForge: forge the next strategy version from the verified outcome.
 * Every verified epoch nudges the weights, so the agent literally rewrites how
 * it will decide next time.
 */
export function forgeStrategy(
  strategy: StrategyState,
  branch: Branch,
  prediction: Prediction,
  outcome: ExecutionResult,
  verdict: Verdict
): StrategyState {
  const next: StrategyState = { ...strategy };

  const slipHigher = outcome.actualSlippageBps > prediction.expectedSlippageBps;
  const yieldLower = outcome.actualYieldPct < prediction.expectedYieldPct;

  if (slipHigher) {
    // Markets slipped more than expected -> care more about slippage/risk.
    next.slippageTolerance = Math.max(10, strategy.slippageTolerance - 5);
    next.riskWeight = round(strategy.riskWeight + 0.1);
  }
  if (yieldLower) {
    // Brochure APY didn't materialise -> trust sources less.
    next.sourceConfidenceWeight = round(Math.max(0.3, strategy.sourceConfidenceWeight - 0.1));
    next.yieldWeight = round(Math.max(0.3, strategy.yieldWeight - 0.05));
  }
  if (verdict === "UnsafeBlocked" || verdict === "RejectedSafely") {
    // Correctly avoided danger -> weight approval safety more heavily.
    next.approvalSafetyWeight = round(strategy.approvalSafetyWeight + 0.15);
  }
  if (verdict === "Correct") {
    // The plan worked -> modestly reward the chosen profile.
    next.liquidityWeight = round(strategy.liquidityWeight + 0.05);
  }

  return next;
}

function round(n: number): number {
  return Number(n.toFixed(3));
}

/**
 * Deterministic post-mortem (used when no LLM key is present). Structured and
 * specific so the timeline is readable and honest.
 */
export function buildDeterministicPostMortem(
  branch: Branch,
  prediction: Prediction,
  outcome: ExecutionResult,
  verdict: Verdict
): PostMortem {
  const whatWasRight: string[] = [];
  const whatWasWrong: string[] = [];
  const route: Route | undefined = branch.routeId ? getRoute(branch.routeId) : undefined;

  if (verdict === "UnsafeBlocked" || verdict === "RejectedSafely") {
    whatWasRight.push(
      branch.id === "D"
        ? "Refused to execute when no route satisfied the policy."
        : `Blocked ${route?.name ?? "the route"} before funds were exposed (${outcome.blockedReason}).`
    );
    whatWasRight.push("Capital was preserved; no unsafe approval was signed.");
    whatWasWrong.push("None — the safety layer behaved as designed.");
  } else {
    const yieldGap = prediction.expectedYieldPct - outcome.actualYieldPct;
    const slipGap = outcome.actualSlippageBps - prediction.expectedSlippageBps;

    if (Math.abs(yieldGap) <= 1) {
      whatWasRight.push(
        `Yield prediction was accurate (predicted ${prediction.expectedYieldPct}%, got ${outcome.actualYieldPct}%).`
      );
    } else {
      whatWasWrong.push(
        `Yield came in ${yieldGap > 0 ? "below" : "above"} prediction (predicted ${prediction.expectedYieldPct}%, got ${outcome.actualYieldPct}%).`
      );
    }

    if (slipGap <= 20) {
      whatWasRight.push(
        `Slippage stayed near prediction (${(outcome.actualSlippageBps / 100).toFixed(2)}%).`
      );
    } else {
      whatWasWrong.push(
        `Slippage was higher than predicted (predicted ${(prediction.expectedSlippageBps / 100).toFixed(2)}%, got ${(outcome.actualSlippageBps / 100).toFixed(2)}%).`
      );
    }

    if (route?.approvalRisk === "safe" || route?.approvalRisk === "none") {
      whatWasRight.push("Used a safe approval pattern, consistent with policy.");
    }
    if (whatWasWrong.length === 0) whatWasWrong.push("No material errors detected.");
  }

  const narrative = buildNarrative(branch, prediction, outcome, verdict);
  return { whatWasRight, whatWasWrong, narrative, source: "deterministic" };
}

function buildNarrative(
  branch: Branch,
  prediction: Prediction,
  outcome: ExecutionResult,
  verdict: Verdict
): string {
  switch (verdict) {
    case "RejectedSafely":
      return `Axion committed its decision tree, then refused to execute because no branch cleared the active policy. This is recorded as a safe rejection — the wallet protected capital rather than forcing a trade.`;
    case "UnsafeBlocked":
      return `Axion committed branch ${branch.id} but the pre-execution safety gate blocked it (${outcome.blockedReason}). The commitment proves Axion flagged this risk before acting, not after.`;
    case "Correct":
      return `Branch ${branch.id} (${branch.name}) executed close to its committed prediction. Outcome verified against the pre-committed hash; strategy nudged to keep this profile.`;
    case "PartiallyCorrect":
      return `Branch ${branch.id} (${branch.name}) executed but drifted from prediction. Axion recorded the gap against its committed forecast and adjusted its weights so the next epoch prices this risk in.`;
    case "Wrong":
      return `Branch ${branch.id} (${branch.name}) underperformed its committed prediction materially. Because the forecast was committed before acting, Axion cannot retroactively claim it expected this — it logs the miss and forges a more conservative strategy.`;
    default:
      return `Epoch judged.`;
  }
}
