import type {
  Branch,
  ExecutionResult,
  Policy,
  Route,
  SkillTraceEntry,
} from "@/types";
import { getRoute } from "./mockRoutes";
import { hashAction, hashOutcome } from "./hashing";

/**
 * ByrealSkillAdapter is the swappable interface to a skill-execution backend.
 * The demo ships a LocalByrealAdapter (deterministic, fully offline). To plug
 * in a real Byreal Skills CLI later, implement this same interface and swap the
 * instance in agentEngine — nothing else needs to change.
 *
 * NOTE: We intentionally do NOT import a non-existent Byreal SDK package. The
 * adapter boundary keeps the integration honest and replaceable.
 */
export interface ByrealSkillAdapter {
  readonly name: string;
  readonly isReal: boolean;
  runRiskCheck(route: Route, policy: Policy): SkillTraceEntry;
  runRouteCompare(route: Route): SkillTraceEntry;
  runApprovalGuard(route: Route, policy: Policy): SkillTraceEntry;
  runExecution(branch: Branch, route: Route | undefined, policy: Policy): SkillTraceEntry;
  runOutcomeVerifier(branch: Branch, actual: { yieldPct: number; slippageBps: number }): SkillTraceEntry;
}

/**
 * Deterministic local adapter labelled clearly as a demo backend.
 */
export class LocalByrealAdapter implements ByrealSkillAdapter {
  readonly name = "Byreal-compatible Local Adapter (demo)";
  readonly isReal = false;

  runRiskCheck(route: Route, policy: Policy): SkillTraceEntry {
    const overSlippage = route.slippageBps > policy.maxSlippageBps;
    const passed = !overSlippage;
    return {
      skill: "RiskCheckSkill",
      input: `${route.name} slippage=${(route.slippageBps / 100).toFixed(2)}% liquidity=${route.liquidity}`,
      output: overSlippage
        ? `FAIL: slippage above policy max ${(policy.maxSlippageBps / 100).toFixed(2)}%`
        : `OK: slippage within policy; risk=${route.risk}`,
      passed,
    };
  }

  runRouteCompare(route: Route): SkillTraceEntry {
    return {
      skill: "RouteCompareSkill",
      input: `Candidate route ${route.name}`,
      output: `APY ${route.expectedYieldPct}% · liquidity ${route.liquidity} · protocolTrust ${route.protocolTrust}`,
      passed: true,
    };
  }

  runApprovalGuard(route: Route, policy: Policy): SkillTraceEntry {
    const unsafe = route.approvalRisk === "unsafe" && !policy.allowUnsafeApprovals;
    return {
      skill: "ApprovalGuardSkill",
      input: `approvalRisk=${route.approvalRisk} allowUnsafe=${policy.allowUnsafeApprovals}`,
      output: unsafe
        ? "BLOCK: unsafe approval not permitted by policy"
        : "OK: approval pattern permitted",
      passed: !unsafe,
    };
  }

  runExecution(branch: Branch, route: Route | undefined, _policy: Policy): SkillTraceEntry {
    if (!route || branch.id === "D") {
      return {
        skill: "ExecutionSkill",
        input: branch.action,
        output:
          branch.id === "D"
            ? "No execution — branch D refuses to act"
            : "No execution — hold position",
        passed: true,
      };
    }
    return {
      skill: "ExecutionSkill",
      input: `Execute ${branch.name} via ${route.name} (demo route)`,
      output: `Simulated deposit submitted to ${route.name}`,
      passed: true,
    };
  }

  runOutcomeVerifier(
    branch: Branch,
    actual: { yieldPct: number; slippageBps: number }
  ): SkillTraceEntry {
    return {
      skill: "OutcomeVerifierSkill",
      input: `branch=${branch.id}`,
      output: `Observed yield ${actual.yieldPct}% · slippage ${(actual.slippageBps / 100).toFixed(2)}%`,
      passed: true,
    };
  }
}

/**
 * Execute a selected branch through the adapter and produce a deterministic
 * outcome. Slippage/yield are derived from the route with a small, deterministic
 * "market drift" so the verification step has something meaningful to judge.
 */
export function executeBranch(
  adapter: ByrealSkillAdapter,
  branch: Branch,
  policy: Policy
): ExecutionResult {
  const route = branch.routeId ? getRoute(branch.routeId) : undefined;
  const trace: SkillTraceEntry[] = [];

  if (route) {
    trace.push(adapter.runRouteCompare(route));
    trace.push(adapter.runRiskCheck(route, policy));
    trace.push(adapter.runApprovalGuard(route, policy));
  }

  // Hard safety gate before execution.
  const blocked =
    !!route &&
    ((route.approvalRisk === "unsafe" && !policy.allowUnsafeApprovals) ||
      route.slippageBps > policy.maxSlippageBps);

  const exec = adapter.runExecution(branch, route, policy);
  trace.push(exec);

  let actualYieldPct = 0;
  let actualSlippageBps = 0;
  let succeeded = true;
  let blockedReason: string | undefined;

  if (branch.id === "D") {
    succeeded = true; // refusing to act is a success of the safety system
    blockedReason = "Execution rejected by policy/safety checks";
  } else if (blocked) {
    succeeded = false;
    blockedReason =
      route && route.approvalRisk === "unsafe"
        ? "Unsafe approval blocked"
        : "Slippage above policy threshold";
  } else if (route) {
    // Deterministic drift: real markets rarely match the brochure exactly.
    // Balanced route slightly underperforms; high-APY route slips more.
    const yieldDrift = route.id === "route-a" ? -2 : route.id === "route-b" ? -0.4 : 0;
    const slippageDrift = route.id === "route-a" ? 40 : route.id === "route-b" ? 8 : 0;
    actualYieldPct = Math.max(0, Number((route.expectedYieldPct + yieldDrift).toFixed(2)));
    actualSlippageBps = route.slippageBps + slippageDrift;
  }

  trace.push(
    adapter.runOutcomeVerifier(branch, {
      yieldPct: actualYieldPct,
      slippageBps: actualSlippageBps,
    })
  );

  const actionHash = hashAction({
    branchId: branch.id,
    routeId: branch.routeId,
    spend: policy.maxSpend,
  });
  const outcomeHash = hashOutcome({
    actualYieldPct,
    actualSlippageBps,
    succeeded,
    blockedReason,
  });

  return {
    branchId: branch.id,
    routeId: branch.routeId,
    skillTrace: trace,
    actualYieldPct,
    actualSlippageBps,
    succeeded,
    blockedReason,
    actionHash,
    outcomeHash,
    mode: "local",
  };
}
