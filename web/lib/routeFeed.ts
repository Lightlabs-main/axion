import type { Route } from "@/types";
import { ROUTE_CATALOG } from "./routes";

/**
 * Live advertised-yield feed.
 *
 * The route catalog's *advertised* APYs are the figures the agent commits a
 * prediction against. Instead of hand-picked constants, we source them from a
 * real market feed (DefiLlama's Mantle pools): the high-yield candidate takes
 * the top advertised APY among volatile Mantle pools, the balanced candidate
 * takes a deep-liquidity stable pool. The route IDs, approval semantics and
 * which on-chain vault each one executes into stay fixed — only the advertised
 * numbers come from the feed. The REALISED terms are still read from the
 * deployed vault at execution time, so the predict-vs-reality gap is intact.
 *
 * Everything degrades gracefully: if the feed is unreachable we fall back to the
 * built-in catalog and say so.
 */

const DEFILLAMA_POOLS = "https://yields.llama.fi/pools";
const MIN_TVL_USD = 50_000;

export interface LlamaPool {
  chain: string;
  project: string;
  symbol: string;
  apy: number | null;
  tvlUsd: number | null;
  stablecoin: boolean;
  ilRisk: string; // "yes" | "no"
}

export interface RouteFeed {
  routes: Route[];
  source: "defillama" | "fallback";
  asOf: number;
  /** Human-readable attribution of where the advertised numbers came from. */
  detail: string;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function trustFromTvl(tvlUsd: number): Route["protocolTrust"] {
  if (tvlUsd >= 1_000_000) return "high";
  if (tvlUsd >= 200_000) return "medium";
  return "low";
}

function label(p: LlamaPool): string {
  return `${p.project} ${p.symbol} ${round1(p.apy ?? 0)}%`;
}

/** Build a route catalog from a raw DefiLlama pools array. Pure + testable. */
export function buildCatalogFromPools(pools: LlamaPool[]): RouteFeed {
  const mantle = pools.filter(
    (p) => p.chain === "Mantle" && (p.tvlUsd ?? 0) >= MIN_TVL_USD && (p.apy ?? 0) > 0
  );

  // High-yield candidate: richest advertised APY among volatile (non-stable) pools.
  const highApy = [...mantle]
    .filter((p) => !p.stablecoin)
    .sort((a, b) => (b.apy ?? 0) - (a.apy ?? 0))[0];

  // Balanced candidate: deepest-liquidity low-IL / stable pool.
  const balanced = [...mantle]
    .filter((p) => p.stablecoin || p.ilRisk === "no")
    .sort((a, b) => (b.tvlUsd ?? 0) - (a.tvlUsd ?? 0))[0];

  // Only treat the feed as live when both candidates resolve; otherwise the
  // built-in advertised listings are used unchanged.
  if (!highApy || !balanced) {
    return {
      routes: ROUTE_CATALOG,
      source: "fallback",
      asOf: Date.now(),
      detail: "Live yield feed returned no usable Mantle pools — using built-in advertised listings.",
    };
  }

  const routes = ROUTE_CATALOG.map((r) => {
    if (r.id === "route-a") {
      return {
        ...r,
        expectedYieldPct: round1(highApy.apy ?? r.expectedYieldPct),
        protocolTrust: trustFromTvl(highApy.tvlUsd ?? 0),
      };
    }
    if (r.id === "route-b") {
      return {
        ...r,
        expectedYieldPct: round1(balanced.apy ?? r.expectedYieldPct),
        protocolTrust: trustFromTvl(balanced.tvlUsd ?? 0),
      };
    }
    return r;
  });

  return {
    routes,
    source: "defillama",
    asOf: Date.now(),
    detail: `Advertised yields (Mantle, DefiLlama) — high: ${label(highApy)} · balanced: ${label(balanced)}`,
  };
}

/** Fetch + map the live feed (server-side). Throws on network failure. */
export async function fetchLiveCatalog(signal?: AbortSignal): Promise<RouteFeed> {
  const res = await fetch(DEFILLAMA_POOLS, {
    signal,
    // Cache at the edge for 10 minutes; advertised APYs don't move per-second.
    next: { revalidate: 600 },
  });
  if (!res.ok) throw new Error(`DefiLlama responded ${res.status}`);
  const json = (await res.json()) as { data?: LlamaPool[] };
  return buildCatalogFromPools(json.data ?? []);
}

/** The built-in catalog as a RouteFeed (used when the feed is unavailable). */
export function fallbackCatalog(): RouteFeed {
  return {
    routes: ROUTE_CATALOG,
    source: "fallback",
    asOf: Date.now(),
    detail: "Using built-in advertised listings (live yield feed unavailable).",
  };
}

/** Client helper: ask our API route for the catalog, degrade to built-in. */
export async function fetchRouteCatalog(): Promise<RouteFeed> {
  try {
    const res = await fetch("/api/routes");
    if (!res.ok) throw new Error(`routes API ${res.status}`);
    return (await res.json()) as RouteFeed;
  } catch {
    return fallbackCatalog();
  }
}
