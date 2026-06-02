"use client";

import { useWallet } from "./WalletProvider";
import { ACTIVE_CHAIN } from "@/lib/config";

export function ConnectButton() {
  const { account, connecting, hasWallet, configured, wrongChain, connect, switchNetwork, usdc } =
    useWallet();

  if (!configured) {
    return (
      <span className="chip border border-[var(--border)] text-[var(--muted)]">Not deployed</span>
    );
  }

  if (!hasWallet) {
    return (
      <a
        href="https://metamask.io/download/"
        target="_blank"
        rel="noreferrer"
        className="btn btn-primary"
      >
        Install wallet
      </a>
    );
  }

  if (!account) {
    return (
      <button onClick={connect} disabled={connecting} className="btn btn-primary">
        {connecting ? "Connecting…" : "Connect wallet"}
      </button>
    );
  }

  if (wrongChain) {
    return (
      <button onClick={switchNetwork} className="btn btn-primary">
        Switch to {ACTIVE_CHAIN.name}
      </button>
    );
  }

  return (
    <span className="flex items-center gap-2">
      <span className="chip hidden border border-[var(--border)] text-[var(--muted)] md:inline-flex">
        {usdc.toFixed(2)} aUSDC
      </span>
      <span className="chip border border-[rgba(45,212,191,0.35)] bg-[rgba(45,212,191,0.06)] font-mono text-[var(--teal-glow)]">
        {account.slice(0, 6)}…{account.slice(-4)}
      </span>
    </span>
  );
}
