// SERVER-ONLY. Spawns the real Byreal Agent Skills CLI (@byreal-io/byreal-cli)
// to read live CLMM pool data. Do not import this from a client component.

import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import type { ByrealMarket, ByrealPoolRef } from "./byrealTypes";
import { unavailableMarket } from "./byrealTypes";

const execFileAsync = promisify(execFile);

const STABLE_SYMBOLS = new Set([
  "USDC",
  "USDT",
  "USDE",
  "SUSDE",
  "USDS",
  "USD1",
  "PYUSD",
  "DAI",
  "FDUSD",
  "USD0",
]);

interface CliToken {
  symbol?: string;
}
interface CliPool {
  pair?: string;
  token_a?: CliToken;
  token_b?: CliToken;
  tvl_usd?: number;
  fee_rate_bps?: number;
  total_apr?: number;
  apr?: number;
}

function toRef(p: CliPool): ByrealPoolRef {
  return {
    pair: p.pair ?? `${p.token_a?.symbol ?? "?"}/${p.token_b?.symbol ?? "?"}`,
    totalAprPct: Number(p.total_apr ?? p.apr ?? 0),
    tvlUsd: Number(p.tvl_usd ?? 0),
    feeRateBps: Number(p.fee_rate_bps ?? 0),
  };
}

function isStablePool(p: CliPool): boolean {
  const a = p.token_a?.symbol?.toUpperCase();
  const b = p.token_b?.symbol?.toUpperCase();
  return !!a && !!b && STABLE_SYMBOLS.has(a) && STABLE_SYMBOLS.has(b);
}

const CLI_REL = path.join("@byreal-io", "byreal-cli", "dist", "index.cjs");

/**
 * Locate the Byreal CLI entry script. We avoid require.resolve / import.meta.url
 * because Next's bundle rewrites both; instead we look under node_modules from a
 * few base directories (app root, its parent for hoisted installs).
 */
function resolveCliBin(): { node: string; script: string } | null {
  if (process.env.BYREAL_CLI_BIN) {
    return { node: process.execPath, script: process.env.BYREAL_CLI_BIN };
  }
  const cwd = process.cwd();
  const candidates = [
    path.join(cwd, "node_modules", CLI_REL),
    path.join(cwd, "..", "node_modules", CLI_REL),
  ];
  const script = candidates.find((p) => existsSync(p));
  return script ? { node: process.execPath, script } : null;
}

/**
 * Read a live market snapshot from the Byreal Agent Skills CLI. Best-effort:
 * any failure returns an unavailable market so callers can degrade gracefully.
 */
interface PoolsListResult {
  version: string;
  pools: CliPool[];
}

async function runPoolsList(
  bin: { node: string; script: string },
  extraArgs: string[]
): Promise<PoolsListResult> {
  const { stdout } = await execFileAsync(
    bin.node,
    [bin.script, "pools", "list", ...extraArgs, "--page-size", "50", "-o", "json"],
    { timeout: 20_000, maxBuffer: 16 * 1024 * 1024 }
  );
  // Be tolerant of any non-JSON prefix the CLI might print.
  const start = stdout.indexOf("{");
  if (start < 0) return { version: "unknown", pools: [] };
  const parsed = JSON.parse(stdout.slice(start)) as {
    success?: boolean;
    meta?: { version?: string };
    data?: { pools?: CliPool[] };
  };
  if (!parsed.success) return { version: parsed.meta?.version ?? "unknown", pools: [] };
  return { version: parsed.meta?.version ?? "unknown", pools: parsed.data?.pools ?? [] };
}

export async function getByrealMarket(): Promise<ByrealMarket> {
  try {
    const bin = resolveCliBin();
    if (!bin) {
      console.error("[byreal] CLI not found under node_modules");
      return unavailableMarket();
    }

    // Two real reads in parallel: richest APR overall, and the deepest pools by
    // TVL (from which we take the top stable pair) — references for the two
    // candidates.
    const [byApr, byTvl] = await Promise.all([
      runPoolsList(bin, ["--sort-field", "apr24h"]),
      runPoolsList(bin, ["--sort-field", "tvl"]).catch(() => ({
        version: "unknown",
        pools: [] as CliPool[],
      })),
    ]);

    console.error(
      `[byreal] apr pools=${byApr.pools.length} tvl pools=${byTvl.pools.length} firstTvl=${byTvl.pools[0]?.pair}`
    );
    if (byApr.pools.length === 0) return unavailableMarket();

    const topApr = toRef(byApr.pools[0]);
    // Deepest-liquidity stable pair (byTvl is sorted desc), falling back to any
    // stable pool seen in the APR list.
    const stable =
      byTvl.pools.find(isStablePool) ??
      byApr.pools.filter(isStablePool).sort((a, b) => Number(b.tvl_usd ?? 0) - Number(a.tvl_usd ?? 0))[0];

    return {
      available: true,
      version: byApr.version,
      asOf: Date.now(),
      poolCount: byApr.pools.length,
      topApr,
      topStable: stable ? toRef(stable) : undefined,
    };
  } catch (e) {
    console.error("[byreal] getByrealMarket failed:", (e as Error)?.message);
    return unavailableMarket();
  }
}
