import type {
  Branch,
  ExecutionResult,
  Policy,
  Route,
  SkillTraceEntry,
} from "@/types";
import { getRoute, vaultAddressFor } from "./routes";
import { hashAction, hashOutcome } from "./hashing";
import {
  depositToVault,
  vaultPosition,
  vaultQuote,
  type VaultQuote,
} from "./contractClient";
import type { Address } from "viem";

/**
 * ByrealSkillAdapter is the swappable interface to a skill-execution backend.
 * The shipped adapter runs Axion's safety skills against REAL on-chain vault
 * data (read via `quote()`/`positionOf()`). To plug in the real Byreal Skills
 * CLI later, implement this same interface and swap the instance — the rest of
 * the lifecycle is unchanged.
 *
 * NOTE: we intentionally do NOT import a non-existent Byreal SDK package; the
 * adapter boundary keeps the integration honest and replaceable.
 */
export interface ByrealSkillAdapter {
  readonly name: string;
  readonly isReal: boolean;
  runRouteCompare(route: Route, realised: VaultQuote): SkillTraceEntry;
  runRiskCheck(realised: VaultQuote, policy: Policy): SkillTraceEntry;
  runApprovalGuard(realised: VaultQuote, policy: Policy): SkillTraceEntry;
  runExecution(branch: Branch, route: Route | undefined, deposit?: { txHash: string; credited: number }): SkillTraceEntry;
  runOutcomeVerifier(realised: VaultQuote, accruedNote: string): SkillTraceEntry;
}

/** Adapter that formats Axion's skills around live on-chain vault reads. */
export class LocalByrealAdapter implements ByrealSkillAdapter {
  readonly name = "Byreal-compatible Adapter (on-chain reads)";
  readonly isReal = true;

  runRouteCompare(route: Route, realised: VaultQuote): SkillTraceEntry {
    return {
      skill: "RouteCompareSkill",
      input: `Candidate ${route.name} (advertised ${route.expectedYieldPct}% / ${(route.slippageBps / 100).toFixed(2)}%)`,
      output: `On-chain quote: APY ${(realised.apyBps / 100).toFixed(2)}% · entry fee ${(realised.depositFeeBps / 100).toFixed(2)}% · tag ${realised.riskTag}`,
      passed: true,
    };
  }

  runRiskCheck(realised: VaultQuote, policy: Policy): SkillTraceEntry {
    const over = realised.depositFeeBps > policy.maxSlippageBps;
    return {
      skill: "RiskCheckSkill",
      input: `realisedFee=${(realised.depositFeeBps / 100).toFixed(2)}% policyMax=${(policy.maxSlippageBps / 100).toFixed(2)}%`,
      output: over
        ? `FAIL: on-chain entry fee exceeds policy max`
        : `OK: on-chain entry fee within policy`,
      passed: !over,
    };
  }

  runApprovalGuard(realised: VaultQuote, policy: Policy): SkillTraceEntry {
    const unsafe = realised.riskTag === "unsafe" && !policy.allowUnsafeApprovals;
    return {
      skill: "ApprovalGuardSkill",
      input: `vaultTag=${realised.riskTag} allowUnsafe=${policy.allowUnsafeApprovals}`,
      output: unsafe
        ? "BLOCK: vault flagged unsafe and policy forbids unsafe approvals"
        : "OK: approval pattern permitted",
      passed: !unsafe,
    };
  }

  runExecution(
    branch: Branch,
    route: Route | undefined,
    deposit?: { txHash: string; credited: number }
  ): SkillTraceEntry {
    if (branch.id === "D") {
      return {
        skill: "ExecutionSkill",
        input: branch.action,
        output: "No execution — branch D refuses to act",
        passed: true,
      };
    }
    if (!route?.vaultKey) {
      return {
        skill: "ExecutionSkill",
        input: branch.action,
        output: "No on-chain action — holding position",
        passed: true,
      };
    }
    if (deposit) {
      return {
        skill: "ExecutionSkill",
        input: `Deposit into ${route.name} vault`,
        output: `On-chain deposit ${deposit.txHash.slice(0, 10)}… · credited ${deposit.credited.toFixed(4)} aUSDC`,
        passed: true,
      };
    }
    return {
      skill: "ExecutionSkill",
      input: branch.action,
      output: "Execution gated by safety checks — no deposit made",
      passed: false,
    };
  }

