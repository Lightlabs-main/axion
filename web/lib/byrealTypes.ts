// Shared types for the Byreal Agent Skills integration. No Node/browser-only
// imports here so both the server client and the client adapter can use them.

export interface ByrealPoolRef {
  pair: string;
  totalAprPct: number;
  tvlUsd: number;
  feeRateBps: number;
}

/**
 * A snapshot of Byreal's live agent-native DEX market, read from the real
 * Byreal Agent Skills CLI. `available` is false when the CLI could not be run
 * (not installed, network down, etc.), in which case the console falls back to
 * the local adapter.
 */
export interface ByrealMarket {
  available: boolean;
  version: string; // Byreal CLI version, e.g. "0.3.6"
  asOf: number;
  poolCount: number;
  topApr?: ByrealPoolRef; // richest-APR volatile pool
  topStable?: ByrealPoolRef; // deepest stablecoin pool
}

export function unavailableMarket(): ByrealMarket {
  return { available: false, version: "", asOf: Date.now(), poolCount: 0 };
}
