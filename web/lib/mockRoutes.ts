import type { Route } from "@/types";

/**
 * Simulated DeFi routes used by the Axion demo. These are DEMO ROUTES — the UI
 * always labels them as simulated. The point of the demo is the decision
 * lifecycle (predict → commit → execute → judge → forge → evolve), not real
 * liquidity sourcing.
 */
export const MOCK_ROUTES: Route[] = [
  {
    id: "route-a",
    name: "High APY Pool",
    expectedYieldPct: 12,
    liquidity: "low",
    slippageBps: 180, // 1.8%
    approvalRisk: "unsafe",
    protocolTrust: "medium",
    risk: "high",
    isDemoRoute: true,
  },
  {
    id: "route-b",
    name: "Balanced Yield Route",
    expectedYieldPct: 6,
    liquidity: "medium",
    slippageBps: 40, // 0.4%
    approvalRisk: "safe",
    protocolTrust: "high",
    risk: "low-medium",
    isDemoRoute: true,
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
    isDemoRoute: true,
  },
];

export function getRoute(id: string): Route | undefined {
  return MOCK_ROUTES.find((r) => r.id === id);
}