  runOutcomeVerifier(realised: VaultQuote, accruedNote: string): SkillTraceEntry {
    return {
      skill: "OutcomeVerifierSkill",
      input: "read positionOf() + quote() on-chain",
      output: `Realised APY ${(realised.apyBps / 100).toFixed(2)}% · ${accruedNote}`,
      passed: true,
    };
  }
}

/**
 * Execute a selected branch for REAL: read the target vault's on-chain terms,
 * run the safety gate, and (if it passes) deposit real test USDC into the vault.
 * The realised yield/slippage are read from chain, so the verification step
 * judges the prediction against ground truth — not a simulation.
 */
export async function executeBranch(
  adapter: ByrealSkillAdapter,
  branch: Branch,
  policy: Policy,
  account: Address
): Promise<ExecutionResult> {
  const route = branch.routeId ? getRoute(branch.routeId) : undefined;
  const vaultAddr = vaultAddressFor(route) as Address | undefined;
  const trace: SkillTraceEntry[] = [];

  // Branch D / Hold: no on-chain action.
  if (branch.id === "D" || !route?.vaultKey || !vaultAddr) {
    trace.push(adapter.runExecution(branch, route));
    const actionHash = hashAction({ branchId: branch.id, routeId: branch.routeId, spend: 0 });
    const outcomeHash = hashOutcome({
      actualYieldPct: 0,
      actualSlippageBps: 0,
      succeeded: true,
      blockedReason: branch.id === "D" ? "Execution rejected by policy/safety checks" : undefined,
    });
    return {
      branchId: branch.id,
      routeId: branch.routeId,
      skillTrace: trace,
      actualYieldPct: 0,
      actualSlippageBps: 0,
      succeeded: true,
      blockedReason: branch.id === "D" ? "Execution rejected by policy/safety checks" : undefined,
      actionHash,
      outcomeHash,
      mode: "onchain",
    };
  }

  // Read REAL on-chain terms for the target vault.
  const realised = await vaultQuote(vaultAddr);
  trace.push(adapter.runRouteCompare(route, realised));
  trace.push(adapter.runRiskCheck(realised, policy));
  trace.push(adapter.runApprovalGuard(realised, policy));

  const blocked =
    (realised.riskTag === "unsafe" && !policy.allowUnsafeApprovals) ||
    realised.depositFeeBps > policy.maxSlippageBps;

  const actualYieldPct = Number((realised.apyBps / 100).toFixed(2));
  const actualSlippageBps = realised.depositFeeBps;

  if (blocked) {
    trace.push(adapter.runExecution(branch, route)); // no deposit
    const blockedReason =
      realised.riskTag === "unsafe" && !policy.allowUnsafeApprovals
        ? "Unsafe approval blocked by policy"
        : "On-chain entry fee above policy slippage threshold";
    const actionHash = hashAction({ branchId: branch.id, routeId: branch.routeId, spend: 0 });
    const outcomeHash = hashOutcome({
      actualYieldPct,
      actualSlippageBps,
      succeeded: false,
      blockedReason,
    });
    return {
      branchId: branch.id,
      routeId: branch.routeId,
      skillTrace: trace,
      actualYieldPct,
      actualSlippageBps,
      succeeded: false,
      blockedReason,
      vaultAddress: vaultAddr,
      actionHash,
      outcomeHash,
      mode: "onchain",
    };
  }

  // Safety passed — perform the REAL deposit.
  const deposit = await depositToVault(account, vaultAddr, policy.maxSpend);
  trace.push(adapter.runExecution(branch, route, deposit));

  const pos = await vaultPosition(vaultAddr, account);
  trace.push(
    adapter.runOutcomeVerifier(
      realised,
      `principal ${pos.principal.toFixed(4)} aUSDC, accrued ${pos.accrued.toFixed(6)} aUSDC`
    )
  );

  const actionHash = hashAction({
    branchId: branch.id,
    routeId: branch.routeId,
    spend: policy.maxSpend,
  });
  const outcomeHash = hashOutcome({
    actualYieldPct,
    actualSlippageBps,
    succeeded: true,
  });

  return {
    branchId: branch.id,
    routeId: branch.routeId,
    skillTrace: trace,
    actualYieldPct,
    actualSlippageBps,
    succeeded: true,
    vaultAddress: vaultAddr,
    creditedUsdc: deposit.credited,
    feePaidUsdc: deposit.feePaid,
    txHash: deposit.txHash,
    actionHash,
    outcomeHash,
    mode: "onchain",
  };
}
