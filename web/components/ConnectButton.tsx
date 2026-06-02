"use client";

import { useState } from "react";
import { useWallet } from "./WalletProvider";
import { ACTIVE_CHAIN } from "@/lib/config";

export function ConnectButton() {
  const {
    account,
    connecting,
    hasWallet,
    configured,
    wrongChain,
    error,
    connect,
    switchNetwork,
    usdc,
  } = useWallet();
  const [switching, setSwitching] = useState(false);

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
      <span className="flex flex-col items-end">
        <button onClick={connect} disabled={connecting} className="btn btn-primary">
          {connecting ? "Connecting…" : "Connect wallet"}
        </button>
        {error && <span className="mt-1 max-w-[220px] text-right text-[10px] text-[var(--rose)]">{error}</span>}
      </span>
    );
  }

  if (wrongChain) {
    return (
      <span className="flex flex-col items-end">
        <button
          onClick={async () => {
            setSwitching(true);
            try {
              await switchNetwork();
            } finally {
              setSwitching(false);
            }
          }}
          disabled={switching}
          className="btn btn-primary"
        >
          {switching ? "Switching…" : `Switch to ${ACTIVE_CHAIN.name}`}
        </button>
        {error && (
          <span className="mt-1 max-w-[260px] text-right text-[10px] text-[var(--rose)]">{error}</span>
        )}
      </span>
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
