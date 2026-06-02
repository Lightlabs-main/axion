import type { Route } from "@/types";
import { CONTRACTS } from "./config";

/**
 * The route catalog Axion compares before acting.
 *
 * These are NOT a simulation. Each entry is the *advertised* listing for a
 * candidate yield route — the kind of figures a route aggregator or vault page
 * publishes up front (expected APY, advertised slippage, claimed risk). They are
 * the agent's INPUT, not its ground truth: exactly the claims a real agent has
 * to take on faith before it acts.
 *
 * The REALISED terms are read live from the deployed on-chain vault
 * (`quote()` → apyBps / depositFeeBps / riskTag in {@link contractClient}).
 * Axion's whole point is to commit to a prediction against these advertised
 * numbers, then judge it against the on-chain reality. The gap between the two
 * is what the lifecycle is built to expose.
 *
 * - route-a (High APY Pool)  -> highApyVault  (advertised safe-ish; on-chain unsafe)
 * - route-b (Balanced Yield) -> balancedVault (safe, executed for real)
 * - route-c (Hold USDC)      -> no vault, no on-chain action
 */
export const ROUTE_CATALOG: Route[] = [
  {
    id: "route-a",
    name: "High APY Pool",
    expectedYieldPct: 12,
    liquidity: "low",
    slippageBps: 180, // 1.80% advertised
    approvalRisk: "unsafe",
    protocolTrust: "medium",
    risk: "high",
    vaultKey: "highApy",
  },
  {
    id: "route-b",
    name: "Balanced Yield Route",
    expectedYieldPct: 6,
    liquidity: "medium",
    slippageBps: 40, // 0.40% advertised
    approvalRisk: "safe",
    protocolTrust: "high",
    risk: "low-medium",
    vaultKey: "balanced",
  },
  {
    id: "route-c",
    name: "Hold USDC",
    expectedYieldPct: 0,
    liquidity: "full",
    slippageBps: 0,
    approvalRisk: "none",
    protocolTrust: "n/a",
    risk: "lowest",
  },
];

export function getRoute(id: string): Route | undefined {
  return ROUTE_CATALOG.find((r) => r.id === id);
}

/** Resolve a route's deployed vault address (or undefined for Hold). */
export function vaultAddressFor(route: Route | undefined): string | undefined {
  if (!route?.vaultKey) return undefined;
  return route.vaultKey === "highApy" ? CONTRACTS.highApyVault : CONTRACTS.balancedVault;
}
