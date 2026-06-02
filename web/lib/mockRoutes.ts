import type { Route } from "@/types";
import { CONTRACTS } from "./config";

/**
 * Candidate routes Axion compares before acting. The numbers here are the
 * agent's PRE-EXECUTION estimates (what the route advertises). The REALISED
 * terms come from the deployed on-chain vault (apyBps / depositFeeBps via
 * `quote()`), which is what the verification step judges against. The gap
 * between advertised estimate and on-chain reality is exactly what Axion is
 * built to catch.
 *
 * - route-a (High APY Pool)  -> HighApyVault  (unsafe, rejected by policy)
 * - route-b (Balanced Yield) -> BalancedVault (safe, executed for real)
 * - route-c (Hold USDC)      -> no vault, no on-chain action
 */
export const MOCK_ROUTES: Route[] = [
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
  return MOCK_ROUTES.find((r) => r.id === id);
}

/** Resolve a route's deployed vault address (or undefined for Hold). */
export function vaultAddressFor(route: Route | undefined): string | undefined {
  if (!route?.vaultKey) return undefined;
  return route.vaultKey === "highApy" ? CONTRACTS.highApyVault : CONTRACTS.balancedVault;
}
