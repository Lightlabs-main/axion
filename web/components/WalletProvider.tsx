"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Address } from "viem";
import {
  connectWallet,
  ensureChain,
  getChainId,
  getConnectedAccount,
  getUsdcBalance,
  hasInjectedWallet,
} from "@/lib/contractClient";
import { CHAIN_ID, isOnchainConfigured } from "@/lib/config";

interface WalletState {
  account: Address | null;
  chainId: number | null;
  usdc: number;
  connecting: boolean;
  error: string | null;
  hasWallet: boolean;
  configured: boolean;
  wrongChain: boolean;
  connect: () => Promise<void>;
  switchNetwork: () => Promise<void>;
  refresh: () => Promise<void>;
}

const WalletContext = createContext<WalletState | null>(null);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [account, setAccount] = useState<Address | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [usdc, setUsdc] = useState(0);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const configured = isOnchainConfigured();
  const hasWallet = hasInjectedWallet();

  const refresh = useCallback(async () => {
    const acc = await getConnectedAccount();
    setAccount(acc);
    if (!acc) {
      setUsdc(0);
      setChainId(await getChainId());
      return;
    }
    const [cid, bal] = await Promise.all([getChainId(), getUsdcBalance(acc)]);
    setChainId(cid);
    setUsdc(bal);
  }, []);

  // Restore an already-authorised connection on load + subscribe to changes.
  useEffect(() => {
    refresh();
    const eth = typeof window !== "undefined" ? window.ethereum : undefined;
    if (!eth?.on) return;
    const onAccounts = () => refresh();
    const onChain = () => refresh();
    eth.on("accountsChanged", onAccounts);
    eth.on("chainChanged", onChain);
    return () => {
      eth.removeListener?.("accountsChanged", onAccounts);
      eth.removeListener?.("chainChanged", onChain);
    };
  }, [refresh]);

  const connect = useCallback(async () => {
    setError(null);
    setConnecting(true);
    try {
      const acc = await connectWallet();
      if (!acc) throw new Error("No account returned from wallet.");
      await refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(/user rejected|denied/i.test(msg) ? "Connection rejected." : msg);
    } finally {
      setConnecting(false);
    }
  }, [refresh]);

  const switchNetwork = useCallback(async () => {
    setError(null);
    try {
      await ensureChain();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [refresh]);

  const value = useMemo<WalletState>(
    () => ({
      account,
      chainId,
      usdc,
      connecting,
      error,
      hasWallet,
      configured,
      wrongChain: account !== null && chainId !== null && chainId !== CHAIN_ID,
      connect,
      switchNetwork,
      refresh,
    }),
    [account, chainId, usdc, connecting, error, hasWallet, configured, connect, switchNetwork, refresh]
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletState {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within WalletProvider");
  return ctx;
}
